import { followUp, hasRedFlag, recentCheckIn } from "./admission";
import { analyteInfo } from "./analytes";
import { addDays, daysBetween, formatDate, todayISO } from "./dates";
import type { Db, HealthAlert, LabResult, WearableDay, WearableMetric } from "./types";

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

/** Valores medidos de um sinal (ignora dias sem medição; pressão 0 = sem medidor). */
export function measured(days: WearableDay[], key: WearableMetric): number[] {
  const bp = key === "systolic" || key === "diastolic";
  return days.flatMap((d) => {
    const v = d[key];
    return v == null || !Number.isFinite(v) || (bp && v <= 0) ? [] : [v];
  });
}

const val = (v: number | null | undefined) => v ?? 0;

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
  const irregular = last14.filter((d) => val(d.irregularRhythmEvents) > 0);
  const irregularCount = irregular.reduce((s, d) => s + val(d.irregularRhythmEvents), 0);
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
      clinical: `${irregularCount} episódios de ritmo irregular notificados pelo relógio em 14 dias (${irregular.length} ${irregular.length === 1 ? "dia" : "dias"}). Padrão compatível com possível fibrilação atrial; registro de dispositivo de consumo, sem ECG.`,
      clinicalNote: "ECG de 12 derivações e, se indicado, Holter de 24 h.",
    });
  }

  // 2. Sinais de apneia do sono
  const last30 = lastDays(days, 30, today);
  // Só noites em que os dois sinais foram medidos: ausência nunca conta como saturação baixa
  const apneaNights = last30.filter((d) => d.spo2Min != null && d.breathingDisturbances != null && d.spo2Min < 90 && d.breathingDisturbances >= 15);
  if (apneaNights.length >= 6) {
    const minSpo2 = Math.min(...measured(apneaNights, "spo2Min"));
    alerts.push({
      id: "apneia",
      kind: "apneia",
      severity: "procure_medico",
      title: "Sinais de apneia do sono",
      message: `Em ${apneaNights.length} das últimas 30 noites, a saturação de oxigênio ficou abaixo de 90% (menor valor: ${minSpo2}%), com muitas pausas na respiração.`,
      recommendation: "Procure um pneumologista ou um médico do sono. O exame que confirma ou descarta apneia é a polissonografia.",
      specialty: "Medicina do sono",
      clinical: `SpO2 mínima noturna abaixo de 90% em ${apneaNights.length} de 30 noites (menor valor ${minSpo2}%), com média de ${Math.round(avg(measured(apneaNights, "breathingDisturbances")))} distúrbios respiratórios por hora nessas noites. Sugere distúrbio respiratório do sono.`,
      clinicalNote: "Polissonografia.",
      evidence: [
        `Noites com saturação abaixo de 90%: ${apneaNights.length}`,
        `Pausas na respiração nessas noites: média de ${Math.round(avg(measured(apneaNights, "breathingDisturbances")))} por hora`,
      ],
    });
  }

  // 3. Pressão arterial (só se houver medidor: dias sem medição têm pressão 0)
  const bp30 = last30.filter((d) => val(d.systolic) > 0 && val(d.diastolic) > 0);
  if (bp30.length >= 14) {
    const sys = Math.round(avg(measured(bp30, "systolic")));
    const dia = Math.round(avg(measured(bp30, "diastolic")));
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
        clinical: `PA domiciliar média de ${sys}/${dia} mmHg em ${bp30.length} medições nos últimos 30 dias${onMed ? ", em uso de anti-hipertensivo" : ", sem anti-hipertensivo registrado"}. Acima da meta de 130/80 mmHg.`,
        clinicalNote: onMed ? "Avaliar adesão e esquema terapêutico; MAPA se houver dúvida." : "Confirmar com MAPA ou MRPA.",
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
        clinical: `FC de repouso média de ${Math.round(now)} bpm na última semana, contra ${Math.round(base)} bpm de 2 a 8 semanas antes (+${Math.round(now - base)} bpm).`,
        clinicalNote: "Correlacionar com sintomas, sono, infecção e função tireoidiana.",
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
      clinical: `${recentOut.length === 1 ? "Um resultado" : `${recentOut.length} resultados`} dos últimos 12 meses fora da faixa de referência do laudo: ${recentOut.map((x) => x.name).join(", ")}.`,
      evidence: recentOut.map((s) => `${s.name}: ${fmt(s.latest.value!)} ${s.unit} (${s.status}; referência ${formatRef(s.latest)})`),
    });
  }

  alerts.push(...crossInsights(db, alerts, today));

  // 6. Pós-alta (apêndice C): sintomas do check-in diário
  const fu = followUp(db, today);
  const ci = fu?.active ? recentCheckIn(fu, today) : undefined;
  if (fu && ci && ci.symptoms.length) {
    const red = hasRedFlag(ci);
    alerts.push({
      id: `pos_alta-${ci.id}`,
      kind: "pos_alta",
      severity: red ? "procure_medico" : "atencao",
      title: red ? "Sintoma de alerta depois da alta" : "Sintoma no pós-alta",
      message: `No registro de ${formatDate(ci.at.slice(0, 10))}, dia ${fu.day} depois da alta, você marcou: ${ci.symptoms.join(", ").toLowerCase()}.`,
      recommendation: red
        ? `Se a falta de ar ou a dor no peito forem fortes ou estiverem piorando, vá ao pronto-socorro ou ligue 192 agora. Se forem leves, ligue hoje para a ${fu.discharge.teamContact.charAt(0).toLowerCase() + fu.discharge.teamContact.slice(1)}.`
        : `Fale com a ${fu.discharge.teamContact.charAt(0).toLowerCase() + fu.discharge.teamContact.slice(1)} se o sintoma continuar amanhã.`,
      specialty: fu.admission.hospital,
      clinical: `Registro do paciente no dia ${fu.day} pós-alta (${fu.admission.procedure}): ${ci.symptoms.join(", ").toLowerCase()}${ci.tookMeds ? "" : "; não tomou os remédios no dia"}.`,
      clinicalNote: red ? "Sintoma de alerta relatado: contato com o paciente hoje." : undefined,
      evidence: [`Internação: ${fu.admission.procedure}`, `Alta em ${formatDate(fu.discharge.date)}`, ci.tookMeds ? "Tomou os remédios" : "Não tomou os remédios no dia"],
    });
  }

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
  const now = measured(last7, "restingHr");
  const base = measured(baseline, "restingHr");
  if (now.length < 5 || base.length < 20) return null;
  return { now: avg(now), base: avg(base) };
}

