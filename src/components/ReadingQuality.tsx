"use client";

import { MIN_READS, rate, readingSummary, stageOf } from "@/lib/quality";
import { useDb } from "@/lib/store";

const pct = (x: number) => `${(x * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** Apêndice F: quanto a pessoa corrige da leitura, por exame. */
export function ReadingQuality() {
  const db = useDb();
  if (!db) return null;
  const s = readingSummary(db);
  return (
    <div className="tile space-y-3">
      <p className="text-sm leading-relaxed text-muted">
        Cada exame começa pedindo conferência completa. Depois de {MIN_READS} leituras com até 5% dos campos corrigidos, passa para conferência rápida. Nenhum resultado é salvo sem você confirmar.
      </p>
      {s.stats.length ? (
        <>
          <p className="text-[15px]">
            <span className="font-medium">{pct(s.rate)}</span> dos campos corrigidos em {s.stats.reduce((n, x) => n + x.reads, 0)} leituras.{" "}
            {s.quick ? `${s.quick} ${s.quick === 1 ? "exame já está" : "exames já estão"} na conferência rápida.` : ""}
          </p>
          <table className="num w-full text-sm">
            <thead className="text-left text-muted">
              <tr className="border-b border-line-strong">
                <th className="py-2 font-medium">Exame</th>
                <th className="font-medium">Leituras</th>
                <th className="font-medium">Corrigido</th>
                <th className="font-medium">Conferência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {s.stats.slice(0, 12).map((x) => (
                <tr key={x.key}>
                  <td className="py-2 pr-2">{x.name}</td>
                  <td className="pr-2">{x.reads}</td>
                  <td className="pr-2">{pct(rate(x))}</td>
                  <td>{stageOf(x) === "rapida" ? <span className="text-ok">Rápida</span> : <span className="text-muted">Completa</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="text-[15px] text-muted">Ainda não há leituras revisadas. Adicione um exame para começar.</p>
      )}
    </div>
  );
}
