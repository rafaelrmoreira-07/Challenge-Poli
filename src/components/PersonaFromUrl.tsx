"use client";

import { useEffect } from "react";
import { PERSONAS } from "@/lib/personas";
import { resetDemo } from "@/lib/store";
import type { PersonaId } from "@/lib/types";

/**
 * Links de demonstração: "?persona=nova" abre o app vazio (com o guia de
 * boas-vindas) e "?persona=carlos" abre com o histórico do Carlos. Ao abrir um
 * desses links, os dados deste navegador voltam ao início daquela persona; o
 * parâmetro sai do endereço para que recarregar a página não apague o progresso.
 */
export function PersonaFromUrl() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get("persona") as PersonaId | null;
    if (!id || !PERSONAS.some((p) => p.id === id)) return;
    url.searchParams.delete("persona");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    void resetDemo(id);
  }, []);
  return null;
}
