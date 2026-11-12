import { analyteInfo } from "./analytes";
import { addDays, daysBetween, formatDate, todayISO } from "./dates";
import type { Db, HealthAlert, LabResult, WearableDay } from "./types";

export type LabStatus = "baixo" | "normal" | "alto" | "sem_faixa";

export function labStatus(r: Pick<LabResult, "value" | "refLow" | "refHigh">): LabStatus {
  if (r.value == null) return "sem_faixa";
  if (r.refLow == null && r.refHigh == null) return "sem_faixa";
  if (r.refLow != null && r.value < r.refLow) return "baixo";
  if (r.refHigh != null && r.value > r.refHigh) return "alto";
  return "normal";
}

export function formatRef(r: Pick<LabResult, "refLow" | "refHigh" | "refText">): string {
  if (r.refLow != null && r.refHigh != null) return `${fmt(r.refLow)} – ${fmt(r.refHigh)}`;
  if (r.refHigh != null) return `até ${fmt(r.refHigh)}`;
  if (r.refLow != null) return `acima de ${fmt(r.refLow)}`;
  return r.refText ?? "—";
}

export function fmt(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export interface AnalyteSeries {
  key: string;
  name: string;
  unit: string;
  category: string;
  results: LabResult[];
  latest: LabResult;
  previous?: LabResult;
  status: LabStatus;
}

export function analyteSeries(labs: LabResult[]): AnalyteSeries[] {
  const groups = new Map<string, LabResult[]>();
  for (const r of labs) {
    const list = groups.get(r.analyteKey) ?? [];
    list.push(r);
    groups.set(r.analyteKey, list);
  }
  const series: AnalyteSeries[] = [];
  for (const [key, results] of groups) {
    results.sort((a, b) => a.date.localeCompare(b.date));
    const latest = results.at(-1)!;
    const info = analyteInfo(key);
    series.push({
      key,
      name: info?.name ?? latest.name,
      unit: latest.unit || info?.unit || "",
      category: info?.category ?? "Outros",
      results,
      latest,
      previous: results.at(-2),
      status: labStatus(latest),
    });
  }
  const order = { alto: 0, baixo: 0, normal: 1, sem_faixa: 2 } as const;
  return series.sort((a, b) => order[a.status] - order[b.status] || b.latest.date.localeCompare(a.latest.date));
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

function lastDays(days: WearableDay[], n: number, today = todayISO()): WearableDay[] {
  const from = addDays(today, -(n - 1));
  return days.filter((d) => d.date >= from && d.date <= today);
}

/**
 * Regras simples e explicáveis. Não são diagnóstico: indicam quando vale
 * procurar um médico, no espírito das notificações dos relógios aprovadas
 * pela FDA (ritmo irregular, apneia, hipertensão).
 */
export function computeAlerts(db: Db, today = todayISO()): HealthAlert[] {
  const alerts: HealthAlert[] = [];
  const days = db.wearableDays;

  // 1. Ritmo irregular (possível fibrilação atrial)
  const last14 = lastDays(days, 14, today);
  const irregular = last14.filter((d) => d.irregularRhythmEvents > 0);
  const irregularCount = irregular.reduce((s, d) => s + d.irregularRhythmEvents, 0);
  if (irregularCount >= 2) {
    alerts.push({
      id: "ritmo_irregular",
      kind: "ritmo_irregular",
      severity: "procure_medico",
      title: "Ritmo cardíaco irregular",
      message: `O relógio registrou ${irregularCount} episódios de batimento irregular nos últimos 14 dias. Esse padrão pode ser sinal de fibrilação atrial.`,
      recommendation:
        "Marque consulta com um cardiologista nos próximos dias. Se tiver dor no peito, falta de ar forte, desmaio ou fraqueza de um lado do corpo, vá ao pronto-socorro ou ligue 192.",
      specialty: "Cardiologia",
      evidence: irregular.map((d) => `${formatDate(d.date)}: ${d.irregularRhythmEvents} ${d.irregularRhythmEvents === 1 ? "episódio" : "episódios"}`),
    });
  }

  // 2. Sinais de apneia do sono
  const last30 = lastDays(days, 30, today);
  const apneaNights = last30.filter((d) => d.spo2Min < 90 && d.breathingDisturbances >= 15);
  if (apneaNights.length >= 6) {
    const minSpo2 = Math.min(...apneaNights.map((d) => d.spo2Min));
    alerts.push({
      id: "apneia",
      kind: "apneia",
      severity: "procure_medico",
      title: "Sinais de apneia do sono",
      message: `Em ${apneaNights.length} das últimas 30 noites, a saturação de oxigênio ficou abaixo de 90% (menor valor: ${minSpo2}%), com muitas pausas na respiração.`,
      recommendation: "Procure um pneumologista ou um médico do sono. O exame que confirma ou descarta apneia é a polissonografia.",
      specialty: "Medicina do sono",
      evidence: [
        `Noites com saturação abaixo de 90%: ${apneaNights.length}`,
        `Pausas na respiração nessas noites: média de ${Math.round(avg(apneaNights.map((d) => d.breathingDisturbances)))} por hora`,
      ],
    });
  }

  // 3. Pressão arterial (só se houver medidor: dias sem medição têm pressão 0)
  const bp30 = last30.filter((d) => d.systolic > 0);
  if (bp30.length >= 14) {
    const sys = Math.round(avg(bp30.map((d) => d.systolic)));
    const dia = Math.round(avg(bp30.map((d) => d.diastolic)));
    const onMed = db.medications.some((m) => !m.endDate && /losartana|enalapril|anlodipino|hidroclorotiazida|valsartana/i.test(m.name));
    if (sys >= 130 || dia >= 80) {
      const high = sys >= 140 || dia >= 90;
      alerts.push({
        id: "pressao",
        kind: "pressao",
        severity: high ? "procure_medico" : "atencao",
        title: "Pressão acima da meta",
        message: `Sua pressão ficou em média ${sys}/${dia} mmHg nos últimos 30 dias${onMed ? ", mesmo tomando remédio para pressão" : ""}. A meta costuma ser abaixo de 130/80.`,
        recommendation: onMed
          ? "Mostre estas medidas ao médico que trata sua pressão. Pode ser preciso ajustar o remédio."
          : "Marque uma consulta para avaliar a pressão.",
        specialty: "Clínica médica ou cardiologia",
        evidence: [`${bp30.length} medições em 30 dias`, `Média: ${sys}/${dia} mmHg`],
      });
    }
  }

  // 4. Frequência cardíaca de repouso subindo
  const hrTrend = restingHrTrend(days, today);
  if (hrTrend) {
    const { now, base } = hrTrend;
    if (now - base >= 5) {
      alerts.push({
        id: "fc_repouso",
        kind: "fc_repouso",
        severity: "atencao",
        title: "Batimentos em repouso mais altos",
        message: `Na última semana, seus batimentos em repouso ficaram em ${Math.round(now)} bpm. Antes, o normal para você era ${Math.round(base)} bpm.`,
        recommendation: "Estresse, noites mal dormidas ou uma infecção podem causar isso. Se continuar ou vier com outros sintomas, fale com seu médico.",
        evidence: [`Últimos 7 dias: ${Math.round(now)} bpm`, `De 2 a 8 semanas atrás: ${Math.round(base)} bpm`],
      });
    }
  }

  // 5. Exames recentes fora da faixa do laudo
  const recentOut = analyteSeries(db.labResults).filter(
    (s) => (s.status === "alto" || s.status === "baixo") && daysBetween(s.latest.date, today) <= 365,
  );
  if (recentOut.length) {
    alerts.push({
      id: "exames",
      kind: "exames",
      severity: "atencao",
      title: "Exames alterados no último ano",
      message: `${recentOut.length === 1 ? "Um resultado do último ano está" : `${recentOut.length} resultados do último ano estão`} fora do valor de referência do laudo.`,
      recommendation: "Leve estes resultados à próxima consulta. Um valor fora da referência nem sempre é problema; quem interpreta é o médico.",
      evidence: recentOut.map((s) => `${s.name}: ${fmt(s.latest.value!)} ${s.unit} (${s.status}; referência ${formatRef(s.latest)})`),
    });
  }

  alerts.push(...crossInsights(db, alerts, today));

  const sev = { procure_medico: 0, atencao: 1 } as const;
  return alerts.sort((a, b) => sev[a.severity] - sev[b.severity]);
}

/** Média de FC de repouso da última semana contra a de 2 a 8 semanas atrás. */
export function restingHrTrend(days: WearableDay[], today = todayISO()): { now: number; base: number } | null {
  const last7 = lastDays(days, 7, today);
  const baseline = days.filter((d) => {
    const ago = daysBetween(d.date, today);
    return ago >= 14 && ago < 60;
  });
  if (last7.length < 5 || baseline.length < 20) return null;
  return { now: avg(last7.map((d) => d.restingHr)), base: avg(baseline.map((d) => d.restingHr)) };
}

/** Há medidor de pressão nesta série? (dias sem medição guardam pressão 0) */
export function hasBloodPressure(days: WearableDay[]): boolean {
  return days.some((d) => d.systolic > 0);
}

/**
 * "Juntando seus dados": conecta um sinal dos wearables com um exame (ou dois
 * sinais) que costumam ser avaliados juntos. Regras fixas e explicáveis, sem IA,
 * para funcionarem sempre na demonstração. Nunca dizem o que a pessoa tem:
 * só mostram os dois fatos lado a lado e orientam levar ao médico.
 */
function crossInsights(db: Db, alerts: HealthAlert[], today: string): HealthAlert[] {
  const active = new Set(alerts.map((a) => a.kind));
  const latestOut = (key: string, dir: "alto" | "baixo") => {
    const r = db.labResults
      .filter((x) => x.analyteKey === key && x.value != null)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    return r && labStatus(r) === dir && daysBetween(r.date, today) <= 365 ? r : null;
  };
  const labFact = (r: LabResult, dir: string) =>
    `seu último ${r.name} (${formatDate(r.date)}) estava ${dir} da referência do laudo: ${fmt(r.value!)} ${r.unit}`;
  const examLink = (r: LabResult) => ({ label: `Ver ${r.name}`, href: `/exame/?a=${encodeURIComponent(r.analyteKey)}` });
  const signals = { label: "Ver sinais do relógio", href: "/wearables" };
  const out: HealthAlert[] = [];

  const hr = restingHrTrend(db.wearableDays, today);
  if (active.has("fc_repouso") && hr) {
    const hrFact = `seus batimentos em repouso subiram de ${Math.round(hr.base)} para ${Math.round(hr.now)} bpm nas últimas semanas`;
    const thyroid = latestOut("tsh", "baixo") ?? latestOut("t4_livre", "alto");
    const anemia = latestOut("hemoglobina", "baixo");
    const lab = thyroid ?? anemia;
    if (lab) {
      const dir = labStatus(lab) === "baixo" ? "abaixo" : "acima";
      out.push({
        id: `cruzado-fc-${lab.analyteKey}`,
        kind: "cruzado",
        severity: "atencao",
        title: thyroid ? "Batimentos em repouso e exame da tireoide" : "Batimentos em repouso e hemoglobina",
        message: `Separados, cada dado pode passar despercebido. Juntos: ${hrFact}, e ${labFact(lab, dir)}.`,
        recommendation: "Esses dois dados costumam ser avaliados juntos. Leve os dois ao seu médico na próxima consulta, sem esperar o próximo check-up.",
        evidence: [`Relógio: média de ${Math.round(hr.now)} bpm na última semana, contra ${Math.round(hr.base)} bpm de 2 a 8 semanas atrás`, `Exame: ${lab.name} ${fmt(lab.value!)} ${lab.unit} em ${formatDate(lab.date)}${lab.lab ? ` (${lab.lab})` : ""}, referência ${formatRef(lab)}`],
        links: [signals, examLink(lab)],
      });
    }
  }

  if (active.has("ritmo_irregular")) {
    const lab = latestOut("tsh", "baixo") ?? latestOut("potassio", "baixo") ?? latestOut("potassio", "alto");
    if (lab) {
      const dir = labStatus(lab) === "baixo" ? "abaixo" : "acima";
      out.push({
        id: `cruzado-ritmo-${lab.analyteKey}`,
        kind: "cruzado",
        severity: "atencao",
        title: `Ritmo irregular e ${lab.name}`,
        message: `O relógio registrou batimentos irregulares nos últimos 14 dias, e ${labFact(lab, dir)}.`,
        recommendation: "Mostre os dois dados juntos ao cardiologista: o exame ajuda a entender o registro do relógio.",
        evidence: [`Exame: ${lab.name} ${fmt(lab.value!)} ${lab.unit} em ${formatDate(lab.date)}, referência ${formatRef(lab)}`],
        links: [signals, examLink(lab)],
      });
    }
  }

  const bp = alerts.find((a) => a.kind === "pressao");
  if (active.has("apneia") && bp) {
    out.push({
      id: "cruzado-apneia-pressao",
      kind: "cruzado",
      severity: "atencao",
      title: "Sono e pressão arterial",
      message: `O relógio registrou noites com oxigenação baixa e pausas na respiração, e o medidor mostra a pressão acima da meta${/remédio/.test(bp.message) ? " mesmo com remédio" : ""}.`,
      recommendation: "Esses dois achados costumam ser avaliados juntos. Conte os dois ao médico que acompanha sua pressão.",
      evidence: [...(alerts.find((a) => a.kind === "apneia")?.evidence.slice(0, 1) ?? []), ...bp.evidence.slice(1)],
      links: [signals],
    });
  }
  return out;
}

export interface RepeatCheck {
  /** Mesmo laudo (data e laboratório) já está salvo. */
  duplicate: boolean;
  /** Exames que a pessoa já fez há menos de 60 dias antes desta coleta. */
  repeats: { name: string; prevDate: string; days: number }[];
}

/** Compara um laudo novo com o histórico, antes de salvar. */
export function checkRepeats(db: Pick<Db, "labResults" | "documents">, examDate: string, lab: string, analyteKeys: string[]): RepeatCheck {
  const empty = { duplicate: false, repeats: [] };
  if (!examDate || !analyteKeys.length) return empty;
  const keys = new Set(analyteKeys.filter(Boolean));
  const sameLab = (l?: string) => !lab.trim() || !l || l.trim().toLowerCase() === lab.trim().toLowerCase();
  const sameDay = db.labResults.filter((r) => r.date === examDate && keys.has(r.analyteKey) && sameLab(r.lab));
  if (new Set(sameDay.map((r) => r.analyteKey)).size >= Math.max(1, Math.ceil(keys.size / 2))) return { duplicate: true, repeats: [] };

  const repeats: RepeatCheck["repeats"] = [];
  for (const key of keys) {
    const prev = db.labResults
      .filter((r) => r.analyteKey === key && r.date < examDate)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!prev) continue;
    const days = daysBetween(prev.date, examDate);
    if (days > 0 && days < 60) repeats.push({ name: analyteInfo(key)?.name ?? prev.name, prevDate: prev.date, days });
  }
  return { duplicate: false, repeats };
}

export function wearableSnapshot(days: WearableDay[], today = todayISO()) {
  const last7 = lastDays(days, 7, today);
  return {
    restingHr: Math.round(avg(last7.map((d) => d.restingHr))),
    hrvMs: Math.round(avg(last7.map((d) => d.hrvMs))),
    sleepHours: Math.round(avg(last7.map((d) => d.sleepHours)) * 10) / 10,
    spo2Min: Math.min(...last7.map((d) => d.spo2Min)),
    steps: Math.round(avg(last7.map((d) => d.steps))),
    systolic: Math.round(avg(last7.map((d) => d.systolic))),
    diastolic: Math.round(avg(last7.map((d) => d.diastolic))),
  };
}

const MED_RELEVANCE: Record<string, RegExp> = {
  ldl: /atorvastatina|rosuvastatina|sinvastatina|ezetimiba/i,
  colesterol_total: /atorvastatina|rosuvastatina|sinvastatina|ezetimiba/i,
  triglicerides: /atorvastatina|rosuvastatina|sinvastatina|fenofibrato/i,
  glicose: /metformina|insulina|gliclazida|empagliflozina|dapagliflozina/i,
  hba1c: /metformina|insulina|gliclazida|empagliflozina|dapagliflozina/i,
  potassio: /losartana|enalapril|espironolactona|hidroclorotiazida/i,
  creatinina: /losartana|enalapril/i,
};

/** Início de remédios que afetam o analito, para marcar no gráfico. */
export function medicationMarkers(analyteKey: string, meds: Db["medications"]) {
  const re = MED_RELEVANCE[analyteKey];
  if (!re) return [];
  return meds.filter((m) => re.test(m.name)).map((m) => ({ date: m.startDate, label: `${m.name}` }));
}
