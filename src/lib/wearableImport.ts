"use client";

import { DecodeUTF8, Unzip, UnzipInflate, strToU8, zipSync } from "fflate";
import { addDays, formatDate, todayISO } from "./dates";
import { generateJson, geminiConfigured } from "./gemini";
import type { WearableDay, WearableMetric, WearableSource } from "./types";

/**
 * Importação dos dados dos wearables a partir dos arquivos que o Apple Saúde,
 * o Google (Takeout / Health Connect) e apps de exportação geram.
 *
 * - Exportação do Apple Saúde (.zip ou export.xml): lida aqui no navegador, em
 *   partes (o arquivo pode ter centenas de MB). Nada é enviado para fora.
 * - Planilhas (.csv) com uma linha por dia: as colunas são reconhecidas pelo
 *   nome (português ou inglês). Também lidas aqui no navegador.
 * - Qualquer outro formato pequeno (PDF de relatório, JSON, CSV que o app não
 *   reconhece): a Gemini organiza em dias, com a mesma chave da leitura de laudos.
 *
 * Os tipos do Apple Saúde seguem a documentação do HealthKit
 * (HKQuantityTypeIdentifier* / HKCategoryTypeIdentifier*).
 */

export const MAX_IMPORT_DAYS = 180;
/** Limite para mandar um arquivo para a IA organizar. */
const AI_TEXT_LIMIT = 600_000;
const AI_BINARY_LIMIT = 10 * 1024 * 1024;

export const METRIC_LABELS: Record<WearableMetric, { name: string; unit: string; agg: "media" | "minimo" | "total" }> = {
  restingHr: { name: "Batimentos em repouso", unit: "bpm", agg: "media" },
  hrvMs: { name: "Variabilidade cardíaca", unit: "ms", agg: "media" },
  sleepHours: { name: "Sono", unit: "h por noite", agg: "media" },
  spo2Min: { name: "Saturação mínima", unit: "%", agg: "minimo" },
  breathingDisturbances: { name: "Distúrbios respiratórios", unit: "por hora", agg: "media" },
  steps: { name: "Passos", unit: "por dia", agg: "media" },
  irregularRhythmEvents: { name: "Ritmo irregular", unit: "episódios", agg: "total" },
  systolic: { name: "Pressão sistólica", unit: "mmHg", agg: "media" },
  diastolic: { name: "Pressão diastólica", unit: "mmHg", agg: "media" },
};
const METRICS = Object.keys(METRIC_LABELS) as WearableMetric[];

export interface ImportResult {
  days: WearableDay[];
  metrics: WearableMetric[];
  from: string;
  to: string;
  source: Required<Pick<WearableSource, "label" | "filename" | "readBy">>;
  notes: string[];
}

export class ImportError extends Error {
  constructor(
    message: string,
    public needsKey = false,
  ) {
    super(message);
  }
}

type Progress = (fraction: number) => void;

/** Ponto de entrada: descobre o formato e devolve os dias organizados. */
export async function importWearableFile(file: File, onProgress?: Progress): Promise<ImportResult> {
  const name = file.name.toLowerCase();
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const isZip = head[0] === 0x50 && head[1] === 0x4b;

  if (isZip) return fromZip(file, onProgress);
  if (name.endsWith(".xml")) {
    const apple = new AppleHealthParser();
    await streamText(file, (t) => apple.push(t), onProgress);
    return finish(apple.result(), file.name, "Apple Saúde", "direto");
  }
  if (/\.(csv|tsv|txt)$/.test(name)) {
    const text = await file.text();
    const parsed = parseDailyCsv(text);
    if (parsed) return finish(parsed, file.name, "Planilha (CSV)", "direto");
    return fromAi(file, text);
  }
  return fromAi(file);
}

// ---------------------------------------------------------------- Apple Saúde

type Acc = {
  hr: number[];
  hrv: number[];
  spo2: number[];
  breath: number[];
  sys: number[];
  dia: number[];
  irregular: number;
  /** Passos e sono por aparelho: iPhone e relógio registram os mesmos passos; somar tudo contaria em dobro. */
  steps: Map<string, number>;
  sleep: Map<string, number>;
};

