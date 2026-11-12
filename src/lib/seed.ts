import { analyteInfo } from "./analytes";
import { addDays, todayISO } from "./dates";
import type { Db, LabResult, SourceDocument, WearableDay } from "./types";

/**
 * Dados 100% sintéticos do paciente de demonstração. Nenhum dado real.
 * A história: homem de 58 anos com LDL subindo (estatina desde 2021),
 * pressão alta (losartana desde 2023), glicemia caminhando para pré-diabetes
 * e, nos wearables, sinais de apneia do sono e pressão acima da meta.
 */

/** PRNG determinístico (mulberry32) para a demo ser reprodutível. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Panel = { date: string; lab: string; values: Record<string, number> };

const LAB_HISTORY: Panel[] = [
  { date: "2017-06-20", lab: "Clínica São Lucas", values: { glicose: 92, colesterol_total: 200, ldl: 128, hdl: 45, triglicerides: 140, creatinina: 1.0, hemoglobina: 15.2, tsh: 2.1 } },
  { date: "2018-07-02", lab: "Clínica São Lucas", values: { glicose: 95, colesterol_total: 208, ldl: 135, hdl: 44, triglicerides: 150, creatinina: 1.0, hemoglobina: 15.0 } },
  { date: "2019-08-14", lab: "LabNorte Análises", values: { glicose: 97, hba1c: 5.5, colesterol_total: 215, ldl: 142, hdl: 43, triglicerides: 162, creatinina: 1.05, tsh: 1.9, tgo: 24, tgp: 29 } },
  { date: "2021-03-30", lab: "Laboratório Vida Diagnósticos", values: { glicose: 101, hba1c: 5.7, colesterol_total: 230, ldl: 156, hdl: 41, triglicerides: 178, creatinina: 1.08, hemoglobina: 15.1 } },
  { date: "2022-04-11", lab: "Laboratório Vida Diagnósticos", values: { glicose: 104, hba1c: 5.8, colesterol_total: 190, ldl: 118, hdl: 42, triglicerides: 160, creatinina: 1.1, vitamina_d: 24, tgo: 27, tgp: 33 } },
  { date: "2023-03-02", lab: "Laboratório Vida Diagnósticos", values: { glicose: 108, hba1c: 5.9, colesterol_total: 182, ldl: 112, hdl: 43, triglicerides: 155, creatinina: 1.1, potassio: 4.4, vitamina_d: 31, tsh: 2.4 } },
  { date: "2025-05-19", lab: "LabNorte Análises", values: { glicose: 112, hba1c: 6.0, colesterol_total: 192, ldl: 121, hdl: 42, triglicerides: 170, creatinina: 1.12, potassio: 4.6, vitamina_d: 28, psa: 1.4 } },
];

function seedLabs(): { documents: SourceDocument[]; labResults: LabResult[] } {
  const documents: SourceDocument[] = [];
  const labResults: LabResult[] = [];
  LAB_HISTORY.forEach((panel, i) => {
    const docId = `seed-doc-${i + 1}`;
    documents.push({
      id: docId,
      filename: `Laudo ${panel.lab} ${panel.date}.pdf`,
      mimeType: "application/pdf",
      uploadedAt: panel.date + "T12:00:00.000Z",
      examDate: panel.date,
      lab: panel.lab,
      extractedBy: "seed",
    });
    for (const [key, value] of Object.entries(panel.values)) {
      const info = analyteInfo(key)!;
      labResults.push({
        id: `${docId}-${key}`,
        documentId: docId,
        analyteKey: key,
        name: info.name,
        value,
        unit: info.unit,
        refLow: info.refLow ?? null,
        refHigh: info.refHigh ?? null,
        date: panel.date,
        lab: panel.lab,
      });
    }
  });
  return { documents, labResults };
}

function seedWearables(today: string): WearableDay[] {
  const r = rng(20261114);
  const noise = (amp: number) => (r() * 2 - 1) * amp;
  const days: WearableDay[] = [];
  const total = 90;
  for (let i = total - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const recent14 = i < 14;
    const recent30 = i < 30;
    // Nas últimas 4 semanas, cerca de 40% das noites têm dessaturação.
    const apneaNight = recent30 && r() < 0.42;
    days.push({
      date,
      restingHr: Math.round((recent14 ? 70 : 64) + noise(2.5)),
      hrvMs: Math.round((recent14 ? 30 : 38) + noise(5)),
      sleepHours: Math.round((6.4 + noise(0.8)) * 10) / 10,
      spo2Min: apneaNight ? Math.round(86 + r() * 3) : Math.round(92 + r() * 3),
      breathingDisturbances: Math.round(apneaNight ? 15 + r() * 8 : 3 + r() * 6),
      steps: Math.round(6200 + noise(2400)),
      // Um episódio isolado há ~40 dias: sozinho, não gera alerta.
      irregularRhythmEvents: i === 41 ? 1 : 0,
      systolic: Math.round(134 + noise(6)),
      diastolic: Math.round(86 + noise(4)),
    });
  }
  return days;
}

export function createSeedDb(now = new Date()): Db {
  const today = todayISO(now);
  const { documents, labResults } = seedLabs();
  return {
    version: 1,
    createdAt: now.toISOString(),
    patient: {
      id: "paciente-demo",
      name: "Carlos Mendes",
      birthDate: "1968-03-14",
      sex: "M",
      bloodType: "O+",
      allergies: ["Dipirona"],
    },
    documents,
    labResults,
    encounters: [
      { id: "enc-1", date: "2017-06-28", specialty: "Clínica médica", professional: "Dra. Helena Prado", place: "Clínica São Lucas", reason: "Check-up anual", notes: "Exames sem alterações relevantes. Orientado sobre atividade física." },
      { id: "enc-2", date: "2021-04-15", specialty: "Cardiologia", professional: "Dr. Rafael Costa", place: "Hospital Santa Clara", reason: "LDL elevado e histórico familiar de infarto (pai, 61 anos)", notes: "Iniciada atorvastatina 20 mg." },
      { id: "enc-3", date: "2023-03-10", specialty: "Clínica médica", professional: "Dra. Helena Prado", place: "Clínica São Lucas", reason: "Pressão 142/92 mmHg em duas medidas", notes: "Diagnóstico de hipertensão estágio 1. Iniciada losartana 50 mg." },
      { id: "enc-4", date: "2025-06-02", specialty: "Endocrinologia", professional: "Dra. Marina Lopes", place: "Centro Médico Paulista", reason: "Glicemia de jejum 112 e HbA1c 6,0%", notes: "Pré-diabetes. Plano de dieta e meta de 150 min/semana de exercício." },
      { id: "enc-5", date: "2026-02-21", specialty: "Pronto-atendimento", professional: "Plantão", place: "Hospital Santa Clara", reason: "Palpitações após café", notes: "ECG em ritmo sinusal no momento do atendimento. Alta com orientação." },
    ],
    medications: [
      { id: "med-1", name: "Atorvastatina", dose: "20 mg", frequency: "1x ao dia, à noite", startDate: "2021-04-15", endDate: null, reason: "Colesterol LDL elevado" },
      { id: "med-2", name: "Losartana", dose: "50 mg", frequency: "1x ao dia", startDate: "2023-03-10", endDate: null, reason: "Hipertensão" },
      { id: "med-3", name: "Omeprazol", dose: "20 mg", frequency: "1x ao dia, em jejum", startDate: "2019-08-01", endDate: "2019-11-01", reason: "Gastrite" },
    ],
    vaccines: [
      { id: "vac-1", name: "Hepatite B", date: "2018-02-10", dose: "3 doses (esquema completo)" },
      { id: "vac-2", name: "dT (difteria e tétano)", date: "2020-08-05", dose: "Reforço" },
      { id: "vac-3", name: "Influenza", date: "2024-04-18", dose: "Anual" },
      { id: "vac-4", name: "COVID-19", date: "2024-10-09", dose: "Reforço" },
      { id: "vac-5", name: "Influenza", date: "2025-04-22", dose: "Anual" },
      { id: "vac-6", name: "Herpes-zóster (recombinante)", date: "2025-09-12", dose: "1ª dose" },
      { id: "vac-7", name: "Influenza", date: "2026-04-15", dose: "Anual" },
    ],
    wearableDays: seedWearables(today),
    devices: [
      { id: "dev-relogio", name: "Relógio inteligente (simulado)", kind: "relogio", metrics: ["Frequência cardíaca", "Variabilidade (VFC)", "Ritmo irregular", "Sono", "SpO2", "Passos"], connectedAt: addDays(today, -90) + "T09:00:00.000Z" },
      { id: "dev-pressao", name: "Medidor de pressão Bluetooth (simulado)", kind: "medidor_pressao", metrics: ["Pressão arterial"], connectedAt: addDays(today, -90) + "T09:05:00.000Z" },
    ],
    shares: [],
    admissions: [],
    checkins: [],
    readingStats: {},
    fhirExports: 0,
  };
}

/** Mantém a série dos wearables terminando em "hoje", mesmo dias depois do seed. */
export function extendWearablesToToday(db: Db, now = new Date()): boolean {
  const today = todayISO(now);
  const last = db.wearableDays.at(-1)?.date;
  if (!last || last >= today) return false;
  const fresh = seedWearables(today);
  const byDate = new Map(db.wearableDays.map((d) => [d.date, d]));
  for (const d of fresh) if (!byDate.has(d.date) && d.date > last) byDate.set(d.date, { ...d, irregularRhythmEvents: 0 });
  db.wearableDays = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-120);
  return true;
}