/** Há medidor de pressão nesta série? (dias sem medição guardam pressão 0) */
export function hasBloodPressure(days: WearableDay[]): boolean {
  return measured(days, "systolic").length > 0;
}

/** O sinal foi medido em algum dia da série? */
export function hasMetric(days: WearableDay[], key: WearableMetric): boolean {
  return measured(days, key).length > 0;
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
        clinical: `FC de repouso em elevação no relógio (${Math.round(hr.base)} → ${Math.round(hr.now)} bpm) e ${lab.name} ${dir} da referência (${fmt(lab.value!)} ${lab.unit} em ${formatDate(lab.date)}).`,
        clinicalNote: thyroid ? "Avaliação de função tireoidiana." : "Avaliação de anemia.",
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
        clinical: `Ritmo irregular notificado pelo relógio nos últimos 14 dias e ${lab.name} ${dir} da referência (${fmt(lab.value!)} ${lab.unit} em ${formatDate(lab.date)}).`,
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
      clinical: `Dessaturação noturna com distúrbios respiratórios no relógio e PA domiciliar acima da meta${/remédio/.test(bp.message) ? " em uso de anti-hipertensivo" : ""}.`,
      clinicalNote: "Distúrbio respiratório do sono como possível fator na hipertensão.",
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

/**
 * Médias da última semana com dados. Se a série termina antes de hoje (um
 * arquivo exportado há alguns dias), a semana termina no último dia medido.
 * null = sinal não medido nesse período.
 */
export function wearableSnapshot(days: WearableDay[], today = todayISO()) {
  const lastDate = days.at(-1)?.date;
  const ref = lastDate && lastDate < today ? lastDate : today;
  const last7 = lastDays(days, 7, ref);
  const mean = (k: WearableMetric, digits = 0) => {
    const xs = measured(last7, k);
    if (!xs.length) return null;
    const f = 10 ** digits;
    return Math.round(avg(xs) * f) / f;
  };
  const spo2 = measured(last7, "spo2Min");
  return {
    restingHr: mean("restingHr"),
    hrvMs: mean("hrvMs"),
    sleepHours: mean("sleepHours", 1),
    spo2Min: spo2.length ? Math.min(...spo2) : null,
    steps: mean("steps"),
    systolic: mean("systolic"),
    diastolic: mean("diastolic"),
    /** Último dia da janela (para dizer "até 10/11" quando os dados não chegam a hoje). */
    until: ref,
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
