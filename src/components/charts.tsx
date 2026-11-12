"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from "recharts";
import type { WearableDay } from "@/lib/types";
import { SlidingTabs } from "./SlidingTabs";

const ts = (iso: string) => new Date(iso + "T12:00:00Z").getTime();
const yearFmt = (t: number) => new Date(t).getUTCFullYear().toString();
const dayFmt = (t: number) =>
  new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const fullFmt = (t: number) =>
  new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const nf = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/**
 * Paleta dos gráficos, alinhada aos tokens de src/app/globals.css.
 * Séries do mesmo gráfico se distinguem também pelo traço (sólido/tracejado),
 * nunca só pela cor.
 */
export const CHART = {
  ink: "#1f2b4d",
  out: "#d1382d",
  warn: "#a87800",
  band: "#1f2b4d",
  med: "#e8850f",
  grid: "#e4e4df",
  axis: "#646b81",
  blue: "#3d5a99",
  plum: "#1f2b4d",
  sage: "#8a93ad",
  night: "#3d5a99",
} as const;
const tooltipStyle = { borderRadius: 12, fontSize: 13, border: "1px solid #e4e4df", boxShadow: "0 8px 24px -8px rgb(31 43 77 / 0.18)" };

export interface TrendPoint {
  date: string;
  value: number;
  lab?: string;
}

export function LabTrendChart({
  points,
  refLow,
  refHigh,
  unit,
  markers = [],
  height = 240,
}: {
  points: TrendPoint[];
  refLow?: number | null;
  refHigh?: number | null;
  unit: string;
  markers?: { date: string; label: string }[];
  height?: number;
}) {
  const data = points.map((p) => ({ t: ts(p.date), value: p.value, lab: p.lab }));
  const values = data.map((d) => d.value);
  const lo = Math.min(...values, refLow ?? Infinity);
  const hi = Math.max(...values, refHigh ?? -Infinity);
  const pad = (hi - lo || hi || 1) * 0.15;
  const yMin = Math.max(0, Math.floor(lo - pad));
  const yMax = Math.ceil(hi + pad);
  const tMin = Math.min(...data.map((d) => d.t), ...markers.map((m) => ts(m.date)));
  const tMax = Math.max(...data.map((d) => d.t));
  const span = Math.max(tMax - tMin, 86_400_000 * 60);
  const out = (v: number) => (refLow != null && v < refLow) || (refHigh != null && v > refHigh);

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
          {(refLow != null || refHigh != null) && (
            <ReferenceArea
              y1={refLow ?? yMin}
              y2={refHigh ?? yMax}
              fill={CHART.band}
              fillOpacity={0.06}
              stroke={CHART.band}
              strokeOpacity={0.35}
              strokeDasharray="4 4"
              ifOverflow="extendDomain"
              label={{ value: "faixa de referência", position: "insideBottomRight", fill: CHART.band, fontSize: 11 }}
            />
          )}
          {markers.map((m) => (
            <ReferenceLine
              key={m.date + m.label}
              x={ts(m.date)}
              stroke={CHART.med}
              strokeDasharray="2 3"
              label={{ value: m.label, position: "insideTopLeft", fill: CHART.med, fontSize: 11 }}
            />
          ))}
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[tMin - span * 0.04, tMax + span * 0.04]}
            tickFormatter={span > 86_400_000 * 500 ? yearFmt : dayFmt}
            tick={{ fontSize: 11, fill: CHART.axis }}
            tickCount={6}
          />
          <YAxis domain={[yMin, yMax]} tick={{ fontSize: 11, fill: CHART.axis }} width={52} tickFormatter={nf} />
          <Tooltip
            labelFormatter={(t) => fullFmt(Number(t))}
            formatter={(v) => [`${nf(Number(v))} ${unit}`, "Resultado"]}
            contentStyle={tooltipStyle}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={CHART.ink}
            strokeWidth={2.5}
            isAnimationActive={false}
            dot={(props) => {
              const { cx, cy, payload, index } = props as { cx: number; cy: number; payload: { value: number }; index: number };
              return (
                out(payload.value) ? (
                  // Fora da faixa: ponto maior, vermelho e com contorno (forma + cor)
                  <circle key={index} cx={cx} cy={cy} r={6} fill={CHART.out} stroke="#fff" strokeWidth={2.5} />
                ) : (
                  <circle key={index} cx={cx} cy={cy} r={4.5} fill="#fff" stroke={CHART.ink} strokeWidth={2.5} />
                )
              );
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Sparkline({ values, bad }: { values: number[]; bad?: boolean }) {
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div className="h-8 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line type="monotone" dataKey="v" stroke={bad ? CHART.out : CHART.ink} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

type Metric = keyof Omit<WearableDay, "date">;

export interface WearableSeries {
  key: Metric;
  name: string;
  color: string;
  /** Traço tracejado para diferenciar séries sem depender da cor. */
  dashed?: boolean;
}

export function WearableChart({
  days,
  series,
  unit,
  refs = [],
  kind = "line",
  domain,
  defaultRange = 30,
  height = 180,
}: {
  days: WearableDay[];
  series: WearableSeries[];
  unit: string;
  refs?: { y: number; label: string; color?: string }[];
  kind?: "line" | "bar";
  domain?: [number | "auto", number | "auto"];
  defaultRange?: 30 | 90;
  height?: number;
}) {
  const [range, setRange] = useState<14 | 30 | 90>(defaultRange);
  const data = days.slice(-range).map((d) => ({ ...d, t: ts(d.date) }));
  const Chart = kind === "bar" ? BarChart : LineChart;

  return (
    <div>
      <div className="mb-3 space-y-2">
        {series.length > 1 && (
          <ul className="flex flex-wrap gap-x-3 pl-2 text-xs text-muted">
            {series.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <svg width="18" height="6" aria-hidden><line x1="0" y1="3" x2="18" y2="3" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dashed ? "4 3" : undefined} /></svg>
                {s.name}
              </li>
            ))}
          </ul>
        )}
        <div>
          <SlidingTabs
            label="Período"
            active={String(range)}
            onChange={(k) => setRange(Number(k) as 14 | 30 | 90)}
            items={[14, 30, 90].map((r) => ({ key: String(r), label: `${r} dias` }))}
          />
        </div>
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <Chart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="t" type="category" tickFormatter={(t) => dayFmt(Number(t))} tick={{ fontSize: 11, fill: CHART.axis }} minTickGap={24} />
            <YAxis domain={domain ?? ["auto", "auto"]} tick={{ fontSize: 11, fill: CHART.axis }} width={48} />
            <Tooltip
              labelFormatter={(t) => fullFmt(Number(t))}
              formatter={(v, n) => [`${nf(Number(v))} ${unit}`, String(n)]}
              contentStyle={tooltipStyle}
            />
            {refs.map((r) => (
              <ReferenceLine
                key={r.label}
                y={r.y}
                stroke={r.color ?? CHART.out}
                strokeDasharray="4 3"
                label={{ value: r.label, position: "insideTopRight", fill: r.color ?? CHART.out, fontSize: 11 }}
              />
            ))}
            {series.map((s) =>
              kind === "bar" ? (
                <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              ) : (
                <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2.25} strokeDasharray={s.dashed ? "5 4" : undefined} dot={false} isAnimationActive={false} />
              ),
            )}
          </Chart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
