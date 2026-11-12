"use client";

import { analyteCatalogForPrompt, analyteInfo } from "./analytes";
import type { ChatAction, ChatMessage } from "./chat";
import { generateJson, geminiConfigured } from "./gemini";
import { scopedData } from "./share";
import { getDbSnapshot } from "./store";
import { buildClinicalContext } from "./summary";
import { SCOPES } from "./types";

/**
 * Conversa livre com o Elo usando a Gemini. As regras do chatbot continuam
 * na frente para o que precisa ser previsível (emergência, revogar acesso,
 * enviar laudo, criar relatório); a IA responde as perguntas abertas, com o
 * histórico do paciente como contexto (sem o nome) e sem dar diagnóstico.
 */

const SYSTEM = `Você é o Elo, o assistente de um app brasileiro que organiza o histórico de saúde de uma pessoa (exames, remédios, vacinas, consultas e dados de relógio inteligente). Você conversa com o próprio paciente, no estilo de uma conversa de WhatsApp.

Como responder:
- Português do Brasil, tom humano, calmo e acolhedor, como uma pessoa atenciosa que conhece o histórico dele. Trate por "você".
- Curto: de 1 a 4 frases. Use *negrito* (um asterisco de cada lado) só para números ou nomes importantes. Sem emoji, sem listas longas, sem markdown de títulos.
- Use APENAS os dados do histórico abaixo. Cite números e datas quando ajudarem. Se o dado não estiver no histórico, diga que ainda não tem e sugira enviar o laudo.
- Pode explicar em linguagem simples o que um exame mede ou o que um alerta do relógio significa em termos gerais.

Limites (obrigatórios):
- Nunca dê diagnóstico, nem diga que a pessoa "tem" uma doença. Use "vale conversar com seu médico", "quem interpreta é o médico".
- Nunca indique, suspenda ou mude remédio ou dose. Para isso, oriente falar com o médico.
- Se a pessoa descrever sintomas graves agora (dor no peito, falta de ar, desmaio, fraqueza de um lado do corpo, sangramento forte), a primeira frase é: ligue 192 (SAMU) ou vá ao pronto-socorro.
- Se a pergunta não for sobre saúde ou sobre o app, responda com gentileza em uma frase e volte ao assunto.

"acao" sugere um botão para a resposta: "ver_exame" (preencha "exame" com a chave do catálogo), "ver_exames", "ver_sinais", "ver_remedios", "relatorio_medico" (quando fizer sentido levar os dados ao médico), "enviar_exame" (falta um laudo) ou "nenhuma".

Chaves do catálogo de exames:
${analyteCatalogForPrompt()}`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    resposta: { type: "STRING" },
    acao: { type: "STRING", enum: ["ver_exame", "ver_exames", "ver_sinais", "ver_remedios", "relatorio_medico", "enviar_exame", "nenhuma"] },
    exame: { type: "STRING", nullable: true },
  },
  required: ["resposta", "acao"],
};

interface RawReply {
  resposta?: string;
  acao?: string;
  exame?: string | null;
}

export function chatAiAvailable(): boolean {
  return geminiConfigured();
}

/** Tira o nome do paciente do texto: nada que identifique a pessoa vai para a IA. */
function anonymize(text: string, patientName: string): string {
  const parts = patientName.split(/\s+/).filter((w) => w.length >= 3);
  return parts.reduce((t, w) => t.replace(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), "[paciente]"), text);
}

function transcript(history: ChatMessage[], patientName: string): string {
  return history
    .filter((m) => m.text.trim())
    .slice(-8)
    .map((m) => `${m.from === "user" ? "Paciente" : "Elo"}: ${anonymize(m.text.replace(/\s+/g, " ").slice(0, 400), patientName)}`)
    .join("\n");
}

function actionFor(r: RawReply): ChatAction[] {
  switch (r.acao) {
    case "ver_exame": {
      const info = r.exame ? analyteInfo(r.exame) : undefined;
      return info ? [{ kind: "link", label: `Ver gráfico de ${info.name}`, href: `/exame/?a=${encodeURIComponent(info.key)}` }] : [{ kind: "link", label: "Ver exames", href: "/exames" }];
    }
    case "ver_exames":
      return [{ kind: "link", label: "Ver exames", href: "/exames" }];
    case "ver_sinais":
      return [{ kind: "link", label: "Ver sinais do relógio", href: "/wearables" }];
    case "ver_remedios":
      return [{ kind: "link", label: "Ver histórico", href: "/historico" }];
    case "relatorio_medico":
      return [{ kind: "reply", label: "Mandar relatório ao médico", text: "relatório para o médico" }];
    case "enviar_exame":
      return [{ kind: "attach", label: "Enviar exame" }];
    default:
      return [];
  }
}

/** Resposta da IA para uma pergunta livre. Lança erro se a IA falhar (o chamador cai nas regras). */
export async function aiReply(question: string, history: ChatMessage[]): Promise<{ text: string; actions: ChatAction[] }> {
  const db = getDbSnapshot();
  const context = buildClinicalContext(scopedData(db, [...SCOPES]));
  const { data } = await generateJson<RawReply>({
    system: SYSTEM,
    schema: SCHEMA,
    timeoutMs: 25_000,
    parts: [
      {
        text:
          `HISTÓRICO DO PACIENTE\n${context}\n\n` +
          `CONVERSA ATÉ AGORA\n${transcript(history, db.patient.name) || "(início da conversa)"}\n\n` +
          `NOVA MENSAGEM DO PACIENTE\n${anonymize(question, db.patient.name)}`,
      },
    ],
  });
  const text = typeof data.resposta === "string" ? data.resposta.trim().slice(0, 1200) : "";
  if (!text) throw new Error("Resposta vazia da IA");
  return { text, actions: actionFor(data) };
}
