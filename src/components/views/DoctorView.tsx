"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LabTrendChart, WearableChart } from "@/components/charts";
import { DoctorSummary } from "@/components/DoctorSummary";
import { ShieldIcon } from "@/components/icons";
import { AlertCard, StatusBadge } from "@/components/ui";
import { ageFrom, formatDate, formatDateTime } from "@/lib/dates";
import { summaryForShare } from "@/lib/doctor";
import { geminiConfigured } from "@/lib/gemini";
import { analyteSeries, fmt, formatRef, medicationMarkers, wearableSnapshot } from "@/lib/health";
import { decodeSharePayload, scopedData, shareState, type ScopedData } from "@/lib/share";
import { logAccess, openDocumentFile, useDb } from "@/lib/store";
import { fallbackSummary, generateDoctorSummary } from "@/lib/summary";
import { buildTimeline } from "@/lib/timeline";
import { SCOPE_LABELS, type DoctorSummary as Summary, type Share } from "@/lib/types";

const DENIED = {
  nao_encontrado: "Este link de acesso não existe ou está incompleto.",
  expirado: "Este link de acesso expirou. Peça ao paciente um novo link.",
  revogado: "O paciente revogou este acesso.",
};

type FromLink = { share: Share; data: ScopedData; summary?: Summary } | "invalid" | null;

export function DoctorView() {
  const token = useSearchParams().get("t") ?? "";
  const db = useDb();
  const [fromLink, setFromLink] = useState<FromLink>(null);
  const logged = useRef(false);

  const local = db?.shares.find((s) => s.token === token);

  // Link aberto em outro aparelho: os dados vêm no fragmento #d=...
  useEffect(() => {
    if (!db || local) return;
    const payload = new URLSearchParams(window.location.hash.slice(1)).get("d");
    if (!payload) {
      queueMicrotask(() => setFromLink("invalid"));
      return;
    }
    decodeSharePayload(payload)
      .then((r) => setFromLink(r.share.token === token ? r : "invalid"))
      .catch(() => setFromLink("invalid"));
  }, [db, local, token]);

  // Registro do acesso (quando o compartilhamento é deste navegador)
  useEffect(() => {
    if (local && shareState(local) === "ativo" && !logged.current) {
      logged.current = true;
      logAccess(token, navigator.userAgent);
    }
  }, [local, token]);

  if (!db || (!local && fromLink === null)) return <p className="p-8 text-center text-sm text-slate-500">Carregando histórico…</p>;

  if (local) {
    const st = shareState(local);
    if (st !== "ativo") return <Denied reason={st} />;
    const data = scopedData(db, local.scopes);
    return (
      <Dashboard
        share={local}
        data={data}
        loadSummary={() => summaryForShare(local, data)}
        openDoc={(id) => openDocumentFile(id)}
      />
    );
  }

  if (fromLink === "invalid" || !fromLink) return <Denied reason="nao_encontrado" />;
  if (shareState(fromLink.share) !== "ativo") return <Denied reason="expirado" />;
  const { share, data, summary } = fromLink;
  return (
    <Dashboard
      share={share}
      data={data}
      fromLink
      loadSummary={async () => summary ?? (geminiConfigured() ? generateDoctorSummary(data) : fallbackSummary(data))}
    />
  );
}

function Denied({ reason }: { reason: keyof typeof DENIED }) {
  return (
    <div className="mx-auto mt-16 max-w-md px-4 text-center">
      <ShieldIcon className="mx-auto h-12 w-12 text-slate-400" />
      <h1 className="mt-3 text-xl font-bold">Acesso indisponível</h1>
      <p className="mt-1 text-sm text-slate-600">{DENIED[reason]}</p>
    </div>
  );
}

function Dashboard({
  share,
  data,
  loadSummary,
  openDoc,
  fromLink,
}: {
  share: Share;
  data: ScopedData;
  loadSummary: () => Promise<Summary>;
  openDoc?: (storedAs: string) => void;
  fromLink?: boolean;
}) {
  const p = data.patient;
  const series = analyteSeries(data.labResults);
  const out = series.filter((s) => s.status === "alto" || s.status === "baixo");
  const featured = [...out, ...series.filter((s) => ["ldl", "hba1c", "glicose", "creatinina"].includes(s.key) && !out.includes(s))]
    .filter((s) => s.results.filter((r) => r.value != null).length >= 2)
    .slice(0, 6);
  const activeMeds = data.medications.filter((m) => !m.endDate);
  const has = (s: (typeof share.scopes)[number]) => share.scopes.includes(s);
  const docs = new Map(data.documents.map((d) => [d.id, d]));
  const timeline = buildTimeline(data).filter((e) => e.kind === "exame" || e.kind === "consulta");
  const w = data.wearableDays.length ? wearableSnapshot(data.wearableDays) : null;
  const cacheKey = `${data.labResults.length}-${data.alerts.map((a) => a.id).join(",")}-${data.wearableDays.at(-1)?.irregularRhythmEvents ?? 0}`;

  return (
    <main className="mx-auto max-w-7xl px-4 py-5">
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
            Escopo: {share.scopes.map((s) => SCOPE_LABELS[s].toLowerCase()).join(", ")}.
            {fromLink ? " Cópia enviada pelo paciente por link." : " Este acesso fica registrado."}
          </p>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <DoctorSummary load={loadSummary} cacheKey={cacheKey} />

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
                {timeline.map((e) => {
                  const doc = e.kind === "exame" ? docs.get(e.id.replace(/^doc-/, "")) : undefined;
                  return (
                    <li key={e.id} className="border-l-2 border-slate-200 pl-3">
                      <p className="text-[10px] font-medium text-slate-400">{formatDate(e.date)}</p>
                      <p className="font-semibold">
                        {doc?.storedAs && openDoc ? (
                          <button type="button" onClick={() => openDoc(doc.storedAs!)} className="text-left text-brand-700 underline">{e.title}</button>
                        ) : (
                          e.title
                        )}
                      </p>
                      {e.detail && <p className="text-slate-600">{e.detail}</p>}
                    </li>
                  );
                })}
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
        Dados informados pelo paciente e por dispositivos de consumo. Os alertas não são diagnóstico.
        {fromLink ? " Os laudos originais ficam no aparelho do paciente." : " Laudos lidos por IA trazem link para o original."}
      </p>
    </main>
  );
}
