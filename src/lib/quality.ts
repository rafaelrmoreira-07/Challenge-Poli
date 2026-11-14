import type { Db, ReadingStat } from "./types";

/**
 * Apêndice F, "a IA ganha autonomia por mérito" (princípio da Rivio):
 * cada exame começa pedindo conferência completa. Depois de 3 leituras com
 * no máximo 5% dos campos corrigidos, passa para conferência rápida.
 * Nenhum exame é salvo sem a pessoa confirmar.
 */
export const MIN_READS = 3;
export const MAX_CORRECTION = 0.05;

export type Stage = "completa" | "rapida";

export const rate = (s: ReadingStat) => (s.fields ? s.corrected / s.fields : 0);

export function stageOf(s: ReadingStat | undefined): Stage {
  return s && s.reads >= MIN_READS && rate(s) <= MAX_CORRECTION ? "rapida" : "completa";
}

export function readingSummary(db: Pick<Db, "readingStats">) {
  const stats = Object.values(db.readingStats ?? {}).sort((a, b) => b.reads - a.reads || a.name.localeCompare(b.name));
  const fields = stats.reduce((n, s) => n + s.fields, 0);
  const corrected = stats.reduce((n, s) => n + s.corrected, 0);
  return { stats, fields, corrected, rate: fields ? corrected / fields : 0, quick: stats.filter((s) => stageOf(s) === "rapida").length };
}
