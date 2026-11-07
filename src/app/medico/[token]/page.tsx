import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { LabTrendChart, WearableChart } from "@/components/charts";
import { DoctorSummary } from "@/components/DoctorSummary";
import { HeartIcon, ShieldIcon } from "@/components/icons";
import { AlertCard, StatusBadge } from "@/components/ui";
import { ageFrom, formatDate, formatDateTime } from "@/lib/dates";
import { analyteSeries, fmt, formatRef, medicationMarkers, wearableSnapshot } from "@/lib/health";
import { openShare } from "@/lib/share";
import { buildTimeline } from "@/lib/timeline";
import { SCOPE_LABELS } from "@/lib/types";

export const metadata: Metadata = {
  title: "Visão do médico · Elo Saúde",
  robots: { index: false, follow: false },
};

export default function MedicoPage(props: PageProps<"/medico/[token]">) {
  return (
    <div className="min-h-dvh bg-[#f4f6f8]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 font-semibold text-brand-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white"><HeartIcon width={18} height={18} /></span>
            Elo Saúde <span className="font-normal text-slate-400">· Visão do médico</span>
          </div>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">Dados sintéticos</span>
        </div>
      </header>
      <Suspense fallback={<p className="p-8 text-center text-sm text-slate-500">Carregando histórico…</p>}>
        <Medico params={props.params} />
      </Suspense>
    </div>
  );
}

const DENIED = {
  nao_encontrado: "Este link de acesso não existe.",
  expirado: "Este link de acesso expirou. Peça ao paciente um novo link.",
  revogado: "O paciente revogou este acesso.",
};

