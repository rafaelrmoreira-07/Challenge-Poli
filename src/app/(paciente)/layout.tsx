import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { HeartIcon } from "@/components/icons";

export default function PacienteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-[#f4f6f8]">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur">
        <Link href="/" className="flex items-center gap-2 font-semibold text-brand-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <HeartIcon width={18} height={18} />
          </span>
          Elo Saúde
        </Link>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
          Dados sintéticos
        </span>
      </header>
      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
