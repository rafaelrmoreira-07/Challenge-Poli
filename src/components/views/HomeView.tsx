"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertIcon, ChevronRight, DoctorIcon, DropIcon, GaugeIcon, HeartIcon, MoonIcon, ScanIcon } from "@/components/icons";
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
  const outOfRange = analyteSeries(db.labResults).filter((s) => s.status === "alto" || s.status === "baixo");
  const activeMeds = db.medications.filter((m) => !m.endDate);
  const since = db.documents.length ? Math.min(...db.documents.map((d) => Number(d.examDate.slice(0, 4)))) : null;
  const bpHigh = w.systolic >= 130 || w.diastolic >= 80;
  const spo2Low = w.spo2Min < 90;

  return (
    <div>
      {/* Ficha: o que qualquer profissional precisa saber primeiro */}
      <section aria-labelledby="ficha" className="card">
        <p className="text-sm text-ink-500">Ficha de saúde</p>
        <h1 id="ficha" className="page-title mt-0.5">{p.name}</h1>
        <p className="mt-1 text-[15px] text-ink-600">
          {ageFrom(p.birthDate)} anos · {p.sex === "F" ? "feminino" : "masculino"}
          {p.bloodType ? <> · tipo sanguíneo <strong className="text-ink-800">{p.bloodType}</strong></> : null}
        </p>
        <dl className="mt-3 space-y-2 border-t border-ink-100 pt-3 text-[15px]">
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 font-semibold text-danger-700">Alergias</dt>
            <dd className="text-ink-800">{p.allergies.join(", ") || "nenhuma registrada"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 font-semibold text-ink-600">Em uso</dt>
            <dd className="text-ink-800">{activeMeds.map((m) => `${m.name} ${m.dose}`).join(", ") || "nenhum remédio"}</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-ink-500">
          {db.documents.length} laudos e {db.labResults.length} resultados{since ? ` desde ${since}` : ""}, mais {db.wearableDays.length} dias de wearables.
        </p>
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

      <SectionTitle action={<SectionLink href="/wearables">Ver sinais</SectionLink>}>Últimos 7 dias</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Vital icon={<HeartIcon />} label="FC de repouso" value={`${w.restingHr}`} unit="bpm" note="média" />
        <Vital icon={<MoonIcon />} label="Sono por noite" value={fmt(w.sleepHours)} unit="h" note="média" />
        <Vital icon={<DropIcon />} label="SpO2 mínima" value={`${w.spo2Min}`} unit="%" note={spo2Low ? "abaixo de 90%" : "menor valor"} warn={spo2Low} />
        <Vital icon={<GaugeIcon />} label="Pressão" value={`${w.systolic}/${w.diastolic}`} unit="mmHg" note={bpHigh ? "acima de 130/80" : "média"} warn={bpHigh} />
      </div>

      <SectionTitle action={<SectionLink href="/exames">Todos</SectionLink>}>Exames fora da faixa</SectionTitle>
      {outOfRange.length ? (
        <ul className="card divide-y divide-ink-100 p-0">
          {outOfRange.slice(0, 5).map((s) => (
            <li key={s.key}>
              <Link href={`/exame/?a=${encodeURIComponent(s.key)}`} className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-50">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink-900">{s.name}</p>
                  <p className="num text-sm text-ink-500">ref. {formatRef(s.latest)} · {formatDate(s.latest.date)}</p>
                </div>
                <div className="text-right">
                  <p className="num text-base font-semibold text-ink-900">
                    {s.latest.value != null ? fmt(s.latest.value) : s.latest.valueText} <span className="text-xs font-normal text-ink-500">{s.unit}</span>
                  </p>
                  <StatusBadge status={s.status} />
                </div>
                <ChevronRight width={18} height={18} className="shrink-0 text-ink-400" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="card text-[15px] text-ink-600">Todos os últimos resultados estão dentro da faixa do laudo.</p>
      )}

      <SectionTitle>O que fazer agora</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        <Action href="/enviar" icon={<ScanIcon />} title="Enviar exame" desc="Foto ou PDF. A leitura é automática e você confere." />
        <Action href="/compartilhar" icon={<DoctorIcon />} title="Mostrar ao médico" desc="Link com prazo, que você pode revogar." />
      </div>

      <details className="mt-10 rounded-xl border border-dashed border-ink-300 px-4 text-[15px]">
        <summary className="flex min-h-12 items-center font-semibold text-ink-600">Controles da demonstração</summary>
        <div className="flex flex-col gap-2 pb-4">
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

function Vital({ icon, label, value, unit, note, warn }: { icon: React.ReactNode; label: string; value: string; unit: string; note: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl border bg-white p-4 ${warn ? "border-warn-300 border-l-4 border-l-warn-500" : "border-ink-200"}`}>
      <p className="flex items-center gap-1.5 text-sm font-medium text-ink-600">
        <span className="text-ink-500 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        {label}
      </p>
      <p className="num mt-1 font-serif text-[1.75rem] font-semibold leading-tight text-ink-900">
        {value} <span className="font-sans text-sm font-medium text-ink-500">{unit}</span>
      </p>
      <p className={`mt-0.5 flex items-center gap-1 text-xs ${warn ? "font-semibold text-warn-800" : "text-ink-500"}`}>
        {warn && <AlertIcon width={12} height={12} strokeWidth={2.4} />}
        {note}
      </p>
    </div>
  );
}

function Action({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} className="card flex flex-col gap-2 transition-colors hover:border-brand-300 hover:bg-brand-50/40">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">{icon}</span>
      <span className="text-[15px] font-semibold text-ink-900">{title}</span>
      <span className="text-sm leading-snug text-ink-500">{desc}</span>
    </Link>
  );
}
