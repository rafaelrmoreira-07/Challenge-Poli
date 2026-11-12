import { computeAlerts } from "./health";
import type { Admission, CheckIn, Db, DoctorSummary, Encounter, Medication, Patient, Scope, Share, ShareKind, Vaccine, WearableDay } from "./types";

export type ShareState = "ativo" | "expirado" | "revogado";

export function shareState(s: Pick<Share, "revokedAt" | "expiresAt">, now = new Date()): ShareState {
  if (s.revokedAt) return "revogado";
  if (new Date(s.expiresAt) <= now) return "expirado";
  return "ativo";
}

type DataPart = Pick<Db, "patient" | "documents" | "labResults" | "encounters" | "medications" | "vaccines" | "wearableDays" | "devices">;

/**
 * Recorte do histórico que o médico (ou o hospital) pode ver, conforme o
 * consentimento. `onlyDocIds` limita os exames aos laudos escolhidos na pasta
 * de internação: o hospital não precisa ver o histórico inteiro.
 */
export function scopedData(db: DataPart, scopes: Scope[], opts: { onlyDocIds?: string[] } = {}) {
  const has = (s: Scope) => scopes.includes(s);
  if (opts.onlyDocIds) {
    const keep = new Set(opts.onlyDocIds);
    db = { ...db, documents: db.documents.filter((d) => keep.has(d.id)), labResults: db.labResults.filter((r) => r.documentId && keep.has(r.documentId)) };
  }
  const full = { ...db, shares: [], version: 1 as const, createdAt: "" };
  const alerts = computeAlerts(full).filter((a) => (a.kind === "exames" ? has("exames") : has("wearables")));
  return {
    patient: db.patient,
    labResults: has("exames") ? db.labResults : [],
    documents: has("exames") ? db.documents : [],
    encounters: has("consultas") ? db.encounters : [],
    medications: has("medicamentos") ? db.medications : [],
    vaccines: has("vacinas") ? db.vaccines : [],
    wearableDays: has("wearables") ? db.wearableDays : [],
    devices: has("wearables") ? db.devices : [],
    alerts,
  };
}

export type ScopedData = ReturnType<typeof scopedData>;

/** Recorte de um compartilhamento: hospital vê só os laudos da pasta. */
export function dataForShare(db: DataPart & Pick<Db, "admissions">, share: Share): ScopedData {
  const ad = share.kind === "hospital" ? db.admissions?.find((a) => a.id === share.admissionId) : undefined;
  return scopedData(db, share.scopes, ad ? { onlyDocIds: ad.supportDocIds } : {});
}

export type SharedExtras = { admission?: Admission; checkins?: CheckIn[] };

// ---------- link autocontido ----------
//
// Sem servidor, o link do médico leva uma cópia compactada dos dados
// autorizados no fragmento (#d=...). O fragmento não é enviado ao servidor que
// hospeda o site. O prazo é conferido na abertura; revogar só vale para quem
// abre neste mesmo navegador (ver docs/ARQUITETURA.md).

interface Snapshot {
  v: 1;
  sh: { t: string; n: string; c?: string; sc: Scope[]; ca: string; ea: string; k?: ShareKind; ev?: boolean; ai?: string; rs?: number };
  /** Pasta de internação (sem o arquivo do pedido, que fica no aparelho). */
  ad?: Admission;
  ci?: Omit<CheckIn, "id" | "admissionId">[];
  p: Patient;
  d: [id: string, date: string, lab: string | null, by: string][];
  l: [doc: number, key: string, name: string, value: number | null, unit: string, lo: number | null, hi: number | null, text: string | null][];
  e: Omit<Encounter, "id">[];
  m: Omit<Medication, "id">[];
  vc: Omit<Vaccine, "id">[];
  w: { s: string | null; d: number[][] };
  sm?: DoctorSummary;
}

const W_FIELDS = ["restingHr", "hrvMs", "sleepHours", "spo2Min", "breathingDisturbances", "steps", "irregularRhythmEvents", "systolic", "diastolic"] as const;

