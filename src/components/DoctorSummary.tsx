"use client";

import { useEffect, useState } from "react";
import type { DoctorSummary as Summary } from "@/lib/types";
import { ClipboardIcon } from "./icons";

/**
 * Mostra o resumo clínico. `load` busca do cache ou gera; `cacheKey` muda
 * quando os dados autorizados mudam e dispara uma nova busca.
 */
export function DoctorSummary({ load, cacheKey }: { load: () => Promise<Summary>; cacheKey: string }) {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((s) => {
        if (cancelled) return;
        setData(s);
        setError(false);
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // `load` muda a cada render; o que importa são os dados (cacheKey) e o botão Atualizar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, attempt]);

  const reload = () => {
    setLoading(true);
    setError(false);
    setAttempt((n) => n + 1);
  };

  return (
    <section className="tile">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2  text-xl font-semibold text-ink">
          <ClipboardIcon className="h-5 w-5 text-ink" /> Resumo clínico
          {data && (
            <span className="rounded border border-line px-1.5 py-0.5 font-sans text-xs font-semibold text-ink-soft">
              {data.geradoPor.startsWith("regras") ? "por regras" : "gerado por IA"}
            </span>
          )}
        </h2>
        {data && !loading && (
          <button type="button" onClick={reload} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-ink">Atualizar</button>
        )}
      </div>

      {loading && (
        <div className="mt-3 space-y-2" aria-busy="true">
          <p className="text-xs text-muted">Lendo exames, remédios, consultas e wearables…</p>
          {[90, 100, 75, 85].map((w, i) => <div key={i} className="h-3 animate-pulse rounded bg-line" style={{ width: `${w}%` }} />)}
        </div>
      )}
      {error && !loading && (
        <p className="mt-3 text-sm text-danger">Não foi possível gerar o resumo. <button className="font-semibold underline" onClick={reload}>Tentar de novo</button></p>
      )}
      {data && !loading && (
        <div className="mt-3 text-sm">
          <p className="text-[15px] leading-relaxed text-ink">{data.resumo}</p>
          {data.pontosDeAtencao.length > 0 && (
            <>
              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Pontos de atenção</h3>
              <ol className="mt-1 space-y-2">
                {data.pontosDeAtencao.map((p, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-navy-100 bg-navy-50 text-xs font-bold text-ink">{i + 1}</span>
                    <p><strong>{p.titulo}.</strong> <span className="text-ink-soft">{p.detalhe}</span></p>
                  </li>
                ))}
              </ol>
            </>
          )}
          {data.perguntasSugeridas.length > 0 && (
            <>
              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">A considerar</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-soft">
                {data.perguntasSugeridas.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </>
          )}
          <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
            Gerado por {data.geradoPor}. Apoio à decisão: confira sempre os dados de origem abaixo.
          </p>
        </div>
      )}
    </section>
  );
}
