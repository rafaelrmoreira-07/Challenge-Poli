"use client";

import { useSyncExternalStore } from "react";

/** Estado global da conversa (aberta ou fechada), para abrir de qualquer tela. */
let open = false;
const listeners = new Set<() => void>();
const set = (v: boolean) => {
  if (open === v) return;
  open = v;
  for (const l of listeners) l();
};

export const openChat = () => set(true);
export const closeChat = () => set(false);
export const setChatOpen = (v: boolean) => set(v);

export function useChatOpen(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open,
    () => false,
  );
}