function toSnapshot(share: Share, data: ScopedData, summary?: DoctorSummary, extras: SharedExtras = {}): Snapshot {
  const docIndex = new Map(data.documents.map((d, i) => [d.id, i]));
  const strip = <T extends { id: string }>(item: T): Omit<T, "id"> => {
    const rest: Partial<T> = { ...item };
    delete rest.id;
    return rest as Omit<T, "id">;
  };
  return {
    v: 1,
    sh: { t: share.token, n: share.doctorName, c: share.doctorCrm, sc: share.scopes, ca: share.createdAt, ea: share.expiresAt, k: share.kind, ev: share.evidenceConsent, ai: share.admissionId, rs: share.recentShown },
    ad: extras.admission ? { ...extras.admission, order: extras.admission.order ? { name: extras.admission.order.name, mimeType: extras.admission.order.mimeType } : undefined } : undefined,
    ci: extras.checkins?.map((c) => ({ at: c.at, symptoms: c.symptoms, tookMeds: c.tookMeds })),
    p: data.patient,
    d: data.documents.map((d) => [d.id, d.examDate, d.lab ?? null, d.extractedBy]),
    l: data.labResults.map((r) => [
      r.documentId != null ? docIndex.get(r.documentId) ?? -1 : -1,
      r.analyteKey,
      r.name,
      r.value,
      r.unit,
      r.refLow ?? null,
      r.refHigh ?? null,
      r.valueText ?? null,
    ]),
    e: data.encounters.map(strip),
    m: data.medications.map(strip),
    vc: data.vaccines.map(strip),
    w: { s: data.wearableDays[0]?.date ?? null, d: data.wearableDays.map((day) => W_FIELDS.map((f) => day[f])) },
    sm: summary,
  };
}

function fromSnapshot(s: Snapshot): { share: Share; data: ScopedData; summary?: DoctorSummary } & SharedExtras {
  const documents = s.d.map(([id, examDate, lab, by]) => ({
    id,
    filename: "laudo",
    mimeType: "",
    uploadedAt: examDate,
    examDate,
    lab: lab ?? undefined,
    extractedBy: by as Db["documents"][number]["extractedBy"],
  }));
  const labResults = s.l.map(([doc, key, name, value, unit, lo, hi, text], i) => ({
    id: `r${i}`,
    documentId: documents[doc]?.id,
    analyteKey: key,
    name,
    value,
    valueText: text ?? undefined,
    unit,
    refLow: lo,
    refHigh: hi,
    date: documents[doc]?.examDate ?? s.sh.ca.slice(0, 10),
    lab: documents[doc]?.lab,
  }));
  const start = s.w.s;
  const wearableDays: WearableDay[] = start
    ? s.w.d.map((row, i) => {
        const date = new Date(start + "T12:00:00Z");
        date.setUTCDate(date.getUTCDate() + i);
        const day = { date: date.toISOString().slice(0, 10) } as WearableDay;
        W_FIELDS.forEach((f, k) => (day[f] = row[k]));
        return day;
      })
    : [];
  const share: Share = {
    token: s.sh.t,
    doctorName: s.sh.n,
    doctorCrm: s.sh.c,
    scopes: s.sh.sc,
    createdAt: s.sh.ca,
    expiresAt: s.sh.ea,
    revokedAt: null,
    accessLog: [],
    kind: s.sh.k,
    evidenceConsent: s.sh.ev,
    admissionId: s.sh.ai,
    recentShown: s.sh.rs,
  };
  const data = scopedData(
    {
      patient: s.p,
      documents,
      labResults,
      encounters: s.e.map((e, i) => ({ id: `e${i}`, ...e })),
      medications: s.m.map((m, i) => ({ id: `m${i}`, ...m })),
      vaccines: s.vc.map((v, i) => ({ id: `v${i}`, ...v })),
      wearableDays,
      devices: [],
    },
    s.sh.sc,
  );
  const admission = s.ad;
  const checkins = s.ci?.map((c, i) => ({ id: `c${i}`, admissionId: admission?.id ?? "", ...c }));
  return { share, data, summary: s.sm, admission, checkins };
}

const b64url = (bytes: Uint8Array) =>
  btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeSharePayload(share: Share, data: ScopedData, summary?: DoctorSummary, extras?: SharedExtras): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(toSnapshot(share, data, summary, extras)));
  return b64url(await pipe(json, new CompressionStream("deflate-raw")));
}

export async function decodeSharePayload(payload: string) {
  const bytes = await pipe(fromB64url(payload), new DecompressionStream("deflate-raw"));
  const snap = JSON.parse(new TextDecoder().decode(bytes)) as Snapshot;
  if (snap.v !== 1) throw new Error("versão de link não suportada");
  return fromSnapshot(snap);
}
