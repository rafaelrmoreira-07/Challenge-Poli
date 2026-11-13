"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { DoctorIcon, HistoryIcon, HomeIcon, PlusIcon, VitalsIcon } from "./icons";

/** "Enviar" no centro, em destaque: é a ação principal do app. A Conversa fica no cabeçalho (ChatButton). */
const ITEMS = [
  { href: "/", label: "Hoje", icon: HomeIcon, match: (p: string) => p === "/" },
  { href: "/historico", label: "Histórico", icon: HistoryIcon, match: (p: string) => /^\/(historico|exames?)/.test(p) },
  { href: "/enviar", label: "Enviar", icon: PlusIcon, match: (p: string) => p.startsWith("/enviar"), primary: true },
  { href: "/wearables", label: "Sinais", icon: VitalsIcon, match: (p: string) => p.startsWith("/wearables") },
  { href: "/compartilhar", label: "Médico", icon: DoctorIcon, match: (p: string) => p.startsWith("/compartilhar") },
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
  return (
    <ul className="mx-auto flex max-w-md items-stretch justify-around px-2">
      {ITEMS.map(({ href, label, icon: Icon, match, primary }) => {
        const active = pathname !== "" && match(pathname);
        return (
          <li key={href} className="flex-1">
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs transition-colors ${active ? "font-semibold text-ink" : "font-medium text-muted hover:text-ink"}`}
            >
              {primary ? (
                // Ação principal: botão laranja que sobe acima da barra
                <span className={`lift -mt-6 mb-0.5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-ink shadow-md ring-4 ring-white ${active ? "bg-accent-hover" : ""}`}>
                  <Icon width={26} />
                </span>
              ) : (
                <Icon width={26} weight={active ? "fill" : "regular"} />
              )}
              {label}
              {/* Indicador da tela atual: ponto laranja, além do ícone preenchido e do aria-current */}
              {!primary && <span className={`mt-0.5 h-1 w-1 rounded-full ${active ? "bg-accent" : "bg-transparent"}`} aria-hidden />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