const newAcc = (): Acc => ({ hr: [], hrv: [], spo2: [], breath: [], sys: [], dia: [], irregular: 0, steps: new Map(), sleep: new Map() });
const attr = (tag: string, a: string) => {
  const m = tag.match(new RegExp(`\\s${a}="([^"]*)"`));
  return m ? m[1] : null;
};

/** Leitor em partes do export.xml do Apple Saúde. */
export class AppleHealthParser {
  private rest = "";
  private days = new Map<string, Acc>();
  private found = false;

  push(text: string) {
    const buf = this.rest + text;
    const cut = buf.lastIndexOf(">");
    if (cut < 0) {
      this.rest = buf;
      return;
    }
    this.rest = buf.slice(cut + 1);
    const chunk = buf.slice(0, cut + 1);
    if (!this.found && chunk.includes("<HealthData")) this.found = true;
    const re = /<Record\s[^>]*>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(chunk))) this.record(m[0]);
  }

  private acc(date: string) {
    let a = this.days.get(date);
    if (!a) this.days.set(date, (a = newAcc()));
    return a;
  }

  private record(tag: string) {
    const type = attr(tag, "type");
    if (!type) return;
    const start = attr(tag, "startDate");
    if (!start) return;
    const day = start.slice(0, 10);
    const value = Number(attr(tag, "value"));
    const source = attr(tag, "sourceName") ?? "?";
    switch (type) {
      case "HKQuantityTypeIdentifierRestingHeartRate":
        if (Number.isFinite(value)) this.acc(day).hr.push(value);
        break;
      case "HKQuantityTypeIdentifierHeartRateVariabilitySDNN":
        if (Number.isFinite(value)) this.acc(day).hrv.push(value);
        break;
      case "HKQuantityTypeIdentifierOxygenSaturation":
        if (Number.isFinite(value)) this.acc(day).spo2.push(value <= 1 ? value * 100 : value);
        break;
      case "HKQuantityTypeIdentifierAppleSleepingBreathingDisturbances": {
        // Medida da noite: conta no dia em que a pessoa acorda
        const end = attr(tag, "endDate");
        if (Number.isFinite(value)) this.acc((end ?? start).slice(0, 10)).breath.push(value);
        break;
      }
      case "HKQuantityTypeIdentifierBloodPressureSystolic":
        if (Number.isFinite(value)) this.acc(day).sys.push(value);
        break;
      case "HKQuantityTypeIdentifierBloodPressureDiastolic":
        if (Number.isFinite(value)) this.acc(day).dia.push(value);
        break;
      case "HKQuantityTypeIdentifierStepCount": {
        if (!Number.isFinite(value)) break;
        const a = this.acc(day);
        a.steps.set(source, (a.steps.get(source) ?? 0) + value);
        break;
      }
      case "HKCategoryTypeIdentifierIrregularHeartRhythmEvent":
        this.acc(day).irregular++;
        break;
      case "HKCategoryTypeIdentifierSleepAnalysis": {
        const v = attr(tag, "value") ?? "";
        const end = attr(tag, "endDate");
        if (!/Asleep/.test(v) || !end) break;
        const hours = (toTime(end) - toTime(start)) / 3_600_000;
        if (!(hours > 0 && hours < 16)) break;
        const a = this.acc(end.slice(0, 10)); // a noite conta no dia em que a pessoa acorda
        a.sleep.set(source, (a.sleep.get(source) ?? 0) + hours);
        break;
      }
    }
  }

  result(): WearableDay[] {
    if (!this.found && !this.days.size) throw new ImportError("Este arquivo não parece ser uma exportação do Apple Saúde.");
    return [...this.days.entries()].map(([date, a]) => accToDay(date, a)).filter(hasAnyMetric);
  }
}

/** "2026-10-01 07:12:33 -0300" → milissegundos */
function toTime(s: string): number {
  const m = s.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/);
  return m ? Date.parse(`${m[1]}T${m[2]}${m[3]}:${m[4]}`) : Date.parse(s);
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const maxOf = (m: Map<string, number>) => (m.size ? Math.max(...m.values()) : null);
const round = (v: number | null, digits = 0) => (v == null ? null : Math.round(v * 10 ** digits) / 10 ** digits);

