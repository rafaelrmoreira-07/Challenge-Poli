"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LabTrendChart } from "@/components/charts";
import { BackIcon } from "@/components/icons";
import { SectionTitle, Skeleton, StatusBadge } from "@/components/ui";
import NumberFlow from "@number-flow/react";
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
      <p className="tile text-[15px]">
        Exame não encontrado. <Link href="/exames" className="font-medium underline underline-offset-4">Ver todos os exames</Link>
      </p>
    );
  }
  const numeric = s.results.filter((r) => r.value != null);
  const docs = new Map(db.documents.map((d) => [d.id, d]));
  const decimals = s.latest.value != null && !Number.isInteger(s.latest.value) ? String(s.latest.value).split(".")[1]?.length ?? 0 : 0;

  return (
    <div>
      <Link href="/exames" className="-ml-2 inline-flex min-h-11 items-center gap-1.5 px-2 text-[15px] font-medium text-ink">
        <BackIcon width={20} /> Exames
      </Link>
      <header className="t-reveal mt-2">
        <p className="text-[15px] text-muted">{s.category}</p>
        <h1 className="display mt-1">{s.name}</h1>
      </header>

      <div className="mt-6 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Último resultado, {formatDate(s.latest.date)}</p>
          <p className="mt-1 flex items-baseline gap-2 text-ink">
            <span className="text-[3.25rem] font-normal leading-none tracking-[-0.04em]">
              {s.latest.value != null ? <NumberFlow value={s.latest.value} locales="pt-BR" format={{ minimumFractionDigits: decimals, maximumFractionDigits: decimals }} /> : s.latest.valueText}
            </span>
            <span className="text-lg text-muted">{s.unit}</span>
          </p>
          <p className="num mt-2 text-[15px] text-muted">Referência do laudo: {formatRef(s.latest)} {s.unit}</p>
        </div>
        <StatusBadge status={s.status} />
      </div>

      {numeric.length > 0 && (
        <div className="tile mt-6 px-2">
          <LabTrendChart
            points={numeric.map((r) => ({ date: r.date, value: r.value!, lab: r.lab }))}
            refLow={s.latest.refLow}
            refHigh={s.latest.refHigh}
            unit={s.unit}
            markers={medicationMarkers(s.key, db.medications)}
          />
          <p className="px-2 pb-1 text-sm leading-relaxed text-muted">
            A faixa clara é a referência do laudo mais recente. Pontos vermelhos estão fora dela. Linhas laranja marcam o início de um remédio.
          </p>
        </div>
      )}

      <SectionTitle>Todos os resultados</SectionTitle>
      <ul className="divide-y divide-line border-y border-line">
        {[...s.results].reverse().map((r) => {
          const doc = r.documentId ? docs.get(r.documentId) : undefined;
          return (
            <li key={r.id} className="flex min-h-16 items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="num text-[15px] font-medium">{formatDate(r.date)}</p>
                <p className="truncate text-sm text-muted">
                  {r.lab ?? "Laboratório não informado"}
                  {doc?.extractedBy === "gemini" ? " · lido por IA" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="num text-[17px] font-medium">{r.value != null ? fmt(r.value) : r.valueText}</span>
                <StatusBadge status={labStatus(r)} />
                {doc?.storedAs && (
                  <button type="button" onClick={() => openDocumentFile(doc.storedAs!)} className="btn-quiet text-sm">
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
