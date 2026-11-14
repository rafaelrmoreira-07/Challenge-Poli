import { addDays, formatDate, todayISO } from "./dates";
import type { LabResult, Scope, SourceDocument, WearableDay } from "./types";
import { SCOPE_LABELS } from "./types";

/**
 * Procedência e cobertura: o que o médico precisa para confiar (ou desconfiar)
 * de cada número. Tudo calculado no aparelho, a partir do que já foi salvo.
 */

/** De onde veio um valor de exame, em linguagem curta para o médico. */
export function resultOrigin(r: LabResult, doc?: SourceDocument): { label: string; tone: "ok" | "warn" | "muted" } {
  if (r.review === "adicionado") return { label: "digitado pelo paciente", tone: "warn" };
  if (r.review === "corrigido") return { label: "leitura corrigida pelo paciente", tone: "warn" };
  switch (doc?.extractedBy) {
    case "gemini":
      return { label: "lido por IA, conferido pelo paciente", tone: "ok" };
    case "simulado":
      return { label: "leitura pré-gravada, conferida", tone: "ok" };
    case "manual":
      return { label: "digitado pelo paciente", tone: "warn" };
    default:
      return { label: "histórico importado", tone: "muted" };
  }
}

/** Nomes diferentes que os laudos usam para o mesmo exame padronizado, com o laboratório. */
export function namesInReports(results: LabResult[], standardName: string): { name: string; labs: string[] }[] {
  const byName = new Map<string, Set<string>>();
  for (const r of results) {
    const n = r.name.trim();
    if (!n) continue;
    const set = byName.get(n) ?? new Set<string>();
    if (r.lab) set.add(r.lab);
    byName.set(n, set);
  }
  const all = [...byName.entries()].map(([name, labs]) => ({ name, labs: [...labs] }));
  // Só interessa quando algum laudo escreve diferente do nome padronizado
  return all.some((x) => x.name.toLowerCase() !== standardName.toLowerCase()) ? all : [];
}

/** Unidades diferentes no mesmo exame: o Elo não converte, então avisa. */
export function mixedUnits(results: LabResult[]): string[] {
  const units = new Set(results.filter((r) => r.value != null).map((r) => r.unit.replace(/\s/g, "").toLowerCase()).filter(Boolean));
  return units.size > 1 ? [...new Set(results.map((r) => r.unit))].filter(Boolean) : [];
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const monthYear = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}`;
const monthsBetween = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7)));

/** Intervalo sem nenhum exame que vale apontar (o paciente pode ter laudos guardados desse período). */
export const GAP_MONTHS = 18;

export interface Coverage {
  from?: string;
  to?: string;
  labReports: number;
  descriptiveReports: number;
  labs: string[];
  gaps: { from: string; to: string; months: number }[];
  /** Meses desde o último exame de laboratório. */
  monthsSinceLast?: number;
  wearableDays: number;
  wearableFrom?: string;
  /** Dados que o paciente não liberou neste acesso. */
  notShared: string[];
  /** Valores digitados ou corrigidos pelo paciente. */
  editedValues: number;
}

export function computeCoverage(
  data: { documents: SourceDocument[]; labResults: LabResult[]; wearableDays: WearableDay[] },
  scopes?: Scope[],
  today = todayISO(),
): Coverage {
  const docs = [...data.documents].sort((a, b) => a.examDate.localeCompare(b.examDate));
  const dates = docs.map((d) => d.examDate);
  const gaps: Coverage["gaps"] = [];
  for (let i = 1; i < dates.length; i++) {
    const m = monthsBetween(dates[i - 1], dates[i]);
    if (m >= GAP_MONTHS) gaps.push({ from: dates[i - 1], to: dates[i], months: m });
  }
  const labDocs = docs.filter((d) => !d.report);
  const lastLab = labDocs.at(-1)?.examDate;
  const recentDays = data.wearableDays.filter((d) => d.date >= addDays(today, -180));
  return {
    from: dates[0],
    to: dates.at(-1),
    labReports: labDocs.length,
    descriptiveReports: docs.length - labDocs.length,
    labs: [...new Set(docs.map((d) => d.lab).filter((x): x is string => Boolean(x)))],
    gaps,
    monthsSinceLast: lastLab ? monthsBetween(lastLab, today) : undefined,
    wearableDays: recentDays.length,
    wearableFrom: recentDays[0]?.date,
    notShared: scopes ? (Object.keys(SCOPE_LABELS) as Scope[]).filter((s) => !scopes.includes(s)).map((s) => SCOPE_LABELS[s].toLowerCase()) : [],
    editedValues: data.labResults.filter((r) => r.review).length,
  };
}

/** Uma linha de texto com a cobertura, para o resumo por IA saber o que falta. */
export function coverageLine(c: Coverage): string {
  const parts = [
    c.from ? `laudos de ${formatDate(c.from)} a ${formatDate(c.to!)}: ${c.labReports} de laboratório e ${c.descriptiveReports} de imagem ou procedimento, de ${c.labs.length} locais` : "nenhum laudo salvo",
    ...c.gaps.map((g) => `sem nenhum laudo entre ${monthYear(g.from)} e ${monthYear(g.to)} (${g.months} meses)`),
    c.wearableDays ? `relógio com ${c.wearableDays} dias de dados nos últimos 6 meses` : "sem dados de relógio",
    c.notShared.length ? `o paciente não compartilhou: ${c.notShared.join(", ")}` : "",
    c.editedValues ? `${c.editedValues} valores digitados ou corrigidos pelo paciente` : "",
  ];
  return parts.filter(Boolean).join("; ") + ".";
}
