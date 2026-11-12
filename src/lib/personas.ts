import { analyteInfo } from "./analytes";
import { addDays, todayISO } from "./dates";
import { createSeedDb, rng, seedWearables } from "./seed";
import type { Db, LabResult, PersonaId, SourceDocument, WearableDay, WearableDevice } from "./types";

/**
 * Outras personas de demonstração, além do Carlos. Todas fictícias, com dados
 * 100% sintéticos. Cada uma testa algo que a história do Carlos não cobre:
 * - Juliana: o insight cruzado (batimentos subindo no anel + TSH baixo de março).
 * - Lúcia: sem relógio nenhum (telas vazias precisam se sustentar) e laudos antigos.
 * - Pedro: jovem e saudável; nenhum alerta pode aparecer (teste de falso alarme).
 */

export const PERSONAS: { id: PersonaId; name: string; resumo: string }[] = [
  { id: "nova", name: "Começar do zero", resumo: "Perfil vazio, com guia de boas-vindas e cadastro" },
  { id: "carlos", name: "Carlos Mendes, 58", resumo: "10 anos de exames, relógio e medidor de pressão, alertas de sono e pressão" },
  { id: "juliana", name: "Juliana Rocha, 34", resumo: "Anel de sono: batimentos subindo + TSH baixo em março (insight cruzado)" },
  { id: "lucia", name: "Lúcia Ferreira, 78", resumo: "Sem relógio, laudos antigos em papel" },
  { id: "pedro", name: "Pedro Lima, 22", resumo: "Saudável, atleta: nenhum alerta deve aparecer" },
];

export function personaName(id: PersonaId | undefined): string {
  return PERSONAS.find((p) => p.id === (id ?? "carlos"))?.name ?? "Carlos Mendes, 58";
}

type Panel = { date: string; lab: string; values: Record<string, number>; refs?: Record<string, [number | null, number | null]> };

function labsFrom(prefix: string, panels: Panel[]): { documents: SourceDocument[]; labResults: LabResult[] } {
  const documents: SourceDocument[] = [];
  const labResults: LabResult[] = [];
  panels.forEach((panel, i) => {
    const docId = `${prefix}-doc-${i + 1}`;
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
      const [lo, hi] = panel.refs?.[key] ?? [info.refLow ?? null, info.refHigh ?? null];
      labResults.push({
        id: `${docId}-${key}`,
        documentId: docId,
        analyteKey: key,
        name: info.name,
        value,
        unit: info.unit,
        refLow: lo,
        refHigh: hi,
        date: panel.date,
        lab: panel.lab,
      });
    }
  });
  return { documents, labResults };
}

/** Faixas femininas impressas nos laudos fictícios. */
const F_REFS: Panel["refs"] = { hemoglobina: [12, 16], creatinina: [0.6, 1.1], tsh: [0.4, 4.0], t4_livre: [0.9, 1.7] };

const round1 = (n: number) => Math.round(n * 10) / 10;

// ---------- Juliana ----------

function julianaWearables(today: string): WearableDay[] {
  const r = rng(34034);
  const noise = (amp: number) => (r() * 2 - 1) * amp;
  const days: WearableDay[] = [];
  for (let i = 89; i >= 0; i--) {
    // Estável até ~11 semanas atrás; depois sobe aos poucos até 75 bpm.
    const t = i >= 75 ? 0 : (75 - i) / 75;
    days.push({
      date: addDays(today, -i),
      restingHr: Math.round(61 + 14.5 * t + noise(1.2)),
      hrvMs: Math.round(48 - 14 * t + noise(4)),
      sleepHours: round1(7.0 - 1.2 * t + noise(0.4)),
      spo2Min: Math.round(93 + r() * 3),
      breathingDisturbances: Math.round(2 + r() * 4),
      steps: Math.round(9000 + noise(1500)),
      irregularRhythmEvents: 0,
      systolic: 0, // sem medidor de pressão
      diastolic: 0,
    });
  }
  return days;
}

