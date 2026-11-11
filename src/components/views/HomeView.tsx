"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertIcon, ChevronRight, ClipboardIcon, DropIcon, GaugeIcon, HeartIcon, MoonIcon } from "@/components/icons";
import { AlertCard, Disclaimer, SectionLink, SectionTitle, Skeleton, StatusBadge } from "@/components/ui";
import { AiStatusBanner } from "@/components/AiStatus";
import { ageFrom, formatDate } from "@/lib/dates";
import { analyteSeries, computeAlerts, fmt, formatRef, wearableSnapshot } from "@/lib/health";
import { resetDemo, simulateIrregularRhythm, useDb } from "@/lib/store";

export function HomeView() {
  const db = useDb();
  const router = useRouter();
  if (!db) return <Skeleton lines={5} />;

  const p = db.patient;
  const alerts = computeAlerts(db);
  const w = wearableSnapshot(db.wearableDays);
  const altered = analyteSeries(db.labResults).filter((s) => s.status === "alto" || s.status === "baixo");
  const activeMeds = db.medications.filter((m) => !m.endDate);
  const since = db.documents.length ? Math.min(...db.documents.map((d) => Number(d.examDate.slice(0, 4)))) : null;
  const bpHigh = w.systolic >= 130 || w.diastolic >= 80;
  const spo2Low = w.spo2Min < 90;

  return (
    <div>
      <h1 className="sr-only">Início</h1>

      {/* Ficha médica: o que qualquer profissional precisa saber primeiro */}
      <section aria-labelledby="ficha" className="card">
        <p id="ficha" className="text-sm font-semibold text-ink-600">Ficha médica</p>
        <p className="mt-0.5 font-serif text-[1.75rem] font-semibold leading-tight text-ink-900">{p.name}</p>
        <p className="mt-0.5 text-[15px] text-ink-600">
          {ageFrom(p.birthDate)} anos, {p.sex === "F" ? "feminino" : "masculino"}
          {p.bloodType ? <>, sangue <strong className="text-ink-800">{p.bloodType}</strong></> : null}
        </p>
        <dl className="mt-3 space-y-2 border-t border-ink-100 pt-3 text-[15px]">
          <div className="flex gap-3">
            <dt className="w-28 shrink-0 font-semibold text-danger-700">Alergias</dt>
            <dd className="text-ink-800">{p.allergies.join(", ") || "Nenhuma conhecida"}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-28 shrink-0 font-semibold text-ink-600">Medicamentos</dt>
            <dd className="text-ink-800">
              {activeMeds.length
                ? activeMeds.map((m) => <span key={m.id} className="block">{m.name} {m.dose}</span>)
                : "Nenhum em uso"}
            </dd>
          </div>
        </dl>
      </section>

      <AiStatusBanner />

      <SectionTitle>{alerts.length ? `Alertas (${alerts.length})` : "Alertas"}</SectionTitle>
      {alerts.length ? (
        <div className="space-y-3">
          {alerts.map((a) => <AlertCard key={a.id} alert={a} />)}
        </div>
      ) : (
        <p className="card text-[15px] text-ink-600">Nenhum alerta no momento.</p>
      )}

      <SectionTitle action={<SectionLink href="/wearables">Ver tudo</SectionLink>}>Últimos 7 dias</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Vital icon={<HeartIcon />} label="Batimentos em repouso" value={`${w.restingHr}`} unit="bpm" note="média" />
        <Vital icon={<MoonIcon />} label="Sono" value={fmt(w.sleepHours)} unit="h/noite" note="média" />
        <Vital icon={<DropIcon />} label="Saturação mínima" value={`${w.spo2Min}`} unit="%" note={spo2Low ? "abaixo de 90%" : "menor valor"} warn={spo2Low} />
        <Vital icon={<GaugeIcon />} label="Pressão arterial" value={`${w.systolic}/${w.diastolic}`} unit="mmHg" note={bpHigh ? "acima de 130/80" : "média"} warn={bpHigh} />
      </div>

      <SectionTitle action={<SectionLink href="/exames">Todos os exames</SectionLink>}>Exames alterados</SectionTitle>
      {altered.length ? (
        <ul className="card divide-y divide-ink-100 p-0">
          {altered.slice(0, 5).map((s) => (
            <li key={s.key}>
              <Link href={`/exame/?a=${encodeURIComponent(s.key)}`} className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-50">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink-900">{s.name}</p>
                  <p className="num text-sm text-ink-500">Referência {formatRef(s.latest)}</p>
                  <p className="num text-sm text-ink-500">Coleta {formatDate(s.latest.date)}</p>
                </div>
                <div className="text-right">
                  <p className="num text-base font-semibold text-ink-900">
                    {s.latest.value != null ? fmt(s.latest.value) : s.latest.valueText} <span className="text-xs font-normal text-ink-500">{s.unit}</span>
                  </p>
                  <StatusBadge status={s.status} />
                </div>
                <ChevronRight width={18} className="shrink-0 text-ink-400" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="card text-[15px] text-ink-600">Seus últimos resultados estão dentro da referência.</p>
      )}
      <p className="mt-2 text-sm text-ink-500">
        {db.documents.length} laudos e {db.labResults.length} resultados guardados{since ? `, desde ${since}` : ""}.
      </p>

      <Link href="/compartilhar" className="card mt-8 flex items-center gap-3 transition-colors hover:border-brand-300">
        <ClipboardIcon width={28} className="shrink-0 text-brand-700" />
        <span className="flex-1">
          <span className="block text-[15px] font-semibold text-ink-900">Tem consulta marcada?</span>
          <span className="block text-sm text-ink-600">Gere um relatório com seus exames e medições para mostrar ao médico.</span>
        </span>
        <ChevronRight width={18} className="shrink-0 text-ink-400" />
      </Link>

      <details className="mt-10 rounded-xl border border-dashed border-ink-300 px-4 text-[15px]">
        <summary className="flex min-h-12 items-center font-semibold text-ink-600">Controles da demonstração</summary>
        <div className="flex flex-col gap-2 pb-4">
          <button className="btn-secondary w-full" onClick={() => simulateIrregularRhythm()}>
            Simular batimentos irregulares no relógio
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

function Vital({ icon, label, value, unit, note, warn }: { icon: React.ReactNode; label: string; value: string; unit: string; note: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl border bg-white p-4 ${warn ? "border-warn-300 border-l-4 border-l-warn-500" : "border-ink-200"}`}>
      <p className="flex items-center gap-1.5 text-sm font-medium leading-tight text-ink-600">
        <span className="shrink-0 text-ink-500 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        {label}
      </p>
      <p className="num mt-1.5 font-serif text-[1.75rem] font-semibold leading-tight text-ink-900">
        {value} <span className="font-sans text-sm font-medium text-ink-500">{unit}</span>
      </p>
      <p className={`mt-0.5 flex items-center gap-1 text-xs ${warn ? "font-semibold text-warn-800" : "text-ink-500"}`}>
        {warn && <AlertIcon width={12} />}
        {note}
      </p>
    </div>
  );
}
