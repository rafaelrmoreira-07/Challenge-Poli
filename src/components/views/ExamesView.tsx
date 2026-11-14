"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DataPortability } from "@/components/DataPortability";
import { FileIcon } from "@/components/icons";
import { ReportList, reportDocuments } from "@/components/ReportList";
import { RowLink, SectionTitle, Skeleton, Spark, StatusBadge } from "@/components/ui";
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
  const altered = series.filter((s) => s.status === "alto" || s.status === "baixo");
  const rest = series.filter((s) => !altered.includes(s));
  const categories = [...new Set(rest.map((s) => s.category))];
  const hasReports = reportDocuments(db.documents).length > 0;

  return (
    <div>
      {doc && <DocumentPanel db={db} docId={doc.id} isNew={Boolean(novo)} />}
      {altered.length > 0 && (
        <>
          <SectionTitle>Alterados no último resultado</SectionTitle>
          <SeriesList series={altered} />
        </>
      )}
      {hasReports && (
        <>
          <SectionTitle>Laudos de imagem e procedimentos</SectionTitle>
          <ReportList documents={db.documents} openDoc={(id) => openDocumentFile(id)} />
        </>
      )}
      {categories.map((c) => (
        <div key={c}>
          <SectionTitle>{c}</SectionTitle>
          <SeriesList series={rest.filter((s) => s.category === c)} />
        </div>
      ))}
      <SectionTitle>Trazer ou levar seus exames</SectionTitle>
      <DataPortability />
      {!series.length && !hasReports && (
        <p className="tile text-[15px]">
          Nenhum exame ainda. <Link className="font-medium underline underline-offset-4" href="/enviar">Adicionar o primeiro</Link>.
        </p>
      )}
    </div>
  );
}

function SeriesList({ series }: { series: AnalyteSeries[] }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {series.map((s) => {
        const values = s.results.map((r) => r.value).filter((v): v is number => v != null);
        const bad = s.status === "alto" || s.status === "baixo";
        return (
          <li key={s.key}>
            <RowLink
              href={`/exame/?a=${encodeURIComponent(s.key)}`}
              trailing={
                <>
                  <Spark values={values} bad={bad} />
                  <span className="w-24 text-right">
                    <span className="num block text-[17px] font-medium">
                      {s.latest.value != null ? fmt(s.latest.value) : s.latest.valueText} <span className="text-xs font-normal text-muted">{s.unit}</span>
                    </span>
                    <StatusBadge status={s.status} />
                  </span>
                </>
              }
            >
              <p className="truncate text-[15px] font-medium">{s.name}</p>
              <p className="num text-sm text-muted">
                {formatDate(s.latest.date)} · {s.results.length} {s.results.length === 1 ? "resultado" : "resultados"}
              </p>
            </RowLink>
          </li>
        );
      })}
    </ul>
  );
}

const SOURCE_LABEL = { gemini: "lido por IA", simulado: "leitura pré-gravada", manual: "digitado", seed: "importado" } as const;

/** Check animado do transitions.dev ("Success check") quando o laudo acabou de ser salvo. */
function SuccessCheck() {
  const [state, setState] = useState<"out" | "in">("out");
  useEffect(() => {
    const r = requestAnimationFrame(() => setState("in"));
    return () => cancelAnimationFrame(r);
  }, []);
  return (
    <span className="t-success-check flex h-9 w-9 items-center justify-center rounded-full bg-ok text-white" data-state={state} aria-hidden>
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path d="M4 9.5l3.2 3L14 5.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function DocumentPanel({ db, docId, isNew }: { db: Db; docId: string; isNew: boolean }) {
  const doc = db.documents.find((d) => d.id === docId)!;
  const results = db.labResults.filter((r) => r.documentId === docId);
  if (doc.report)
    return (
      <section className="mb-2">
        {isNew && (
          <p className="mb-3 flex items-center gap-3 text-[17px] font-medium text-ok" role="status">
            <SuccessCheck /> Laudo salvo no seu histórico
          </p>
        )}
        <ReportList documents={[doc]} openDoc={(id) => openDocumentFile(id)} />
      </section>
    );
  return (
    <section className="tile mb-2">
      {isNew && (
        <p className="mb-4 flex items-center gap-3 text-[17px] font-medium text-ok" role="status">
          <SuccessCheck /> {results.length} resultados salvos no seu histórico
        </p>
      )}
      <div className="flex items-start gap-3">
        <FileIcon width={22} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-medium">{doc.lab ?? "Laudo"}</p>
          <p className="text-sm text-muted">
            Coleta em {formatDate(doc.examDate)} · {SOURCE_LABEL[doc.extractedBy]}
            {doc.model ? ` (${doc.model})` : ""}
          </p>
        </div>
        {doc.storedAs && (
          <button type="button" onClick={() => openDocumentFile(doc.storedAs!)} className="btn-secondary min-h-10 px-3 text-sm">
            Ver laudo
          </button>
        )}
      </div>
      <table className="num mt-4 w-full text-sm">
        <thead className="text-left text-muted">
          <tr className="border-b border-line-strong"><th className="py-2 font-medium">Exame</th><th className="font-medium">Resultado</th><th className="font-medium">Referência</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {results.map((r) => {
            const st = labStatus(r);
            return (
              <tr key={r.id}>
                <td className="py-2 pr-2">{r.name}</td>
                <td className={`pr-2 font-medium ${st === "alto" ? "text-danger" : st === "baixo" ? "text-warn" : ""}`}>
                  {st === "alto" ? "↑ " : st === "baixo" ? "↓ " : ""}{r.value != null ? fmt(r.value) : r.valueText} {r.unit}
                </td>
                <td className="text-muted">{formatRef(r)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
