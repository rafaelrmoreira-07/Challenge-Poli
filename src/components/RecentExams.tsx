import { addDays, daysBetween, formatDate, todayISO } from "@/lib/dates";
import { fmt, formatRef, labStatus } from "@/lib/health";
import type { LabResult, SourceDocument } from "@/lib/types";
import { StatusBadge } from "./ui";

export const RECENT_DAYS = 90;

export function recentResults(labs: LabResult[], today = todayISO()) {
  const since = addDays(today, -RECENT_DAYS);
  return labs.filter((r) => r.date >= since && r.date <= today).sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
}

/**
 * Apêndice B: exames dos últimos 90 dias no relatório do médico, com a data e
 * o laudo original, para não pedir de novo o que acabou de ser feito.
 * Quem decide se o exame ainda vale é o médico; aqui só aparecem os fatos.
 */
export function RecentExams({
  labs,
  documents,
  openDoc,
}: {
  labs: LabResult[];
  documents: SourceDocument[];
  openDoc?: (storedAs: string) => void;
}) {
  const today = todayISO();
  const recent = recentResults(labs, today);
  const docs = new Map(documents.map((d) => [d.id, d]));
  return (
    <section className="rounded-2xl bg-white p-4 sm:p-5" aria-labelledby="recentes">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="recentes" className="text-lg font-medium tracking-[-0.02em]">Exames dos últimos {RECENT_DAYS} dias</h2>
        <p className="text-sm text-muted">Confira antes de pedir de novo</p>
      </div>
      {recent.length ? (
        <table className="num mt-3 w-full text-sm">
          <thead className="text-left text-muted">
            <tr className="border-b border-line-strong">
              <th className="py-2 font-medium">Exame</th>
              <th className="font-medium">Resultado</th>
              <th className="hidden font-medium sm:table-cell">Coleta</th>
              <th className="font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {recent.map((r) => {
              const doc = r.documentId ? docs.get(r.documentId) : undefined;
              const ago = daysBetween(r.date, today);
              return (
                <tr key={r.id}>
                  <td className="py-2 pr-2">
                    {r.name}
                    <span className="block text-xs text-muted">ref. {formatRef(r)}{r.lab ? ` · ${r.lab}` : ""}</span>
                  </td>
                  <td className="whitespace-nowrap pr-2 font-medium">
                    {r.value != null ? fmt(r.value) : r.valueText} <span className="text-xs font-normal text-muted">{r.unit}</span>
                  </td>
                  <td className="hidden whitespace-nowrap pr-2 text-muted sm:table-cell">
                    {formatDate(r.date)} <span className="text-xs">({ago === 0 ? "hoje" : ago === 1 ? "ontem" : `há ${ago} dias`})</span>
                  </td>
                  <td className="text-right">
                    <span className="inline-flex items-center gap-2">
                      <StatusBadge status={labStatus(r)} />
                      {doc?.storedAs && openDoc && (
                        <button type="button" onClick={() => openDoc(doc.storedAs!)} className="btn-quiet text-sm">laudo</button>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="mt-2 text-[15px] text-muted">Nenhum exame feito nos últimos {RECENT_DAYS} dias.</p>
      )}
    </section>
  );
}
