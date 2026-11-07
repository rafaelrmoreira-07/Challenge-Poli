import "server-only";
import { createHash } from "node:crypto";
import { updateDb } from "./db";
import { ageFrom, formatDate, todayISO } from "./dates";
import { generateJson } from "./gemini";
import { analyteSeries, fmt, formatRef, wearableSnapshot } from "./health";
import type { ScopedData } from "./share";
import type { DoctorSummary, Share } from "./types";

/** Contexto compacto e estruturado enviado ao modelo (sem nome do paciente). */
export function buildClinicalContext(data: ScopedData): string {
  const p = data.patient;
  const lines: string[] = [
    `Data de hoje: ${todayISO()}`,
    `Paciente: sexo ${p.sex === "F" ? "feminino" : "masculino"}, ${ageFrom(p.birthDate)} anos. Alergias: ${p.allergies.join(", ") || "nenhuma registrada"}.`,
  ];

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

  if (data.encounters.length) {
    lines.push("", "CONSULTAS");
    for (const e of data.encounters) lines.push(`- ${e.date} ${e.specialty}: ${e.reason}. ${e.notes ?? ""}`);
  }

  if (data.wearableDays.length) {
    const w = wearableSnapshot(data.wearableDays);
    lines.push(
      "",
      "WEARABLES (média dos últimos 7 dias)",
      `FC repouso ${w.restingHr} bpm; VFC ${w.hrvMs} ms; sono ${w.sleepHours} h; SpO2 mínima ${w.spo2Min}%; passos ${w.steps}/dia; PA ${w.systolic}/${w.diastolic} mmHg`,
    );
  }

  if (data.alerts.length) {
    lines.push("", "ALERTAS AUTOMÁTICOS");
    for (const a of data.alerts) lines.push(`- ${a.title}: ${a.message} Evidências: ${a.evidence.join("; ")}`);
  }

  if (data.vaccines.length) {
    lines.push("", "VACINAS");
    lines.push(data.vaccines.map((v) => `${v.name} (${v.date})`).join("; "));
  }
  return lines.join("\n");
}

const SYSTEM = `Você apoia um médico que vai atender um paciente. Receberá o histórico estruturado (exames, remédios, consultas, wearables e alertas automáticos).
Escreva em português do Brasil, em linguagem clínica e objetiva, para ser lido em 30 segundos.
- "resumo": 3 a 5 frases com o quadro geral e as tendências mais relevantes, citando números e datas.
- "pontosDeAtencao": até 5 itens, do mais ao menos relevante. Cada um com título curto e detalhe com os dados que sustentam.
- "perguntasSugeridas": até 4 perguntas ou condutas que o médico pode querer considerar (ex.: exame complementar).
Não feche diagnósticos: use "sugere", "compatível com", "a considerar". Use apenas os dados fornecidos; se faltar dado, diga que falta.`;

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

export function contextHash(context: string): string {
  return createHash("sha256").update(context).digest("hex").slice(0, 16);
}

// Global de processo: Server Actions e Route Handlers podem carregar instâncias
// diferentes deste módulo.
const g = globalThis as typeof globalThis & { __summaryInFlight?: Map<string, Promise<DoctorSummary>> };
const inFlight = (g.__summaryInFlight ??= new Map());

/**
 * Devolve o resumo do cache do compartilhamento ou gera um novo. Chamadas
 * simultâneas para os mesmos dados esperam a mesma geração (o pré-aquecimento
 * feito ao criar o link e a abertura da página pelo médico, por exemplo).
 */
export async function getOrCreateSummary(token: string, share: Share, data: ScopedData): Promise<DoctorSummary> {
  const hash = contextHash(buildClinicalContext(data));
  if (share.summaryCache?.hash === hash) return share.summaryCache.summary;

  const key = `${token}:${hash}`;
  let job = inFlight.get(key);
  if (!job) {
    job = generateDoctorSummary(data).then(async (summary) => {
      if (!summary.geradoPor.startsWith("regras")) {
        await updateDb((db) => {
          const s = db.shares.find((x) => x.token === token);
          if (s) s.summaryCache = { hash, summary };
        });
      }
      return summary;
    });
    inFlight.set(key, job);
    job.finally(() => inFlight.delete(key)).catch(() => undefined);
  }
  return job;
}

export async function generateDoctorSummary(data: ScopedData): Promise<DoctorSummary> {
  const context = buildClinicalContext(data);
  try {
    const { data: out, model } = await generateJson<Omit<DoctorSummary, "geradoPor" | "geradoEm">>({
      system: SYSTEM,
      schema: SCHEMA,
      timeoutMs: 30_000,
      parts: [{ text: context }],
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

/** Resumo por regras, usado se a IA estiver indisponível. */
function fallbackSummary(data: ScopedData): DoctorSummary {
  const out = analyteSeries(data.labResults).filter((s) => s.status === "alto" || s.status === "baixo");
  const active = data.medications.filter((m) => !m.endDate);
  return {
    resumo: [
      `Paciente de ${ageFrom(data.patient.birthDate)} anos.`,
      active.length ? `Em uso de ${active.map((m) => `${m.name} ${m.dose}`).join(", ")}.` : "",
      out.length ? `${out.length} exame(s) com último resultado fora da faixa do laudo.` : "",
      data.alerts.length ? `${data.alerts.length} alerta(s) automático(s) ativo(s).` : "",
    ].filter(Boolean).join(" "),
    pontosDeAtencao: [
      ...data.alerts.map((a) => ({ titulo: a.title, detalhe: a.message })),
      ...out.slice(0, 3).map((s) => ({
        titulo: s.name,
        detalhe: `${fmt(s.latest.value!)} ${s.unit} em ${formatDate(s.latest.date)} (ref. ${formatRef(s.latest)}).`,
      })),
    ].slice(0, 5),
    perguntasSugeridas: [],
    geradoPor: "regras (IA indisponível)",
    geradoEm: new Date().toISOString(),
  };
}