function accToDay(date: string, a: Acc): WearableDay {
  return {
    date,
    restingHr: round(mean(a.hr)),
    hrvMs: round(mean(a.hrv)),
    sleepHours: round(maxOf(a.sleep), 1),
    spo2Min: a.spo2.length ? Math.round(Math.min(...a.spo2)) : null,
    breathingDisturbances: round(mean(a.breath), 1),
    steps: round(maxOf(a.steps)),
    irregularRhythmEvents: a.irregular || null,
    systolic: round(mean(a.sys)),
    diastolic: round(mean(a.dia)),
  };
}

const hasAnyMetric = (d: WearableDay) => METRICS.some((k) => d[k] != null);

// ---------------------------------------------------------------- zip

async function fromZip(file: File, onProgress?: Progress): Promise<ImportResult> {
  const apple = new AppleHealthParser();
  let appleEntry: string | null = null;
  const csvs: { name: string; text: string }[] = [];
  const pending: Promise<void>[] = [];

  const unzip = new Unzip((entry) => {
    const n = entry.name.toLowerCase();
    if (n.endsWith(".xml") && !n.includes("cda") && !appleEntry) {
      // export.xml / exportação.xml (o nome muda com o idioma do iPhone)
      appleEntry = entry.name;
      const dec = new DecodeUTF8((t) => apple.push(t));
      entry.ondata = (err, chunk, final) => {
        if (err) throw err;
        dec.push(chunk, final);
      };
      entry.start();
    } else if (/\.(csv|tsv)$/.test(n) && csvs.length < 40) {
      const parts: Uint8Array[] = [];
      pending.push(
        new Promise((resolve) => {
          entry.ondata = (err, chunk, final) => {
            if (!err) parts.push(chunk);
            if (final || err) {
              csvs.push({ name: entry.name, text: new TextDecoder().decode(concat(parts)) });
              resolve();
            }
          };
          entry.start();
        }),
      );
    }
  });
  unzip.register(UnzipInflate);

  const reader = file.stream().getReader();
  let read = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) {
      unzip.push(new Uint8Array(0), true);
      break;
    }
    read += value.length;
    unzip.push(value);
    onProgress?.(Math.min(0.99, read / file.size));
    await tick();
  }
  await Promise.all(pending);

  if (appleEntry) return finish(apple.result(), file.name, "Apple Saúde", "direto");
  // Google Takeout e apps de exportação: a primeira planilha diária reconhecível
  for (const c of csvs.sort((a, b) => scoreCsvName(b.name) - scoreCsvName(a.name))) {
    const parsed = parseDailyCsv(c.text);
    if (parsed) return finish(parsed, file.name, /takeout|fit/i.test(c.name) ? "Google (Takeout)" : "Planilha (CSV)", "direto", [`Planilha usada: ${c.name.split("/").pop()}`]);
  }
  throw new ImportError("Não encontrei dados do relógio neste .zip. Envie a exportação do Apple Saúde ou uma planilha com uma linha por dia.");
}

const scoreCsvName = (n: string) => (/daily|di[aá]ri|summar|resumo/i.test(n) ? 2 : 0) + (/activity|atividade|metric/i.test(n) ? 1 : 0);
const tick = () => new Promise((r) => setTimeout(r, 0));
function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function streamText(file: File, push: (t: string) => void, onProgress?: Progress) {
  const reader = file.stream().getReader();
  const dec = new TextDecoder();
  let read = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    read += value.length;
    push(dec.decode(value, { stream: true }));
    onProgress?.(Math.min(0.99, read / file.size));
    await tick();
  }
  push(dec.decode());
}

