"use client";

import { useSyncExternalStore } from "react";
import { analyteInfo, resolveAnalyteKey } from "./analytes";
import { resetChat } from "./chat";
import { addDays, isValidISODate, todayISO } from "./dates";
import { createSeedDb, extendWearablesToToday } from "./seed";
import { SCOPES, type Db, type DoctorSummary, type ExtractionSource, type Scope } from "./types";

/**
 * Armazenamento da versão web: tudo fica no navegador da pessoa.
 * - Histórico estruturado: localStorage (JSON).
 * - Arquivos originais dos laudos: IndexedDB.
 * Abas e iframes do mesmo site ficam sincronizados pelo evento "storage".
 */

const DB_KEY = "elo-saude:db:v1";
const listeners = new Set<() => void>();
let cache: Db | undefined;

function read(): Db {
  const raw = localStorage.getItem(DB_KEY);
  let db: Db | null = null;
  if (raw) {
    try {
      db = JSON.parse(raw) as Db;
    } catch {
      db = null;
    }
  }
  if (!db || db.version !== 1) {
    db = createSeedDb();
    write(db);
  } else if (extendWearablesToToday(db)) {
    write(db);
  }
  return db;
}

function write(db: Db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function notify() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === DB_KEY || e.key === null) {
      cache = undefined;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getDbSnapshot(): Db {
  cache ??= read();
  return cache;
}

/** Histórico atual; null durante a pré-renderização (antes de abrir no navegador). */
export function useDb(): Db | null {
  return useSyncExternalStore(subscribe, getDbSnapshot, () => null);
}

function update<T>(mutate: (db: Db) => T): T {
  const db = structuredClone(getDbSnapshot());
  const result = mutate(db);
  write(db);
  cache = db;
  notify();
  return result;
}

// ---------- arquivos (IndexedDB) ----------

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("elo-saude-arquivos", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("files");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbRun<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction("files", mode).objectStore("files"));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getDocumentFile(id: string): Promise<Blob | undefined> {
  try {
    return await idbRun<Blob | undefined>("readonly", (s) => s.get(id));
  } catch {
    return undefined;
  }
}

/** Abre o laudo original numa nova aba. */
export async function openDocumentFile(id: string) {
  const win = window.open("", "_blank");
  const blob = await getDocumentFile(id);
  if (!blob) {
    win?.close();
    alert("O arquivo original deste laudo não está salvo neste navegador.");
    return;
  }
  const url = URL.createObjectURL(blob);
  if (win) win.location.href = url;
  else window.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ---------- mutações ----------

export interface SaveExamInput {
  file: File;
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

export async function saveExam(input: SaveExamInput): Promise<{ error: string } | { docId: string }> {
  if (!isValidISODate(input.examDate) || input.examDate > todayISO()) return { error: "Informe uma data de coleta válida." };
  const results = input.results
    .slice(0, 80)
    .filter((r) => clean(r.name, 120) && (finite(r.value) != null || clean(r.valueText, 80)));
  if (!results.length) return { error: "Nenhum resultado para salvar." };

  const docId = crypto.randomUUID();
  let stored = false;
  try {
    await idbRun("readwrite", (s) => s.put(input.file, docId));
    stored = true;
  } catch {
    // sem IndexedDB (ex.: navegação privada): salva os dados sem o original
  }
  const lab = clean(input.lab, 120) || undefined;
  update((db) => {
    db.documents.push({
      id: docId,
      filename: clean(input.file.name, 160) || "laudo",
      mimeType: clean(input.file.type, 60),
      storedAs: stored ? docId : undefined,
      uploadedAt: new Date().toISOString(),
      examDate: input.examDate,
      lab,
      extractedBy: input.extractedBy === "gemini" ? "gemini" : input.extractedBy === "simulado" ? "simulado" : "manual",
      model: clean(input.model, 60) || undefined,
    });
    for (const r of results) {
      const name = clean(r.name, 120);
      const key = resolveAnalyteKey(clean(r.analyteKey, 60), name);
      db.labResults.push({
        id: crypto.randomUUID(),
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
  return { docId };
}

/** Demo: injeta episódios de ritmo irregular nos últimos dias. */
export function simulateIrregularRhythm() {
  const today = todayISO();
  const plan: Record<string, number> = { [today]: 2, [addDays(today, -1)]: 1, [addDays(today, -3)]: 1 };
  update((db) => {
    for (const d of db.wearableDays) {
      if (plan[d.date]) {
        d.irregularRhythmEvents += plan[d.date];
        d.restingHr += 4;
      }
    }
  });
}

export async function resetDemo() {
  update((db) => {
    Object.assign(db, createSeedDb());
  });
  resetChat();
  try {
    await idbRun("readwrite", (s) => s.clear());
  } catch {
    // nada a limpar
  }
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function createShare(form: { doctorName: string; doctorCrm?: string; scopes: string[]; hours: number }): { error: string } | { token: string } {
  const doctorName = clean(form.doctorName, 100);
  const doctorCrm = clean(form.doctorCrm, 30) || undefined;
  const scopes = form.scopes.filter((s): s is Scope => SCOPES.includes(s as Scope));
  if (!doctorName) return { error: "Informe o nome do médico." };
  if (!scopes.length) return { error: "Escolha pelo menos um tipo de dado para compartilhar." };
  if (![1, 24, 168, 720].includes(form.hours)) return { error: "Prazo inválido." };

  const token = newToken();
  const now = new Date();
  update((db) => {
    db.shares.unshift({
      token,
      doctorName,
      doctorCrm,
      scopes,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + form.hours * 3_600_000).toISOString(),
      revokedAt: null,
      accessLog: [],
    });
  });
  return { token };
}

export function revokeShare(token: string) {
  update((db) => {
    const s = db.shares.find((x) => x.token === token);
    if (s && !s.revokedAt) s.revokedAt = new Date().toISOString();
  });
}

/** Registra a abertura da visão do médico. Recarregar em menos de 1 min conta como o mesmo acesso. */
export function logAccess(token: string, userAgent?: string) {
  const db = getDbSnapshot();
  const s = db.shares.find((x) => x.token === token);
  const last = s?.accessLog.at(-1);
  const now = Date.now();
  if (!s || (last && last.userAgent === userAgent && now - new Date(last.at).getTime() < 60_000)) return;
  update((d) => {
    d.shares.find((x) => x.token === token)?.accessLog.push({ at: new Date(now).toISOString(), userAgent: userAgent?.slice(0, 200) });
  });
}

export function cacheSummary(token: string, hash: string, summary: DoctorSummary) {
  update((db) => {
    const s = db.shares.find((x) => x.token === token);
    if (s) s.summaryCache = { hash, summary };
  });
}
