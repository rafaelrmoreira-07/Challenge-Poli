import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { analyteCatalogForPrompt, analyteInfo, resolveAnalyteKey } from "./analytes";
import { generateJson, GeminiUnavailableError } from "./gemini";
import { isValidISODate } from "./dates";
import type { Extraction, ExtractedResult } from "./types";
import { SAMPLE_EXTRACTIONS } from "./samples";

export const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

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

let sampleHashes: Map<string, string> | null = null;

async function sampleKeyFor(hash: string): Promise<string | undefined> {
  if (!sampleHashes) {
    sampleHashes = new Map();
    for (const file of Object.keys(SAMPLE_EXTRACTIONS)) {
      try {
        const buf = await readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "exemplos", file));
        sampleHashes.set(createHash("sha256").update(buf).digest("hex"), file);
      } catch {
        // arquivo de exemplo ausente: segue sem fallback para ele
      }
    }
  }
  return sampleHashes.get(hash);
}

/**
 * Extrai os resultados com a Gemini. Se a API estiver indisponível e o arquivo
 * for um dos laudos de exemplo da demo, usa a extração pré-gravada dele
 * (marcada como "simulado" na interface).
 */
export async function extractLabReport(
  file: Buffer,
  mimeType: string,
  patient: { sex: "F" | "M"; age: number },
): Promise<Extraction> {
  try {
    const { data, model } = await generateJson<RawExtraction>({
      system: SYSTEM,
      schema: SCHEMA,
      timeoutMs: 40_000,
      parts: [
        { inlineData: { mimeType, data: file.toString("base64") } },
        { text: `Paciente: sexo ${patient.sex === "F" ? "feminino" : "masculino"}, ${patient.age} anos. Extraia os resultados deste laudo.` },
      ],
    });
    return { ...normalizeExtraction(data), source: "gemini", model };
  } catch (err) {
    const hash = createHash("sha256").update(file).digest("hex");
    const sample = await sampleKeyFor(hash);
    if (sample) {
      console.warn("[extração] usando extração pré-gravada do exemplo", sample, (err as Error).message);
      return { ...normalizeExtraction(SAMPLE_EXTRACTIONS[sample]), source: "simulado" };
    }
    if (err instanceof GeminiUnavailableError) throw err;
    throw new GeminiUnavailableError((err as Error).message);
  }
}
