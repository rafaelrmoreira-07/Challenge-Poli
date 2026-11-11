import Link from "next/link";
import type { LabStatus } from "@/lib/health";
import type { HealthAlert } from "@/lib/types";
import { AlertIcon, ArrowDownIcon, ArrowUpIcon, CheckIcon, ChevronRight, MinusIcon } from "./icons";

/**
 * Status de um resultado. Sempre ícone + texto, nunca só cor.
 * "Na faixa" fica neutro para que o olho vá direto ao que está fora.
 */
export function StatusBadge({ status }: { status: LabStatus }) {
  const map = {
    alto: ["Acima", ArrowUpIcon, "bg-danger-50 text-danger-700 border-danger-200"],
    baixo: ["Abaixo", ArrowDownIcon, "bg-warn-50 text-warn-800 border-warn-200"],
    normal: ["Na faixa", CheckIcon, "bg-white text-ink-600 border-ink-200"],
    sem_faixa: ["Sem faixa", MinusIcon, "bg-ink-50 text-ink-600 border-ink-200"],
  } as const;
  const [label, Icon, cls] = map[status];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-semibold ${cls}`}>
      <Icon width={12} height={12} strokeWidth={2.4} />
      {label}
    </span>
  );
}

/** Título de seção no estilo de prontuário: versalete com um fio até a margem. */
export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-center gap-3">
      <h2 className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-ink-600">{children}</h2>
      <span className="h-px flex-1 bg-ink-200" aria-hidden />
      {action}
    </div>
  );
}

export function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="-my-2 inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-brand-700 underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}

export function AlertCard({ alert, compact, cta = true }: { alert: HealthAlert; compact?: boolean; cta?: boolean }) {
  const urgent = alert.severity === "procure_medico";
  return (
    <article
      className={`rounded-xl border border-l-4 bg-white p-4 ${urgent ? "border-danger-200 border-l-danger-600" : "border-warn-200 border-l-warn-500"}`}
    >
      <p className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] ${urgent ? "text-danger-700" : "text-warn-800"}`}>
        <AlertIcon width={14} height={14} strokeWidth={2.2} />
        {urgent ? "Procure um médico" : "Atenção"}
        {alert.specialty ? <span className="font-semibold normal-case tracking-normal text-ink-600">· {alert.specialty}</span> : null}
      </p>
      <h3 className="mt-1.5 font-serif text-lg font-semibold leading-snug text-ink-900">{alert.title}</h3>
      <p className="mt-1 text-[15px] text-ink-700">{alert.message}</p>
      {!compact && (
        <>
          <p className="mt-3 border-t border-ink-100 pt-3 text-[15px] font-semibold text-ink-900">{alert.recommendation}</p>
          {alert.evidence.length > 0 && (
            <details className="mt-2 text-sm text-ink-600">
              <summary className="inline-flex min-h-11 items-center font-semibold text-ink-700">Ver os dados que geraram o alerta</summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {alert.evidence.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </details>
          )}
          {cta && urgent && (
            <Link href="/compartilhar" className="btn-primary mt-3 w-full">
              Compartilhar histórico com um médico
            </Link>
          )}
        </>
      )}
    </article>
  );
}

export function ListLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-50">
      <div className="min-w-0 flex-1">{children}</div>
      <ChevronRight width={18} height={18} className="shrink-0 text-ink-400" />
    </Link>
  );
}

export function Skeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl bg-ink-200/60" />
      ))}
    </div>
  );
}

export function Disclaimer() {
  return (
    <p className="mt-10 border-t border-ink-200 pt-4 text-center text-xs leading-relaxed text-ink-500">
      Os alertas são orientações para procurar atendimento e não substituem avaliação médica.
      Em emergência, ligue <strong className="text-ink-700">192 (SAMU)</strong>.
    </p>
  );
}
