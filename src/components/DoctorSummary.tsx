"use client";

import { useEffect, useState } from "react";
import type { DoctorSummary as Summary } from "@/lib/types";
import { SparkIcon } from "./icons";

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
    <section className="card">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <SparkIcon className="h-5 w-5 text-brand-600" /> Resumo clínico {data && data.geradoPor.startsWith("regras") ? "automático" : "por IA"}
        </h2>
        {data && !loading && (
          <button type="button" onClick={reload} className="text-xs font-semibold text-brand-700">Atualizar</button>
        )}
      </div>

      {loading && (
        <div className="mt-3 space-y-2" aria-busy="true">
          <p className="text-xs text-slate-500">Lendo exames, remédios, consultas e wearables…</p>
          {[90, 100, 75, 85].map((w, i) => <div key={i} className="h-3 animate-pulse rounded bg-slate-200" style={{ width: `${w}%` }} />)}
        </div>
      )}
      {error && !loading && (
        <p className="mt-3 text-sm text-red-700">Não foi possível gerar o resumo. <button className="font-semibold underline" onClick={reload}>Tentar de novo</button></p>
      )}
      {data && !loading && (
        <div className="mt-3 text-sm">
          <p className="leading-relaxed text-slate-800">{data.resumo}</p>
          {data.pontosDeAtencao.length > 0 && (
            <>
              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Pontos de atenção</h3>
              <ol className="mt-1 space-y-2">
                {data.pontosDeAtencao.map((p, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">{i + 1}</span>
                    <p><strong>{p.titulo}.</strong> <span className="text-slate-700">{p.detalhe}</span></p>
                  </li>
                ))}
              </ol>
            </>
          )}
          {data.perguntasSugeridas.length > 0 && (
            <>
              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">A considerar</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">
                {data.perguntasSugeridas.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </>
          )}
          <p className="mt-4 text-[11px] text-slate-400">
            Gerado por {data.geradoPor}. Apoio à decisão: confira sempre os dados de origem abaixo.
          </p>
        </div>
      )}
    </section>
  );
}
