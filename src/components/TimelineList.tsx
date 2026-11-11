"use client";

import Link from "next/link";
import { useState } from "react";
import type { TimelineEvent, TimelineKind } from "@/lib/timeline";
import { AlertIcon, FileIcon, PillIcon, StethoscopeIcon, SyringeIcon } from "./icons";

const KINDS: { key: TimelineKind; label: string }[] = [
  { key: "exame", label: "Exames" },
  { key: "consulta", label: "Consultas" },
  { key: "medicamento", label: "Remédios" },
  { key: "vacina", label: "Vacinas" },
  { key: "alerta", label: "Alertas" },
];

const ICON: Record<TimelineKind, [React.ComponentType<React.SVGProps<SVGSVGElement>>, string]> = {
  exame: [FileIcon, "bg-brand-50 text-brand-700 border-brand-200"],
  consulta: [StethoscopeIcon, "bg-plum-100 text-plum-700 border-plum-100"],
  medicamento: [PillIcon, "bg-clay-50 text-clay-700 border-clay-100"],
  vacina: [SyringeIcon, "bg-ink-100 text-ink-700 border-ink-200"],
  alerta: [AlertIcon, "bg-danger-50 text-danger-700 border-danger-200"],
};

const TONE = {
  red: "bg-danger-50 text-danger-700 border-danger-200",
  amber: "bg-warn-50 text-warn-800 border-warn-200",
  green: "bg-brand-50 text-brand-700 border-brand-200",
  slate: "bg-ink-50 text-ink-600 border-ink-200",
};

const fmtDate = (iso: string) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });

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

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filtrar eventos">
        {KINDS.map(({ key, label }) => {
          const on = !hidden.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              aria-pressed={on}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-colors ${on ? "border-brand-600 bg-brand-600 text-white" : "border-ink-300 bg-white text-ink-500 line-through decoration-ink-400"}`}
            >
              {label} <span className={`num font-normal ${on ? "text-brand-100" : ""}`}>{events.filter((e) => e.kind === key).length}</span>
            </button>
          );
        })}
      </div>

      <ol className="relative ml-4 border-l border-ink-300">
        {visible.map((e, i) => {
          const year = e.date.slice(0, 4);
          const showYear = i === 0 || visible[i - 1].date.slice(0, 4) !== year;
          const [Icon, iconCls] = ICON[e.kind];
          const body = (
            <div className="card ml-6 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="num text-xs font-semibold uppercase tracking-[0.06em] text-ink-500">{fmtDate(e.date)}</p>
                  <p className="mt-0.5 text-[15px] font-semibold leading-snug text-ink-900">{e.title}</p>
                  {e.subtitle && <p className="text-sm text-ink-500">{e.subtitle}</p>}
                </div>
                {e.badge && <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-xs font-semibold ${TONE[e.badge.tone]}`}>{e.badge.text}</span>}
              </div>
              {e.detail && <p className="mt-1.5 text-sm text-ink-600">{e.detail}</p>}
            </div>
          );
          return (
            <li key={e.id} className="relative mb-3">
              {showYear && <p className="num mb-2 mt-6 pl-6 font-serif text-2xl font-semibold text-clay-600">{year}</p>}
              <span className={`absolute -left-[15px] flex h-7 w-7 items-center justify-center rounded-full border ring-4 ring-paper ${iconCls} ${showYear ? "top-[3.25rem]" : "top-3"}`}>
                <Icon width={15} height={15} />
              </span>
              {e.href ? <Link href={e.href} className="block rounded-xl transition-colors [&>div]:hover:border-brand-300">{body}</Link> : body}
            </li>
          );
        })}
      </ol>
      {!visible.length && <p className="text-[15px] text-ink-500">Nada para mostrar com estes filtros.</p>}
    </div>
  );
}
