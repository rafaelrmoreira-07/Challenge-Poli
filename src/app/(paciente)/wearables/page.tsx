"use client";

import NumberFlow from "@number-flow/react";
import { CHART, WearableChart } from "@/components/charts";
import { GaugeIcon, RingIcon, WatchIcon } from "@/components/icons";

/** Um ícone por tipo de aparelho: relógio, anel e medidor de pressão (o mesmo manômetro do cartão de pressão na tela Hoje). */
const DEVICE_ICON = { relogio: WatchIcon, anel: RingIcon, medidor_pressao: GaugeIcon } as const;
import { AlertCard, Disclaimer, PageHeader, SectionTitle, Skeleton } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { computeAlerts, fmt, wearableSnapshot } from "@/lib/health";
import { simulateIrregularRhythm, useDb } from "@/lib/store";

export default function WearablesPage() {
  const db = useDb();
  return (
    <div>
      <PageHeader title="Sinais">Batimentos, sono, saturação e pressão, medidos pelo relógio e pelo medidor de pressão.</PageHeader>
      {db ? <Wearables db={db} /> : <Skeleton lines={5} />}
    </div>
  );
}

function Wearables({ db }: { db: NonNullable<ReturnType<typeof useDb>> }) {
  const alerts = computeAlerts(db).filter((a) => a.kind !== "exames");
  const days = db.wearableDays;
  const w = wearableSnapshot(days);
  const irregular = days.filter((d) => d.irregularRhythmEvents > 0).reverse();

  return (
    <div>
      <ul className="flex flex-wrap gap-2" aria-label="Aparelhos conectados">
        {db.devices.map((d) => {
          const Icon = DEVICE_ICON[d.kind] ?? WatchIcon;
          return (
          <li key={d.id} className="flex shrink-0 items-center gap-2.5 rounded-full bg-surface py-2 pl-2 pr-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white"><Icon width={16} /></span>
            <span>
              <span className="block text-sm font-medium leading-tight">{d.name.replace(" (simulado)", "")}</span>
              <span className="flex items-center gap-1 text-xs text-ok"><span className="h-1.5 w-1.5 rounded-full bg-ok" />Sincronizado</span>
            </span>
          </li>
          );
        })}
      </ul>

      {alerts.length > 0 && (
        <>
          <SectionTitle>Alertas</SectionTitle>
          <div className="space-y-2">
            {alerts.map((a) => <AlertCard key={a.id} alert={a} cta={false} />)}
          </div>
        </>
      )}

      <Chart title="Batimentos em repouso" value={w.restingHr} unit="bpm, média de 7 dias">
        <WearableChart days={days} unit="bpm" series={[{ key: "restingHr", name: "Repouso", color: CHART.ink }]} />
      </Chart>

      <Chart title="Pressão arterial" value={w.systolic} second={w.diastolic} unit="mmHg, média de 7 dias" warn={w.systolic >= 130 || w.diastolic >= 80}>
        <WearableChart
          days={days}
          unit="mmHg"
          domain={[60, 160]}
          refs={[{ y: 130, label: "130", color: CHART.warn }, { y: 80, label: "80", color: CHART.warn }]}
          series={[{ key: "systolic", name: "Sistólica", color: CHART.plum }, { key: "diastolic", name: "Diastólica", color: CHART.plum, dashed: true }]}
        />
      </Chart>

      <Chart title="Saturação mínima à noite" value={w.spo2Min} unit="%, menor valor em 7 dias" warn={w.spo2Min < 90}>
        <WearableChart days={days} unit="%" domain={[80, 100]} refs={[{ y: 90, label: "90%" }]} series={[{ key: "spo2Min", name: "Saturação", color: CHART.blue }]} />
      </Chart>

      <Chart title="Batimento irregular" value={irregular.reduce((n, d) => n + d.irregularRhythmEvents, 0)} unit="episódios em 90 dias">
        <WearableChart days={days} unit="episódios" kind="bar" domain={[0, "auto"]} defaultRange={90} series={[{ key: "irregularRhythmEvents", name: "Episódios", color: CHART.out }]} />
        {irregular.length > 0 && (
          <p className="num px-2 pt-2 text-sm text-muted">
            Dias com registro: {irregular.slice(0, 6).map((d) => `${formatDate(d.date, { day: "2-digit", month: "2-digit" })} (${d.irregularRhythmEvents})`).join(", ")}
          </p>
        )}
      </Chart>

      <Chart title="Sono" value={w.sleepHours} decimals={1} unit="horas por noite, média de 7 dias">
        <WearableChart days={days} unit="h" kind="bar" domain={[0, 10]} series={[{ key: "sleepHours", name: "Sono", color: CHART.night }]} />
      </Chart>

      <Chart title="Variabilidade cardíaca" value={w.hrvMs} unit="ms, média de 7 dias">
        <WearableChart days={days} unit="ms" series={[{ key: "hrvMs", name: "VFC", color: CHART.band }]} />
      </Chart>

      <Chart title="Passos" value={w.steps} unit="por dia, média de 7 dias">
        <WearableChart days={days} unit="passos" kind="bar" domain={[0, "auto"]} series={[{ key: "steps", name: "Passos", color: CHART.sage }]} />
      </Chart>

      <button className="btn-secondary mt-8 w-full" onClick={() => simulateIrregularRhythm()}>
        Simular batimentos irregulares (demonstração)
      </button>
      <Disclaimer />
    </div>
  );
}

function Chart({ title, value, second, decimals = 0, unit, warn, children }: { title: string; value: number; second?: number; decimals?: number; unit: string; warn?: boolean; children: React.ReactNode }) {
  const format = { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  return (
    <section className="mt-10">
      <h2 className="text-xl font-medium tracking-[-0.02em]">{title}</h2>
      <p className="mt-1 flex items-baseline gap-2">
        <span className={`big-num ${warn ? "text-warn" : "text-ink"}`} aria-label={second != null ? `${value} por ${second}` : fmt(value)}>
          <NumberFlow value={value} locales="pt-BR" format={format} />
          {second != null && (
            <>
              /<NumberFlow value={second} locales="pt-BR" />
            </>
          )}
        </span>
        <span className="text-sm text-muted">{unit}</span>
      </p>
      <div className="tile mt-3 px-2">{children}</div>
    </section>
  );
}