function juliana(now: Date): Db {
  const today = todayISO(now);
  const { documents, labResults } = labsFrom("jul", [
    { date: "2024-02-20", lab: "Lab Aurora", refs: F_REFS, values: { tsh: 1.8, t4_livre: 1.2, hemoglobina: 13.2, glicose: 84, colesterol_total: 168, vitamina_b12: 420 } },
    { date: "2025-03-18", lab: "Lab Aurora", refs: F_REFS, values: { tsh: 1.5, t4_livre: 1.3, hemoglobina: 13.4, glicose: 86, colesterol_total: 172, vitamina_d: 34 } },
    { date: "2026-03-12", lab: "Lab Aurora", refs: F_REFS, values: { tsh: 0.2, t4_livre: 1.9, hemoglobina: 13.1, glicose: 88, colesterol_total: 170 } },
  ]);
  return {
    version: 1,
    personaId: "juliana",
    createdAt: now.toISOString(),
    patient: { id: "paciente-juliana", name: "Juliana Rocha", birthDate: "1992-05-20", sex: "F", bloodType: "A+", allergies: [] },
    documents,
    labResults,
    encounters: [
      { id: "jul-enc-1", date: "2024-03-01", specialty: "Clínica médica", professional: "Dr. André Sato", place: "Clínica Paulista", reason: "Check-up anual", notes: "Sem alterações." },
      { id: "jul-enc-2", date: "2025-03-25", specialty: "Ginecologia", professional: "Dra. Beatriz Nunes", place: "Clínica Paulista", reason: "Consulta de rotina", notes: "Mantido anticoncepcional contínuo." },
    ],
    medications: [
      { id: "jul-med-1", name: "Desogestrel", dose: "75 mcg", frequency: "1x ao dia, uso contínuo", startDate: "2019-06-01", endDate: null, reason: "Anticoncepcional" },
    ],
    vaccines: [
      { id: "jul-vac-1", name: "HPV", date: "2015-08-10", dose: "Esquema completo" },
      { id: "jul-vac-2", name: "COVID-19", date: "2024-11-05", dose: "Reforço" },
      { id: "jul-vac-3", name: "Influenza", date: "2026-05-04", dose: "Anual" },
    ],
    wearableDays: julianaWearables(today),
    devices: [
      { id: "dev-anel", name: "Anel inteligente (simulado)", kind: "anel", metrics: ["Frequência cardíaca", "Variabilidade (VFC)", "Sono", "SpO2", "Passos"], connectedAt: addDays(today, -150) + "T08:00:00.000Z" },
    ],
    shares: [],
  };
}

// ---------- Lúcia ----------

function lucia(now: Date): Db {
  const { documents, labResults } = labsFrom("luc", [
    { date: "2019-04-17", lab: "Lab Aurora", refs: F_REFS, values: { hemoglobina: 12.3, creatinina: 1.0, tsh: 3.1 } },
    { date: "2023-06-05", lab: "LaborVida", refs: { ...F_REFS, vitamina_d: [30, 100] }, values: { hemoglobina: 11.8, creatinina: 1.2, vitamina_d: 22 } },
  ]);
  return {
    version: 1,
    personaId: "lucia",
    createdAt: now.toISOString(),
    patient: { id: "paciente-lucia", name: "Lúcia Ferreira", birthDate: "1948-07-03", sex: "F", allergies: [] },
    documents,
    labResults,
    encounters: [
      { id: "luc-enc-1", date: "2019-05-02", specialty: "Endocrinologia", professional: "Dr. Jorge Amaral", place: "Clínica Pajuçara (Maceió)", reason: "Acompanhamento da tireoide", notes: "Mantida levotiroxina 50 mcg." },
      { id: "luc-enc-2", date: "2023-06-20", specialty: "Geriatria", professional: "Dra. Teresa Lins", place: "Clínica Pajuçara (Maceió)", reason: "Consulta anual", notes: "Orientada sobre vitamina D e hidratação." },
    ],
    medications: [
      { id: "luc-med-1", name: "Levotiroxina", dose: "50 mcg", frequency: "1x ao dia, em jejum", startDate: "2015-03-01", endDate: null, reason: "Tireoide" },
    ],
    vaccines: [
      { id: "luc-vac-1", name: "Pneumocócica 23", date: "2022-05-10", dose: "Dose única" },
      { id: "luc-vac-2", name: "Herpes-zóster (recombinante)", date: "2024-03-14", dose: "2 doses" },
      { id: "luc-vac-3", name: "COVID-19", date: "2025-04-09", dose: "Reforço" },
      { id: "luc-vac-4", name: "Influenza", date: "2026-04-20", dose: "Anual" },
    ],
    wearableDays: [],
    devices: [],
    shares: [],
  };
}

