import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { monthYear, type Coverage } from "@/lib/provenance";

/**
 * Cobertura do histórico: período, quantos laudos, de quantos lugares, onde
 * há buracos e o que não foi compartilhado. Para o médico, é o "o que eu não
 * sei"; para o paciente, um convite a completar o histórico.
 */
export function CoverageCard({ c, audience }: { c: Coverage; audience: "medico" | "paciente" }) {
  const doctor = audience === "medico";
  if (!c.from && !c.wearableDays) return null;
  return (
    <section className={doctor ? "rounded-2xl bg-white p-4 sm:p-5" : "tile"} aria-labelledby={`cobertura-${audience}`}>
      <h2 id={`cobertura-${audience}`} className={doctor ? "text-lg font-medium tracking-[-0.02em]" : "text-[17px] font-medium"}>
        {doctor ? "Cobertura do histórico" : "Seu histórico até aqui"}
      </h2>
      <ul className="num mt-2 space-y-1 text-[15px] text-ink-soft">
        {c.from && (
          <li>
            {formatDate(c.from)} a {formatDate(c.to!)} · {c.labReports} {c.labReports === 1 ? "laudo de laboratório" : "laudos de laboratório"}
            {c.descriptiveReports > 0 && ` e ${c.descriptiveReports} de imagem ou procedimento`} · {c.labs.length} {c.labs.length === 1 ? "local" : "locais"}
          </li>
        )}
        {c.from && c.labs.length > 0 && <li className="text-sm text-muted">{c.labs.join(", ")}</li>}
        {c.wearableDays > 0 ? (
          <li>Relógio: {c.wearableDays} dias de dados nos últimos 6 meses{c.wearableFrom ? `, desde ${formatDate(c.wearableFrom)}` : ""}</li>
        ) : (
          <li>Sem dados de relógio ou anel</li>
        )}
        {doctor && c.editedValues > 0 && <li>{c.editedValues} {c.editedValues === 1 ? "valor digitado ou corrigido" : "valores digitados ou corrigidos"} pelo paciente (marcados em cada resultado)</li>}
      </ul>
      {(c.gaps.length > 0 || c.notShared.length > 0) && (
        <ul className="mt-3 space-y-1.5">
          {c.gaps.map((g) => (
            <li key={g.from} className="rounded-xl bg-warn-soft px-3 py-2 text-[15px] text-ink">
              {doctor ? "Lacuna" : "Nenhum exame"}: {monthYear(g.from)} a {monthYear(g.to)} ({g.months} meses sem laudo)
            </li>
          ))}
          {doctor && c.notShared.length > 0 && (
            <li className="rounded-xl bg-surface px-3 py-2 text-[15px] text-ink">Não compartilhado neste acesso: {c.notShared.join(", ")}</li>
          )}
        </ul>
      )}
      {!doctor && c.gaps.length > 0 && (
        <p className="mt-3 text-[15px] text-muted">
          Tem algum exame guardado desse período? Uma foto já ajuda o seu médico. <Link href="/enviar" className="btn-quiet">Enviar</Link>
        </p>
      )}
    </section>
  );
}
