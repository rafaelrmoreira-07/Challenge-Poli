"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CHART, LabTrendChart, WearableChart } from "@/components/charts";
import { DoctorSummary } from "@/components/DoctorSummary";
import { ShieldIcon } from "@/components/icons";
import { RecentExams } from "@/components/RecentExams";
import { ReportList } from "@/components/ReportList";
import { AlertCard, StatusBadge } from "@/components/ui";
import { HospitalDashboard } from "./HospitalView";
import { ageFrom, formatDate, formatDateTime } from "@/lib/dates";
import { summaryForShare } from "@/lib/doctor";
import { geminiConfigured } from "@/lib/gemini";
import { analyteSeries, fmt, formatRef, hasBloodPressure, hasMetric, medicationMarkers, wearableSnapshot } from "@/lib/health";
import { sourceLine } from "@/lib/wearableImport";
import { dataForShare, decodeSharePayload, shareState, type ScopedData, type SharedExtras } from "@/lib/share";
import { logAccess, openDocumentFile, useDb } from "@/lib/store";
import { fallbackSummary, generateDoctorSummary } from "@/lib/summary";
import { buildTimeline } from "@/lib/timeline";
import { SCOPE_LABELS, type DoctorSummary as Summary, type Share } from "@/lib/types";

const DENIED = {
  nao_encontrado: "Este link de acesso não existe ou está incompleto.",
  expirado: "Este link de acesso expirou. Peça ao paciente um novo link.",
  revogado: "O paciente revogou este acesso.",
};

