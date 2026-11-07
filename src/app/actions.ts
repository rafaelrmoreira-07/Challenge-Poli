"use server";

import { access } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { analyteInfo, resolveAnalyteKey } from "@/lib/analytes";
import { addDays, isValidISODate, todayISO } from "@/lib/dates";
import { resetDb, updateDb, uploadPath } from "@/lib/db";
import { after } from "next/server";
import { newShareToken, openShare } from "@/lib/share";
import { getOrCreateSummary } from "@/lib/summary";
import { SCOPES, type ExtractionSource, type Scope } from "@/lib/types";

export interface SaveExamInput {
  uploadId: string;
  filename: string;
  mimeType: string;
  extractedBy: ExtractionSource;
  model?: string;
  lab: string;
  examDate: string;
  results: {
    name: string;
    analyteKey: string;
    value: number | null;
    valueText?: string | null;
    unit: string;
    refLow: number | null;
    refHigh: number | null;
    refText?: string | null;
  }[];
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const finite = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export async function saveExam(input: SaveExamInput): Promise<{ error: string } | void> {
  if (!/^[0-9a-f-]{36}\.[a-z0-9]{2,5}$/.test(input.uploadId)) return { error: "Upload inválido." };
  try {
    await access(uploadPath(input.uploadId));
  } catch {
    return { error: "Arquivo enviado não encontrado. Envie de novo." };
  }
  if (!isValidISODate(input.examDate) || input.examDate > todayISO()) return { error: "Informe uma data de coleta válida." };
  const results = (Array.isArray(input.results) ? input.results : [])
    .slice(0, 80)
    .filter((r) => clean(r.name, 120) && (finite(r.value) != null || clean(r.valueText, 80)));
  if (!results.length) return { error: "Nenhum resultado para salvar." };

  const docId = randomUUID();
  const lab = clean(input.lab, 120) || undefined;
  await updateDb((db) => {
    db.documents.push({
      id: docId,
      filename: clean(input.filename, 160) || "laudo",
      mimeType: clean(input.mimeType, 60),
      storedAs: input.uploadId,
      uploadedAt: new Date().toISOString(),
      examDate: input.examDate,
      lab,
      extractedBy: input.extractedBy === "gemini" ? "gemini" : "simulado",
      model: clean(input.model, 60) || undefined,
    });
    for (const r of results) {
      const name = clean(r.name, 120);
      const key = resolveAnalyteKey(clean(r.analyteKey, 60), name);
      db.labResults.push({
        id: randomUUID(),
        documentId: docId,
        analyteKey: key,
        name,
        value: finite(r.value),
        valueText: clean(r.valueText, 80) || undefined,
        unit: clean(r.unit, 30) || analyteInfo(key)?.unit || "",
        refLow: finite(r.refLow),
        refHigh: finite(r.refHigh),
        refText: clean(r.refText, 160) || undefined,
        date: input.examDate,
        lab,
      });
    }
  });
  redirect(`/exames?novo=${docId}`);
}

/** Demo: injeta episódios de ritmo irregular nos últimos dias. */
export async function simulateIrregularRhythm() {
  const today = todayISO();
  const plan: Record<string, number> = { [today]: 2, [addDays(today, -1)]: 1, [addDays(today, -3)]: 1 };
  await updateDb((db) => {
    for (const d of db.wearableDays) {
      if (plan[d.date]) {
        d.irregularRhythmEvents += plan[d.date];
        d.restingHr += 4;
      }
    }
  });
  refresh();
}

export async function resetDemo() {
  await resetDb();
  redirect("/");
}

export async function createShare(_prev: unknown, form: FormData): Promise<{ error?: string; token?: string }> {
  const doctorName = clean(form.get("doctorName"), 100);
  const doctorCrm = clean(form.get("doctorCrm"), 30) || undefined;
  const scopes = form.getAll("scopes").filter((s): s is Scope => SCOPES.includes(s as Scope));
  const hours = Number(form.get("hours"));
  if (!doctorName) return { error: "Informe o nome do médico." };
  if (!scopes.length) return { error: "Escolha pelo menos um tipo de dado para compartilhar." };
  if (![1, 24, 168, 720].includes(hours)) return { error: "Prazo inválido." };

  const token = newShareToken();
  const now = new Date();
  await updateDb((db) => {
    db.shares.unshift({
      token,
      doctorName,
      doctorCrm,
      scopes,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + hours * 3_600_000).toISOString(),
      revokedAt: null,
      accessLog: [],
    });
  });
  // Gera o resumo por IA em segundo plano: quando o médico abrir o link, já está pronto.
  after(async () => {
    const access = await openShare(token);
    if (access.ok) await getOrCreateSummary(token, access.share, access.data).catch(() => undefined);
  });
  refresh();
  return { token };
}

export async function revokeShare(token: string) {
  await updateDb((db) => {
    const s = db.shares.find((x) => x.token === token);
    if (s && !s.revokedAt) s.revokedAt = new Date().toISOString();
  });
  refresh();
}
