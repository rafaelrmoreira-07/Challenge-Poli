"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { syncAlerts } from "@/lib/chat";
import { computeAlerts } from "@/lib/health";
import { useDb } from "@/lib/store";
import type { HealthAlert } from "@/lib/types";
import { CloseIcon, LogoMark } from "./icons";

/**
 * Leva os alertas para a conversa e, quando aparece um alerta novo,
 * mostra um aviso no topo da tela, como a notificação de uma mensagem.
 */
export function ChatNotifier() {
  const db = useDb();
  const [toast, setToast] = useState<{ alert: HealthAlert; more: number } | null>(null);

  useEffect(() => {
    if (!db || !db.patient.name.trim()) return; // ainda no guia de boas-vindas
    const fresh = syncAlerts(db.patient.name.split(" ")[0], computeAlerts(db));
    if (fresh.length) queueMicrotask(() => setToast({ alert: fresh[0], more: fresh.length - 1 }));
  }, [db]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  const { alert, more } = toast;
  return (
    <div className="fixed inset-x-0 top-2 z-50 mx-auto max-w-md px-3" role="status" aria-live="polite">
      <div className="toast-in flex items-start gap-2 rounded-2xl border border-ink-200 bg-white p-3 shadow-lg">
        <Link href="/conversa" className="flex min-w-0 flex-1 gap-3" onClick={() => setToast(null)}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-paper">
            <LogoMark width={24} height={24} />
          </span>
          <span className="min-w-0">
            <span className="block text-xs text-ink-500">Elo Saúde · agora</span>
            <span className="block text-[15px] font-semibold text-ink-900">
              {alert.severity === "procure_medico" ? "Procure um médico: " : ""}
              {alert.title}
            </span>
            <span className="line-clamp-2 text-sm text-ink-600">
              {alert.message}
              {more > 0 ? ` (+${more} ${more === 1 ? "alerta" : "alertas"})` : ""}
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setToast(null)}
          aria-label="Fechar aviso"
          className="-m-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"
        >
          <CloseIcon width={18} />
        </button>
      </div>
    </div>
  );
}
