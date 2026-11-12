"use client";

import { CHART, WearableChart } from "@/components/charts";
import { WatchIcon } from "@/components/icons";
import { AlertCard, Disclaimer, SectionTitle, Skeleton } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { computeAlerts, hasBloodPressure } from "@/lib/health";
import { simulateIrregularRhythm, useDb } from "@/lib/store";

export default function WearablesPage() {
  const db = useDb();
  return (
    <div>
      <h1 className="page-title">Sinais dos wearables</h1>
      <p className="mt-1 text-sm text-ink-600">Batimento, sono, oxigenação, pressão e atividade, no mesmo histórico dos seus exames.</p>
      {db ? <Wearables db={db} /> : <Skeleton lines={5} />}
    </div>
  );
}

function Wearables({ db }: { db: NonNullable<ReturnType<typeof useDb>> }) {
  const alerts = computeAlerts(db).filter((a) => a.kind !== "exames" && a.kind !== "cruzado");
  const days = db.wearableDays;
  if (!days.length)
    return (
      <div className="card mt-6 flex flex-col items-center px-6 py-10 text-center">
        <WatchIcon width={40} className="text-ink-400" />
        <p className="mt-3 text-lg font-semibold text-ink-900">Nenhum relógio ou anel conectado</p>
        <p className="mt-1 max-w-sm text-[15px] text-ink-600">
          Quando houver um dispositivo, batimento, sono, oxigenação e atividade aparecem aqui, junto dos exames. Até lá, o histórico
          de exames, remédios e vacinas funciona normalmente.
        </p>
        <Disclaimer />
      </div>
    );
  const bp = hasBloodPressure(days);
  const irregular = days.filter((d) => d.irregularRhythmEvents > 0).reverse();

  return (
    <div>
      <SectionTitle>Dispositivos conectados</SectionTitle>
      <ul className="card divide-y divide-ink-100 p-0">
        {db.devices.map((d) => (
          <li key={d.id} className="flex items-center gap-3 px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><WatchIcon width={18} height={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{d.name}</p>
              <p className="truncate text-xs text-ink-500">{d.metrics.join(" · ")}</p>
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold text-brand-700"><span className="h-2 w-2 rounded-full bg-brand-500" />sincronizado</span>
          </li>
        ))}
      </ul>

      <SectionTitle>Alertas</SectionTitle>
      <div className="space-y-3">
        {alerts.length ? alerts.map((a) => <AlertCard key={a.id} alert={a} />) : <p className="card text-sm text-ink-600">Nenhum alerta nos wearables.</p>}
      </div>
      <button className="btn-secondary mt-3 w-full text-xs" onClick={() => { simulateIrregularRhythm(); }}>
        Demo: simular episódios de ritmo irregular
      </button>

      <SectionTitle>Frequência cardíaca de repouso</SectionTitle>
      <div className="card px-2">
        <WearableChart days={days} unit="bpm" series={[{ key: "restingHr", name: "FC repouso", color: CHART.ink }]} />
      </div>

      <SectionTitle>Ritmo irregular</SectionTitle>
      <div className="card px-2">
        <WearableChart days={days} unit="episódios" kind="bar" domain={[0, "auto"]} defaultRange={90} series={[{ key: "irregularRhythmEvents", name: "Episódios", color: CHART.out }]} />
        {irregular.length > 0 && (
          <p className="px-2 pb-1 text-xs text-ink-500">
            Registros: {irregular.slice(0, 6).map((d) => `${formatDate(d.date, { day: "2-digit", month: "2-digit" })} (${d.irregularRhythmEvents})`).join(", ")}
          </p>
        )}
      </div>

      <SectionTitle>Oxigenação mínima à noite (SpO2)</SectionTitle>
      <div className="card px-2">
        <WearableChart days={days} unit="%" domain={[80, 100]} refs={[{ y: 90, label: "90%" }]} series={[{ key: "spo2Min", name: "SpO2 mínima", color: CHART.blue }]} />
      </div>

      {bp && (
        <>
          <SectionTitle>Pressão arterial</SectionTitle>
          <div className="card px-2">
            <WearableChart
              days={days}
              unit="mmHg"
              domain={[60, 160]}
              refs={[{ y: 130, label: "130", color: CHART.warn }, { y: 80, label: "80", color: CHART.warn }]}
              series={[{ key: "systolic", name: "Sistólica", color: CHART.plum }, { key: "diastolic", name: "Diastólica", color: CHART.plum, dashed: true }]}
            />
          </div>
        </>
      )}

      <SectionTitle>Sono e variabilidade cardíaca</SectionTitle>
      <div className="card space-y-4 px-2">
        <div>
          <p className="px-2 text-[15px] font-semibold">Horas de sono por noite</p>
          <WearableChart days={days} unit="h" kind="bar" domain={[0, 10]} series={[{ key: "sleepHours", name: "Sono", color: CHART.night }]} />
        </div>
        <div className="border-t border-ink-100 pt-3">
          <p className="px-2 text-[15px] font-semibold">Variabilidade cardíaca (VFC, ms)</p>
          <WearableChart days={days} unit="ms" series={[{ key: "hrvMs", name: "VFC", color: CHART.band }]} />
        </div>
      </div>

      <SectionTitle>Passos</SectionTitle>
      <div className="card px-2">
        <WearableChart days={days} unit="passos" kind="bar" domain={[0, "auto"]} series={[{ key: "steps", name: "Passos", color: CHART.sage }]} />
      </div>
      <Disclaimer />
    </div>
  );
}
