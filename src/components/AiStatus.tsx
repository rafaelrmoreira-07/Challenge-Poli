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
    <Link href="/configuracoes" className="mt-3 flex items-center gap-3 rounded-xl border border-ink-200 bg-ink-50 p-3 text-sm text-ink-700 transition-colors hover:bg-ink-100">
      <ScanIcon className="h-5 w-5 shrink-0 text-ink-500" />
      <span className="flex-1">
        <strong className="text-ink-900">Leitura por IA desligada.</strong> Os laudos de exemplo usam leitura pré-gravada. Para ler qualquer laudo, informe uma chave da Gemini em Configurações.
      </span>
      <ChevronRight width={18} height={18} className="shrink-0 text-ink-400" />
    </Link>
  );
}
