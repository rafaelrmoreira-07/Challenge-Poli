"use client";

import NumberFlow from "@number-flow/react";
import Link from "next/link";
import { BackIcon } from "@/components/icons";
import { PageHeader, SectionTitle, Skeleton } from "@/components/ui";
import { admissionChecklist, checklistScore, followUp, hasRedFlag } from "@/lib/admission";
import { readingSummary } from "@/lib/quality";
import { shareState } from "@/lib/share";
import { useDb } from "@/lib/store";

/**
 * Apêndice G: modelo pago por resultado. Cada indicador vem dos dados deste
 * aparelho e mostra quem ganharia com ele, no mesmo espírito da Rivio, que
 * cobra dos hospitais pelo resultado entregue.
 */
export default function ImpactoPage() {
  const db = useDb();
  if (!db) return <Skeleton lines={5} />;

  const hospitalShares = db.shares.filter((s) => s.kind === "hospital");
  const doctorShares = db.shares.filter((s) => s.kind !== "hospital");
  const sentAdmissions = new Set(hospitalShares.map((s) => s.admissionId));
  const admissions = (db.admissions ?? []).filter((a) => sentAdmissions.has(a.id));
  const complete = admissions.filter((a) => checklistScore(admissionChecklist(a)).complete).length;
  const pending = (db.admissions ?? []).reduce((n, a) => n + admissionChecklist(a).filter((i) => i.status !== "ok" && i.glosa).length, 0);
  const recentShown = doctorShares.reduce((n, s) => n + (s.recentShown ?? 0), 0);
  const fu = followUp(db);
  const checkins = db.checkins ?? [];
  const redFlags = checkins.filter(hasRedFlag).length;
  const consent = hospitalShares.filter((s) => s.evidenceConsent).length;
  const reading = readingSummary(db);
  const imported = db.documents.filter((d) => d.mimeType === "application/fhir+json").length;
  const active = db.shares.filter((s) => shareState(s) === "ativo").length;
  const opens = db.shares.reduce((n, s) => n + s.accessLog.length, 0);

  return (
    <div>
      <Link href="/configuracoes" className="-ml-2 inline-flex min-h-11 items-center gap-1.5 px-2 text-[15px] font-medium text-ink">
        <BackIcon width={20} /> Configurações
      </Link>
      <PageHeader title="Indicadores">
        O paciente não paga. Hospitais e planos pagariam pelo resultado, como a Rivio cobra dos hospitais. Números deste aparelho.
      </PageHeader>

      <SectionTitle>Para o hospital</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Metric value={complete} of={admissions.length} label="pastas enviadas completas" who="Menos autorização travada e menos glosa por documento" />
        <Metric value={pending} label="pendências apontadas antes da internação" who="Glosas 1818, 1414 e 3052 vistas a tempo" />
        <Metric value={consent} label="consentimentos para anexar ao prontuário" who="Evidência clínica para a auditoria da conta" />
        <Metric value={opens} label="aberturas de links registradas" who="Rastreabilidade de quem viu o quê" />
      </div>

      <SectionTitle>Para o plano de saúde</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Metric value={recentShown} label="resultados recentes levados ao médico" who="Exames que não precisam ser repetidos" />
        <Metric value={checkins.length} label="registros diários no pós-alta" who={`Acompanhamento para evitar reinternação${fu?.active ? ` · dia ${fu.day} de ${fu.total}` : ""}`} />
        <Metric value={redFlags} label="sintomas de alerta sinalizados" who="Equipe do hospital avisada no mesmo dia" />
        <Metric value={active} label="acessos ativos agora" who="Médicos e hospitais com o histórico em mãos" />
      </div>

      <SectionTitle>Qualidade dos dados</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Metric value={Math.round(reading.rate * 1000) / 10} suffix="%" label="dos campos lidos precisaram de correção" who={`${reading.quick} exames já em conferência rápida`} />
        <Metric value={db.fhirExports ?? 0} label="exportações em FHIR" who={`${imported} laudos importados de outros sistemas`} />
      </div>

      <p className="mt-10 text-sm leading-relaxed text-muted">
        Como seria cobrado: o hospital paga por pasta completa entregue antes da internação; o plano paga por exame repetido evitado e por reinternação evitada em 30 dias, medidos contra quem não usa o app. Os números acima são da demonstração neste aparelho.
      </p>
    </div>
  );
}

function Metric({ value, of, suffix, label, who }: { value: number; of?: number; suffix?: string; label: string; who: string }) {
  return (
    <div className="flex flex-col rounded-2xl bg-surface p-4">
      <p className="big-num text-ink">
        <NumberFlow value={value} locales="pt-BR" suffix={suffix} />
        {of != null && <span className="text-lg text-muted"> de {of}</span>}
      </p>
      <p className="mt-1 text-sm font-medium leading-snug text-ink">{label}</p>
      <p className="mt-auto pt-2 text-xs leading-snug text-muted">{who}</p>
    </div>
  );
}
