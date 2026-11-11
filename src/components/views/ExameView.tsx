"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LabTrendChart } from "@/components/charts";
import { ChevronRight } from "@/components/icons";
import { SectionTitle, Skeleton, StatusBadge } from "@/components/ui";
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
      <div className="card text-[15px]">
        Exame não encontrado. <Link href="/exames" className="font-semibold text-brand-700">Ver todos os exames</Link>
      </div>
    );
  }
  const numeric = s.results.filter((r) => r.value != null);
  const docs = new Map(db.documents.map((d) => [d.id, d]));

  return (
    <div>
      <Link href="/exames" className="-ml-1 inline-flex min-h-11 items-center gap-1 px-1 text-[15px] font-semibold text-brand-700">
        <ChevronRight width={18} height={18} className="rotate-180" /> Exames
      </Link>
      <h1 className="mt-1 page-title">{s.name}</h1>
      <div className="mt-3 flex items-end justify-between gap-3 rounded-xl border border-ink-200 bg-white p-4">
        <div>
          <p className="text-sm text-ink-500">Último resultado · {formatDate(s.latest.date)}</p>
          <p className="num font-serif text-[2rem] font-semibold leading-tight text-ink-900">
            {s.latest.value != null ? fmt(s.latest.value) : s.latest.valueText} <span className="font-sans text-base font-medium text-ink-500">{s.unit}</span>
          </p>
          <p className="num text-sm text-ink-500">Referência do laudo: {formatRef(s.latest)} {s.unit}</p>
        </div>
        <StatusBadge status={s.status} />
      </div>

      {numeric.length > 0 && (
        <div className="card mt-4 px-2">
          <LabTrendChart
            points={numeric.map((r) => ({ date: r.date, value: r.value!, lab: r.lab }))}
            refLow={s.latest.refLow}
            refHigh={s.latest.refHigh}
            unit={s.unit}
            markers={medicationMarkers(s.key, db.medications)}
          />
          <p className="px-2 pb-1 text-sm text-ink-500">
            Área sombreada: faixa de referência do laudo mais recente. Pontos cheios em vermelho: fora da faixa. Linhas pontilhadas: início de remédio.
          </p>
        </div>
      )}

      <SectionTitle>Todos os resultados</SectionTitle>
      <ul className="card divide-y divide-ink-100 p-0">
        {[...s.results].reverse().map((r) => {
          const doc = r.documentId ? docs.get(r.documentId) : undefined;
          return (
            <li key={r.id} className="flex min-h-16 items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="num text-[15px] font-semibold">{formatDate(r.date)}</p>
                <p className="num truncate text-sm text-ink-500">
                  {r.lab ?? "—"} · ref. {formatRef(r)}
                  {doc?.extractedBy === "gemini" ? " · lido por IA" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="num text-base font-semibold">{r.value != null ? fmt(r.value) : r.valueText}</span>
                <StatusBadge status={labStatus(r)} />
                {doc?.storedAs && (
                  <button type="button" onClick={() => openDocumentFile(doc.storedAs!)} className="inline-flex min-h-11 items-center px-1 text-sm font-semibold text-brand-700 underline underline-offset-4">
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
