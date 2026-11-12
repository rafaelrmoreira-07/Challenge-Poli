/** Datas são sempre strings ISO "YYYY-MM-DD"; instantes são ISO completos. */

export interface Patient {
  id: string;
  name: string;
  birthDate: string;
  sex: "F" | "M";
  bloodType?: string;
  allergies: string[];
}

export type ExtractionSource = "gemini" | "simulado" | "manual" | "seed";

export interface SourceDocument {
  id: string;
  filename: string;
  mimeType: string;
  /** Chave do arquivo original no IndexedDB. Ausente em registros importados (seed). */
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
  wearables: "Relógio, medidor de pressão e alertas",
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

/** Para quem é o link: um médico (relatório) ou um hospital (pasta de internação). */
export type ShareKind = "medico" | "hospital";

export interface Share {
  token: string;
  /** Médico ou hospital que recebe o link. */
  doctorName: string;
  doctorCrm?: string;
  scopes: Scope[];
  createdAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  accessLog: AccessLogEntry[];
  summaryCache?: { hash: string; summary: DoctorSummary };
  /** Ausente nos links antigos: médico. */
  kind?: ShareKind;
  /** Pasta de internação enviada (links de hospital). */
  admissionId?: string;
  /** Consentimento separado para anexar os exames ao prontuário do hospital (apêndice E). */
  evidenceConsent?: boolean;
  /** Quantos resultados dos últimos 90 dias foram no relatório (apêndice B). */
  recentShown?: number;
}

/** Arquivo guardado no IndexedDB (ex.: foto do pedido médico). */
export interface StoredFile {
  name: string;
  mimeType: string;
  storedAs?: string;
}

/** Resumo da alta em linguagem simples (apêndice H). */
export interface Discharge {
  date: string;
  summary: string[];
  newMeds: { name: string; dose: string; frequency: string; days: number }[];
  nextSteps: string[];
  warningSigns: string[];
  teamContact: string;
  /** Dias de acompanhamento depois da alta (apêndice C). */
  followUpDays: number;
  simulated: boolean;
}

/** Pasta de pré-internação (apêndice A). */
export interface Admission {
  id: string;
  createdAt: string;
  hospital: string;
  procedure: string;
  plannedDate: string;
  requestingDoctor: string;
  plan: string;
  cardNumber: string;
  authNumber: string;
  authValidUntil: string;
  order?: StoredFile;
  supportDocIds: string[];
  discharge?: Discharge;
}

export const CHECKIN_SYMPTOMS = ["Falta de ar", "Dor no peito", "Febre", "Dor que não melhora", "Inchaço nas pernas", "Vermelhidão ou secreção no corte"] as const;
export type CheckInSymptom = (typeof CHECKIN_SYMPTOMS)[number];
/** Sintomas que pedem atendimento no mesmo dia. */
export const RED_FLAGS: CheckInSymptom[] = ["Falta de ar", "Dor no peito"];

/** Registro diário do pós-alta. */
export interface CheckIn {
  id: string;
  admissionId: string;
  at: string;
  symptoms: CheckInSymptom[];
  tookMeds: boolean;
}

/** Correções feitas na revisão da leitura de laudos, por exame (apêndice F). */
export interface ReadingStat {
  key: string;
  name: string;
  reads: number;
  fields: number;
  corrected: number;
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
  /** Campos opcionais: bancos salvos antes destes apêndices continuam válidos. */
  admissions?: Admission[];
  checkins?: CheckIn[];
  readingStats?: Record<string, ReadingStat>;
  fhirExports?: number;
}

export type AlertSeverity = "atencao" | "procure_medico";

export interface HealthAlert {
  id: string;
  kind: "ritmo_irregular" | "apneia" | "pressao" | "fc_repouso" | "exames" | "pos_alta";
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
