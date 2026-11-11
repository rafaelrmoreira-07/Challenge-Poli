"use client";

import Link from "next/link";
import { useUnreadCount } from "@/lib/chat";
import { ChatIcon } from "./icons";

/** Atalho do cabeçalho para a conversa, com o número de mensagens novas do Elo. */
export function ChatButton() {
  const unread = useUnreadCount();
  return (
    <Link
      href="/conversa"
      aria-label={unread ? `Conversa com o Elo, ${unread} ${unread === 1 ? "mensagem nova" : "mensagens novas"}` : "Conversa com o Elo"}
      className="relative flex h-11 w-11 items-center justify-center rounded-lg text-ink-600 transition-colors hover:bg-ink-100"
    >
      <ChatIcon width={24} />
      {unread > 0 && (
        <span className="num absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-xs font-bold text-white" aria-hidden>
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
