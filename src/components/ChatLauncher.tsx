"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Drawer } from "vaul";
import { useUnreadCount } from "@/lib/chat";
import { closeChat, openChat, setChatOpen, useChatOpen } from "@/lib/chatOpen";
import { ChatIcon } from "./icons";
import { ChatPanel } from "./views/ChatView";

/**
 * Botão flutuante da conversa com o Elo. Abre a conversa numa gaveta por
 * cima da tela atual (Vaul), sem trocar de página. Some nas telas com barra
 * de ação fixa embaixo, para não cobrir o botão de salvar.
 */
export function ChatLauncher() {
  return (
    <Suspense fallback={null}>
      <Launcher />
    </Suspense>
  );
}

const HIDE_ON = ["/enviar", "/conversa"];

function Launcher() {
  const open = useChatOpen();
  const unread = useUnreadCount();
  const path = usePathname();
  const hidden = HIDE_ON.some((p) => path.startsWith(p));

  return (
    <Drawer.Root open={open} onOpenChange={setChatOpen} handleOnly>
      {!hidden && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-md justify-end px-4">
          <button
            type="button"
            onClick={openChat}
            aria-label={unread ? `Conversar com o Elo, ${unread} ${unread === 1 ? "mensagem nova" : "mensagens novas"}` : "Conversar com o Elo"}
            className={`lift pointer-events-auto relative flex h-14 items-center gap-2 rounded-full bg-ink pl-4 pr-5 text-white shadow-[0_10px_28px_-8px_rgb(20_28_51/0.55)] transition-opacity duration-200 ${open ? "opacity-0" : "opacity-100"}`}
          >
            <ChatIcon width={24} weight="fill" />
            <span className="text-[15px] font-medium">Elo</span>
            {unread > 0 && (
              <span key={unread} className="t-badge num absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-ink ring-2 ring-white" aria-hidden>
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        </div>
      )}
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-navy-900/40" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[92dvh] max-w-md flex-col overflow-hidden rounded-t-[28px] bg-white outline-none"
        >
          <Drawer.Title className="sr-only">Conversa com o Elo</Drawer.Title>
          <Drawer.Handle className="!mt-3 !mb-1 !h-1.5 !w-11 !rounded-full !bg-line-strong" />
          <div className="min-h-0 flex-1">
            <ChatPanel variant="sheet" onClose={closeChat} />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
