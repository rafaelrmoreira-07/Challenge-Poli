/** Datas são sempre strings ISO "YYYY-MM-DD"; instantes são ISO completos. */

export interface Patient {
  id: string;
  name: string;
  birthDate: string;
  sex: "F" | "M";
  bloodType?: string;
  allergies: string[];
  /** Quem avisar numa emergência (aparece para o médico e nos alertas urgentes). */
  emergencyContact?: { name: string; phone: string };
}

export type ExtractionSource = "gemini" | "simulado" | "manual" | "seed";

/** Tipo de laudo descritivo (sem tabela de resultados). */
export type ReportCategory = "imagem" | "cardiologico" | "endoscopia" | "outro";

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  imagem: "Exame de imagem",
  cardiologico: "Exame do coração",
  endoscopia: "Endoscopia ou colonoscopia",
  outro: "Outro laudo",
};

/**
 * Laudo descritivo: ecocardiograma, eletrocardiograma, ultrassom, raio X,
 * tomografia, endoscopia... O valor está no texto (achados e conclusão),
 * não numa tabela de números.
 */
export interface DescriptiveReport {
  /** Nome do exame como está no laudo (ex.: "Ecocardiograma transtorácico"). */
  examName: string;
  category: ReportCategory;
  /** Conclusão ou impressão diagnóstica, copiada do laudo. */
  conclusion: string;
  /** Resumo fiel dos achados (opcional). */
  findings?: string;
  /** Médico que assina o laudo. */
  physician?: string;
}

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
  /** Presente quando o documento é um laudo descritivo (imagem, coração, endoscopia). */
  report?: DescriptiveReport;
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
  /** Na revisão da leitura: "corrigido" (a pessoa mudou o que a IA leu) ou "adicionado" (digitado à mão). */
  review?: "corrigido" | "adicionado";
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

/**
 * Um dia de dados dos wearables. null = não medido naquele dia (o aparelho não
 * mede aquilo, ou não foi usado). Nunca trate ausência como zero: saturação 0
 * dispararia o alerta de apneia. Pressão 0 também conta como não medida
 * (convenção antiga das personas).
 */
export interface WearableDay {
  date: string;
  restingHr: number | null;
  hrvMs: number | null;
  sleepHours: number | null;
  spo2Min: number | null;
  /** Distúrbios respiratórios por hora de sono. */
  breathingDisturbances: number | null;
  steps: number | null;
  irregularRhythmEvents: number | null;
  systolic: number | null;
  diastolic: number | null;
}

export type WearableMetric = Exclude<keyof WearableDay, "date">;

export interface WearableDevice {
  id: string;
  name: string;
  kind: "relogio" | "anel" | "medidor_pressao" | "importado";
  metrics: string[];
  connectedAt: string;
}

/** De onde vêm os dados dos wearables desta pessoa. */
export interface WearableSource {
  kind: "simulado" | "importado";
  /** Ex.: "Apple Saúde", "Planilha (CSV)", "Relatório lido pela IA". */
  label?: string;
  /** Nome do arquivo importado. */
  filename?: string;
  importedAt?: string;
  /** Como o arquivo foi lido: direto no navegador ou organizado pela IA. */
  readBy?: "direto" | "ia";
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
  exames: "Exames e laudos",
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

/** Personas de demonstração (todas sintéticas). Ausente = Carlos, o paciente original. "nova" = começar do zero. */
export type PersonaId = "nova" | "carlos" | "juliana" | "lucia" | "pedro";

export interface Db {
  version: 1;
  personaId?: PersonaId;
  /** Ausente = dados simulados (personas). */
  wearableSource?: WearableSource;
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
  /** "cruzado": junta um sinal dos wearables com um exame ("Juntando seus dados"). "pos_alta": sintoma do registro diário depois da alta. */
  kind: "ritmo_irregular" | "apneia" | "pressao" | "fc_repouso" | "exames" | "cruzado" | "pos_alta";
  severity: AlertSeverity;
  title: string;
  message: string;
  recommendation: string;
  specialty?: string;
  evidence: string[];
  /** Texto para o médico, em terceira pessoa e linguagem clínica (a tela do paciente usa `message`). */
  clinical?: string;
  /** O que o médico pode considerar. Nunca é prescrição: só exame ou avaliação a considerar. */
  clinicalNote?: string;
  /** Atalhos para as telas de origem dos dados (usados no app do paciente). */
  links?: { label: string; href: string }[];
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
  /** Quão segura a IA está da leitura deste valor. null = não informado (ex.: leitura antiga). */
  confidence: Confidence | null;
}

export type Confidence = "alta" | "media" | "baixa";

export interface Extraction {
  lab: string | null;
  examDate: string | null;
  patientName: string | null;
  results: ExtractedResult[];
  /** Laudo descritivo lido (imagem, coração, endoscopia). Nesse caso `results` costuma vir vazio. */
  report?: DescriptiveReport | null;
  notes: string | null;
  source: ExtractionSource;
  model?: string;
}