async function Medico({ params }: { params: PageProps<"/medico/[token]">["params"] }) {
  const { token } = await params;
  const h = await headers();
  const access = await openShare(token, { logAccess: true, userAgent: h.get("user-agent") ?? undefined });

  if (!access.ok) {
    return (
      <div className="mx-auto mt-16 max-w-md px-4 text-center">
        <ShieldIcon className="mx-auto h-12 w-12 text-slate-400" />
        <h1 className="mt-3 text-xl font-bold">Acesso indisponível</h1>
        <p className="mt-1 text-sm text-slate-600">{DENIED[access.reason]}</p>
      </div>
    );
  }

  const { share, data } = access;
  const p = data.patient;
  const series = analyteSeries(data.labResults);
  const out = series.filter((s) => s.status === "alto" || s.status === "baixo");
  const featured = [...out, ...series.filter((s) => ["ldl", "hba1c", "glicose", "creatinina"].includes(s.key) && !out.includes(s))]
    .filter((s) => s.results.filter((r) => r.value != null).length >= 2)
    .slice(0, 6);
  const activeMeds = data.medications.filter((m) => !m.endDate);
  const has = (s: (typeof share.scopes)[number]) => share.scopes.includes(s);
  const timeline = buildTimeline(data, [], (id) =>
    data.documents.find((d) => d.id === id)?.storedAs ? `/api/medico/${token}/documentos/${id}` : undefined,
  ).filter((e) => e.kind === "exame" || e.kind === "consulta");
  const w = data.wearableDays.length ? wearableSnapshot(data.wearableDays) : null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-5">
      {/* Paciente + consentimento */}
      <section className="card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{p.name}</h1>
          <p className="text-sm text-slate-600">
            {p.sex === "F" ? "Feminino" : "Masculino"} · {ageFrom(p.birthDate)} anos · nasc. {formatDate(p.birthDate)}
            {p.bloodType ? ` · tipo ${p.bloodType}` : ""}
          </p>
          <p className="mt-1 text-sm">
            <span className="font-semibold text-red-700">Alergias:</span> {p.allergies.join(", ") || "nenhuma registrada"}
            {has("medicamentos") && <> · <span className="font-semibold">Em uso:</span> {activeMeds.map((m) => `${m.name} ${m.dose}`).join(", ") || "nenhum"}</>}
          </p>
        </div>
        <div className="flex gap-2 rounded-xl bg-brand-50 p-3 text-xs text-brand-900 md:max-w-sm">
          <ShieldIcon className="h-5 w-5 shrink-0 text-brand-600" />
          <p>
            Acesso autorizado pelo paciente para <strong>{share.doctorName}</strong> até {formatDateTime(share.expiresAt)}.
            Escopo: {share.scopes.map((s) => SCOPE_LABELS[s].toLowerCase()).join(", ")}. Este acesso fica registrado.
          </p>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <DoctorSummary token={token} />

          {data.alerts.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Alertas automáticos</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {data.alerts.map((a) => <AlertCard key={a.id} alert={a} cta={false} />)}
              </div>
            </section>
          )}

          {featured.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Evolução dos exames</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {featured.map((s) => (
                  <div key={s.key} className="card px-2 pb-2">
                    <div className="flex items-center justify-between px-2">
                      <p className="text-sm font-semibold">{s.name}</p>
                      <span className="flex items-center gap-1.5 text-sm">
                        <strong>{fmt(s.latest.value!)}</strong> <span className="text-xs text-slate-500">{s.unit}</span>
                        <StatusBadge status={s.status} />
                      </span>
                    </div>
                    <LabTrendChart
                      height={170}
                      points={s.results.filter((r) => r.value != null).map((r) => ({ date: r.date, value: r.value! }))}
                      refLow={s.latest.refLow}
                      refHigh={s.latest.refHigh}
                      unit={s.unit}
                      markers={has("medicamentos") ? medicationMarkers(s.key, data.medications) : []}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {w && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Wearables · médias de 7 dias: FC repouso {w.restingHr} bpm · sono {fmt(w.sleepHours)} h · SpO2 mín. {w.spo2Min}% · PA {w.systolic}/{w.diastolic}
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="card px-2">
                  <p className="px-2 text-sm font-semibold">Ritmo irregular (episódios/dia)</p>
                  <WearableChart days={data.wearableDays} unit="episódios" kind="bar" domain={[0, "auto"]} defaultRange={90} height={150} series={[{ key: "irregularRhythmEvents", name: "Episódios", color: "#dc2626" }]} />
                </div>
                <div className="card px-2">
                  <p className="px-2 text-sm font-semibold">FC de repouso</p>
                  <WearableChart days={data.wearableDays} unit="bpm" height={150} series={[{ key: "restingHr", name: "FC repouso", color: "#e11d48" }]} />
                </div>
                <div className="card px-2">
                  <p className="px-2 text-sm font-semibold">SpO2 mínima noturna</p>
                  <WearableChart days={data.wearableDays} unit="%" domain={[80, 100]} height={150} refs={[{ y: 90, label: "90%" }]} series={[{ key: "spo2Min", name: "SpO2", color: "#0284c7" }]} />
                </div>
                <div className="card px-2">
                  <p className="px-2 text-sm font-semibold">Pressão arterial (medidor domiciliar)</p>
                  <WearableChart
                    days={data.wearableDays}
                    unit="mmHg"
                    domain={[60, 160]}
                    height={150}
                    refs={[{ y: 130, label: "130", color: "#d97706" }, { y: 80, label: "80", color: "#d97706" }]}
                    series={[{ key: "systolic", name: "Sistólica", color: "#7c3aed" }, { key: "diastolic", name: "Diastólica", color: "#a78bfa" }]}
                  />
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          {series.length > 0 && (
            <section className="card p-0">
              <h2 className="px-4 pt-3 text-sm font-semibold">Últimos resultados</h2>
              <table className="mt-2 w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  {series.map((s) => (
                    <tr key={s.key}>
                      <td className="py-1.5 pl-4 pr-2">
                        {s.name}
                        <span className="block text-[10px] text-slate-400">{formatDate(s.latest.date)} · ref. {formatRef(s.latest)}</span>
                      </td>
                      <td className="whitespace-nowrap pr-2 text-right font-semibold">{s.latest.value != null ? fmt(s.latest.value) : s.latest.valueText} <span className="font-normal text-slate-400">{s.unit}</span></td>
                      <td className="pr-4 text-right"><StatusBadge status={s.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {has("medicamentos") && (
            <section className="card">
              <h2 className="text-sm font-semibold">Medicamentos</h2>
              <ul className="mt-2 space-y-1.5 text-xs">
                {data.medications.map((m) => (
                  <li key={m.id} className={m.endDate ? "text-slate-400" : ""}>
                    <strong>{m.name} {m.dose}</strong> · {m.frequency} · desde {formatDate(m.startDate)}
                    {m.endDate ? ` até ${formatDate(m.endDate)}` : ""}{m.reason ? ` · ${m.reason}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {timeline.length > 0 && (
            <section className="card">
              <h2 className="text-sm font-semibold">Consultas e laudos</h2>
              <ol className="mt-2 space-y-2 text-xs">
                {timeline.map((e) => (
                  <li key={e.id} className="border-l-2 border-slate-200 pl-3">
                    <p className="text-[10px] font-medium text-slate-400">{formatDate(e.date)}</p>
                    <p className="font-semibold">
                      {e.href ? <a href={e.href} target="_blank" rel="noopener" className="text-brand-700 underline">{e.title}</a> : e.title}
                    </p>
                    {e.detail && <p className="text-slate-600">{e.detail}</p>}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {has("vacinas") && (
            <section className="card">
              <h2 className="text-sm font-semibold">Vacinas</h2>
              <ul className="mt-2 space-y-1 text-xs">
                {[...data.vaccines].reverse().map((v) => <li key={v.id}><strong>{v.name}</strong> · {formatDate(v.date)}{v.dose ? ` · ${v.dose}` : ""}</li>)}
              </ul>
            </section>
          )}
        </aside>
      </div>
      <p className="mt-8 text-center text-[11px] text-slate-400">
        Dados informados pelo paciente e por dispositivos de consumo. Os alertas não são diagnóstico. Laudos lidos por IA trazem link para o original.
      </p>
    </main>
  );
}
