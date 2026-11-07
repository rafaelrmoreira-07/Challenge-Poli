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

const ts = (iso: string) => new Date(iso + "T12:00:00Z").getTime();
const yearFmt = (t: number) => new Date(t).getUTCFullYear().toString();
const dayFmt = (t: number) =>
  new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const fullFmt = (t: number) =>
  new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const nf = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

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
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          {(refLow != null || refHigh != null) && (
            <ReferenceArea
              y1={refLow ?? yMin}
              y2={refHigh ?? yMax}
              fill="#10b981"
              fillOpacity={0.1}
              stroke="#10b981"
              strokeOpacity={0.3}
              strokeDasharray="4 4"
              ifOverflow="extendDomain"
            />
          )}
          {markers.map((m) => (
            <ReferenceLine
              key={m.date + m.label}
              x={ts(m.date)}
              stroke="#6366f1"
              strokeDasharray="4 3"
              label={{ value: m.label, position: "insideTopLeft", fill: "#4f46e5", fontSize: 10 }}
            />
          ))}
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[tMin - span * 0.04, tMax + span * 0.04]}
            tickFormatter={span > 86_400_000 * 500 ? yearFmt : dayFmt}
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickCount={6}
          />
          <YAxis domain={[yMin, yMax]} tick={{ fontSize: 11, fill: "#64748b" }} width={52} tickFormatter={nf} />
          <Tooltip
            labelFormatter={(t) => fullFmt(Number(t))}
            formatter={(v) => [`${nf(Number(v))} ${unit}`, "Resultado"]}
            contentStyle={{ borderRadius: 12, fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#0d8573"
            strokeWidth={2.5}
            isAnimationActive={false}
            dot={(props) => {
              const { cx, cy, payload, index } = props as { cx: number; cy: number; payload: { value: number }; index: number };
              return (
                <circle key={index} cx={cx} cy={cy} r={5} fill={out(payload.value) ? "#dc2626" : "#0d8573"} stroke="#fff" strokeWidth={2} />
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
          <Line type="monotone" dataKey="v" stroke={bad ? "#dc2626" : "#0d8573"} strokeWidth={2} dot={false} isAnimationActive={false} />
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
      <div className="mb-2 flex justify-end gap-1" role="group" aria-label="Período">
        {([14, 30, 90] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            aria-pressed={range === r}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${range === r ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {r}d
          </button>
        ))}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <Chart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="t" type="category" tickFormatter={(t) => dayFmt(Number(t))} tick={{ fontSize: 10, fill: "#64748b" }} minTickGap={24} />
            <YAxis domain={domain ?? ["auto", "auto"]} tick={{ fontSize: 10, fill: "#64748b" }} width={48} />
            <Tooltip
              labelFormatter={(t) => fullFmt(Number(t))}
              formatter={(v, n) => [`${nf(Number(v))} ${unit}`, String(n)]}
              contentStyle={{ borderRadius: 12, fontSize: 12 }}
            />
            {refs.map((r) => (
              <ReferenceLine
                key={r.label}
                y={r.y}
                stroke={r.color ?? "#dc2626"}
                strokeDasharray="4 3"
                label={{ value: r.label, position: "insideTopRight", fill: r.color ?? "#dc2626", fontSize: 10 }}
              />
            ))}
            {series.map((s) =>
              kind === "bar" ? (
                <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              ) : (
                <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={false} isAnimationActive={false} />
              ),
            )}
          </Chart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
