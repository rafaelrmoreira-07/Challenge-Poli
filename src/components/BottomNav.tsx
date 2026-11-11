"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { DoctorIcon, HomeIcon, PlusIcon, TimelineIcon, WatchIcon } from "./icons";

const ITEMS = [
  { href: "/", label: "Início", icon: HomeIcon, match: (p: string) => p === "/" },
  { href: "/historico", label: "Histórico", icon: TimelineIcon, match: (p: string) => p.startsWith("/historico") || p.startsWith("/exames") || p.startsWith("/exame") },
  { href: "/enviar", label: "Enviar", icon: PlusIcon, match: (p: string) => p.startsWith("/enviar"), primary: true },
  { href: "/wearables", label: "Sinais", icon: WatchIcon, match: (p: string) => p.startsWith("/wearables") },
  { href: "/compartilhar", label: "Médico", icon: DoctorIcon, match: (p: string) => p.startsWith("/compartilhar") },
];

/**
 * Em rotas com parâmetro dinâmico (/exames/[analito]) o pathname só existe
 * na requisição; o Suspense deixa o resto do layout no shell estático.
 */
export function BottomNav() {
  return (
    <nav aria-label="Principal" className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white pb-[env(safe-area-inset-bottom)]">
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
  return (
    <ul className="mx-auto flex max-w-md items-stretch justify-around px-1">
      {ITEMS.map(({ href, label, icon: Icon, match, primary }) => {
        const active = pathname !== "" && match(pathname);
        return (
          <li key={href} className="flex-1">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors ${active ? "text-brand-700" : "text-ink-500 hover:text-ink-800"}`}
            >
              {/* Indicador da aba ativa: fio no topo, além da cor e do aria-current */}
              <span className={`absolute inset-x-4 top-0 h-[3px] rounded-b ${active ? "bg-brand-600" : "bg-transparent"}`} aria-hidden />
              {primary ? (
                <span className={`flex h-8 w-11 items-center justify-center rounded-lg ${active ? "bg-brand-700" : "bg-brand-600"} text-white`}>
                  <Icon width={20} height={20} strokeWidth={2.2} />
                </span>
              ) : (
                <Icon width={24} height={24} strokeWidth={active ? 2.2 : 1.8} />
              )}
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
