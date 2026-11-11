import { labStatus } from "./health";
import type { Db, HealthAlert } from "./types";
import { todayISO } from "./dates";

export type TimelineKind = "exame" | "consulta" | "medicamento" | "vacina" | "alerta";

export interface TimelineEvent {
  id: string;
  date: string;
  kind: TimelineKind;
  title: string;
  subtitle?: string;
  detail?: string;
  href?: string;
  badge?: { text: string; tone: "red" | "amber" | "green" | "slate" };
}

/**
 * Junta tudo numa linha do tempo única, do mais recente para o mais antigo.
 * `docHref` permite que a visão do médico aponte para a rota protegida.
 */
export function buildTimeline(
  data: Pick<Db, "documents" | "labResults" | "encounters" | "medications" | "vaccines">,
  alerts: HealthAlert[] = [],
  docHref: (id: string) => string | undefined = () => undefined,
): TimelineEvent[] {
  const ev: TimelineEvent[] = [];

  for (const doc of data.documents) {
    const results = data.labResults.filter((r) => r.documentId === doc.id);
    if (!results.length) continue;
    const out = results.filter((r) => ["alto", "baixo"].includes(labStatus(r)));
    ev.push({
      id: "doc-" + doc.id,
      date: doc.examDate,
      kind: "exame",
      title: doc.lab ?? "Laboratório não informado",
      subtitle: `Exames de laboratório, ${results.length} resultados`,
      detail: out.length ? `Alterados: ${out.map((r) => r.name).join(", ")}` : "Todos dentro da referência",
      href: docHref(doc.id),
      badge: out.length ? { text: `${out.length} ${out.length === 1 ? "alterado" : "alterados"}`, tone: "red" } : undefined,
    });
  }
  for (const e of data.encounters) {
    ev.push({ id: e.id, date: e.date, kind: "consulta", title: e.specialty, subtitle: `Consulta com ${e.professional}, ${e.place}`, detail: [e.reason, e.notes].filter(Boolean).join(". ") });
  }
  for (const m of data.medications) {
    ev.push({ id: m.id + "-ini", date: m.startDate, kind: "medicamento", title: `${m.name} ${m.dose}`, subtitle: `Começou a tomar, ${m.frequency}`, detail: m.reason, badge: m.endDate ? undefined : { text: "Em uso", tone: "slate" } });
    if (m.endDate) ev.push({ id: m.id + "-fim", date: m.endDate, kind: "medicamento", title: `${m.name} ${m.dose}`, subtitle: "Parou de tomar", detail: m.reason });
  }
  for (const v of data.vaccines) {
    ev.push({ id: v.id, date: v.date, kind: "vacina", title: v.name, subtitle: v.dose ? `Vacina, ${v.dose.toLowerCase()}` : "Vacina" });
  }
  const today = todayISO();
  for (const a of alerts.filter((x) => x.kind !== "exames")) {
    ev.push({
      id: "alerta-" + a.id,
      date: today,
      kind: "alerta",
      title: a.title,
      subtitle: "Alerta do relógio ou do medidor",
      detail: a.message,
      badge: a.severity === "procure_medico" ? { text: "Procure um médico", tone: "red" } : { text: "Atenção", tone: "amber" },
    });
  }
  return ev.sort((a, b) => b.date.localeCompare(a.date) || a.kind.localeCompare(b.kind));
}
