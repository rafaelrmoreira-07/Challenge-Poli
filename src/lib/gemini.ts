/**
 * Cliente da Gemini API chamado direto do navegador. A chave é digitada pela
 * pessoa em Configurações e fica só no localStorage deste navegador: nunca é
 * embutida no site publicado.
 *
 * Tenta cada modelo em ordem; se um estiver sobrecarregado ou demorar demais,
 * passa para o próximo.
 */

const API = "https://generativelanguage.googleapis.com/v1beta/models";
const KEY_STORAGE = "elo-saude:gemini-key";
export const MODELS = ["gemini-3.5-flash", "gemini-3-flash-preview", "gemini-3.8-flash"];

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

export class GeminiUnavailableError extends Error {}

export function getGeminiKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY_STORAGE);
}

export function setGeminiKey(key: string | null) {
  if (key) localStorage.setItem(KEY_STORAGE, key.trim());
  else localStorage.removeItem(KEY_STORAGE);
  window.dispatchEvent(new Event("elo-saude:gemini-key"));
}

export function geminiConfigured(): boolean {
  return Boolean(getGeminiKey());
}

export async function generateJson<T>(opts: {
  system: string;
  parts: GeminiPart[];
  schema: object;
  timeoutMs?: number;
}): Promise<{ data: T; model: string }> {
  const key = getGeminiKey();
  if (!key) throw new GeminiUnavailableError("Chave da Gemini não configurada");

  const errors: string[] = [];
  for (const model of MODELS) {
    try {
      return { data: await attempt<T>(model, key, opts), model };
    } catch (err) {
      const msg = `${model}: ${(err as Error).message}`;
      console.warn("[gemini]", msg.slice(0, 200));
      errors.push(msg);
      // Chave inválida: não adianta tentar outro modelo.
      if (/API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(msg)) break;
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
    signal: AbortSignal.timeout(opts.timeoutMs ?? 40_000),
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

/** Teste rápido da chave, usado na tela de Configurações. */
export async function testGeminiKey(): Promise<{ ok: true; model: string } | { ok: false; error: string }> {
  try {
    const { model } = await generateJson<{ ok: boolean }>({
      system: "Responda apenas o JSON pedido.",
      parts: [{ text: 'Responda {"ok": true}' }],
      schema: { type: "OBJECT", properties: { ok: { type: "BOOLEAN" } }, required: ["ok"] },
      timeoutMs: 20_000,
    });
    return { ok: true, model };
  } catch (err) {
    const msg = (err as Error).message;
    return { ok: false, error: /API key not valid|API_KEY_INVALID/i.test(msg) ? "Chave inválida." : "Não foi possível falar com a Gemini agora." };
  }
}
