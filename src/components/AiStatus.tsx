"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { getGeminiKey } from "@/lib/gemini";
import { ChevronRight, ScanIcon } from "./icons";

function subscribe(cb: () => void) {
  window.addEventListener("elo-saude:gemini-key", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("elo-saude:gemini-key", cb);
    window.removeEventListener("storage", cb);
  };
}

/** true/false no navegador; null durante a pré-renderização. */
export function useAiEnabled(): boolean | null {
  return useSyncExternalStore(subscribe, () => Boolean(getGeminiKey()), () => null);
}

export function AiStatusBanner() {
  const enabled = useAiEnabled();
  if (enabled !== false) return null;
  return (
    <Link href="/configuracoes" className="lift mt-4 flex items-center gap-3 rounded-2xl border border-line p-4 text-sm text-muted">
      <ScanIcon width={22} className="shrink-0 text-ink" />
      <span className="flex-1">
        <span className="block font-medium text-ink">Leitura de laudos desligada</span>
        Os laudos de exemplo funcionam. Para ler outros, adicione uma chave da Gemini.
      </span>
      <ChevronRight width={18} className="shrink-0 text-faint" />
    </Link>
  );
}
