import { analyteInfo, resolveAnalyteKey } from "./analytes";
import { todayISO } from "./dates";
import { labStatus } from "./health";
import type { Admission, Db, LabResult, Share } from "./types";

/**
 * Exportar e importar o histórico em HL7 FHIR R4 (apêndice D), o padrão da
 * RNDS. Tudo roda no navegador; nada sai do aparelho sem a pessoa baixar ou
 * enviar o arquivo.
 *
 * Os códigos LOINC abaixo cobrem só os exames em que o mapeamento é direto.
 * Os outros vão com o código local "elo-saude" e o nome do laudo.
 */
export const LOINC: Record<string, string> = {
  glicose: "1558-6",
  hba1c: "4548-4",
  colesterol_total: "2093-3",
  ldl: "13457-7",
  hdl: "2085-9",
  triglicerides: "2571-8",
  creatinina: "2160-0",
  ureia: "3091-6",
  potassio: "2823-3",
  sodio: "2951-2",
  tsh: "3016-3",
  t4_livre: "3024-7",
  hemoglobina: "718-7",
  hematocrito: "4544-3",
  leucocitos: "6690-2",
  plaquetas: "777-3",
  vitamina_d: "62292-8",
  vitamina_b12: "2132-9",
  acido_urico: "3084-1",
  tgo: "1920-8",
  tgp: "1742-6",
  psa: "2857-1",
  pcr: "1988-5",
};
const KEY_BY_LOINC = Object.fromEntries(Object.entries(LOINC).map(([k, v]) => [v, k]));

const LOINC_SYS = "http://loinc.org";
const LOCAL_SYS = "urn:elo-saude:exame";
const INTERP_SYS = "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation";

type Resource = Record<string, unknown> & { resourceType: string; id: string };
export type Bundle = { resourceType: "Bundle"; type: "collection"; timestamp: string; meta?: Record<string, unknown>; entry: { fullUrl: string; resource: Resource }[] };

const urn = (id: string) => `urn:uuid:${id}`;
const safeId = (s: string) => s.replace(/[^A-Za-z0-9\-.]/g, "-").slice(0, 64);

function observation(r: LabResult, patientRef: string, docRef?: string): Resource {
  const code = LOINC[r.analyteKey];
  const st = labStatus(r);
  return {
    resourceType: "Observation",
    id: safeId(r.id),
    status: "final",
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory" }] }],
    code: {
      coding: [code ? { system: LOINC_SYS, code, display: analyteInfo(r.analyteKey)?.name ?? r.name } : { system: LOCAL_SYS, code: r.analyteKey, display: r.name }],
      text: r.name,
    },
    subject: { reference: patientRef },
    effectiveDateTime: r.date,
    ...(r.value != null ? { valueQuantity: { value: r.value, unit: r.unit } } : { valueString: r.valueText ?? "" }),
    ...(r.refLow != null || r.refHigh != null
      ? { referenceRange: [{ ...(r.refLow != null ? { low: { value: r.refLow, unit: r.unit } } : {}), ...(r.refHigh != null ? { high: { value: r.refHigh, unit: r.unit } } : {}), ...(r.refText ? { text: r.refText } : {}) }] }
      : {}),
    ...(st === "alto" || st === "baixo" ? { interpretation: [{ coding: [{ system: INTERP_SYS, code: st === "alto" ? "H" : "L" }] }] } : {}),
    ...(r.lab ? { performer: [{ display: r.lab }] } : {}),
    ...(docRef ? { derivedFrom: [{ reference: docRef }] } : {}),
  };
}

