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
  exame: [FileIcon, "bg-sky-100 text-sky-700"],
  consulta: [StethoscopeIcon, "bg-violet-100 text-violet-700"],
  medicamento: [PillIcon, "bg-emerald-100 text-emerald-700"],
  vacina: [SyringeIcon, "bg-amber-100 text-amber-700"],
  alerta: [AlertIcon, "bg-red-100 text-red-700"],
};

const TONE = {
  red: "bg-red-50 text-red-700 ring-red-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  slate: "bg-slate-50 text-slate-600 ring-slate-200",
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
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {KINDS.map(({ key, label }) => {
          const on = !hidden.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              aria-pressed={on}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${on ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-600 ring-slate-300"}`}
            >
              {label} · {events.filter((e) => e.kind === key).length}
            </button>
          );
        })}
      </div>

      <ol className="relative ml-4 border-l-2 border-slate-200">
        {visible.map((e, i) => {
          const year = e.date.slice(0, 4);
          const showYear = i === 0 || visible[i - 1].date.slice(0, 4) !== year;
          const [Icon, iconCls] = ICON[e.kind];
          const body = (
            <div className="card ml-6 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-slate-500">{fmtDate(e.date)}</p>
                  <p className="text-sm font-semibold text-slate-900">{e.title}</p>
                  {e.subtitle && <p className="text-xs text-slate-500">{e.subtitle}</p>}
                </div>
                {e.badge && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${TONE[e.badge.tone]}`}>{e.badge.text}</span>}
              </div>
              {e.detail && <p className="mt-1.5 text-xs text-slate-600">{e.detail}</p>}
            </div>
          );
          return (
            <li key={e.id} className="relative mb-3">
              {showYear && <p className="-ml-4 mb-2 mt-4 pl-6 text-lg font-bold text-slate-800">{year}</p>}
              <span className={`absolute -left-[15px] top-3 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-[#f4f6f8] ${iconCls} ${showYear ? "top-14" : ""}`}>
                <Icon width={15} height={15} />
              </span>
              {e.href ? <Link href={e.href} className="block hover:opacity-90">{body}</Link> : body}
            </li>
          );
        })}
      </ol>
      {!visible.length && <p className="text-sm text-slate-500">Nada para mostrar com estes filtros.</p>}
    </div>
  );
}
