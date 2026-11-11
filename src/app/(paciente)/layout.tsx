import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { ChatButton } from "@/components/ChatButton";
import { ChatNotifier } from "@/components/ChatNotifier";
import { GearIcon, LogoMark } from "@/components/icons";

export default function PacienteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-paper">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-ink-200 bg-paper px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <Link href="/" className="-ml-1 flex min-h-11 items-center gap-2 px-1">
          <LogoMark />
          <span className="font-serif text-xl font-semibold tracking-[-0.01em] text-brand-800">Elo Saúde</span>
        </Link>
        <div className="flex items-center">
          <span className="mr-1 rounded border border-warn-300 px-1.5 py-0.5 text-xs font-semibold text-warn-800">
            Dados fictícios
          </span>
          <ChatButton />
          <Link
            href="/configuracoes"
            aria-label="Configurações"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-600 transition-colors hover:bg-ink-100"
          >
            <GearIcon width={24} />
          </Link>
        </div>
      </header>
      <ChatNotifier />
      <main className="flex-1 px-4 pb-32 pt-5">{children}</main>
      <BottomNav />
    </div>
  );
}
