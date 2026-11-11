"use client";

import { useSyncExternalStore } from "react";
import type { LabStatus } from "./health";
import type { AlertSeverity, HealthAlert } from "./types";

/**
 * Conversa com o Elo (chat no estilo do WhatsApp, dentro do app).
 * Fica salva no navegador, separada do histórico de saúde, e guarda quais
 * alertas já foram avisados para não repetir o aviso.
 */

const CHAT_KEY = "elo-saude:chat:v1";
const MAX_MESSAGES = 300;

export type ChatAction =
  | { kind: "reply"; label: string; text: string }
  | { kind: "link"; label: string; href: string; newTab?: boolean }
  | { kind: "tel"; label: string; number: string }
  | { kind: "attach"; label: string }
  | { kind: "sample"; label: string; file: string; mime: string }
  | { kind: "save-exam"; label: string; pendingId: string }
  | { kind: "discard-exam"; label: string; pendingId: string }
  | { kind: "copy"; label: string; text: string }
  | { kind: "revoke"; label: string; token: string };

export interface ChatResultRow {
  name: string;
  value: string;
  unit: string;
  ref: string;
  status: LabStatus;
}

export interface ChatMessage {
  id: string;
  from: "bot" | "user";
  at: string;
  /** Texto com *negrito* no estilo do WhatsApp e quebras de linha. */
  text: string;
  alert?: { id: string; severity: AlertSeverity };
  attachment?: { name: string; mime: string };
  results?: ChatResultRow[];
  actions?: ChatAction[];
  /** Botões já usados (ex.: "Salvar" depois de salvar) ficam desativados. */
  actionsDone?: boolean;
  /** Bot: lida pelo paciente. Usuário: lida pelo Elo (tique azul). */
  read: boolean;
}

/** Etapa de uma conversa em várias mensagens (ex.: criar o relatório para o médico). */
export type ChatFlow = { step: "doctor_name" } | { step: "share_hours"; doctorName: string } | null;

export interface ChatState {
  version: 1;
  messages: ChatMessage[];
  /** Alertas já avisados na conversa. Sai daqui quando o alerta deixa de existir. */
  notified: string[];
  flow: ChatFlow;
}

export type BotDraft = Omit<ChatMessage, "id" | "from" | "at" | "read">;

const listeners = new Set<() => void>();
let cache: ChatState | null | undefined;

function read(): ChatState | null {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    const s = raw ? (JSON.parse(raw) as ChatState) : null;
    return s?.version === 1 ? s : null;
  } catch {
    return null;
  }
}

function notify() {
  for (const l of listeners) l();
}

function write(s: ChatState | null) {
  if (s) {
    s.messages = s.messages.slice(-MAX_MESSAGES);
    localStorage.setItem(CHAT_KEY, JSON.stringify(s));
  } else {
    localStorage.removeItem(CHAT_KEY);
  }
  cache = s;
  notify();
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === CHAT_KEY || e.key === null) {
      cache = undefined;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

function snapshot(): ChatState | null {
  if (cache === undefined) cache = read();
  return cache;
}

/** Conversa atual; null antes de abrir no navegador ou antes da primeira mensagem. */
export function useChat(): ChatState | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}

export function useUnreadCount(): number {
  return useSyncExternalStore(
    subscribe,
    () => snapshot()?.messages.filter((m) => m.from === "bot" && !m.read).length ?? 0,
    () => 0,
  );
}

function mutate(fn: (s: ChatState) => void) {
  const s = structuredClone(snapshot());
  if (!s) return;
  fn(s);
  write(s);
}

const msg = (from: ChatMessage["from"], d: BotDraft, read: boolean): ChatMessage => ({
  id: crypto.randomUUID(),
  from,
  at: new Date().toISOString(),
  read,
  ...d,
});

export function pushBot(d: BotDraft, opts: { read?: boolean } = {}) {
  mutate((s) => {
    // O Elo "leu" tudo o que o paciente mandou antes desta resposta
    for (const m of s.messages) if (m.from === "user") m.read = true;
    s.messages.push(msg("bot", d, opts.read ?? false));
  });
}

export function pushUser(d: BotDraft) {
  mutate((s) => s.messages.push(msg("user", d, false)));
}

export function markAllRead() {
  const s = snapshot();
  if (!s?.messages.some((m) => m.from === "bot" && !m.read)) return;
  mutate((x) => {
    for (const m of x.messages) if (m.from === "bot") m.read = true;
  });
}

export function markActionsDone(messageId: string) {
  mutate((s) => {
    const m = s.messages.find((x) => x.id === messageId);
    if (m) m.actionsDone = true;
  });
}

export function setFlow(flow: ChatFlow) {
  mutate((s) => {
    s.flow = flow;
  });
}

export function getChatSnapshot(): ChatState | null {
  return snapshot();
}

export function resetChat() {
  write(null);
}

// ---------- alertas ----------

export function alertDraft(a: HealthAlert): BotDraft {
  const urgent = a.severity === "procure_medico";
  return {
    alert: { id: a.id, severity: a.severity },
    text: `*${a.title}*\n${a.message}\n\n*O que fazer:* ${a.recommendation}`,
    actions: [
      a.kind === "exames"
        ? { kind: "reply", label: "Ver exames alterados", text: "exames alterados" }
        : { kind: "link", label: "Ver medições", href: "/wearables" },
      ...(urgent ? [{ kind: "reply", label: "Mandar relatório ao médico", text: "relatório para o médico" } as const] : []),
    ],
  };
}

/**
 * Cria a conversa na primeira vez (boas-vindas + alertas atuais, sem aviso
 * na tela) e depois avisa só os alertas novos. Devolve os alertas novos.
 */
export function syncAlerts(firstName: string, alerts: HealthAlert[]): HealthAlert[] {
  const s = snapshot();
  if (!s) {
    const welcome: BotDraft[] = [
      {
        text:
          `Olá, ${firstName}. Aqui é o *Elo Saúde*.\n\n` +
          "Vou te avisar por aqui quando o relógio ou o medidor de pressão registrar algo importante. " +
          "Você também pode me mandar foto ou PDF de exame e pedir o relatório para levar ao médico.",
      },
      {
        text: "Esta conversa não é atendimento de emergência. Se precisar de socorro, ligue *192* (SAMU).",
        actions: menuActions(),
      },
      ...alerts.map(alertDraft),
    ];
    write({
      version: 1,
      flow: null,
      notified: alerts.map((a) => a.id),
      messages: welcome.map((d) => msg("bot", d, false)),
    });
    return [];
  }

  const active = new Set(alerts.map((a) => a.id));
  const fresh = alerts.filter((a) => !s.notified.includes(a.id));
  const gone = s.notified.filter((id) => !active.has(id));
  if (!fresh.length && !gone.length) return [];
  mutate((x) => {
    x.notified = x.notified.filter((id) => active.has(id)).concat(fresh.map((a) => a.id));
    for (const a of fresh) x.messages.push(msg("bot", alertDraft(a), false));
  });
  return fresh;
}

export function menuActions(): ChatAction[] {
  return [
    { kind: "reply", label: "Meus alertas", text: "meus alertas" },
    { kind: "reply", label: "Exames alterados", text: "exames alterados" },
    { kind: "attach", label: "Enviar exame" },
    { kind: "reply", label: "Relatório para o médico", text: "relatório para o médico" },
  ];
}
