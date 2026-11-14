"use client";

import NumberFlow from "@number-flow/react";
import Link from "next/link";
import { CHART, WearableChart } from "@/components/charts";
import { GaugeIcon, RingIcon, WatchIcon } from "@/components/icons";
import { AlertCard, Disclaimer, PageHeader, SectionTitle, Skeleton } from "@/components/ui";
import { formatDate, todayISO } from "@/lib/dates";
import { computeAlerts, fmt, hasBloodPressure, hasMetric, wearableSnapshot } from "@/lib/health";
import type { WearableMetric } from "@/lib/types";
import { simulateIrregularRhythm, useDb } from "@/lib/store";

/** Um ícone por tipo de aparelho: relógio, anel e medidor de pressão (o mesmo manômetro do cartão de pressão na tela Hoje). */
const DEVICE_ICON: Record<string, typeof WatchIcon> = { relogio: WatchIcon, anel: RingIcon, medidor_pressao: GaugeIcon, importado: WatchIcon };

export default function WearablesPage() {
  const db = useDb();
  return (
    <div>
      <PageHeader title="Sinais">Batimentos, sono, saturação, passos e pressão, vindos do seu relógio, anel ou medidor de pressão.</PageHeader>
      {db ? <Wearables db={db} /> : <Skeleton lines={5} />}
    </div>
  );
}