// ---------------------------------------------------------------- CSV

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Reconhece cada coluna pelo nome. A ordem importa: a primeira regra que casar fica com a coluna. */
const COLUMN_RULES: { key: WearableMetric | "date"; test: (h: string) => boolean }[] = [
  { key: "date", test: (h) => /^(date|data|dia|day|datetime|date\/time|start|inicio)\b/.test(h) },
  { key: "restingHr", test: (h) => /(resting|repouso)/.test(h) && /(heart|card|\bfc\b|fc_|bpm|\bhr\b|pulse|pulso|batim)/.test(h) },
  { key: "hrvMs", test: (h) => /(variab|\bhrv\b|\bvfc\b|sdnn)/.test(h) },
  { key: "sleepHours", test: (h) => /(sleep|sono|dormi)/.test(h) && !/(in bed|na cama|awake|acordad|despert|score|pontua)/.test(h) },
  { key: "spo2Min", test: (h) => /(spo2|oxygen|oxigen|saturac)/.test(h) },
  { key: "breathingDisturbances", test: (h) => /(breathing disturb|disturbio|respirat)/.test(h) },
  { key: "steps", test: (h) => /(step|passo)/.test(h) },
  { key: "irregularRhythmEvents", test: (h) => /(irregular|afib|fibril|ritmo)/.test(h) },
  { key: "systolic", test: (h) => /(systolic|sistol)/.test(h) },
  { key: "diastolic", test: (h) => /(diastolic|diastol)/.test(h) },
];

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (c === sep && !q) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function toNumber(raw: string): number | null {
  const s = raw.replace(/\s/g, "").replace(/[^\d.,-]/g, "");
  if (!s) return null;
  const n = Number(s.includes(",") && !s.includes(".") ? s.replace(",", ".") : s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Planilha com uma linha por dia. Devolve null se não reconhecer as colunas. */
export function parseDailyCsv(text: string): WearableDay[] | null {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;
  const first = lines[0];
  const sep = [";", "\t", ","].map((s) => [s, first.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const header = splitCsvLine(first, sep).map(norm);

  const cols = new Map<WearableMetric | "date", number>();
  header.forEach((h, i) => {
    const rule = COLUMN_RULES.find((r) => !cols.has(r.key) && r.test(h));
    if (rule) cols.set(rule.key, i);
  });
  if (!cols.has("date") || cols.size < 2) return null;

  const rows = lines.slice(1).map((l) => splitCsvLine(l, sep));
  const dateFmt = guessDateFormat(rows.map((r) => r[cols.get("date")!] ?? ""));
  const byDate = new Map<string, Record<string, number[]>>();
  for (const r of rows) {
    const date = parseDate(r[cols.get("date")!] ?? "", dateFmt);
    if (!date) continue;
    const bucket = byDate.get(date) ?? {};
    for (const [key, i] of cols) {
      if (key === "date") continue;
      const v = toNumber(r[i] ?? "");
      if (v != null) (bucket[key] ??= []).push(v);
    }
    byDate.set(date, bucket);
  }
  const sleepInMinutes = /(min)/.test(header[cols.get("sleepHours") ?? -1] ?? "");
  const days = [...byDate.entries()].map(([date, b]) => {
    const pick = (k: WearableMetric, how: "mean" | "sum" | "min") => {
      const xs = b[k];
      if (!xs?.length) return null;
      return how === "sum" ? xs.reduce((s, x) => s + x, 0) : how === "min" ? Math.min(...xs) : mean(xs)!;
    };
    let spo2 = pick("spo2Min", "min");
    if (spo2 != null && spo2 <= 1) spo2 *= 100;
    let sleep = pick("sleepHours", "mean");
    if (sleep != null && (sleepInMinutes || sleep > 24)) sleep /= 60;
    return {
      date,
      restingHr: round(pick("restingHr", "mean")),
      hrvMs: round(pick("hrvMs", "mean")),
      sleepHours: round(sleep, 1),
      spo2Min: round(spo2),
      breathingDisturbances: round(pick("breathingDisturbances", "mean"), 1),
      steps: round(pick("steps", "sum")),
      irregularRhythmEvents: pick("irregularRhythmEvents", "sum") || null,
      systolic: round(pick("systolic", "mean")),
      diastolic: round(pick("diastolic", "mean")),
    } satisfies WearableDay;
  });
  const ok = days.filter(hasAnyMetric);
  return ok.length ? ok : null;
}

type DateFmt = "iso" | "dmy" | "mdy";
function guessDateFormat(values: string[]): DateFmt {
  let dmy = false;
  let mdy = false;
  for (const v of values.slice(0, 400)) {
    const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
    if (!m) continue;
    if (Number(m[1]) > 12) dmy = true;
    if (Number(m[2]) > 12) mdy = true;
  }
  return mdy && !dmy ? "mdy" : values.some((v) => /^\d{4}-\d{2}-\d{2}/.test(v)) ? "iso" : "dmy";
}
function parseDate(v: string, fmt: DateFmt): string | null {
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (!m) return null;
  const [a, b] = fmt === "mdy" ? [m[2], m[1]] : [m[1], m[2]];
  const y = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${y}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
}

// ---------------------------------------------------------------- IA

const AI_SYSTEM = `Você organiza dados exportados de relógios, anéis e apps de saúde (Apple Saúde, Google Fit, Health Connect, Fitbit, Samsung Health, Garmin, Oura e outros) em um registro por dia.
Regras:
- Use só o que está no arquivo. Nunca invente valores. Se um sinal não aparece num dia, deixe nulo.
- Uma linha por data (AAAA-MM-DD). Se o arquivo traz várias medições no mesmo dia, resuma: média para batimentos em repouso, variabilidade e pressão; menor valor para saturação; soma para passos e para episódios de ritmo irregular; horas dormidas na noite que termina naquele dia.
- Converta unidades: saturação em % (0,95 vira 95), sono em horas, variabilidade em ms.
- Não confunda batimento médio ou máximo com batimento em repouso: se não houver repouso, deixe nulo.
- "fonte" é o app ou aparelho de origem, se aparecer no arquivo.`;

const AI_SCHEMA = {
  type: "OBJECT",
  properties: {
    fonte: { type: "STRING", nullable: true },
    observacoes: { type: "STRING", nullable: true },
    dias: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          data: { type: "STRING" },
          fc_repouso: { type: "NUMBER", nullable: true },
          vfc_ms: { type: "NUMBER", nullable: true },
          sono_horas: { type: "NUMBER", nullable: true },
          spo2_min: { type: "NUMBER", nullable: true },
          disturbios_respiratorios: { type: "NUMBER", nullable: true },
          passos: { type: "NUMBER", nullable: true },
          episodios_ritmo_irregular: { type: "NUMBER", nullable: true },
          pa_sistolica: { type: "NUMBER", nullable: true },
          pa_diastolica: { type: "NUMBER", nullable: true },
        },
        required: ["data"],
      },
    },
  },
  required: ["dias"],
};

type AiDay = { data: string; fc_repouso?: number | null; vfc_ms?: number | null; sono_horas?: number | null; spo2_min?: number | null; disturbios_respiratorios?: number | null; passos?: number | null; episodios_ritmo_irregular?: number | null; pa_sistolica?: number | null; pa_diastolica?: number | null };

async function fromAi(file: File, text?: string): Promise<ImportResult> {
  if (!geminiConfigured()) {
    throw new ImportError(
      "Não reconheci o formato deste arquivo. Com uma chave da Gemini em Configurações, a IA organiza os dados; ou envie a exportação do Apple Saúde (.zip) ou uma planilha com uma linha por dia.",
      true,
    );
  }
  const isText = text != null || /\.(json|csv|tsv|txt|xml)$/i.test(file.name);
  let part: { text: string } | { inlineData: { mimeType: string; data: string } };
  if (isText) {
    const body = text ?? (await file.text());
    if (body.length > AI_TEXT_LIMIT) throw new ImportError("Arquivo grande demais para a IA organizar. Exporte só os últimos meses, ou envie a exportação do Apple Saúde (.zip), que é lida aqui no aparelho.");
    part = { text: `ARQUIVO: ${file.name}\n\n${body}` };
  } else {
    if (file.size > AI_BINARY_LIMIT) throw new ImportError("Arquivo maior que 10 MB.");
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    part = { inlineData: { mimeType: file.type || "application/pdf", data: btoa(bin) } };
  }
  let data: { fonte?: string | null; observacoes?: string | null; dias?: AiDay[] };
  try {
    ({ data } = await generateJson<typeof data>({ system: AI_SYSTEM, schema: AI_SCHEMA, parts: [part], timeoutMs: 60_000 }));
  } catch {
    throw new ImportError("A IA não conseguiu organizar este arquivo agora. Tente de novo em instantes.");
  }
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const days: WearableDay[] = (data.dias ?? [])
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.data ?? ""))
    .map((d) => {
      const spo2 = num(d.spo2_min);
      return {
        date: d.data,
        restingHr: round(num(d.fc_repouso)),
        hrvMs: round(num(d.vfc_ms)),
        sleepHours: round(num(d.sono_horas), 1),
        spo2Min: round(spo2 != null && spo2 <= 1 ? spo2 * 100 : spo2),
        breathingDisturbances: round(num(d.disturbios_respiratorios), 1),
        steps: round(num(d.passos)),
        irregularRhythmEvents: num(d.episodios_ritmo_irregular) || null,
        systolic: round(num(d.pa_sistolica)),
        diastolic: round(num(d.pa_diastolica)),
      };
    })
    .filter(hasAnyMetric);
  const notes = data.observacoes ? [`Observação da IA: ${data.observacoes}`] : [];
  return finish(days, file.name, data.fonte?.trim() ? data.fonte.trim().slice(0, 40) : "Relatório organizado pela IA", "ia", notes);
}

