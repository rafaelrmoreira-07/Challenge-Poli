"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { AlertIcon, ArrowUpIcon, BackIcon, CameraIcon, ChevronRight, CloseIcon, CopyIcon, FileIcon, LogoMark, PaperclipIcon, PhoneIcon, UrgentIcon } from "@/components/icons";
import { StatusBadge } from "@/components/ui";
import { markActionsDone, markAllRead, menuActions, pushBot, pushUser, syncAlerts, useChat, type BotDraft, type ChatAction, type ChatMessage } from "@/lib/chat";
import { respondToFile, respondToText, runAction, type Say } from "@/lib/chatbot";
import { computeAlerts } from "@/lib/health";
import { asset } from "@/lib/paths";
import { useDb } from "@/lib/store";

/*
 * Conversa com o Elo, com a identidade do app: balão do paciente em
 * azul-marinho, respostas do Elo em superfície clara, ações como pílulas
 * e sugestões fixas acima do campo de mensagem.
 */

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

/** *negrito* no texto das respostas; o resto é texto puro (sem HTML). */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*[^*\n]+\*)/g);
  return (
    <p className="whitespace-pre-line break-words">
      {parts.map((p, i) => (p.startsWith("*") && p.endsWith("*") && p.length > 2 ? <strong key={i} className="font-semibold">{p.slice(1, -1)}</strong> : <Fragment key={i}>{p}</Fragment>))}
    </p>
  );
}

/**
 * `variant="sheet"`: dentro da gaveta que abre por cima de qualquer tela.
 * `variant="page"`: tela cheia em /conversa (links diretos).
 */
export function ChatPanel({ variant = "page", onClose }: { variant?: "sheet" | "page"; onClose?: () => void }) {
  const db = useDb();
  const chat = useChat();
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (db) syncAlerts(db.patient.name.split(" ")[0], computeAlerts(db));
  }, [db]);

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

  const enqueue = useCallback(
    (task: () => Promise<unknown>) => {
      queue.current = queue.current.then(task).catch(() => say({ text: "Algo deu errado aqui. Pode tentar de novo?" }));
    },
    [say],
  );

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

  async function onAction(a: ChatAction, m?: ChatMessage) {
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
          if (m) setCopied(m.id);
          setTimeout(() => setCopied(null), 2500);
        } catch {
          window.prompt("Copie o link:", a.text);
        }
        return;
      case "save-exam":
      case "discard-exam":
      case "revoke":
        if (!m) return;
        markActionsDone(m.id);
        pushUser({ text: a.label });
        return enqueue(() => runAction(a, m.id, say));
    }
  }

  const messages = chat?.messages ?? [];
  const sheet = variant === "sheet";

  return (
    <div className={`flex min-h-0 flex-col bg-white ${sheet ? "h-full" : "mx-auto h-dvh max-w-md"}`}>
      <header className={`flex items-center gap-3 border-b border-line px-4 pb-3 ${sheet ? "pt-2" : "pt-[max(0.75rem,env(safe-area-inset-top))]"}`}>
        {!sheet && (
          <Link href="/" aria-label="Voltar para o início" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface">
            <BackIcon width={22} />
          </Link>
        )}
        <span className="relative shrink-0">
          <LogoMark width={40} height={40} />
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-ok ring-2 ring-white" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold leading-tight tracking-[-0.01em]">Elo</h2>
          <p className="text-sm leading-tight text-muted" aria-live="polite">
            {typing ? <span className="t-shimmer">escrevendo…</span> : "Assistente de saúde"}
          </p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Fechar a conversa" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-surface">
            <CloseIcon width={22} />
          </button>
        )}
      </header>

      <div role="log" aria-label="Mensagens" data-vaul-no-drag className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <p className="mb-4 text-center text-xs leading-relaxed text-muted">
          A conversa fica salva só neste aparelho. Não é atendimento de emergência: se precisar de socorro, ligue 192.
        </p>
        {messages.map((m, i) => {
          const showDay = i === 0 || dayLabel(messages[i - 1].at) !== dayLabel(m.at);
          const grouped = i > 0 && messages[i - 1].from === m.from && !showDay;
          return (
            <Fragment key={m.id}>
              {showDay && <p className="my-4 text-center text-xs font-medium text-muted">{dayLabel(m.at)}</p>}
              <Bubble m={m} grouped={grouped} copied={copied === m.id} onAction={(a) => onAction(a, m)} onNavigate={onClose} />
            </Fragment>
          );
        })}
        {typing && (
          <div className="t-step mt-3 flex items-end gap-2">
            <span className="w-7 shrink-0" />
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-surface px-4 py-3.5" aria-label="Elo está escrevendo">
              {[0, 1, 2].map((d) => <span key={d} className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" style={{ animationDelay: `${d * 0.2}s` }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className={`border-t border-line bg-white ${sheet ? "pb-[max(0.75rem,env(safe-area-inset-bottom))]" : "pb-[max(0.75rem,env(safe-area-inset-bottom))]"}`}>
        <div className="flex gap-2 overflow-x-auto px-4 pt-3" data-vaul-no-drag aria-label="Sugestões">
          {menuActions().map((a) => (
            <button key={a.label} type="button" onClick={() => onAction(a)} className="shrink-0 rounded-full bg-surface px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-2">
              {a.label}
            </button>
          ))}
        </div>
        <form
          className="flex items-end gap-2 px-3 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            sendText(draft);
            setDraft("");
          }}
        >
          <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={onPick} />
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
          <button type="button" onClick={() => fileRef.current?.click()} aria-label="Anexar exame (PDF ou imagem)" className="flex h-12 w-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-surface">
            <PaperclipIcon width={22} />
          </button>
          <div className="flex min-h-12 flex-1 items-center rounded-2xl bg-surface pl-4 pr-1 ring-ink/40 focus-within:ring-2">
            <label htmlFor="mensagem" className="sr-only">Mensagem</label>
            <input
              id="mensagem"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escreva sua pergunta"
              autoComplete="off"
              enterKeyHint="send"
              maxLength={500}
              className="min-w-0 flex-1 bg-transparent py-2 text-base text-ink outline-none placeholder:text-muted focus-visible:outline-none"
            />
            <button type="button" onClick={() => camRef.current?.click()} aria-label="Fotografar exame" className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:text-ink">
              <CameraIcon width={22} />
            </button>
          </div>
          <button type="submit" disabled={!draft.trim()} aria-label="Enviar mensagem" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-ink transition-colors hover:bg-accent-hover disabled:bg-surface disabled:text-faint">
            <ArrowUpIcon width={22} />
          </button>
        </form>
      </div>
    </div>
  );
}

