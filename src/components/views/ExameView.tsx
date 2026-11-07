"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LabTrendChart } from "@/components/charts";
import { Skeleton, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { analyteSeries, fmt, formatRef, labStatus, medicationMarkers } from "@/lib/health";
import { openDocumentFile, useDb } from "@/lib/store";

export function ExameView() {
  const db = useDb();
  const key = useSearchParams().get("a");
  if (!db) return <Skeleton lines={4} />;

  const s = analyteSeries(db.labResults).find((x) => x.key === key);
  if (!s) {
    return (
      <div className="card text-sm">
        Exame não encontrado. <Link href="/exames" className="font-semibold text-brand-700">Ver todos os exames</Link>
      </div>
    );
  }
  const numeric = s.results.filter((r) => r.value != null);
  const docs = new Map(db.documents.map((d) => [d.id, d]));

  return (
    <div>
      <Link href="/exames" className="text-sm font-medium text-brand-700">← Exames</Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{s.name}</h1>
      <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
        Último: <strong>{s.latest.value != null ? fmt(s.latest.value) : s.latest.valueText} {s.unit}</strong> em {formatDate(s.latest.date)}
        <StatusBadge status={s.status} />
      </p>

      {numeric.length > 0 && (
        <div className="card mt-4 px-2">
          <LabTrendChart
            points={numeric.map((r) => ({ date: r.date, value: r.value!, lab: r.lab }))}
            refLow={s.latest.refLow}
            refHigh={s.latest.refHigh}
            unit={s.unit}
            markers={medicationMarkers(s.key, db.medications)}
          />
          <p className="px-2 pb-1 text-[11px] text-slate-500">
            Faixa verde: referência do laudo mais recente ({formatRef(s.latest)} {s.unit}). Pontos vermelhos: fora da faixa.
          </p>
        </div>
      )}

      <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">Todos os resultados</h2>
      <ul className="card divide-y divide-slate-100 p-0">
        {[...s.results].reverse().map((r) => {
          const doc = r.documentId ? docs.get(r.documentId) : undefined;
          return (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{formatDate(r.date)}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {r.lab ?? "—"} · ref. {formatRef(r)}
                  {doc?.extractedBy === "gemini" ? " · lido por IA" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{r.value != null ? fmt(r.value) : r.valueText}</span>
                <StatusBadge status={labStatus(r)} />
                {doc?.storedAs && (
                  <button type="button" onClick={() => openDocumentFile(doc.storedAs!)} className="text-[11px] font-semibold text-brand-700">
                    laudo
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
