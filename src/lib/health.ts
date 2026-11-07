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
      message: `Seu relógio registrou ${irregularCount} episódios de ritmo cardíaco irregular nos últimos 14 dias. O padrão pode indicar fibrilação atrial.`,
      recommendation:
        "Marque um cardiologista nos próximos dias e leve este histórico. Se sentir dor no peito, falta de ar forte, desmaio ou fraqueza de um lado do corpo, vá ao pronto-socorro ou ligue 192.",
      specialty: "Cardiologia",
      evidence: irregular.map((d) => `${formatDate(d.date)}: ${d.irregularRhythmEvents} episódio(s)`),
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
      message: `Em ${apneaNights.length} das últimas 30 noites a oxigenação caiu abaixo de 90% (mínima de ${minSpo2}%) junto com muitos distúrbios respiratórios.`,
      recommendation: "Converse com um médico do sono ou pneumologista. O exame que confirma ou descarta apneia é a polissonografia.",
      specialty: "Medicina do sono",
      evidence: [
        `Noites com SpO2 < 90%: ${apneaNights.length}`,
        `Distúrbios respiratórios nessas noites: média de ${Math.round(avg(apneaNights.map((d) => d.breathingDisturbances)))}/h`,
      ],
    });
  }

  // 3. Pressão arterial
  if (last30.length >= 14) {
    const sys = Math.round(avg(last30.map((d) => d.systolic)));
    const dia = Math.round(avg(last30.map((d) => d.diastolic)));
    const onMed = db.medications.some((m) => !m.endDate && /losartana|enalapril|anlodipino|hidroclorotiazida|valsartana/i.test(m.name));
    if (sys >= 130 || dia >= 80) {
      const high = sys >= 140 || dia >= 90;
      alerts.push({
        id: "pressao",
        kind: "pressao",
        severity: high ? "procure_medico" : "atencao",
        title: "Pressão acima da meta",
        message: `Média de ${sys}/${dia} mmHg nos últimos 30 dias${onMed ? ", mesmo com remédio para pressão em uso" : ""}. A meta usual é abaixo de 130/80.`,
        recommendation: onMed
          ? "Leve estas medidas ao médico que acompanha sua pressão: pode ser preciso ajustar o tratamento."
          : "Agende uma consulta para avaliar a pressão.",
        specialty: "Clínica médica ou cardiologia",
        evidence: [`${last30.length} medições diárias`, `Média: ${sys}/${dia} mmHg`],
      });
    }
  }

  // 4. Frequência cardíaca de repouso subindo
  const last7 = lastDays(days, 7, today);
  const baseline = days.filter((d) => {
    const ago = daysBetween(d.date, today);
    return ago >= 14 && ago < 60;
  });
  if (last7.length >= 5 && baseline.length >= 20) {
    const now = avg(last7.map((d) => d.restingHr));
    const base = avg(baseline.map((d) => d.restingHr));
    if (now - base >= 5) {
      alerts.push({
        id: "fc_repouso",
        kind: "fc_repouso",
        severity: "atencao",
        title: "Frequência de repouso mais alta",
        message: `Sua frequência cardíaca de repouso está em ${Math.round(now)} bpm na última semana, contra ${Math.round(base)} bpm no seu padrão anterior.`,
        recommendation: "Pode ser estresse, sono ruim, infecção ou outro motivo. Se continuar ou vier com sintomas, comente com seu médico.",
        evidence: [`Últimos 7 dias: ${Math.round(now)} bpm`, `Padrão (2 a 8 semanas atrás): ${Math.round(base)} bpm`],
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
      title: "Exames fora da faixa de referência",
      message: `${recentOut.length === 1 ? "Um resultado do último ano está" : `${recentOut.length} resultados do último ano estão`} fora da faixa indicada no laudo.`,
      recommendation: "Leve estes resultados à sua próxima consulta. Valores fora da faixa nem sempre são um problema, e quem interpreta é o médico.",
      evidence: recentOut.map((s) => `${s.name}: ${fmt(s.latest.value!)} ${s.unit} (${s.status}, ref. ${formatRef(s.latest)})`),
    });
  }

  const sev = { procure_medico: 0, atencao: 1 } as const;
  return alerts.sort((a, b) => sev[a.severity] - sev[b.severity]);
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
  return meds.filter((m) => re.test(m.name)).map((m) => ({ date: m.startDate, label: `Início ${m.name}` }));
}
