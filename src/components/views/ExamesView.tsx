"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Sparkline } from "@/components/charts";
import { CheckIcon, FileIcon } from "@/components/icons";
import { SectionTitle, Skeleton, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { analyteSeries, fmt, formatRef, labStatus, type AnalyteSeries } from "@/lib/health";
import { openDocumentFile, useDb } from "@/lib/store";
import type { Db } from "@/lib/types";

export function ExamesView() {
  const db = useDb();
  const sp = useSearchParams();
  if (!db) return <Skeleton lines={6} />;

  const novo = sp.get("novo");
  const docId = novo ?? sp.get("doc");
  const doc = docId ? db.documents.find((d) => d.id === docId) : undefined;
  const series = analyteSeries(db.labResults);
  const out = series.filter((s) => s.status === "alto" || s.status === "baixo");
  const rest = series.filter((s) => !out.includes(s));
  const categories = [...new Set(rest.map((s) => s.category))];

  return (
    <div>
      {doc && <DocumentPanel db={db} docId={doc.id} isNew={Boolean(novo)} />}
      {out.length > 0 && (
        <>
          <SectionTitle>Último resultado fora da faixa</SectionTitle>
          <SeriesList series={out} />
        </>
      )}
      {categories.map((c) => (
        <div key={c}>
          <SectionTitle>{c}</SectionTitle>
          <SeriesList series={rest.filter((s) => s.category === c)} />
        </div>
      ))}
      {!series.length && (
        <p className="card text-[15px]">
          Nenhum exame ainda. <Link className="font-semibold text-brand-700" href="/enviar">Envie o primeiro</Link>.
        </p>
      )}
    </div>
  );
}

function SeriesList({ series }: { series: AnalyteSeries[] }) {
  return (
    <ul className="card divide-y divide-ink-100 p-0">
      {series.map((s) => {
        const values = s.results.map((r) => r.value).filter((v): v is number => v != null);
        const delta = s.previous?.value != null && s.latest.value != null ? s.latest.value - s.previous.value : null;
        return (
          <li key={s.key}>
            <Link href={`/exame/?a=${encodeURIComponent(s.key)}`} className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-50">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-ink-900">{s.name}</p>
                <p className="num text-sm text-ink-500">
                  {formatDate(s.latest.date)} · {s.results.length} {s.results.length === 1 ? "resultado" : "resultados"}
                </p>
              </div>
              {values.length > 1 && <Sparkline values={values} bad={s.status === "alto" || s.status === "baixo"} />}
              <div className="w-28 text-right">
                <p className="num text-base font-semibold text-ink-900">
                  {s.latest.value != null ? fmt(s.latest.value) : s.latest.valueText} <span className="text-xs font-normal text-ink-500">{s.unit}</span>
                </p>
                <div className="mt-0.5 flex items-center justify-end gap-1">
                  {delta != null && delta !== 0 && (
                    <span className="num text-xs text-ink-500" title="Diferença para o resultado anterior">{delta > 0 ? "+" : "−"}{fmt(Math.abs(delta))}</span>
                  )}
                  <StatusBadge status={s.status} />
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

const SOURCE_LABEL = { gemini: "lido por IA", simulado: "leitura pré-gravada", manual: "digitado", seed: "importado" } as const;

function DocumentPanel({ db, docId, isNew }: { db: Db; docId: string; isNew: boolean }) {
  const doc = db.documents.find((d) => d.id === docId)!;
  const results = db.labResults.filter((r) => r.documentId === docId);
  return (
    <section className={`card mb-2 ${isNew ? "ring-2 ring-brand-500" : ""}`}>
      {isNew && (
        <p className="mb-3 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800">
          <CheckIcon width={16} height={16} strokeWidth={2.4} /> {results.length} resultados adicionados ao seu histórico
        </p>
      )}
      <div className="flex items-start gap-3">
        <FileIcon className="mt-0.5 shrink-0 text-brand-700" />
        <div className="min-w-0 flex-1">
          <p className="font-serif text-lg font-semibold">{doc.lab ?? "Laudo"}</p>
          <p className="text-sm text-ink-500">
            Coleta em {formatDate(doc.examDate)} · {SOURCE_LABEL[doc.extractedBy]}
            {doc.model ? ` (${doc.model})` : ""}
          </p>
        </div>
        {doc.storedAs && (
          <button type="button" onClick={() => openDocumentFile(doc.storedAs!)} className="btn-secondary px-3 text-sm">
            Ver original
          </button>
        )}
      </div>
      <table className="num mt-3 w-full text-sm">
        <thead className="border-b border-ink-200 text-left text-xs uppercase tracking-[0.06em] text-ink-500">
          <tr><th className="py-1.5 font-semibold">Exame</th><th className="font-semibold">Resultado</th><th className="font-semibold">Referência</th></tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {results.map((r) => {
            const st = labStatus(r);
            return (
              <tr key={r.id}>
                <td className="py-2 pr-2">{r.name}</td>
                <td className={`pr-2 font-semibold ${st === "alto" ? "text-danger-700" : st === "baixo" ? "text-warn-800" : ""}`}>
                  {st === "alto" ? "↑ " : st === "baixo" ? "↓ " : ""}{r.value != null ? fmt(r.value) : r.valueText} {r.unit}
                </td>
                <td className="text-ink-500">{formatRef(r)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
