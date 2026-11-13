"use client";

import Link from "next/link";
import { useUnreadCount } from "@/lib/chat";
import { ChatIcon } from "./icons";

/** Atalho do cabeçalho para a conversa com o Elo, com o número de mensagens novas. */
export function ChatButton() {
  const unread = useUnreadCount();
  return (
    <Link
      href="/conversa"
      aria-label={unread ? `Conversa com o Elo, ${unread} ${unread === 1 ? "mensagem nova" : "mensagens novas"}` : "Conversa com o Elo"}
      className="relative flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface"
    >
      <ChatIcon width={23} />
      {unread > 0 && (
        <span className="num absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold leading-none text-ink ring-2 ring-white" aria-hidden>
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
