"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { CameraIcon, BackIcon, CopyIcon, FileIcon, LogoMark, PaperclipIcon, PhoneIcon, ReadIcon, SendIcon, UrgentIcon, AlertIcon } from "@/components/icons";
import { StatusBadge } from "@/components/ui";
import { markActionsDone, markAllRead, pushBot, pushUser, syncAlerts, useChat, type BotDraft, type ChatAction, type ChatMessage } from "@/lib/chat";
import { respondToFile, respondToText, runAction, type Say } from "@/lib/chatbot";
import { computeAlerts } from "@/lib/health";
import { asset } from "@/lib/paths";
import { useDb } from "@/lib/store";

/** Cores da conversa, no estilo do WhatsApp (fundo bege, balão do paciente verde-claro). */
const WALL = "#efeae2";
const OUT = "#d9fdd3";
const BLUE_TICK = "#027eb5";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const time = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR");
}

/** *negrito* como no WhatsApp; o resto é texto puro (sem HTML). */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*[^*\n]+\*)/g);
  return (
    <p className="whitespace-pre-line break-words">
      {parts.map((p, i) => (p.startsWith("*") && p.endsWith("*") && p.length > 2 ? <strong key={i}>{p.slice(1, -1)}</strong> : <Fragment key={i}>{p}</Fragment>))}
    </p>
  );
}