// ---------------------------------------------------------------- final

function finish(all: WearableDay[], filename: string, label: string, readBy: "direto" | "ia", notes: string[] = []): ImportResult {
  const today = todayISO();
  const sorted = all.filter((d) => d.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) throw new ImportError("Não encontrei nenhum dia com dados de batimento, sono, passos, saturação ou pressão neste arquivo.");
  const last = sorted.at(-1)!.date;
  const cutoff = addDays(last, -(MAX_IMPORT_DAYS - 1));
  const days = sorted.filter((d) => d.date >= cutoff);
  if (days.length < sorted.length) {
    notes.unshift(`O arquivo tinha dados desde ${formatDate(sorted[0].date)}. Entram os últimos ${MAX_IMPORT_DAYS} dias, o período que a tela Sinais e o médico usam.`);
  }
  return {
    days,
    metrics: METRICS.filter((k) => days.some((d) => d[k] != null)),
    from: days[0].date,
    to: last,
    source: { label, filename, readBy },
    notes,
  };
}

/** Resumo de um sinal no período importado, para a tela de revisão. */
export function summarize(days: WearableDay[], k: WearableMetric): { value: number; count: number } | null {
  const xs = days.flatMap((d) => (d[k] == null ? [] : [d[k]!]));
  if (!xs.length) return null;
  const agg = METRIC_LABELS[k].agg;
  const v = agg === "total" ? xs.reduce((s, x) => s + x, 0) : agg === "minimo" ? Math.min(...xs) : mean(xs)!;
  return { value: k === "sleepHours" ? Math.round(v * 10) / 10 : Math.round(v), count: xs.length };
}

