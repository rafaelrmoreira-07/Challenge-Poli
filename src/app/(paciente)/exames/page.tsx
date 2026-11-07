import Link from "next/link";
import { Suspense } from "react";
import { Sparkline } from "@/components/charts";
import { HistoryTabs } from "@/components/HistoryTabs";
import { FileIcon } from "@/components/icons";
import { SectionTitle, Skeleton, StatusBadge } from "@/components/ui";
import { getDb } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { analyteSeries, fmt, formatRef, labStatus, type AnalyteSeries } from "@/lib/health";
import type { Db } from "@/lib/types";

export default function ExamesPage(props: PageProps<"/exames">) {
  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold tracking-tight">Histórico</h1>
      <HistoryTabs active="exames" />
      <Suspense fallback={<Skeleton lines={6} />}>
        <Exames searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Exames({ searchParams }: { searchParams: PageProps<"/exames">["searchParams"] }) {
  const sp = await searchParams;
  const db = await getDb();
  const docId = typeof sp.novo === "string" ? sp.novo : typeof sp.doc === "string" ? sp.doc : undefined;
  const doc = docId ? db.documents.find((d) => d.id === docId) : undefined;
  const series = analyteSeries(db.labResults);
  const out = series.filter((s) => s.status === "alto" || s.status === "baixo");
  const rest = series.filter((s) => !out.includes(s));
  const categories = [...new Set(rest.map((s) => s.category))];

  return (
    <div>
      {doc && <DocumentPanel db={db} docId={doc.id} isNew={typeof sp.novo === "string"} />}

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
      {!series.length && <p className="card text-sm">Nenhum exame ainda. <Link className="font-semibold text-brand-700" href="/enviar">Envie o primeiro</Link>.</p>}
    </div>
  );
}

function SeriesList({ series }: { series: AnalyteSeries[] }) {
  return (
    <ul className="card divide-y divide-slate-100 p-0">
      {series.map((s) => {
        const values = s.results.map((r) => r.value).filter((v): v is number => v != null);
        const delta = s.previous?.value != null && s.latest.value != null ? s.latest.value - s.previous.value : null;
        return (
          <li key={s.key}>
            <Link href={`/exames/${s.key}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.name}</p>
                <p className="text-[11px] text-slate-500">
                  {formatDate(s.latest.date)} · {s.results.length} {s.results.length === 1 ? "resultado" : "resultados"}
                </p>
              </div>
              {values.length > 1 && <Sparkline values={values} bad={s.status === "alto" || s.status === "baixo"} />}
              <div className="w-24 text-right">
                <p className="text-sm font-semibold">
                  {s.latest.value != null ? fmt(s.latest.value) : s.latest.valueText} <span className="text-[11px] font-normal text-slate-500">{s.unit}</span>
                </p>
                <div className="mt-0.5 flex items-center justify-end gap-1">
                  {delta != null && delta !== 0 && (
                    <span className="text-[10px] text-slate-500">{delta > 0 ? "▲" : "▼"} {fmt(Math.abs(delta))}</span>
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

function DocumentPanel({ db, docId, isNew }: { db: Db; docId: string; isNew: boolean }) {
  const doc = db.documents.find((d) => d.id === docId)!;
  const results = db.labResults.filter((r) => r.documentId === docId);
  return (
    <section className={`card mb-2 ${isNew ? "ring-2 ring-brand-500" : ""}`}>
      {isNew && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700">✓ {results.length} resultados adicionados ao seu histórico</p>}
      <div className="flex items-start gap-3">
        <FileIcon className="mt-0.5 shrink-0 text-sky-600" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{doc.lab ?? "Laudo"}</p>
          <p className="text-xs text-slate-500">
            Coleta em {formatDate(doc.examDate)} ·{" "}
            {doc.extractedBy === "gemini" ? `lido por IA (${doc.model})` : doc.extractedBy === "simulado" ? "leitura simulada (IA indisponível)" : "importado"}
          </p>
        </div>
        {doc.storedAs && (
          <a href={`/api/documentos/${doc.id}`} target="_blank" rel="noopener" className="btn-secondary px-3 py-1.5 text-xs">
            Ver original
          </a>
        )}
      </div>
      <table className="mt-3 w-full text-xs">
        <thead className="text-left text-slate-500">
          <tr><th className="py-1 font-medium">Exame</th><th className="font-medium">Resultado</th><th className="font-medium">Referência</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {results.map((r) => {
            const st = labStatus(r);
            return (
              <tr key={r.id}>
                <td className="py-1.5 pr-2">{r.name}</td>
                <td className={`pr-2 font-semibold ${st === "alto" ? "text-red-700" : st === "baixo" ? "text-amber-700" : ""}`}>
                  {r.value != null ? fmt(r.value) : r.valueText} {r.unit}
                </td>
                <td className="text-slate-500">{formatRef(r)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
