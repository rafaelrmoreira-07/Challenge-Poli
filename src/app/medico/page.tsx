import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/icons";
import { DoctorView } from "@/components/views/DoctorView";

export const metadata: Metadata = {
  title: "Relatório de saúde · Elo Saúde",
  robots: { index: false, follow: false },
};

export default function MedicoPage() {
  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden border-l border-line pl-3 text-[15px] text-muted sm:inline">Compartilhado pelo paciente</span>
          </div>
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-ink">Dados fictícios</span>
        </div>
      </header>
      <Suspense fallback={<p className="p-8 text-center text-[15px] text-muted">Carregando relatório…</p>}>
        <DoctorView />
      </Suspense>
    </div>
  );
}
