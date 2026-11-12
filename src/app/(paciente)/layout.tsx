import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { ChatNotifier } from "@/components/ChatNotifier";
import { GearIcon, Logo } from "@/components/icons";
import { OnboardingGate } from "@/components/OnboardingGate";

export default function PacienteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-bg">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-white/95 px-5 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <Link href="/" aria-label="Elo Saúde, início" className="-ml-1 flex min-h-11 items-center px-1">
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-ink">Dados fictícios</span>
          <Link
            href="/configuracoes"
            aria-label="Configurações"
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface"
          >
            <GearIcon width={22} />
          </Link>
        </div>
      </header>
      <ChatNotifier />
      <main className="flex-1 px-5 pb-32 pt-4">{children}</main>
      <BottomNav />
      <OnboardingGate />
    </div>
  );
}
