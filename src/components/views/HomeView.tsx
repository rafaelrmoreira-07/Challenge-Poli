"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DropIcon, FileIcon, GaugeIcon, HeartIcon, MoonIcon, SparkIcon } from "@/components/icons";
import { AlertCard, Disclaimer, SectionTitle, Skeleton, StatusBadge } from "@/components/ui";
import { AiStatusBanner } from "@/components/AiStatus";
import { ageFrom, formatDate } from "@/lib/dates";
import { analyteSeries, computeAlerts, fmt, wearableSnapshot } from "@/lib/health";
import { resetDemo, simulateIrregularRhythm, useDb } from "@/lib/store";

export function HomeView() {
  const db = useDb();
  const router = useRouter();
  if (!db) return <Skeleton lines={5} />;

  const alerts = computeAlerts(db);
  const w = wearableSnapshot(db.wearableDays);
  const outOfRange = analyteSeries(db.labResults).filter((s) => s.status === "alto" || s.status === "baixo");
  const firstName = db.patient.name.split(" ")[0];
  const years = db.documents.length
    ? new Date().getFullYear() - Math.min(...db.documents.map((d) => Number(d.examDate.slice(0, 4))))
    : 0;

  return (
    <div>
      <section>
        <p className="text-sm text-slate-500">Olá, {firstName} · {ageFrom(db.patient.birthDate)} anos</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sua saúde hoje</h1>
        <p className="mt-1 text-sm text-slate-600">
          {db.documents.length} laudos, {db.labResults.length} resultados e {db.wearableDays.length} dias de wearables
          {years > 0 ? `, cobrindo ${years} anos` : ""}.
        </p>
      </section>

      <AiStatusBanner />

      <SectionTitle>Alertas</SectionTitle>
      {alerts.length ? (
        <div className="space-y-3">
          {alerts.map((a) => <AlertCard key={a.id} alert={a} />)}
        </div>
      ) : (
        <p className="card text-sm text-slate-600">Nenhum alerta no momento.</p>
      )}

      <SectionTitle action={<Link href="/wearables" className="text-xs font-semibold text-brand-700">Ver tudo</Link>}>
        Últimos 7 dias
      </SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Stat icon={<HeartIcon />} label="FC de repouso" value={`${w.restingHr}`} unit="bpm" />
        <Stat icon={<MoonIcon />} label="Sono por noite" value={fmt(w.sleepHours)} unit="h" />
        <Stat icon={<DropIcon />} label="SpO2 mínima" value={`${w.spo2Min}`} unit="%" warn={w.spo2Min < 90} />
        <Stat icon={<GaugeIcon />} label="Pressão média" value={`${w.systolic}/${w.diastolic}`} unit="mmHg" warn={w.systolic >= 130 || w.diastolic >= 80} />
      </div>

      <SectionTitle action={<Link href="/exames" className="text-xs font-semibold text-brand-700">Todos os exames</Link>}>
        Exames fora da faixa
      </SectionTitle>
      {outOfRange.length ? (
        <ul className="card divide-y divide-slate-100 p-0">
          {outOfRange.slice(0, 5).map((s) => (
            <li key={s.key}>
              <Link href={`/exame/?a=${encodeURIComponent(s.key)}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-slate-500">{formatDate(s.latest.date)}</p>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <span className="text-sm font-semibold">{s.latest.value != null ? fmt(s.latest.value) : s.latest.valueText} <span className="text-xs font-normal text-slate-500">{s.unit}</span></span>
                  <StatusBadge status={s.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="card text-sm text-slate-600">Todos os últimos resultados estão dentro da faixa do laudo.</p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link href="/enviar" className="card flex flex-col gap-2 hover:ring-brand-200">
          <FileIcon className="text-brand-600" />
          <span className="text-sm font-semibold">Enviar exame</span>
          <span className="text-xs text-slate-500">Foto ou PDF. A IA lê e organiza.</span>
        </Link>
        <Link href="/compartilhar" className="card flex flex-col gap-2 hover:ring-brand-200">
          <SparkIcon className="text-brand-600" />
          <span className="text-sm font-semibold">Mostrar ao médico</span>
          <span className="text-xs text-slate-500">Link com prazo, que você pode revogar.</span>
        </Link>
      </div>

      <details className="mt-8 rounded-2xl border border-dashed border-slate-300 p-4 text-sm">
        <summary className="cursor-pointer font-semibold text-slate-600">Controles da demonstração</summary>
        <div className="mt-3 flex flex-col gap-2">
          <button className="btn-secondary w-full" onClick={() => simulateIrregularRhythm()}>
            Simular episódios de ritmo irregular no relógio
          </button>
          <button
            className="btn-danger w-full"
            onClick={async () => {
              if (!confirm("Apagar os exames enviados e os acessos criados, e voltar aos dados iniciais?")) return;
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

function Stat({ icon, label, value, unit, warn }: { icon: React.ReactNode; label: string; value: string; unit: string; warn?: boolean }) {
  return (
    <div className={`card ${warn ? "ring-amber-300" : ""}`}>
      <div className={`flex items-center gap-1.5 text-xs font-medium ${warn ? "text-amber-700" : "text-slate-500"}`}>
        <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        {label}
      </div>
      <p className="mt-1 text-2xl font-bold tracking-tight">
        {value} <span className="text-sm font-medium text-slate-500">{unit}</span>
      </p>
    </div>
  );
}