/** Tela cheia em /conversa, para links diretos. */
export function ChatView() {
  return <ChatPanel variant="page" />;
}

function Bubble({ m, grouped, copied, onAction, onNavigate }: { m: ChatMessage; grouped: boolean; copied: boolean; onAction: (a: ChatAction) => void; onNavigate?: () => void }) {
  const mine = m.from === "user";
  const urgent = m.alert?.severity === "procure_medico";
  const done = Boolean(m.actionsDone);

  if (mine) {
    return (
      <div className={`t-step flex justify-end ${grouped ? "mt-1" : "mt-3"}`}>
        <div className="max-w-[80%]">
          <div className="rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[15px] leading-snug text-white">
            {m.attachment && (
              <span className="flex items-center gap-2">
                <FileIcon width={22} className="shrink-0 text-accent" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{m.attachment.name}</span>
                  <span className="block text-xs text-navy-200">{m.attachment.mime === "application/pdf" ? "PDF" : "Imagem"}</span>
                </span>
              </span>
            )}
            {m.text && <RichText text={m.text} />}
          </div>
          {!grouped && <p className="mt-1 text-right text-xs text-muted">{time(m.at)}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={`t-step flex items-end gap-2 ${grouped ? "mt-1" : "mt-3"}`}>
      <span className="w-7 shrink-0">{!grouped && <LogoMark width={28} height={28} />}</span>
      <div className="min-w-0 max-w-[85%]">
        <div className={`rounded-2xl rounded-bl-md px-4 py-3 text-[15px] leading-relaxed text-ink ${m.alert ? (urgent ? "bg-danger-soft" : "bg-warn-soft") : "bg-surface"}`}>
          {m.alert && (
            <p className={`mb-1 flex items-center gap-1.5 text-sm font-semibold ${urgent ? "text-danger" : "text-warn"}`}>
              {urgent ? <UrgentIcon width={16} /> : <AlertIcon width={16} />}
              {urgent ? "Procure um médico" : "Atenção"}
            </p>
          )}
          {m.text && <RichText text={m.text} />}
          {m.results && (
            <ul className="num mt-3 divide-y divide-line rounded-xl bg-white text-sm">
              {m.results.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block font-medium">{r.name}</span>
                    <span className="block text-xs text-muted">Referência {r.ref}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold">{r.value} <span className="text-xs font-normal text-muted">{r.unit}</span></span>
                    <StatusBadge status={r.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {m.actions && m.actions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {m.actions.map((a, i) => (
              <ActionChip key={i} a={a} primary={i === 0 && ["save-exam", "copy", "tel"].includes(a.kind)} done={done && ["save-exam", "discard-exam", "revoke"].includes(a.kind)} copied={copied} onAction={onAction} onNavigate={onNavigate} />
            ))}
          </div>
        )}
        {!grouped && <p className="mt-1 text-xs text-muted">{time(m.at)}</p>}
      </div>
    </div>
  );
}

function ActionChip({ a, primary, done, copied, onAction, onNavigate }: { a: ChatAction; primary: boolean; done: boolean; copied: boolean; onAction: (a: ChatAction) => void; onNavigate?: () => void }) {
  const base = "inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors disabled:cursor-default disabled:opacity-50";
  const tone = primary ? "bg-accent text-ink hover:bg-accent-hover" : "border border-line-strong bg-white text-ink hover:border-ink";
  if (a.kind === "link") {
    return (
      <Link href={a.href} target={a.newTab ? "_blank" : undefined} onClick={a.newTab ? undefined : onNavigate} className={`${base} ${tone}`}>
        {a.label} <ChevronRight width={14} />
      </Link>
    );
  }
  if (a.kind === "tel") {
    return (
      <a href={`tel:${a.number}`} className={`${base} bg-danger text-white`}>
        <PhoneIcon width={16} /> {a.label}
      </a>
    );
  }
  return (
    <button type="button" className={`${base} ${tone}`} disabled={done} onClick={() => onAction(a)}>
      {a.kind === "copy" && <CopyIcon width={16} />}
      {a.kind === "copy" && copied ? "Link copiado" : a.label}
    </button>
  );
}
