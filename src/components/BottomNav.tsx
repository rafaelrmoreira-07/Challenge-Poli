"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { DoctorIcon, HomeIcon, PlusIcon, TimelineIcon, WatchIcon } from "./icons";

const ITEMS = [
  { href: "/", label: "Início", icon: HomeIcon, match: (p: string) => p === "/" },
  { href: "/historico", label: "Histórico", icon: TimelineIcon, match: (p: string) => p.startsWith("/historico") || p.startsWith("/exames") },
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
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
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
    <ul className="mx-auto flex max-w-md items-end justify-around px-2">
      {ITEMS.map(({ href, label, icon: Icon, match, primary }) => {
        const active = pathname !== "" && match(pathname);
        return (
          <li key={href} className="flex-1">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active ? "text-brand-700" : "text-slate-500"}`}
            >
              {primary ? (
                <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30">
                  <Icon />
                </span>
              ) : (
                <Icon />
              )}
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