/** Frase de origem dos dados, para a tela Sinais e para o médico. */
export function sourceLine(src: WearableSource | undefined): string {
  if (!src || src.kind === "simulado") return "simulação de demonstração (dados fictícios gerados pelo app)";
  const when = src.importedAt ? ` em ${formatDate(src.importedAt.slice(0, 10))}` : "";
  const how = src.readBy === "ia" ? "organizado pela IA" : "lido no aparelho do paciente";
  return `${src.label ?? "arquivo"}, importado${when} (${how})`;
}

// ---------------------------------------------------------------- exemplos fictícios

/**
 * Exportação FICTÍCIA do Apple Saúde, gerada na hora com datas até hoje, para a
 * demonstração. Segue o formato real do export.xml (HealthKit). Passos vêm do
 * iPhone e do relógio, como na vida real, para mostrar que não são somados em dobro.
 * Padrão: batimentos estáveis, sono de 6 a 7 h e batimento irregular em 3 dias
 * das últimas duas semanas (dispara o alerta de ritmo irregular).
 */
export function sampleAppleExport(today = todayISO(), nDays = 75): File {
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const recs: string[] = [];
  const watch = 'sourceName="Apple Watch (fictício)" sourceVersion="11.1"';
  const phone = 'sourceName="iPhone (fictício)" sourceVersion="19.1"';
  const t = (d: string, hh: string) => `${d} ${hh} -0300`;
  const irregularDays = new Set([addDays(today, -11), addDays(today, -6), addDays(today, -2)]);
  for (let i = nDays - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const prev = addDays(d, -1);
    const steps = Math.round(6500 + r() * 2500);
    const phoneShare = Math.round(steps * (0.85 + r() * 0.1));
    recs.push(`<Record type="HKQuantityTypeIdentifierStepCount" ${watch} unit="count" creationDate="${t(d, "21:00:00")}" startDate="${t(d, "08:00:00")}" endDate="${t(d, "20:00:00")}" value="${steps}"/>`);
    recs.push(`<Record type="HKQuantityTypeIdentifierStepCount" ${phone} unit="count" creationDate="${t(d, "21:00:00")}" startDate="${t(d, "08:00:00")}" endDate="${t(d, "20:00:00")}" value="${phoneShare}"/>`);
    recs.push(`<Record type="HKQuantityTypeIdentifierRestingHeartRate" ${watch} unit="count/min" creationDate="${t(d, "23:00:00")}" startDate="${t(d, "00:00:00")}" endDate="${t(d, "23:59:00")}" value="${Math.round(63.5 + 1.6 * Math.sin(i / 9) + (r() - 0.5) * 1.2)}"/>`);
    recs.push(`<Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" ${watch} unit="ms" creationDate="${t(d, "06:30:00")}" startDate="${t(d, "06:29:00")}" endDate="${t(d, "06:30:00")}" value="${(36 + r() * 10).toFixed(1)}"/>`);
    for (const hh of ["02:10:00", "04:40:00"]) {
      recs.push(`<Record type="HKQuantityTypeIdentifierOxygenSaturation" ${watch} unit="%" creationDate="${t(d, hh)}" startDate="${t(d, hh)}" endDate="${t(d, hh)}" value="${(0.93 + r() * 0.04).toFixed(2)}"/>`);
    }
    recs.push(`<Record type="HKQuantityTypeIdentifierAppleSleepingBreathingDisturbances" ${watch} unit="count/hr" creationDate="${t(d, "07:00:00")}" startDate="${t(prev, "23:30:00")}" endDate="${t(d, "06:40:00")}" value="${(2 + r() * 4).toFixed(1)}"/>`);
    // Noite: núcleo, profundo e REM até a hora de acordar (6 a 7 h dormidas)
    const sleepMin = Math.round(360 + r() * 60);
    const startMin = 23 * 60 + 30;
    const segs: [string, number][] = [["HKCategoryValueSleepAnalysisAsleepCore", 0.55], ["HKCategoryValueSleepAnalysisAsleepDeep", 0.2], ["HKCategoryValueSleepAnalysisAsleepREM", 0.25]];
    let cur = startMin;
    for (const [kind, share] of segs) {
      const len = Math.round(sleepMin * share);
      const s = minutesToStamp(d, prev, cur);
      const e = minutesToStamp(d, prev, cur + len);
      recs.push(`<Record type="HKCategoryTypeIdentifierSleepAnalysis" ${watch} creationDate="${e}" startDate="${s}" endDate="${e}" value="${kind}"/>`);
      cur += len;
    }
    if (irregularDays.has(d)) {
      recs.push(`<Record type="HKCategoryTypeIdentifierIrregularHeartRhythmEvent" ${watch} creationDate="${t(d, "15:20:00")}" startDate="${t(d, "13:05:00")}" endDate="${t(d, "15:10:00")}" value="HKCategoryValueNotApplicable"/>`);
    }
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- DADOS FICTÍCIOS gerados pelo Elo Saúde para demonstração. Formato do export.xml do Apple Saúde. -->
<HealthData locale="pt_BR">
 <ExportDate value="${t(today, "08:00:00")}"/>
 <Me HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSexNotSet"/>
 ${recs.join("\n ")}
</HealthData>
`;
  const zip = zipSync({ "apple_health_export/exportação.xml": strToU8(xml) });
  return new File([zip as BlobPart], "exportar.zip", { type: "application/zip" });
}

function minutesToStamp(day: string, prev: string, minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const date = minutes >= 1440 ? day : prev;
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${date} ${hh}:${mm}:00 -0300`;
}

/** Planilha FICTÍCIA no estilo dos apps que exportam o Health Connect (Android), com datas até hoje. */
export function sampleAndroidCsv(today = todayISO(), nDays = 60): File {
  let seed = 11;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const rows = ["Data;Frequência cardíaca em repouso (bpm);Sono (min);Passos;Saturação de oxigênio mínima (%)"];
  for (let i = nDays - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const br = d.split("-").reverse().join("/");
    rows.push([br, Math.round(58 + r() * 4), Math.round(400 + r() * 70), Math.round(9000 + r() * 4000), Math.round(94 + r() * 3)].join(";"));
  }
  return new File(["﻿" + rows.join("\r\n")], "health-connect-export.csv", { type: "text/csv" });
}
