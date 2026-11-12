"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useUnreadCount } from "@/lib/chat";
import { ChatIcon, DoctorIcon, HistoryIcon, HomeIcon, VitalsIcon } from "./icons";

const ITEMS = [
  { href: "/", label: "Hoje", icon: HomeIcon, match: (p: string) => p === "/" },
  { href: "/historico", label: "Histórico", icon: HistoryIcon, match: (p: string) => /^\/(historico|exames?|enviar)/.test(p) },
  { href: "/wearables", label: "Sinais", icon: VitalsIcon, match: (p: string) => p.startsWith("/wearables") },
  { href: "/conversa", label: "Conversa", icon: ChatIcon, match: (p: string) => p.startsWith("/conversa"), chat: true },
  { href: "/compartilhar", label: "Médico", icon: DoctorIcon, match: (p: string) => p.startsWith("/compartilhar") || p.startsWith("/internacao") },
];

/**
 * Em rotas com parâmetro dinâmico o pathname só existe na requisição;
 * o Suspense deixa o resto do layout no shell estático.
 */
export function BottomNav() {
  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
      <Suspense fallback={<NavItems pathname="" />}>
        <ActiveNavItems />
      </Suspense>
    </nav>
  );
}

function ActiveNavItems() {
  return <NavItems pathname={usePathname()} />;
}

function NavItems({ pathname }: { pathname: string }) {
  const unread = useUnreadCount();
  return (
    <ul className="mx-auto flex max-w-md items-stretch justify-around px-2">
      {ITEMS.map(({ href, label, icon: Icon, match, chat }) => {
        const active = pathname !== "" && match(pathname);
        const badge = chat && unread > 0;
        return (
          <li key={href} className="flex-1">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={badge ? `${label}, ${unread} ${unread === 1 ? "mensagem nova" : "mensagens novas"}` : undefined}
              className={`relative flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs transition-colors ${active ? "font-semibold text-ink" : "font-medium text-muted hover:text-ink"}`}
            >
              <span className="relative">
                <Icon width={26} weight={active ? "fill" : "regular"} />
                {badge && (
                  <span className="num absolute -right-2.5 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold leading-none text-ink ring-2 ring-white" aria-hidden>
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </span>
              {label}
              {/* Indicador da tela atual: ponto laranja, além do ícone preenchido e do aria-current */}
              <span className={`mt-0.5 h-1 w-1 rounded-full ${active ? "bg-accent" : "bg-transparent"}`} aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
