import "server-only";

/**
 * Cliente mínimo da Gemini API (REST). Tenta cada modelo de GEMINI_MODELS em
 * ordem: se um estiver sobrecarregado (429/503) ou demorar demais, passa para
 * o próximo. Isso importa numa demo ao vivo.
 */

const API = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODELS = ["gemini-3.5-flash", "gemini-3-flash-preview", "gemini-3.8-flash"];

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

export class GeminiUnavailableError extends Error {}

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function models(): string[] {
  const env = process.env.GEMINI_MODELS?.split(",").map((m) => m.trim()).filter(Boolean);
  return env?.length ? env : DEFAULT_MODELS;
}

export async function generateJson<T>(opts: {
  system: string;
  parts: GeminiPart[];
  schema: object;
  timeoutMs?: number;
}): Promise<{ data: T; model: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiUnavailableError("GEMINI_API_KEY não configurada");

  const errors: string[] = [];
  for (const model of models()) {
    const started = Date.now();
    try {
      const data = await attempt<T>(model, key, opts);
      console.info(`[gemini] ${model} respondeu em ${Date.now() - started} ms`);
      return { data, model };
    } catch (err) {
      const msg = `${model}: ${(err as Error).message}`;
      console.warn(`[gemini] falhou em ${Date.now() - started} ms → ${msg.slice(0, 200)}`);
      errors.push(msg);
    }
  }
  throw new GeminiUnavailableError(errors.join(" | "));
}

async function attempt<T>(
  model: string,
  key: string,
  opts: { system: string; parts: GeminiPart[]; schema: object; timeoutMs?: number },
): Promise<T> {
  const res = await fetch(`${API}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [{ role: "user", parts: opts.parts }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: opts.schema,
        thinkingConfig: { thinkingLevel: "low" },
      },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${body?.error?.message ?? ""}`.trim());
  const text: string | undefined = body?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("");
  if (!text) throw new Error(`resposta vazia (${body?.candidates?.[0]?.finishReason ?? "sem candidato"})`);
  return JSON.parse(text) as T;
}
