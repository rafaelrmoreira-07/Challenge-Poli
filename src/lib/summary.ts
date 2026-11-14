import { ageFrom, formatDate, todayISO } from "./dates";
import { generateJson, geminiConfigured } from "./gemini";
import { analyteSeries, fmt, formatRef, hasBloodPressure, wearableSnapshot } from "./health";
import { computeCoverage, coverageLine } from "./provenance";
import type { ScopedData } from "./share";
import type { DoctorSummary } from "./types";

/** Contexto compacto e estruturado enviado ao modelo (sem nome do paciente). */
export function buildClinicalContext(data: ScopedData): string {
  const p = data.patient;
  const lines: string[] = [
    `Data de hoje: ${todayISO()}`,
    `Paciente: sexo ${p.sex === "F" ? "feminino" : "masculino"}, ${ageFrom(p.birthDate)} anos. Alergias: ${p.allergies.join(", ") || "nenhuma registrada"}.`,
  ];

  lines.push(`Cobertura do histórico: ${coverageLine(computeCoverage(data))}`);

  if (data.medications.length) {
    lines.push("", "MEDICAMENTOS");
    for (const m of data.medications)
      lines.push(`- ${m.name} ${m.dose}, ${m.frequency}, desde ${m.startDate}${m.endDate ? ` até ${m.endDate} (suspenso)` : " (em uso)"}${m.reason ? `. Motivo: ${m.reason}` : ""}`);
  }

  if (data.labResults.length) {
    lines.push("", "EXAMES (valores em ordem cronológica; faixa do laudo mais recente)");
    for (const s of analyteSeries(data.labResults)) {
      const hist = s.results.map((r) => `${r.date}: ${r.value == null ? r.valueText ?? "?" : fmt(r.value)}`).join("; ");
      lines.push(`- ${s.name} (${s.unit}) ref. ${formatRef(s.latest)}, último ${s.status}: ${hist}`);
    }
  }

  const reports = data.documents.filter((d) => d.report);
  if (reports.length) {
    lines.push("", "LAUDOS DESCRITIVOS (imagem, coração, endoscopia; conclusão copiada do laudo)");
    for (const d of reports) lines.push(`- ${d.examDate} ${d.report!.examName}${d.lab ? ` (${d.lab})` : ""}: ${d.report!.conclusion}`);
  }

  if (data.encounters.length) {
    lines.push("", "CONSULTAS");
    for (const e of data.encounters) lines.push(`- ${e.date} ${e.specialty}: ${e.reason}. ${e.notes ?? ""}`);
  }

  if (data.wearableDays.length) {
    const w = wearableSnapshot(data.wearableDays);
    lines.push(
      "",
      "WEARABLES (média dos últimos 7 dias)",
      [
        w.restingHr != null && `FC repouso ${w.restingHr} bpm`,
        w.hrvMs != null && `VFC ${w.hrvMs} ms`,
        w.sleepHours != null && `sono ${w.sleepHours} h`,
        w.spo2Min != null && `SpO2 mínima ${w.spo2Min}%`,
        w.steps != null && `passos ${w.steps}/dia`,
        hasBloodPressure(data.wearableDays) && w.systolic != null ? `PA ${w.systolic}/${w.diastolic} mmHg` : "sem medidor de pressão",
      ].filter(Boolean).join("; ") + (w.until < new Date().toISOString().slice(0, 10) ? ` (dados até ${w.until})` : ""),
    );
  }

  if (data.alerts.length) {
    lines.push("", "ALERTAS AUTOMÁTICOS");
    for (const a of data.alerts) lines.push(`- ${a.title}: ${a.clinical ?? a.message} Evidências: ${a.evidence.join("; ")}`);
  }

  if (data.vaccines.length) {
    lines.push("", "VACINAS");
    lines.push(data.vaccines.map((v) => `${v.name} (${v.date})`).join("; "));
  }
  return lines.join("\n");
}

