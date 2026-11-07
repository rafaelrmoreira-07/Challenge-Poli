import Link from "next/link";
import type { LabStatus } from "@/lib/health";
import type { HealthAlert } from "@/lib/types";
import { AlertIcon, ChevronRight } from "./icons";

export function StatusBadge({ status }: { status: LabStatus }) {
  const map = {
    alto: ["Acima", "bg-red-50 text-red-700 ring-red-200"],
    baixo: ["Abaixo", "bg-amber-50 text-amber-800 ring-amber-200"],
    normal: ["Na faixa", "bg-emerald-50 text-emerald-700 ring-emerald-200"],
    sem_faixa: ["Sem faixa", "bg-slate-50 text-slate-600 ring-slate-200"],
  } as const;
  const [label, cls] = map[status];
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${cls}`}>{label}</span>;
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h2>
      {action}
    </div>
  );
}

export function AlertCard({ alert, compact, cta = true }: { alert: HealthAlert; compact?: boolean; cta?: boolean }) {
  const urgent = alert.severity === "procure_medico";
  return (
    <article
      className={`rounded-2xl p-4 ring-1 ${urgent ? "bg-red-50 ring-red-200" : "bg-amber-50 ring-amber-200"}`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${urgent ? "bg-red-600 text-white" : "bg-amber-500 text-white"}`}>
          <AlertIcon width={18} height={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-bold uppercase tracking-wide ${urgent ? "text-red-700" : "text-amber-800"}`}>
            {urgent ? "Procure um médico" : "Atenção"}
            {alert.specialty ? ` · ${alert.specialty}` : ""}
          </p>
          <h3 className="mt-0.5 font-semibold text-slate-900">{alert.title}</h3>
          <p className="mt-1 text-sm text-slate-700">{alert.message}</p>
          {!compact && (
            <>
              <p className="mt-2 text-sm font-medium text-slate-900">{alert.recommendation}</p>
              {alert.evidence.length > 0 && (
                <details className="mt-2 text-xs text-slate-600">
                  <summary className="cursor-pointer font-medium">Ver dados</summary>
                  <ul className="mt-1 list-disc pl-4">
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
        </div>
      </div>
    </article>
  );
}

export function ListLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
      <div className="min-w-0 flex-1">{children}</div>
      <ChevronRight width={18} height={18} className="shrink-0 text-slate-400" />
    </Link>
  );
}

export function Skeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200/70" />
      ))}
    </div>
  );
}

export function Disclaimer() {
  return (
    <p className="mt-8 text-center text-[11px] leading-relaxed text-slate-500">
      Os alertas são orientações para procurar atendimento e não substituem avaliação médica.
      Em emergência, ligue 192 (SAMU).
    </p>
  );
}