/** Pacote FHIR com o histórico (ou o recorte de um compartilhamento). */
export function buildBundle(
  db: Pick<Db, "patient" | "documents" | "labResults" | "medications" | "vaccines"> & Partial<Pick<Db, "encounters">>,
  opts: { consent?: { share: Share; admission?: Admission } } = {},
): Bundle {
  const p = db.patient;
  const patientId = safeId(p.id);
  const patientRef = urn(patientId);
  const entries: Resource[] = [
    {
      resourceType: "Patient",
      id: patientId,
      name: [{ text: p.name }],
      gender: p.sex === "F" ? "female" : "male",
      birthDate: p.birthDate,
    },
  ];
  for (const a of p.allergies) {
    entries.push({ resourceType: "AllergyIntolerance", id: safeId(`alergia-${a}`), patient: { reference: patientRef }, code: { text: a }, clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: "active" }] } });
  }
  const docRef = new Map<string, string>();
  for (const d of db.documents) {
    const id = safeId(`doc-${d.id}`);
    docRef.set(d.id, urn(id));
    entries.push({
      resourceType: "DocumentReference",
      id,
      status: "current",
      type: { text: d.report ? d.report.examName : "Laudo de exames laboratoriais" },
      subject: { reference: patientRef },
      date: `${d.examDate}T12:00:00Z`,
      description: d.lab ?? "Laudo",
      content: [{ attachment: { contentType: d.mimeType || "application/pdf", title: d.filename } }],
    });
    // Laudo descritivo: DiagnosticReport com a conclusão como está no laudo
    if (d.report) {
      entries.push({
        resourceType: "DiagnosticReport",
        id: safeId(`laudo-${d.id}`),
        status: "final",
        category: [{ text: d.report.category === "imagem" ? "Imagem" : d.report.category === "cardiologico" ? "Cardiologia" : d.report.category === "endoscopia" ? "Endoscopia" : "Outro" }],
        code: { text: d.report.examName },
        subject: { reference: patientRef },
        effectiveDateTime: d.examDate,
        ...(d.lab ? { performer: [{ display: d.lab }] } : {}),
        conclusion: d.report.conclusion,
        presentedForm: [{ contentType: d.mimeType || "application/pdf", title: d.filename }],
      });
    }
  }
  for (const r of db.labResults) entries.push(observation(r, patientRef, r.documentId ? docRef.get(r.documentId) : undefined));
  for (const m of db.medications) {
    entries.push({
      resourceType: "MedicationStatement",
      id: safeId(m.id),
      status: m.endDate && m.endDate < todayISO() ? "completed" : "active",
      medicationCodeableConcept: { text: `${m.name} ${m.dose}` },
      subject: { reference: patientRef },
      effectivePeriod: { start: m.startDate, ...(m.endDate ? { end: m.endDate } : {}) },
      dosage: [{ text: m.frequency }],
      ...(m.reason ? { reasonCode: [{ text: m.reason }] } : {}),
    });
  }
  for (const v of db.vaccines) {
    entries.push({ resourceType: "Immunization", id: safeId(v.id), status: "completed", vaccineCode: { text: v.name }, patient: { reference: patientRef }, occurrenceDateTime: v.date, ...(v.dose ? { protocolApplied: [{ doseNumberString: v.dose }] } : {}) });
  }
  for (const e of db.encounters ?? []) {
    entries.push({ resourceType: "Encounter", id: safeId(e.id), status: "finished", class: { code: "AMB" }, subject: { reference: patientRef }, period: { start: e.date }, serviceType: { text: e.specialty }, reasonCode: [{ text: e.reason }], location: [{ location: { display: e.place } }] });
  }
  if (opts.consent) {
    const { share, admission } = opts.consent;
    entries.push({
      resourceType: "Consent",
      id: safeId(`consent-${share.token}`),
      status: "active",
      scope: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/consentscope", code: "patient-privacy" }] },
      category: [{ text: "Anexar exames externos ao prontuário do hospital" }],
      patient: { reference: patientRef },
      dateTime: share.createdAt,
      organization: [{ display: share.doctorName }],
      policyRule: { text: "LGPD, art. 11: dado de saúde, consentimento específico e destacado" },
      provision: {
        type: "permit",
        period: { start: share.createdAt, end: share.expiresAt },
        purpose: [{ code: "TREAT", system: "http://terminology.hl7.org/CodeSystem/v3-ActReason" }],
        ...(admission ? { data: admission.supportDocIds.map((id) => ({ meaning: "instance", reference: { reference: docRef.get(id) ?? urn(safeId(`doc-${id}`)) } })) } : {}),
      },
    });
  }
  return {
    resourceType: "Bundle",
    type: "collection",
    timestamp: new Date().toISOString(),
    entry: entries.map((r) => ({ fullUrl: urn(r.id), resource: r })),
  };
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/fhir+json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ---------- importação ----------

type Coding = { system?: string; code?: string; display?: string };
type Codeable = { coding?: Coding[]; text?: string };
const str = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : "");

/**
 * Lê um Bundle FHIR (ex.: exportado do Meu SUS Digital ou de outro app) e
 * devolve vacinas e exames prontos para importar. Ignora o que não conhece.
 */
export function parseBundle(json: unknown) {
  const b = json as { resourceType?: string; entry?: { resource?: Record<string, unknown> }[] };
  if (b?.resourceType !== "Bundle" || !Array.isArray(b.entry)) throw new Error("O arquivo não é um pacote FHIR (Bundle).");
  const vaccines: { name: string; date: string; dose?: string }[] = [];
  const groups = new Map<string, { date: string; lab?: string; results: { analyteKey: string; name: string; value: number | null; unit: string; refLow: number | null; refHigh: number | null }[] }>();
  for (const e of b.entry.slice(0, 2000)) {
    const r = e.resource;
    if (!r) continue;
    if (r.resourceType === "Immunization") {
      const name = str((r.vaccineCode as Codeable)?.text) || str((r.vaccineCode as Codeable)?.coding?.[0]?.display);
      const date = day(r.occurrenceDateTime);
      if (name && date) vaccines.push({ name, date, dose: str((r.protocolApplied as { doseNumberString?: string }[])?.[0]?.doseNumberString, 60) || undefined });
    }
    if (r.resourceType === "Observation") {
      const code = r.code as Codeable;
      const loinc = code?.coding?.find((c) => c.system === LOINC_SYS)?.code;
      const name = str(code?.text) || str(code?.coding?.[0]?.display);
      const date = day(r.effectiveDateTime);
      const q = r.valueQuantity as { value?: unknown; unit?: unknown } | undefined;
      if (!name || !date || !q) continue;
      const range = (r.referenceRange as { low?: { value?: unknown }; high?: { value?: unknown } }[] | undefined)?.[0];
      const lab = str((r.performer as { display?: string }[] | undefined)?.[0]?.display);
      const g = groups.get(`${date}|${lab}`) ?? { date, lab: lab || undefined, results: [] };
      g.results.push({
        analyteKey: (loinc && KEY_BY_LOINC[loinc]) || resolveAnalyteKey("", name),
        name,
        value: num(q.value),
        unit: str(q.unit, 30),
        refLow: num(range?.low?.value),
        refHigh: num(range?.high?.value),
      });
      groups.set(`${date}|${lab}`, g);
    }
  }
  return { vaccines, labs: [...groups.values()] };
}
