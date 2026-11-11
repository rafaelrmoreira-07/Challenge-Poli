import { analyteCatalogForPrompt, analyteInfo, resolveAnalyteKey } from "./analytes";
import { isValidISODate } from "./dates";
import { generateJson, geminiConfigured, GeminiUnavailableError } from "./gemini";
import { asset } from "./paths";
import { SAMPLE_EXTRACTIONS } from "./samples";
import type { Extraction, ExtractedResult } from "./types";

export const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Navegadores às vezes não informam o tipo (ex.: HEIC); deduz pela extensão. */
export function fileType(f: File): string {
  if (f.type) return f.type;
  const ext = f.name.split(".").pop()?.toLowerCase();
  return { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif" }[ext ?? ""] ?? "";
}

const SYSTEM = `Você é um extrator de laudos laboratoriais brasileiros. Leia o documento (PDF ou foto, às vezes antiga, torta ou com baixa qualidade) e devolva os resultados em JSON.

Regras:
- Extraia só o que está escrito. Nunca invente valor, unidade ou faixa. Se não conseguir ler, deixe o campo nulo.
- Números brasileiros: vírgula é decimal ("5,8" = 5.8); ponto costuma separar milhar ("7.500" = 7500; "250.000" = 250000).
- "valor" é numérico. Resultados qualitativos ("Negativo", "Não reagente") vão em "valor_texto" com "valor" nulo.
- Faixa de referência: use a do laudo. "Desejável: < 130" vira ref_max=130. "Superior a 40" vira ref_min=40. Se houver faixas por sexo ou idade, escolha a do paciente informado. Copie o texto original da faixa em "ref_texto".
- "chave": use a chave do catálogo abaixo quando o exame corresponder; caso contrário use "outro".
- "data_coleta" no formato AAAA-MM-DD (data da coleta; se não houver, a data do laudo).
- Se o documento não for um laudo laboratorial, devolva "resultados" vazio e explique em "observacoes".

Catálogo de chaves:
${analyteCatalogForPrompt()}`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    laboratorio: { type: "STRING", nullable: true },
    data_coleta: { type: "STRING", nullable: true, description: "AAAA-MM-DD" },
    paciente: { type: "STRING", nullable: true },
    observacoes: { type: "STRING", nullable: true },
    resultados: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          nome: { type: "STRING", description: "Nome do exame como está no laudo" },
          chave: { type: "STRING" },
          valor: { type: "NUMBER", nullable: true },
          valor_texto: { type: "STRING", nullable: true },
          unidade: { type: "STRING" },
          ref_min: { type: "NUMBER", nullable: true },
          ref_max: { type: "NUMBER", nullable: true },
          ref_texto: { type: "STRING", nullable: true },
        },
        required: ["nome", "chave", "unidade"],
      },
    },
  },
  required: ["resultados"],
};

interface RawExtraction {
  laboratorio?: string | null;
  data_coleta?: string | null;
  paciente?: string | null;
  observacoes?: string | null;
  resultados?: {
    nome?: string;
    chave?: string;
    valor?: number | null;
    valor_texto?: string | null;
    unidade?: string;
    ref_min?: number | null;
    ref_max?: number | null;
    ref_texto?: string | null;
  }[];
}

const str = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function normalizeExtraction(raw: RawExtraction): Omit<Extraction, "source" | "model"> {
  const results: ExtractedResult[] = (raw.resultados ?? []).slice(0, 80).flatMap((r) => {
    const name = str(r.nome, 120);
    if (!name) return [];
    const analyteKey = resolveAnalyteKey(str(r.chave, 60) ?? "", name);
    return [{
      name,
      analyteKey,
      value: num(r.valor),
      valueText: str(r.valor_texto, 80),
      unit: str(r.unidade, 30) ?? analyteInfo(analyteKey)?.unit ?? "",
      refLow: num(r.ref_min),
      refHigh: num(r.ref_max),
      refText: str(r.ref_texto, 160),
    }];
  });
  return {
    lab: str(raw.laboratorio, 120),
    examDate: isValidISODate(raw.data_coleta) ? raw.data_coleta : null,
    patientName: str(raw.paciente, 120),
    notes: str(raw.observacoes, 500),
    results,
  };
}

async function sha256(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

let sampleHashes: Promise<Map<string, string>> | null = null;

function loadSampleHashes() {
  sampleHashes ??= (async () => {
    const map = new Map<string, string>();
    for (const file of Object.keys(SAMPLE_EXTRACTIONS)) {
      try {
        const res = await fetch(asset(`/exemplos/${file}`));
        if (res.ok) map.set(await sha256(await res.arrayBuffer()), file);
      } catch {
        // sem rede: segue sem fallback para este exemplo
      }
    }
    return map;
  })();
  return sampleHashes;
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export class NoKeyError extends Error {}

/**
 * Extrai os resultados com a Gemini. Sem chave configurada, ou se a IA cair,
 * os dois laudos de exemplo usam a leitura pré-gravada (marcada como
 * "simulado" na interface). Qualquer outro arquivo pede a chave ou o
 * preenchimento manual.
 */
export async function extractLabReport(file: File, patient: { sex: "F" | "M"; age: number }): Promise<Extraction> {
  const buf = await file.arrayBuffer();
  let failure: Error | null = null;

  if (geminiConfigured()) {
    try {
      const { data, model } = await generateJson<RawExtraction>({
        system: SYSTEM,
        schema: SCHEMA,
        timeoutMs: 40_000,
        parts: [
          { inlineData: { mimeType: file.type, data: toBase64(buf) } },
          { text: `Paciente: sexo ${patient.sex === "F" ? "feminino" : "masculino"}, ${patient.age} anos. Extraia os resultados deste laudo.` },
        ],
      });
      return { ...normalizeExtraction(data), source: "gemini", model };
    } catch (err) {
      failure = err as Error;
    }
  }

  const sample = (await loadSampleHashes()).get(await sha256(buf));
  if (sample) return { ...normalizeExtraction(SAMPLE_EXTRACTIONS[sample]), source: "simulado" };
  if (!failure) throw new NoKeyError("Chave da Gemini não configurada");
  throw failure instanceof GeminiUnavailableError ? failure : new GeminiUnavailableError(failure.message);
}
