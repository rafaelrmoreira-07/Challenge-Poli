"use client";

import Link from "next/link";
import { useState } from "react";
import type { TimelineEvent, TimelineKind } from "@/lib/timeline";
import { AlertIcon, ChevronRight, LabIcon, PillIcon, StethoscopeIcon, SyringeIcon } from "./icons";

const KINDS: { key: TimelineKind; label: string; icon: React.ComponentType<{ width?: number }>; dot: string }[] = [
  { key: "exame", label: "Exames", icon: LabIcon, dot: "bg-ink text-white" },
  { key: "consulta", label: "Consultas", icon: StethoscopeIcon, dot: "bg-navy-100 text-ink" },
  { key: "medicamento", label: "Remédios", icon: PillIcon, dot: "bg-accent-soft text-ink" },
  { key: "vacina", label: "Vacinas", icon: SyringeIcon, dot: "bg-surface-2 text-ink" },
  { key: "alerta", label: "Alertas", icon: AlertIcon, dot: "bg-danger-soft text-danger" },
];
const BY_KIND = Object.fromEntries(KINDS.map((k) => [k.key, k]));

const TONE = {
  red: "bg-danger-soft text-danger",
  amber: "bg-warn-soft text-warn",
  green: "bg-ok-soft text-ok",
  slate: "bg-surface text-muted",
};

const day = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("pt-BR", { day: "2-digit", timeZone: "UTC" });
const month = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", "");

export function TimelineList({ events }: { events: TimelineEvent[] }) {
  const [hidden, setHidden] = useState<Set<TimelineKind>>(new Set());
  const visible = events.filter((e) => !hidden.has(e.kind));
  const toggle = (k: TimelineKind) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const years: { year: string; items: TimelineEvent[] }[] = [];
  for (const e of visible) {
    const y = e.date.slice(0, 4);
    if (years.at(-1)?.year !== y) years.push({ year: y, items: [] });
    years.at(-1)!.items.push(e);
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="Mostrar na linha do tempo">
        {KINDS.map(({ key, label }) => {
          const on = !hidden.has(key);
          const n = events.filter((e) => e.kind === key).length;
          if (!n) return null;
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              aria-pressed={on}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors ${on ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-muted"}`}
            >
              {label} <span className={`num ${on ? "text-navy-200" : ""}`}>{n}</span>
            </button>
          );
        })}
      </div>

      {years.map(({ year, items }) => (
        <section key={year} aria-labelledby={`ano-${year}`}>
          <h2 id={`ano-${year}`} className="num sticky top-[60px] z-10 -mx-5 mt-6 bg-white/95 px-5 py-2 text-3xl font-normal tracking-[-0.03em] text-ink backdrop-blur">
            {year}
          </h2>
          <ol className="divide-y divide-line">
            {items.map((e) => {
              const k = BY_KIND[e.kind];
              const Icon = k.icon;
              const body = (
                <div className="flex gap-4 py-4">
                  <div className="num w-10 shrink-0 text-center">
                    <span className="block text-xl leading-none text-ink">{day(e.date)}</span>
                    <span className="block text-xs text-muted">{month(e.date)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="flex items-center gap-2 text-sm text-muted">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${k.dot}`}>
                          <Icon width={14} />
                        </span>
                        {e.subtitle}
                      </p>
                      {e.badge && <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TONE[e.badge.tone]}`}>{e.badge.text}</span>}
                    </div>
                    <p className="mt-1 text-[17px] font-medium leading-snug text-ink">{e.title}</p>
                    {e.detail && <p className="mt-1 text-[15px] leading-relaxed text-muted">{e.detail}</p>}
                  </div>
                  {e.href && <ChevronRight width={18} className="mt-1 shrink-0 self-center text-faint" />}
                </div>
              );
              return (
                <li key={e.id}>
                  {e.href ? <Link href={e.href} className="block transition-colors hover:bg-navy-50/60">{body}</Link> : body}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {!visible.length && <p className="mt-6 text-[15px] text-muted">Nada para mostrar. Ligue algum filtro acima.</p>}
    </div>
  );
}
