import type { Metadata } from "next";
import { Suspense } from "react";
import { LogoMark } from "@/components/icons";
import { DoctorView } from "@/components/views/DoctorView";

export const metadata: Metadata = {
  title: "Relatório de saúde · Elo Saúde",
  robots: { index: false, follow: false },
};

export default function MedicoPage() {
  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <LogoMark />
            <span className="font-serif text-xl font-semibold text-brand-800">Elo Saúde</span>
            <span className="border-l border-ink-200 pl-2 text-[15px] text-ink-500">Relatório para o médico</span>
          </div>
          <span className="rounded border border-warn-300 px-1.5 py-0.5 text-xs font-semibold text-warn-800">Dados fictícios</span>
        </div>
      </header>
      <Suspense fallback={<p className="p-8 text-center text-[15px] text-ink-500">Carregando relatório…</p>}>
        <DoctorView />
      </Suspense>
    </div>
  );
}
