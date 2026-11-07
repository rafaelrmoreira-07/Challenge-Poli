import type { Metadata } from "next";
import { Suspense } from "react";
import { HeartIcon } from "@/components/icons";
import { DoctorView } from "@/components/views/DoctorView";

export const metadata: Metadata = {
  title: "Visão do médico · Elo Saúde",
  robots: { index: false, follow: false },
};

export default function MedicoPage() {
  return (
    <div className="min-h-dvh bg-[#f4f6f8]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 font-semibold text-brand-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white"><HeartIcon width={18} height={18} /></span>
            Elo Saúde <span className="font-normal text-slate-400">· Visão do médico</span>
          </div>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">Dados sintéticos</span>
        </div>
      </header>
      <Suspense fallback={<p className="p-8 text-center text-sm text-slate-500">Carregando histórico…</p>}>
        <DoctorView />
      </Suspense>
    </div>
  );
}