const SYSTEM = `Você apoia um médico que vai atender um paciente. Receberá o histórico estruturado (exames, laudos de imagem e procedimentos, remédios, consultas, wearables e alertas automáticos).
Escreva em português do Brasil, em linguagem clínica e objetiva, para ser lido em 30 segundos.
- "resumo": 3 a 5 frases com o quadro geral e as tendências mais relevantes, citando números e datas.
- "pontosDeAtencao": até 5 itens, do mais ao menos relevante. Cada um com título curto e detalhe com os dados que sustentam.
- "perguntasSugeridas": até 4 perguntas ou condutas que o médico pode querer considerar (ex.: exame complementar).
Não feche diagnósticos: use "sugere", "compatível com", "a considerar". Use apenas os dados fornecidos; se faltar dado, diga que falta (use a linha de cobertura do histórico para apontar lacunas).`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    resumo: { type: "STRING" },
    pontosDeAtencao: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { titulo: { type: "STRING" }, detalhe: { type: "STRING" } }, required: ["titulo", "detalhe"] },
    },
    perguntasSugeridas: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["resumo", "pontosDeAtencao", "perguntasSugeridas"],
};

/** Hash curto do contexto: o resumo em cache só vale enquanto os dados não mudam. */
export async function contextHash(context: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(context));
  return [...new Uint8Array(d)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function generateDoctorSummary(data: ScopedData): Promise<DoctorSummary> {
  if (!geminiConfigured()) return fallbackSummary(data);
  try {
    const { data: out, model } = await generateJson<Omit<DoctorSummary, "geradoPor" | "geradoEm">>({
      system: SYSTEM,
      schema: SCHEMA,
      timeoutMs: 30_000,
      parts: [{ text: buildClinicalContext(data) }],
    });
    return {
      resumo: String(out.resumo ?? ""),
      pontosDeAtencao: (out.pontosDeAtencao ?? []).slice(0, 5),
      perguntasSugeridas: (out.perguntasSugeridas ?? []).slice(0, 4),
      geradoPor: model,
      geradoEm: new Date().toISOString(),
    };
  } catch {
    return fallbackSummary(data);
  }
}

export const isRuleSummary = (s: DoctorSummary) => s.geradoPor.startsWith("regras");

/** Resumo por regras, usado sem chave da IA ou se ela estiver indisponível. */
export function fallbackSummary(data: ScopedData): DoctorSummary {
  const out = analyteSeries(data.labResults).filter((s) => s.status === "alto" || s.status === "baixo");
  const active = data.medications.filter((m) => !m.endDate);
  // Minúscula só na inicial, e nunca em siglas (TSH, PSA, LDL...)
  const low = (t: string) => (/^\p{Lu}{2}/u.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1));
  const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} e ${xs.at(-1)}` : xs[0] ?? "");
  const p = data.patient;
  return {
    resumo: [
      `${p.sex === "F" ? "Mulher" : "Homem"}, ${ageFrom(p.birthDate)} anos.`,
      active.length ? `Em uso de ${list(active.map((m) => `${low(m.name)} ${m.dose}`))}.` : "Sem medicamentos em uso registrados.",
      out.length
        ? `${out.length === 1 ? "Último resultado alterado" : `${out.length} exames com último resultado alterado`}: ${list(out.map((s) => low(s.name)))}.`
        : "Últimos exames dentro da referência.",
      data.alerts.length
        ? `${data.alerts.length === 1 ? "Um alerta" : `${data.alerts.length} alertas`} da monitorização domiciliar: ${list(data.alerts.map((a) => low(a.title)))}.`
        : "",
    ].filter(Boolean).join(" "),
    pontosDeAtencao: [
      ...data.alerts.map((a) => ({ titulo: a.title, detalhe: a.clinical ?? a.message })),
      ...out.slice(0, 3).map((s) => ({
        titulo: s.name,
        detalhe: `${s.latest.value != null ? fmt(s.latest.value) : s.latest.valueText} ${s.unit} em ${formatDate(s.latest.date)} (referência ${formatRef(s.latest)}).`,
      })),
    ].slice(0, 5),
    perguntasSugeridas: [],
    geradoPor: "regras (sem IA)",
    geradoEm: new Date().toISOString(),
  };
}
