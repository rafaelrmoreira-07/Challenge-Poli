import { analyteCatalogForPrompt, analyteInfo, resolveAnalyteKey } from "./analytes";
import { isValidISODate } from "./dates";
import { generateJson, geminiConfigured, GeminiUnavailableError } from "./gemini";
import { asset } from "./paths";
import { SAMPLE_EXTRACTIONS } from "./samples";
import type { Confidence, DescriptiveReport, Extraction, ExtractedResult, ReportCategory } from "./types";

export const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Navegadores às vezes não informam o tipo (ex.: HEIC); deduz pela extensão. */
export function fileType(f: File): string {
  if (f.type) return f.type;
  const ext = f.name.split(".").pop()?.toLowerCase();
  return { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif" }[ext ?? ""] ?? "";
}

const SYSTEM = `Você é um extrator de laudos médicos brasileiros. Leia o documento (PDF ou foto, às vezes antiga, torta ou com baixa qualidade) e devolva JSON.

Há dois tipos de laudo:
1. LABORATORIAL: tabela de exames com valor, unidade e faixa (sangue, urina...). "tipo_documento" = "laboratorial"; preencha "resultados".
2. DESCRITIVO: texto do médico sobre um exame de imagem ou procedimento (ecocardiograma, eletrocardiograma, Holter, MAPA, ultrassom, raio X, tomografia, ressonância, mamografia, densitometria, endoscopia, colonoscopia...). "tipo_documento" = "descritivo"; "resultados" vazio; preencha "laudo_descritivo":
   - "exame": nome do exame como está no laudo;
   - "categoria": "imagem" (ultrassom, raio X, tomografia, ressonância, mamografia, densitometria), "cardiologico" (eletrocardiograma, ecocardiograma, Holter, MAPA, teste ergométrico), "endoscopia" (endoscopia, colonoscopia) ou "outro";
   - "conclusao": a conclusão ou impressão diagnóstica, copiada como está escrita (não resuma, não interprete);
   - "achados": resumo fiel dos achados principais, em até 4 frases, sem acrescentar nada;
   - "medico": quem assina, se houver.
   "laboratorio" é a clínica ou hospital; "data_coleta" é a data do exame.
Se não for laudo médico, "tipo_documento" = "outro", "resultados" vazio, e explique em "observacoes".

Regras para o laudo laboratorial:
- Extraia só o que está escrito. Nunca invente valor, unidade ou faixa. Se não conseguir ler, deixe o campo nulo.
- "confianca" diz o quanto você tem certeza do VALOR lido: "alta" (nítido), "media" (legível, mas com alguma dúvida: borrado, dígito parecido com outro, alinhamento confuso na tabela) ou "baixa" (adivinhação). Se o número estiver coberto por carimbo, rasgado ou ilegível, NÃO tente adivinhar: devolva "valor" nulo e "confianca" baixa. Prefira marcar dúvida a errar.
- Números brasileiros: vírgula é decimal ("5,8" = 5.8); ponto costuma separar milhar ("7.500" = 7500; "250.000" = 250000).
- "valor" é numérico. Resultados qualitativos ("Negativo", "Não reagente") vão em "valor_texto" com "valor" nulo.
- Faixa de referência: use a do laudo. "Desejável: < 130" vira ref_max=130. "Superior a 40" vira ref_min=40. Se houver faixas por sexo ou idade, escolha a do paciente informado. Copie o texto original da faixa em "ref_texto".
- "chave": use a chave do catálogo abaixo quando o exame corresponder; caso contrário use "outro".
- "data_coleta" no formato AAAA-MM-DD (data da coleta; se não houver, a data do laudo).

Catálogo de chaves:
${analyteCatalogForPrompt()}`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    laboratorio: { type: "STRING", nullable: true },
    data_coleta: { type: "STRING", nullable: true, description: "AAAA-MM-DD" },
    paciente: { type: "STRING", nullable: true },
    observacoes: { type: "STRING", nullable: true },
    tipo_documento: { type: "STRING", enum: ["laboratorial", "descritivo", "outro"] },
    laudo_descritivo: {
      type: "OBJECT",
      nullable: true,
      properties: {
        exame: { type: "STRING" },
        categoria: { type: "STRING", enum: ["imagem", "cardiologico", "endoscopia", "outro"] },
        conclusao: { type: "STRING" },
        achados: { type: "STRING", nullable: true },
        medico: { type: "STRING", nullable: true },
      },
      required: ["exame", "categoria", "conclusao"],
    },
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
          confianca: { type: "STRING", enum: ["alta", "media", "baixa"] },
        },
        required: ["nome", "chave", "unidade", "confianca"],
      },
    },
  },
  required: ["resultados"],
};

export interface RawExtraction {
  tipo_documento?: string | null;
  laudo_descritivo?: { exame?: string | null; categoria?: string | null; conclusao?: string | null; achados?: string | null; medico?: string | null } | null;
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
    confianca?: string | null;
  }[];
}

const str = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const conf = (v: unknown): Confidence | null => {
  const s = typeof v === "string" ? v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";
  return s === "alta" || s === "media" || s === "baixa" ? s : null;
};

const CATEGORIES: ReportCategory[] = ["imagem", "cardiologico", "endoscopia", "outro"];

/** Laudo descritivo válido só se tiver nome do exame e conclusão. */
export function normalizeReport(raw: RawExtraction["laudo_descritivo"]): DescriptiveReport | null {
  const examName = str(raw?.exame, 120);
  const conclusion = str(raw?.conclusao, 1200);
  if (!examName || !conclusion) return null;
  const cat = str(raw?.categoria, 20) as ReportCategory | null;
  return {
    examName,
    category: cat && CATEGORIES.includes(cat) ? cat : "outro",
    conclusion,
    findings: str(raw?.achados, 1200) ?? undefined,
    physician: str(raw?.medico, 120) ?? undefined,
  };
}

function normalizeExtraction(raw: RawExtraction): Omit<Extraction, "source" | "model"> {
  const report = raw.tipo_documento === "descritivo" || raw.laudo_descritivo ? normalizeReport(raw.laudo_descritivo) : null;
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
      // Valor ausente sem texto qualitativo = a IA não conseguiu ler: sempre pede conferência.
      confidence: num(r.valor) == null && !str(r.valor_texto, 80) ? "baixa" : conf(r.confianca),
    }];
  });
  return {
    lab: str(raw.laboratorio, 120),
    examDate: isValidISODate(raw.data_coleta) ? raw.data_coleta : null,
    patientName: str(raw.paciente, 120),
    notes: str(raw.observacoes, 500),
    // Laudo descritivo não mistura tabela de números: os resultados ficam vazios
    results: report ? [] : results,
    report,
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
 * os laudos de exemplo usam a leitura pré-gravada (marcada como
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
          { inlineData: { mimeType: fileType(file), data: toBase64(buf) } },
          { text: `Paciente: sexo ${patient.sex === "F" ? "feminino" : "masculino"}, ${patient.age} anos. Identifique o tipo do laudo e extraia o conteúdo.` },
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
