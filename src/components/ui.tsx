"use client";

import Link from "next/link";
import { useState } from "react";
import type { LabStatus } from "@/lib/health";
import type { HealthAlert } from "@/lib/types";
import { AlertIcon, ArrowDownIcon, ArrowUpIcon, CheckIcon, ChevronDown, ChevronRight, MinusIcon, UrgentIcon } from "./icons";

/**
 * Status de um resultado, nos termos dos laudos. Sempre ícone + texto.
 * "Normal" fica neutro para que o olho vá direto ao que está alterado.
 */
export function StatusBadge({ status }: { status: LabStatus }) {
  const map = {
    alto: ["Alto", ArrowUpIcon, "bg-danger-soft text-danger"],
    baixo: ["Baixo", ArrowDownIcon, "bg-warn-soft text-warn"],
    normal: ["Normal", CheckIcon, "bg-surface text-muted"],
    sem_faixa: ["Sem referência", MinusIcon, "bg-surface text-muted"],
  } as const;
  const [label, Icon, cls] = map[status];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      <Icon width={12} />
      {label}
    </span>
  );
}

/** Cabeçalho de cada tela: linha pequena acima, título grande, ação opcional à direita. */
export function PageHeader({ eyebrow, title, action, children }: { eyebrow?: React.ReactNode; title: React.ReactNode; action?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="t-reveal mb-6">
      {eyebrow && <p className="text-[15px] text-muted">{eyebrow}</p>}
      <div className="flex items-end justify-between gap-3">
        <h1 className="display mt-1">{title}</h1>
        {action}
      </div>
      {children && <div className="mt-2 text-[15px] leading-relaxed text-muted">{children}</div>}
    </header>
  );
}

export function SectionTitle({ children, action, id }: { children: React.ReactNode; action?: React.ReactNode; id?: string }) {
  return (
    <div className="mb-3 mt-10 flex items-baseline justify-between gap-3">
      <h2 id={id} className="text-xl font-medium tracking-[-0.02em] text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="btn-quiet -my-2 shrink-0 text-sm">
      {children}
    </Link>
  );
}

/**
 * Alerta. Fechado mostra gravidade e título; aberto mostra o que aconteceu
 * e o que fazer (accordion do transitions.dev). `open` deixa sempre aberto.
 */
export function AlertCard({ alert, open: alwaysOpen, cta = true, defaultOpen = false }: { alert: HealthAlert; open?: boolean; cta?: boolean; defaultOpen?: boolean }) {
  const urgent = alert.severity === "procure_medico";
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = alwaysOpen || open;
  const Icon = urgent ? UrgentIcon : AlertIcon;
  const head = (
    <>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${urgent ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn"}`}>
        <Icon width={22} />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className={`block text-sm font-medium ${urgent ? "text-danger" : "text-warn"}`}>{urgent ? "Procure um médico" : "Atenção"}</span>
        <span className="block text-[17px] font-medium leading-snug text-ink">{alert.title}</span>
      </span>
    </>
  );
  return (
    <article className="t-acc rounded-2xl bg-surface" data-open={isOpen}>
      {alwaysOpen ? (
        <div className="flex items-center gap-3 p-4 pb-0">{head}</div>
      ) : (
        <button type="button" className="flex w-full items-center gap-3 p-4" aria-expanded={isOpen} onClick={() => setOpen((v) => !v)}>
          {head}
          <span className="t-acc-chevron text-muted"><ChevronDown width={20} /></span>
        </button>
      )}
      <div className="t-acc-panel">
        <div className="t-acc-panel-inner">
          <div className={`px-4 pb-4 ${alwaysOpen ? "pt-3" : ""}`}>
            <p className="text-[15px] leading-relaxed text-ink-soft">{alert.message}</p>
            <p className="mt-3 rounded-xl bg-white p-3 text-[15px] leading-relaxed text-ink">
              <span className="font-medium">O que fazer: </span>
              {alert.recommendation}
            </p>
            {alert.specialty && <p className="mt-2 text-sm text-muted">Especialidade: {alert.specialty}</p>}
            {alert.evidence.length > 0 && (
              <ul className="num mt-2 space-y-0.5 text-sm text-muted">
                {alert.evidence.map((e) => <li key={e}>· {e}</li>)}
              </ul>
            )}
            {cta && (
              <div className="mt-4 flex flex-col gap-2">
                {urgent && <Link href="/compartilhar" className="btn-primary">Montar relatório para o médico</Link>}
                {alert.kind === "pos_alta" ? (
                  <Link href="/internacao" className="btn-secondary">Abrir o pós-alta</Link>
                ) : alert.kind !== "exames" ? (
                  <Link href="/wearables" className="btn-secondary">Ver medições</Link>
                ) : (
                  <Link href="/exames" className="btn-secondary">Ver exames</Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/** Linha de lista que leva a outra tela. */
export function RowLink({ href, children, trailing }: { href: string; children: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <Link href={href} className="flex min-h-16 items-center gap-3 py-3 transition-colors hover:bg-navy-50/60">
      <div className="min-w-0 flex-1">{children}</div>
      {trailing}
      <ChevronRight width={18} className="shrink-0 text-faint" />
    </Link>
  );
}

export function Skeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface" />
      ))}
    </div>
  );
}

export function Disclaimer() {
  return (
    <p className="mt-12 text-sm leading-relaxed text-muted">
      Os alertas dizem quando procurar atendimento. Eles não são diagnóstico. Em emergência, ligue <strong className="font-medium text-ink">192 (SAMU)</strong>.
    </p>
  );
}

/** Mini gráfico de linha em SVG (sem biblioteca), para os cartões de sinais e a lista de exames. */
export function Spark({ values, bad, width = 72, height = 28 }: { values: number[]; bad?: boolean; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (width - 4) + 2).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`);
  const last = pts.at(-1)!.split(",");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="shrink-0">
      <polyline points={pts.join(" ")} fill="none" stroke={bad ? "var(--color-danger-mark)" : "var(--color-ink)"} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={bad ? "var(--color-danger-mark)" : "var(--color-ink)"} />
    </svg>
  );
}