type FromLink = ({ share: Share; data: ScopedData; summary?: Summary } & SharedExtras) | "invalid" | null;

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

  if (!db || (!local && fromLink === null)) return <p className="p-8 text-center text-sm text-muted">Carregando relatório…</p>;

  if (local) {
    const st = shareState(local);
    if (st !== "ativo") return <Denied reason={st} />;
    const data = dataForShare(db, local);
    if (local.kind === "hospital") {
      return (
        <HospitalDashboard
          share={local}
          data={data}
          admission={db.admissions?.find((a) => a.id === local.admissionId)}
          checkins={(db.checkins ?? []).filter((c) => c.admissionId === local.admissionId)}
          openDoc={(id) => openDocumentFile(id)}
        />
      );
    }
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
  if (share.kind === "hospital") {
    return <HospitalDashboard share={share} data={data} admission={fromLink.admission} checkins={fromLink.checkins ?? []} fromLink />;
  }
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
      <ShieldIcon className="mx-auto h-12 w-12 text-muted" />
      <h1 className="mt-3 display">Acesso indisponível</h1>
      <p className="mt-1 text-[15px] text-ink-soft">{DENIED[reason]}</p>
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
  const bp = hasBloodPressure(data.wearableDays);
  const cacheKey = `${data.labResults.length}-${data.alerts.map((a) => a.id).join(",")}-${data.wearableDays.at(-1)?.irregularRhythmEvents ?? 0}`;

  return (
    <main className="mx-auto max-w-7xl px-4 py-5">
      <section className="tile flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Paciente</p>
          <h1 className="display mt-0.5">{p.name}</h1>
          <p className="text-[15px] text-ink-soft">
            {p.sex === "F" ? "Feminino" : "Masculino"} · {ageFrom(p.birthDate)} anos · nasc. {formatDate(p.birthDate)}
            {p.bloodType ? ` · tipo ${p.bloodType}` : ""}
          </p>
          <dl className="mt-3 grid gap-1.5 text-[15px] sm:grid-cols-[auto_1fr] sm:gap-x-4">
            <dt className="inline-flex w-fit items-center rounded border border-danger-line bg-danger-soft px-1.5 text-sm font-bold uppercase tracking-[0.06em] text-danger">Alergias</dt>
            <dd className="font-semibold text-ink">{p.allergies.join(", ") || "nenhuma registrada"}</dd>
            {has("medicamentos") && (
              <>
                <dt className="text-sm font-bold uppercase tracking-[0.06em] text-ink-soft">Em uso</dt>
                <dd className="text-ink">{activeMeds.map((m) => `${m.name} ${m.dose}`).join(", ") || "nenhum"}</dd>
              </>
            )}
            {p.emergencyContact && (
              <>
                <dt className="text-sm font-bold uppercase tracking-[0.06em] text-ink-soft">Emergência</dt>
                <dd className="text-ink">
                  {p.emergencyContact.name} · <a className="num underline decoration-line-strong underline-offset-2" href={`tel:${p.emergencyContact.phone.replace(/[^\d+]/g, "")}`}>{p.emergencyContact.phone}</a>
                </dd>
              </>
            )}
          </dl>
        </div>
        <div className="flex gap-3 rounded-lg border border-navy-100 bg-navy-50 p-3 text-sm text-ink md:max-w-sm">
          <ShieldIcon className="h-5 w-5 shrink-0 text-ink" />
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

          {has("exames") && <RecentExams labs={data.labResults} documents={data.documents} openDoc={openDoc} />}

          {data.alerts.length > 0 && (
            <section>
              <DocH2>Alertas automáticos</DocH2>
              <div className="grid gap-3 md:grid-cols-2">
                {data.alerts.map((a) => <AlertCard key={a.id} alert={a} cta={false} open audience="medico" />)}
              </div>
            </section>
          )}

          {featured.length > 0 && (
            <section>
              <DocH2>Evolução dos exames</DocH2>
              <div className="grid gap-3 md:grid-cols-2">
                {featured.map((s) => (
                  <div key={s.key} className="tile px-2 pb-2">
                    <div className="flex items-center justify-between px-2">
                      <p className="text-[15px] font-semibold">{s.name}</p>
                      <span className="num flex items-center gap-1.5 text-[15px]">
                        <strong>{fmt(s.latest.value!)}</strong> <span className="text-xs text-muted">{s.unit}</span>
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

          {has("exames") && data.documents.some((d) => d.report) && (
            <section>
              <DocH2>Laudos de imagem e procedimentos</DocH2>
              <ReportList documents={data.documents} openDoc={openDoc} audience="medico" />
            </section>
          )}

          {w && (
            <section>
              <DocH2>Wearables</DocH2>
              <p className="-mt-1 mb-1 text-sm text-muted">Origem: {sourceLine(data.wearableSource)}</p>
              <p className="num mb-3 text-sm text-ink-soft">
                Médias de 7 dias{w.until < new Date().toISOString().slice(0, 10) ? ` (até ${formatDate(w.until)})` : ""}:{" "}
                {[
                  w.restingHr != null && <>FC repouso <strong>{w.restingHr} bpm</strong></>,
                  w.sleepHours != null && <>sono <strong>{fmt(w.sleepHours)} h</strong></>,
                  w.spo2Min != null && <>SpO2 mín. <strong>{w.spo2Min}%</strong></>,
                  bp && w.systolic != null && <>PA <strong>{w.systolic}/{w.diastolic}</strong></>,
                  w.steps != null && <>passos <strong>{w.steps.toLocaleString("pt-BR")}</strong></>,
                ]
                  .filter(Boolean)
                  .map((el, i) => <span key={i}>{i > 0 && " · "}{el}</span>)}
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {hasMetric(data.wearableDays, "irregularRhythmEvents") && <div className="tile px-2">
                  <p className="px-2 pt-1 text-[15px] font-semibold">Ritmo irregular (episódios/dia)</p>
                  <WearableChart days={data.wearableDays} unit="episódios" kind="bar" domain={[0, "auto"]} defaultRange={90} height={150} series={[{ key: "irregularRhythmEvents", name: "Episódios", color: CHART.out }]} />
                </div>}
                {hasMetric(data.wearableDays, "restingHr") && <div className="tile px-2">
                  <p className="px-2 pt-1 text-[15px] font-semibold">FC de repouso</p>
                  <WearableChart days={data.wearableDays} unit="bpm" height={150} series={[{ key: "restingHr", name: "FC repouso", color: CHART.ink }]} />
                </div>}
                {hasMetric(data.wearableDays, "spo2Min") && <div className="tile px-2">
                  <p className="px-2 pt-1 text-[15px] font-semibold">SpO2 mínima noturna</p>
                  <WearableChart days={data.wearableDays} unit="%" domain={[80, 100]} height={150} refs={[{ y: 90, label: "90%" }]} series={[{ key: "spo2Min", name: "SpO2", color: CHART.blue }]} />
                </div>}
                {bp && <div className="tile px-2">
                  <p className="px-2 pt-1 text-[15px] font-semibold">Pressão arterial (medidor domiciliar)</p>
                  <WearableChart
                    days={data.wearableDays}
                    unit="mmHg"
                    domain={[60, 160]}
                    height={150}
                    refs={[{ y: 130, label: "130", color: CHART.warn }, { y: 80, label: "80", color: CHART.warn }]}
                    series={[{ key: "systolic", name: "Sistólica", color: CHART.plum }, { key: "diastolic", name: "Diastólica", color: CHART.plum, dashed: true }]}
                  />
                </div>}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          {series.length > 0 && (
            <section className="tile p-0">
              <h2 className="px-4 pt-3  text-lg font-semibold">Últimos resultados</h2>
              <table className="num mt-2 w-full text-sm">
                <tbody className="divide-y divide-line">
                  {series.map((s) => (
                    <tr key={s.key}>
                      <td className="py-2 pl-4 pr-2">
                        {s.name}
                        <span className="block text-xs text-muted">{formatDate(s.latest.date)} · ref. {formatRef(s.latest)}</span>
                      </td>
                      <td className="whitespace-nowrap pr-2 text-right font-semibold">{s.latest.value != null ? fmt(s.latest.value) : s.latest.valueText} <span className="font-normal text-muted">{s.unit}</span></td>
                      <td className="pr-4 text-right"><StatusBadge status={s.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {has("medicamentos") && (
            <section className="tile">
              <h2 className=" text-lg font-semibold">Medicamentos</h2>
              <ul className="mt-2 space-y-1.5 text-sm">
                {data.medications.map((m) => (
                  <li key={m.id} className={m.endDate ? "text-muted" : ""}>
                    <strong>{m.name} {m.dose}</strong> · {m.frequency} · desde {formatDate(m.startDate)}
                    {m.endDate ? ` até ${formatDate(m.endDate)}` : ""}{m.reason ? ` · ${m.reason}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {timeline.length > 0 && (
            <section className="tile">
              <h2 className=" text-lg font-semibold">Consultas e laudos</h2>
              <ol className="mt-2 space-y-2.5 text-sm">
                {timeline.map((e) => {
                  const doc = e.kind === "exame" ? docs.get(e.id.replace(/^doc-/, "")) : undefined;
                  return (
                    <li key={e.id} className="border-l-2 border-line pl-3">
                      <p className="num text-xs font-semibold uppercase tracking-[0.06em] text-muted">{formatDate(e.date)}</p>
                      <p className="font-semibold">
                        {doc?.storedAs && openDoc ? (
                          <button type="button" onClick={() => openDoc(doc.storedAs!)} className="text-left text-ink underline">{e.title}</button>
                        ) : (
                          e.title
                        )}
                      </p>
                      {e.detail && <p className="text-ink-soft">{e.detail}</p>}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {has("vacinas") && (
            <section className="tile">
              <h2 className=" text-lg font-semibold">Vacinas</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {[...data.vaccines].reverse().map((v) => <li key={v.id}><strong>{v.name}</strong> · {formatDate(v.date)}{v.dose ? ` · ${v.dose}` : ""}</li>)}
              </ul>
            </section>
          )}
        </aside>
      </div>
      <p className="mt-10 border-t border-line pt-4 text-center text-xs text-muted">
        Dados informados pelo paciente e por dispositivos de consumo. Os alertas não são diagnóstico.
        {fromLink ? " Os laudos originais ficam no aparelho do paciente." : " Laudos lidos por IA trazem link para o original."}
      </p>
    </main>
  );
}

function DocH2({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h2 className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft">{children}</h2>
      <span className="h-px flex-1 bg-line" aria-hidden />
    </div>
  );
}