export function ChatView() {
  const db = useDb();
  const chat = useChat();
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  // Alertas novos entram na conversa mesmo com ela aberta
  useEffect(() => {
    if (db) syncAlerts(db.patient.name.split(" ")[0], computeAlerts(db));
  }, [db]);

  // Conversa aberta: tudo lido
  useEffect(() => {
    if (chat) markAllRead();
  }, [chat]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [chat?.messages.length, typing]);

  const say: Say = useCallback(async (d: BotDraft, opts) => {
    setTyping(true);
    await sleep(opts?.delay ?? 450 + Math.min(d.text.length * 5, 900));
    pushBot(d, { read: true });
    setTyping(false);
  }, []);

  /** Uma resposta por vez, na ordem em que o paciente mandou. */
  const enqueue = useCallback((task: () => Promise<unknown>) => {
    queue.current = queue.current.then(task).catch(() => say({ text: "Algo deu errado aqui. Pode tentar de novo?" }));
  }, [say]);

  const sendText = (shown: string, botText = shown, fromButton = false) => {
    const t = shown.trim();
    if (!t) return;
    pushUser({ text: t });
    enqueue(() => respondToText(botText, say, { fromButton }));
  };

  const sendFile = (file: File) => {
    pushUser({ text: "", attachment: { name: file.name, mime: file.type } });
    enqueue(() => respondToFile(file, say));
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) sendFile(f);
  };

  async function onAction(a: ChatAction, m: ChatMessage) {
    switch (a.kind) {
      case "reply":
        return sendText(a.label, a.text, true);
      case "attach":
        return fileRef.current?.click();
      case "sample": {
        const blob = await (await fetch(asset(`/exemplos/${a.file}`))).blob();
        return sendFile(new File([blob], a.file, { type: a.mime }));
      }
      case "copy":
        try {
          await navigator.clipboard.writeText(a.text);
          setCopied(m.id);
          setTimeout(() => setCopied(null), 2500);
        } catch {
          window.prompt("Copie o link:", a.text);
        }
        return;
      case "save-exam":
      case "discard-exam":
      case "revoke":
        markActionsDone(m.id);
        pushUser({ text: a.label });
        return enqueue(() => runAction(a, m.id, say));
    }
  }

  const messages = chat?.messages ?? [];

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col" style={{ background: WALL }}>
      <header className="flex items-center gap-2 bg-brand-700 px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-white">
        <Link href="/" aria-label="Voltar para o início" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10">
          <BackIcon width={24} />
        </Link>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper">
          <LogoMark width={26} height={26} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[17px] font-semibold leading-tight">Elo Saúde</h1>
          <p className="text-sm leading-tight text-brand-100" aria-live="polite">{typing ? "digitando…" : "online"}</p>
        </div>
      </header>

      <div role="log" aria-label="Mensagens" className="flex-1 overflow-y-auto px-3 py-3">
        <p className="mx-auto mb-3 max-w-xs rounded-lg bg-[#fff5c4] px-3 py-2 text-center text-xs text-ink-700">
          As mensagens ficam salvas só neste aparelho. Esta conversa não é atendimento de emergência: em emergência, ligue 192.
        </p>
        {messages.map((m, i) => {
          const showDay = i === 0 || dayLabel(messages[i - 1].at) !== dayLabel(m.at);
          return (
            <Fragment key={m.id}>
              {showDay && (
                <p className="my-3 text-center">
                  <span className="rounded-md bg-white/90 px-2.5 py-1 text-xs font-medium text-ink-600 shadow-sm">{dayLabel(m.at)}</span>
                </p>
              )}
              <Bubble m={m} copied={copied === m.id} onAction={(a) => onAction(a, m)} />
            </Fragment>
          );
        })}
        {typing && (
          <div className="mb-2 flex">
            <div className="flex items-center gap-1 rounded-lg rounded-tl-none bg-white px-3 py-3 shadow-sm" aria-label="Elo está digitando">
              {[0, 1, 2].map((d) => <span key={d} className="typing-dot h-2 w-2 rounded-full bg-ink-400" style={{ animationDelay: `${d * 0.2}s` }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="flex items-end gap-2 bg-[#f0f2f5] px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        onSubmit={(e) => {
          e.preventDefault();
          sendText(draft);
          setDraft("");
        }}
      >
        <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={onPick} />
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
        <div className="flex min-h-11 flex-1 items-center rounded-3xl bg-white pl-4 pr-1">
          <label htmlFor="mensagem" className="sr-only">Mensagem</label>
          <input
            id="mensagem"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Mensagem"
            autoComplete="off"
            maxLength={500}
            className="min-w-0 flex-1 bg-transparent py-2 text-base text-ink-900 outline-none placeholder:text-ink-500"
          />
          <button type="button" onClick={() => fileRef.current?.click()} aria-label="Anexar exame (PDF ou imagem)" className="flex h-11 w-11 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100">
            <PaperclipIcon width={22} />
          </button>
          <button type="button" onClick={() => camRef.current?.click()} aria-label="Fotografar exame" className="flex h-11 w-11 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100">
            <CameraIcon width={22} />
          </button>
        </div>
        <button type="submit" disabled={!draft.trim()} aria-label="Enviar mensagem" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:opacity-50">
          <SendIcon width={20} />
        </button>
      </form>
    </div>
  );
}

function Bubble({ m, copied, onAction }: { m: ChatMessage; copied: boolean; onAction: (a: ChatAction) => void }) {
  const mine = m.from === "user";
  const urgent = m.alert?.severity === "procure_medico";
  return (
    <div className={`mb-2 flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] overflow-hidden rounded-lg text-[15px] leading-snug text-ink-900 shadow-sm ${mine ? "rounded-tr-none" : "rounded-tl-none bg-white"} ${m.alert ? `border-l-4 ${urgent ? "border-l-danger-600" : "border-l-warn-500"}` : ""}`}
        style={mine ? { background: OUT } : undefined}
      >
        <div className="px-2.5 pb-1.5 pt-2">
          {m.alert && (
            <p className={`mb-1 flex items-center gap-1.5 text-sm font-semibold ${urgent ? "text-danger-700" : "text-warn-800"}`}>
              {urgent ? <UrgentIcon width={16} /> : <AlertIcon width={16} />}
              {urgent ? "Procure um médico" : "Atenção"}
            </p>
          )}
          {m.attachment && (
            <div className="mb-1 flex items-center gap-2 rounded-md bg-black/5 p-2">
              <FileIcon width={28} className="shrink-0 text-danger-600" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{m.attachment.name}</span>
                <span className="block text-xs text-ink-600">{m.attachment.mime === "application/pdf" ? "PDF" : "Imagem"}</span>
              </span>
            </div>
          )}
          {m.text && <RichText text={m.text} />}
          {m.results && (
            <ul className="num mt-2 divide-y divide-ink-100 rounded-md border border-ink-200 text-sm">
              {m.results.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <span className="min-w-0">
                    <span className="block font-medium">{r.name}</span>
                    <span className="block text-xs text-ink-500">Referência {r.ref}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold">{r.value} <span className="text-xs font-normal text-ink-500">{r.unit}</span></span>
                    <StatusBadge status={r.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-0.5 flex items-center justify-end gap-1 text-xs text-ink-500">
            {time(m.at)}
            {mine && <ReadIcon width={16} style={{ color: m.read ? BLUE_TICK : undefined }} aria-label={m.read ? "Lida" : "Enviada"} />}
          </p>
        </div>
        {m.actions && m.actions.length > 0 && (
          <div className="divide-y divide-ink-100 border-t border-ink-100">
            {m.actions.map((a, i) => (
              <ActionButton key={i} a={a} done={Boolean(m.actionsDone) && ["save-exam", "discard-exam", "revoke"].includes(a.kind)} copied={copied} onAction={onAction} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({ a, done, copied, onAction }: { a: ChatAction; done: boolean; copied: boolean; onAction: (a: ChatAction) => void }) {
  const cls = "flex min-h-11 w-full items-center justify-center gap-1.5 px-3 text-[15px] font-semibold text-brand-700 transition-colors hover:bg-ink-50 disabled:text-ink-400 disabled:hover:bg-transparent";
  if (a.kind === "link") {
    return (
      <Link href={a.href} target={a.newTab ? "_blank" : undefined} className={cls}>
        {a.label}
      </Link>
    );
  }
  if (a.kind === "tel") {
    return (
      <a href={`tel:${a.number}`} className={`${cls} text-danger-700`}>
        <PhoneIcon width={18} /> {a.label}
      </a>
    );
  }
  return (
    <button type="button" className={cls} disabled={done} onClick={() => onAction(a)}>
      {a.kind === "copy" && <CopyIcon width={18} />}
      {a.kind === "copy" && copied ? "Link copiado" : a.label}
    </button>
  );
}
