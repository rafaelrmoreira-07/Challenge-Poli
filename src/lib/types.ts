/** Datas são sempre strings ISO "YYYY-MM-DD"; instantes são ISO completos. */

export interface Patient {
  id: string;
  name: string;
  birthDate: string;
  sex: "F" | "M";
  bloodType?: string;
  allergies: string[];
}

export type ExtractionSource = "gemini" | "simulado" | "seed";

export interface SourceDocument {
  id: string;
  filename: string;
  mimeType: string;
  /** Nome do arquivo em .data/uploads. Ausente em registros importados (seed). */
  storedAs?: string;
  uploadedAt: string;
  examDate: string;
  lab?: string;
  extractedBy: ExtractionSource;
  model?: string;
}

export interface LabResult {
  id: string;
  documentId?: string;
  analyteKey: string;
  name: string;
  value: number | null;
  valueText?: string;
  unit: string;
  refLow?: number | null;
  refHigh?: number | null;
  refText?: string;
  date: string;
  lab?: string;
}

export interface Encounter {
  id: string;
  date: string;
  specialty: string;
  professional: string;
  place: string;
  reason: string;
  notes?: string;
}

export interface Medication {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  startDate: string;
  endDate?: string | null;
  reason?: string;
}

export interface Vaccine {
  id: string;
  name: string;
  date: string;
  dose?: string;
}

export interface WearableDay {
  date: string;
  restingHr: number;
  hrvMs: number;
  sleepHours: number;
  spo2Min: number;
  /** Distúrbios respiratórios por hora de sono. */
  breathingDisturbances: number;
  steps: number;
  irregularRhythmEvents: number;
  systolic: number;
  diastolic: number;
}

export interface WearableDevice {
  id: string;
  name: string;
  kind: "relogio" | "anel" | "medidor_pressao";
  metrics: string[];
  connectedAt: string;
}

export const SCOPES = [
  "exames",
  "consultas",
  "medicamentos",
  "vacinas",
  "wearables",
] as const;
export type Scope = (typeof SCOPES)[number];

export const SCOPE_LABELS: Record<Scope, string> = {
  exames: "Exames laboratoriais",
  consultas: "Consultas",
  medicamentos: "Medicamentos",
  vacinas: "Vacinas",
  wearables: "Dados de wearables e alertas",
};

export interface AccessLogEntry {
  at: string;
  userAgent?: string;
}

export interface DoctorSummary {
  resumo: string;
  pontosDeAtencao: { titulo: string; detalhe: string }[];
  perguntasSugeridas: string[];
  geradoPor: string;
  geradoEm: string;
}

export interface Share {
  token: string;
  doctorName: string;
  doctorCrm?: string;
  scopes: Scope[];
  createdAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  accessLog: AccessLogEntry[];
  summaryCache?: { hash: string; summary: DoctorSummary };
}

export interface Db {
  version: 1;
  createdAt: string;
  patient: Patient;
  documents: SourceDocument[];
  labResults: LabResult[];
  encounters: Encounter[];
  medications: Medication[];
  vaccines: Vaccine[];
  wearableDays: WearableDay[];
  devices: WearableDevice[];
  shares: Share[];
}

export type AlertSeverity = "atencao" | "procure_medico";

export interface HealthAlert {
  id: string;
  kind: "ritmo_irregular" | "apneia" | "pressao" | "fc_repouso" | "exames";
  severity: AlertSeverity;
  title: string;
  message: string;
  recommendation: string;
  specialty?: string;
  evidence: string[];
}

/** Resultado da extração por IA, antes da revisão do usuário. */
export interface ExtractedResult {
  name: string;
  analyteKey: string;
  value: number | null;
  valueText: string | null;
  unit: string;
  refLow: number | null;
  refHigh: number | null;
  refText: string | null;
}

export interface Extraction {
  lab: string | null;
  examDate: string | null;
  patientName: string | null;
  results: ExtractedResult[];
  notes: string | null;
  source: ExtractionSource;
  model?: string;
}
