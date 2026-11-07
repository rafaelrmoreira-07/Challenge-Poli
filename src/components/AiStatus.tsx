"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { getGeminiKey } from "@/lib/gemini";
import { SparkIcon } from "./icons";

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
    <Link href="/configuracoes" className="mt-4 flex items-start gap-3 rounded-2xl bg-sky-50 p-3 text-sm text-sky-900 ring-1 ring-sky-200">
      <SparkIcon className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
      <span>
        <strong>IA desligada.</strong> Os laudos de exemplo funcionam com leitura pré-gravada. Para ler qualquer laudo e gerar o resumo do médico, informe uma chave da Gemini em <u>Configurações</u>.
      </span>
    </Link>
  );
}