// ---------- Pedro ----------

function pedroWearables(today: string): WearableDay[] {
  const r = rng(22022);
  const noise = (amp: number) => (r() * 2 - 1) * amp;
  const days: WearableDay[] = [];
  for (let i = 89; i >= 0; i--) {
    days.push({
      date: addDays(today, -i),
      restingHr: Math.round(52 + noise(1.8)), // baixa e estável: comum em quem treina
      hrvMs: Math.round(78 + noise(8)),
      sleepHours: round1(7.5 + noise(0.5)),
      spo2Min: Math.round(94 + r() * 3),
      breathingDisturbances: Math.round(1 + r() * 4),
      steps: Math.round(12000 + noise(2500)),
      irregularRhythmEvents: 0,
      systolic: 0,
      diastolic: 0,
    });
  }
  return days;
}

function pedro(now: Date): Db {
  const today = todayISO(now);
  const { documents, labResults } = labsFrom("ped", [
    { date: "2026-02-10", lab: "Lab Aurora", values: { glicose: 82, colesterol_total: 158, ldl: 88, hdl: 58, triglicerides: 70, creatinina: 1.0, hemoglobina: 15.2, vitamina_d: 42 } },
    { date: "2026-08-18", lab: "Lab Aurora", values: { glicose: 85, colesterol_total: 162, ldl: 92, hdl: 55, triglicerides: 80, creatinina: 1.05, hemoglobina: 15.4 } },
  ]);
  const devices: WearableDevice[] = [
    { id: "dev-galaxy", name: "Relógio inteligente (simulado)", kind: "relogio", metrics: ["Frequência cardíaca", "Variabilidade (VFC)", "Ritmo irregular", "Sono", "SpO2", "Passos"], connectedAt: addDays(today, -200) + "T10:00:00.000Z" },
  ];
  return {
    version: 1,
    personaId: "pedro",
    createdAt: now.toISOString(),
    patient: { id: "paciente-pedro", name: "Pedro Lima", birthDate: "2004-03-09", sex: "M", bloodType: "O-", allergies: [] },
    documents,
    labResults,
    encounters: [
      { id: "ped-enc-1", date: "2026-02-15", specialty: "Medicina esportiva", professional: "Dr. Felipe Rocha", place: "Ambulatório universitário", reason: "Avaliação pré-participação (futebol)", notes: "Apto para atividade física." },
    ],
    medications: [],
    vaccines: [
      { id: "ped-vac-1", name: "HPV", date: "2017-04-12", dose: "Esquema completo" },
      { id: "ped-vac-2", name: "dT (difteria e tétano)", date: "2023-02-01", dose: "Reforço" },
      { id: "ped-vac-3", name: "Influenza", date: "2026-04-28", dose: "Anual" },
    ],
    wearableDays: pedroWearables(today),
    devices,
    shares: [],
  };
}

/** Perfil vazio: a pessoa preenche nome, nascimento e sexo no guia de boas-vindas. */
function nova(now: Date): Db {
  return {
    version: 1,
    personaId: "nova",
    createdAt: now.toISOString(),
    patient: { id: "paciente-novo", name: "", birthDate: "", sex: "F", allergies: [] },
    documents: [],
    labResults: [],
    encounters: [],
    medications: [],
    vaccines: [],
    wearableDays: [],
    devices: [],
    shares: [],
  };
}

/** Perfil ainda sem cadastro (mostra o guia de boas-vindas). */
export const needsOnboarding = (db: Db) => !db.patient.name.trim();

/** Histórico inicial de uma persona. */
export function createPersonaDb(id: PersonaId = "carlos", now = new Date()): Db {
  switch (id) {
    case "nova":
      return nova(now);
    case "juliana":
      return juliana(now);
    case "lucia":
      return lucia(now);
    case "pedro":
      return pedro(now);
    default:
      return createSeedDb(now);
  }
}

/** Gerador da série dos wearables da persona (usado para estender a série até hoje). */
export function personaWearables(id: PersonaId | undefined): (today: string) => WearableDay[] {
  switch (id) {
    case "juliana":
      return julianaWearables;
    case "lucia":
    case "nova":
      return () => [];
    case "pedro":
      return pedroWearables;
    default:
      return seedWearables;
  }
}