function Wearables({ db }: { db: NonNullable<ReturnType<typeof useDb>> }) {
  const alerts = computeAlerts(db).filter((a) => a.kind !== "exames" && a.kind !== "cruzado" && a.kind !== "pos_alta");
  const days = db.wearableDays;
  if (!days.length)
    return (
      <div className="tile mt-2 flex flex-col items-center px-6 py-10 text-center">
        <WatchIcon width={40} className="text-faint" />
        <p className="mt-3 text-lg font-medium text-ink">Nenhum dado de relógio ou anel</p>
        <p className="mt-1 max-w-sm text-[15px] text-muted">
          Exporte os dados do app Saúde (iPhone) ou do Google e do Health Connect (Android) e envie aqui. Batimento, sono, saturação e passos
          aparecem nesta tela, junto dos exames.
        </p>
        <Link href="/enviar/?tipo=relogio" className="btn-primary mt-6">Importar dados do relógio</Link>
      </div>
    );
  const src = db.wearableSource;
  const imported = src?.kind === "importado";
  const has = (k: WearableMetric) => hasMetric(days, k);
  const bp = hasBloodPressure(days);
  const w = wearableSnapshot(days);
  const irregular = days.filter((d) => (d.irregularRhythmEvents ?? 0) > 0).reverse();
  const until = w.until < todayISO() ? `, até ${formatDate(w.until, { day: "2-digit", month: "2-digit" })}` : "";

  return (
    <div>
      {/* Origem dos dados: honesta sobre o que é simulação e o que veio de um arquivo */}
      <div className="tile flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white">{(() => { const Icon = DEVICE_ICON[db.devices[0]?.kind ?? "relogio"] ?? WatchIcon; return <Icon width={20} />; })()}</span>
        <div className="min-w-0 flex-1">
          {imported ? (
            <>
              <p className="text-[15px] font-medium leading-snug">{src.label}</p>
              <p className="num text-sm text-muted">
                Importado em {formatDate((src.importedAt ?? "").slice(0, 10))} · {days.length} dias, de {formatDate(days[0].date, { day: "2-digit", month: "2-digit" })} a{" "}
                {formatDate(days.at(-1)!.date, { day: "2-digit", month: "2-digit" })}
              </p>
              <p className="text-sm text-muted">{src.readBy === "ia" ? "Organizado pela IA" : "Lido no seu aparelho, direto do arquivo"}</p>
            </>
          ) : (
            <>
              <p className="text-[15px] font-medium leading-snug">Simulação de demonstração</p>
              <p className="text-sm text-muted">
                Dados fictícios de {db.devices.map((d) => d.name.replace(" (simulado)", "").toLowerCase()).join(" e ") || "relógio"}. Importe um arquivo para ver dados de verdade.
              </p>
            </>
          )}
          <Link href="/enviar/?tipo=relogio" className="btn-quiet -ml-1 text-sm">{imported ? "Atualizar com um arquivo novo" : "Importar dados do relógio"}</Link>
        </div>
      </div>

      {alerts.length > 0 && (
        <>
          <SectionTitle>Alertas</SectionTitle>
          <div className="space-y-2">
            {alerts.map((a) => <AlertCard key={a.id} alert={a} cta={false} />)}
          </div>
        </>
      )}

      {has("restingHr") && (
        <Chart title="Batimentos em repouso" value={w.restingHr} unit={`bpm, média de 7 dias${until}`}>
          <WearableChart days={days} unit="bpm" series={[{ key: "restingHr", name: "Repouso", color: CHART.ink }]} />
        </Chart>
      )}

      {bp && (
        <Chart title="Pressão arterial" value={w.systolic} second={w.diastolic} unit={`mmHg, média de 7 dias${until}`} warn={(w.systolic ?? 0) >= 130 || (w.diastolic ?? 0) >= 80}>
          <WearableChart
            days={days}
            unit="mmHg"
            domain={[60, 160]}
            refs={[{ y: 130, label: "130", color: CHART.warn }, { y: 80, label: "80", color: CHART.warn }]}
            series={[{ key: "systolic", name: "Sistólica", color: CHART.plum }, { key: "diastolic", name: "Diastólica", color: CHART.plum, dashed: true }]}
          />
        </Chart>
      )}

      {has("spo2Min") && (
        <Chart title="Saturação mínima à noite" value={w.spo2Min} unit={`%, menor valor em 7 dias${until}`} warn={(w.spo2Min ?? 100) < 90}>
          <WearableChart days={days} unit="%" domain={[80, 100]} refs={[{ y: 90, label: "90%" }]} series={[{ key: "spo2Min", name: "Saturação", color: CHART.blue }]} />
        </Chart>
      )}

      {(has("irregularRhythmEvents") || !imported) && (
        <Chart title="Batimento irregular" value={irregular.reduce((n, d) => n + (d.irregularRhythmEvents ?? 0), 0)} unit="episódios em 90 dias">
          <WearableChart days={days} unit="episódios" kind="bar" domain={[0, "auto"]} defaultRange={90} series={[{ key: "irregularRhythmEvents", name: "Episódios", color: CHART.out }]} />
          {irregular.length > 0 && (
            <p className="num px-2 pt-2 text-sm text-muted">
              Dias com registro: {irregular.slice(0, 6).map((d) => `${formatDate(d.date, { day: "2-digit", month: "2-digit" })} (${d.irregularRhythmEvents})`).join(", ")}
            </p>
          )}
        </Chart>
      )}

      {has("sleepHours") && (
        <Chart title="Sono" value={w.sleepHours} decimals={1} unit={`horas por noite, média de 7 dias${until}`}>
          <WearableChart days={days} unit="h" kind="bar" domain={[0, 10]} series={[{ key: "sleepHours", name: "Sono", color: CHART.night }]} />
        </Chart>
      )}

      {has("hrvMs") && (
        <Chart title="Variabilidade cardíaca" value={w.hrvMs} unit={`ms, média de 7 dias${until}`}>
          <WearableChart days={days} unit="ms" series={[{ key: "hrvMs", name: "VFC", color: CHART.band }]} />
        </Chart>
      )}

      {has("steps") && (
        <Chart title="Passos" value={w.steps} unit={`por dia, média de 7 dias${until}`}>
          <WearableChart days={days} unit="passos" kind="bar" domain={[0, "auto"]} series={[{ key: "steps", name: "Passos", color: CHART.sage }]} />
        </Chart>
      )}

      {!imported && (
        <button className="btn-secondary mt-8 w-full" onClick={() => simulateIrregularRhythm()}>
          Simular batimentos irregulares (demonstração)
        </button>
      )}
      <Disclaimer />
    </div>
  );
}

function Chart({ title, value, second, decimals = 0, unit, warn, children }: { title: string; value: number | null; second?: number | null; decimals?: number; unit: string; warn?: boolean; children: React.ReactNode }) {
  const format = { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  return (
    <section className="mt-10">
      <h2 className="text-xl font-medium tracking-[-0.02em]">{title}</h2>
      <p className="mt-1 flex items-baseline gap-2">
        <span className={`big-num ${warn ? "text-warn" : "text-ink"}`} aria-label={value == null ? "sem medição na última semana" : second != null ? `${value} por ${second}` : fmt(value)}>
          {value == null ? "—" : <NumberFlow value={value} locales="pt-BR" format={format} />}
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
