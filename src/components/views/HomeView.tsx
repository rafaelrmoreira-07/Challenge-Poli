"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AiStatusBanner } from "@/components/AiStatus";
import { ExamSearch } from "@/components/ExamSearch";
import { AlertIcon, ChevronDown, DropIcon, GaugeIcon, HeartIcon, MoonIcon } from "@/components/icons";
import { AlertCard, Disclaimer, RowLink, SectionLink, SectionTitle, Skeleton, Spark, StatusBadge } from "@/components/ui";
import NumberFlow from "@number-flow/react";
import { ageFrom, formatDate } from "@/lib/dates";
import { analyteSeries, computeAlerts, fmt, formatRef, wearableSnapshot } from "@/lib/health";
import { resetDemo, simulateIrregularRhythm, useDb } from "@/lib/store";
import type { WearableDay } from "@/lib/types";

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export function HomeView() {
  const db = useDb();
  const router = useRouter();
  if (!db) return <Skeleton lines={5} />;

  const p = db.patient;
  const alerts = computeAlerts(db);
  const w = wearableSnapshot(db.wearableDays);
  const last14 = db.wearableDays.slice(-14);
  const altered = analyteSeries(db.labResults).filter((s) => s.status === "alto" || s.status === "baixo");
  const meds = db.medications.filter((m) => !m.endDate);
  const bpHigh = w.systolic >= 130 || w.diastolic >= 80;
  const spo2Low = w.spo2Min < 90;
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div>
      <header className="t-reveal">
        <p className="text-[15px] text-muted">{today.charAt(0).toUpperCase() + today.slice(1)}</p>
        <h1 className="display mt-1">
          {greeting()}, {p.name.split(" ")[0]}
        </h1>
        <p className="mt-2 text-[15px] text-muted">
          {ageFrom(p.birthDate)} anos{p.bloodType ? `, sangue ${p.bloodType}` : ""}
        </p>
      </header>

      {/* Ficha: o que qualquer profissional precisa saber primeiro */}
      <dl className="mt-5 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-danger-soft p-3.5">
          <dt className="text-sm font-medium text-danger">Alergia</dt>
          <dd className="mt-0.5 text-[15px] font-medium leading-snug text-ink">{p.allergies.join(", ") || "Nenhuma conhecida"}</dd>
        </div>
        <div className="rounded-2xl bg-surface p-3.5">
          <dt className="text-sm font-medium text-muted">Remédios em uso</dt>
          <dd className="mt-0.5 text-[15px] font-medium leading-snug text-ink">
            {meds.length ? meds.map((m) => <span key={m.id} className="block">{m.name} {m.dose}</span>) : "Nenhum"}
          </dd>
        </div>
      </dl>

      <AiStatusBanner />

      <SectionTitle>{alerts.length ? `Alertas (${alerts.length})` : "Alertas"}</SectionTitle>
      {alerts.length ? (
        <div className="space-y-2">
          {alerts.map((a, i) => <AlertCard key={a.id} alert={a} defaultOpen={i === 0 && a.severity === "procure_medico"} />)}
        </div>
      ) : (
        <p className="tile text-[15px] text-muted">Nenhum alerta. Eu aviso na Conversa se aparecer algum.</p>
      )}

      <div className="mt-6 flex flex-col gap-2">
        <Link href="/enviar" className="btn-primary">Adicionar exame</Link>
        <Link href="/compartilhar" className="btn-secondary">Montar relatório para o médico</Link>
      </div>

      <SectionTitle action={<SectionLink href="/wearables">Ver gráficos</SectionLink>}>Sinais dos últimos 7 dias</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Vital icon={<HeartIcon />} label="Batimentos em repouso" unit="bpm" note="média" days={last14} metric="restingHr">
          <NumberFlow value={w.restingHr} locales="pt-BR" />
        </Vital>
        <Vital icon={<MoonIcon />} label="Sono" unit="h por noite" note="média" days={last14} metric="sleepHours">
          <NumberFlow value={w.sleepHours} locales="pt-BR" format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }} />
        </Vital>
        <Vital icon={<DropIcon />} label="Saturação mínima" unit="%" note={spo2Low ? "abaixo de 90%" : "menor valor"} warn={spo2Low} days={last14} metric="spo2Min">
          <NumberFlow value={w.spo2Min} locales="pt-BR" />
        </Vital>
        <Vital icon={<GaugeIcon />} label="Pressão" unit="mmHg" note={bpHigh ? "acima de 130/80" : "média"} warn={bpHigh} days={last14} metric="systolic">
          <NumberFlow value={w.systolic} locales="pt-BR" />
          <span>/</span>
          <NumberFlow value={w.diastolic} locales="pt-BR" />
        </Vital>
      </div>

      <SectionTitle action={<SectionLink href="/exames">Todos os exames</SectionLink>}>Exames alterados</SectionTitle>
      <div className="mb-3">
        <ExamSearch />
      </div>
      {altered.length ? (
        <ul className="divide-y divide-line border-y border-line">
          {altered.slice(0, 5).map((s) => (
            <li key={s.key}>
              <RowLink
                href={`/exame/?a=${encodeURIComponent(s.key)}`}
                trailing={
                  <span className="text-right">
                    <span className="num block text-[17px] font-medium">
                      {s.latest.value != null ? fmt(s.latest.value) : s.latest.valueText} <span className="text-xs font-normal text-muted">{s.unit}</span>
                    </span>
                    <StatusBadge status={s.status} />
                  </span>
                }
              >
                <p className="truncate text-[15px] font-medium">{s.name}</p>
                <p className="num text-sm text-muted">Referência {formatRef(s.latest)}</p>
                <p className="num text-sm text-muted">Coleta {formatDate(s.latest.date)}</p>
              </RowLink>
            </li>
          ))}
        </ul>
      ) : (
        <p className="tile text-[15px] text-muted">Seus últimos resultados estão dentro da referência.</p>
      )}

      <details className="group mt-12 rounded-2xl border border-dashed border-line-strong">
        <summary className="flex min-h-12 items-center justify-between px-4 text-[15px] font-medium text-muted">
          Controles da demonstração
          <ChevronDown width={18} className="transition-transform group-open:-scale-y-100" />
        </summary>
        <div className="flex flex-col gap-2 px-4 pb-4">
          <button className="btn-secondary" onClick={() => simulateIrregularRhythm()}>
            Simular batimentos irregulares no relógio
          </button>
          <button
            className="btn-danger"
            onClick={async () => {
              if (!confirm("Apagar os exames enviados, os acessos e a conversa, e voltar aos dados iniciais?")) return;
              await resetDemo();
              router.push("/");
            }}
          >
            Restaurar dados de demonstração
          </button>
        </div>
      </details>

      <Disclaimer />
    </div>
  );
}

function Vital({
  icon,
  label,
  unit,
  note,
  warn,
  days,
  metric,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  unit: string;
  note: string;
  warn?: boolean;
  days: WearableDay[];
  metric: keyof Omit<WearableDay, "date">;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl p-4 ${warn ? "bg-warn-soft" : "bg-surface"}`}>
      <p className="flex items-center gap-1.5 text-sm font-medium leading-tight text-muted">
        <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        {label}
      </p>
      <p className="big-num mt-3 flex items-baseline text-ink">{children}</p>
      <p className="text-sm text-muted">{unit}</p>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className={`flex items-center gap-1 text-xs ${warn ? "font-medium text-warn" : "text-muted"}`}>
          {warn && <AlertIcon width={12} />}
          {note}
        </p>
        <Spark values={days.map((d) => d[metric] as number)} width={56} height={22} />
      </div>
    </div>
  );
}
