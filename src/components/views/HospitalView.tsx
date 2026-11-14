"use client";

import { toast } from "sonner";
import { CheckIcon, FileIcon, ShieldIcon, UrgentIcon, AlertIcon, DownloadIcon } from "@/components/icons";
import { StatusBadge } from "@/components/ui";
import { admissionChecklist, checklistScore, hasRedFlag } from "@/lib/admission";
import { ageFrom, addDays, daysBetween, formatDate, formatDateTime, todayISO } from "@/lib/dates";
import { buildBundle, downloadJson } from "@/lib/fhir";
import { fmt, formatRef, labStatus, measured } from "@/lib/health";
import type { ScopedData } from "@/lib/share";
import type { Admission, CheckIn, Share } from "@/lib/types";

/**
 * O que o hospital vê pelo link da pasta de internação (apêndices A, C, E e H):
 * dados da internação, o que ainda falta, os laudos que justificam o
 * procedimento e, depois da alta, os registros do pós-alta.
 */
export function HospitalDashboard({
  share,
  data,
  admission: ad,
  checkins,
  openDoc,
  fromLink,
}: {
  share: Share;
  data: ScopedData;
  admission?: Admission;
  checkins: CheckIn[];
  openDoc?: (storedAs: string) => void;
  fromLink?: boolean;
}) {
  const p = data.patient;
  if (!ad) {
    return <p className="mx-auto mt-16 max-w-md px-4 text-center text-[15px] text-muted">Esta pasta de internação não foi encontrada.</p>;
  }
  const items = admissionChecklist(ad);
  const score = checklistScore(items);
  const meds = data.medications.filter((m) => !m.endDate || m.endDate >= todayISO());
  const docs = data.documents;
  const sorted = [...checkins].sort((a, b) => b.at.localeCompare(a.at));
  const d = ad.discharge;
  const day = d ? daysBetween(d.date, todayISO()) + 1 : 0;
  const sinceDischarge = d ? data.wearableDays.filter((w) => w.date >= d.date) : [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
      <section className="flex flex-col gap-4 rounded-2xl bg-white p-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm text-muted">Pasta de internação</p>
          <h1 className="title mt-1">{p.name}</h1>
          <p className="text-[15px] text-muted">
            {p.sex === "F" ? "Feminino" : "Masculino"}, {ageFrom(p.birthDate)} anos, nascimento em {formatDate(p.birthDate)}
            {p.bloodType ? `, sangue ${p.bloodType}` : ""}
          </p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-1.5 text-[15px] text-danger">
            <span className="font-medium">Alergia:</span> {p.allergies.join(", ") || "nenhuma conhecida"}
          </p>
        </div>
        <p className="flex gap-3 rounded-2xl bg-navy-50 p-4 text-sm leading-relaxed text-ink-soft md:max-w-sm">
          <ShieldIcon width={20} className="mt-0.5 shrink-0 text-ink" />
          <span>
            Enviado pelo paciente para <strong className="font-medium text-ink">{share.doctorName}</strong>, válido até {formatDateTime(share.expiresAt)}.
            {fromLink ? " Cópia recebida por link." : " Cada acesso fica registrado."}
          </span>
        </p>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-2xl bg-white p-5">
            <h2 className="text-lg font-medium tracking-[-0.02em]">{ad.procedure}</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-2">
              <Field label="Data prevista" value={ad.plannedDate ? formatDate(ad.plannedDate) : "Não informada"} />
              <Field label="Médico que indicou" value={ad.requestingDoctor || "Não informado"} />
              <Field label="Plano" value={ad.plan || "Não informado"} />
              <Field label="Carteirinha" value={ad.cardNumber || "Não informada"} />
              <Field label="Senha de autorização" value={ad.authNumber || "Não informada"} />
              <Field label="Senha válida até" value={ad.authValidUntil ? formatDate(ad.authValidUntil) : "Não informada"} />
            </dl>
          </section>

          <section className="rounded-2xl bg-white p-5" aria-labelledby="pend">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="pend" className="text-lg font-medium tracking-[-0.02em]">Conferência da pasta</h2>
              <p className={`text-sm font-medium ${score.complete ? "text-ok" : "text-warn"}`}>
                {score.ok} de {score.total} itens completos
              </p>
            </div>
            <ul className="mt-3 divide-y divide-line">
              {items.map((i) => (
                <li key={i.id} className="flex gap-3 py-3">
                  <StatusDot status={i.status} />
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium">{i.label}</p>
                    <p className="text-sm text-muted">{i.detail}</p>
                    {i.status !== "ok" && i.glosa && (
                      <p className="mt-0.5 text-xs text-muted">Risco de glosa {i.glosa.code}: {i.glosa.label}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl bg-white p-5">
            <h2 className="text-lg font-medium tracking-[-0.02em]">Laudos que justificam o procedimento</h2>
            {docs.length ? (
              <div className="mt-3 space-y-4">
                {docs.map((doc) => {
                  const results = data.labResults.filter((r) => r.documentId === doc.id);
                  return (
                    <div key={doc.id}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[15px] font-medium">{doc.lab ?? "Laudo"} · {formatDate(doc.examDate)}</p>
                        {doc.storedAs && openDoc && (
                          <button type="button" className="btn-quiet text-sm" onClick={() => openDoc(doc.storedAs!)}>Ver laudo</button>
                        )}
                      </div>
                      <table className="num mt-1 w-full text-sm">
                        <tbody className="divide-y divide-line">
                          {results.map((r) => (
                            <tr key={r.id}>
                              <td className="py-1.5 pr-2">{r.name}</td>
                              <td className="whitespace-nowrap pr-2 font-medium">{r.value != null ? fmt(r.value) : r.valueText} <span className="text-xs font-normal text-muted">{r.unit}</span></td>
                              <td className="hidden pr-2 text-muted sm:table-cell">ref. {formatRef(r)}</td>
                              <td className="text-right"><StatusBadge status={labStatus(r)} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-[15px] text-muted">Nenhum laudo foi escolhido pelo paciente.</p>
            )}
            <p className="mt-4 flex items-center gap-2 text-sm text-muted">
              <FileIcon width={16} />
              {ad.order ? `Pedido médico: ${ad.order.name}.` : "O pedido médico ainda não foi anexado."}
              {ad.order && fromLink ? " O arquivo fica no aparelho do paciente." : ""}
              {ad.order?.storedAs && openDoc && !fromLink && (
                <button type="button" className="btn-quiet text-sm" onClick={() => openDoc(ad.order!.storedAs!)}>Ver pedido</button>
              )}
            </p>
          </section>

          {d && (
            <section className="rounded-2xl bg-white p-5" aria-labelledby="posalta">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="posalta" className="text-lg font-medium tracking-[-0.02em]">Pós-alta</h2>
                <p className="text-sm text-muted">Alta em {formatDate(d.date)} · dia {Math.min(day, d.followUpDays)} de {d.followUpDays}</p>
              </div>
              {sorted.length ? (
                <ul className="mt-3 divide-y divide-line">
                  {sorted.slice(0, 14).map((c) => {
                    const red = hasRedFlag(c);
                    return (
                      <li key={c.id} className="flex items-start gap-3 py-2.5">
                        <span className={`mt-0.5 ${red ? "text-danger" : c.symptoms.length ? "text-warn" : "text-ok"}`}>
                          {red ? <UrgentIcon width={18} /> : c.symptoms.length ? <AlertIcon width={18} /> : <CheckIcon width={18} />}
                        </span>
                        <div className="min-w-0 text-[15px]">
                          <p className="num text-sm text-muted">{formatDateTime(c.at)}</p>
                          <p>{c.symptoms.length ? c.symptoms.join(", ") : "Sem sintomas"}{c.tookMeds ? "" : " · não tomou os remédios"}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-[15px] text-muted">O paciente ainda não fez o registro diário.</p>
              )}
              {sinceDischarge.length > 0 && (() => {
                // Só o que foi medido: dia sem relógio ou sem medidor não conta como zero
                const sys = measured(sinceDischarge, "systolic");
                const dia = measured(sinceDischarge, "diastolic");
                const hr = measured(sinceDischarge, "restingHr");
                const spo2 = measured(sinceDischarge, "spo2Min");
                const parts = [
                  sys.length && dia.length ? `pressão média ${Math.round(avg(sys))}/${Math.round(avg(dia))} mmHg` : null,
                  hr.length ? `batimentos em repouso ${Math.round(avg(hr))} bpm` : null,
                  spo2.length ? `saturação mínima ${Math.min(...spo2)}%` : null,
                ].filter(Boolean);
                return parts.length ? <p className="num mt-3 text-sm text-muted">Relógio e medidor desde a alta: {parts.join(", ")}.</p> : null;
              })()}
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl bg-white p-5">
            <h2 className="text-lg font-medium tracking-[-0.02em]">Remédios em uso</h2>
            {meds.length ? (
              <ul className="mt-2 space-y-1.5 text-[15px]">
                {meds.map((m) => (
                  <li key={m.id}><span className="font-medium">{m.name} {m.dose}</span> <span className="text-muted">· {m.frequency}</span></li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[15px] text-muted">Sem remédios no escopo autorizado.</p>
            )}
          </section>

          {share.evidenceConsent ? (
            <section className="rounded-2xl bg-white p-5">
              <h2 className="text-lg font-medium tracking-[-0.02em]">Anexar ao prontuário</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                O paciente autorizou, em separado, que estes laudos externos sejam anexados ao prontuário do hospital. O pacote segue o padrão FHIR R4 e inclui o registro do consentimento.
              </p>
              <button
                type="button"
                className="btn-secondary mt-3 w-full"
                onClick={() => {
                  const bundle = buildBundle({ ...data, encounters: [] }, { consent: { share, admission: ad } });
                  downloadJson(`prontuario-${p.name.split(" ")[0].toLowerCase()}-${todayISO()}.json`, bundle);
                  toast.success("Pacote FHIR baixado", { description: `${bundle.entry.length} registros, com o consentimento.` });
                }}
              >
                <DownloadIcon width={18} /> Baixar pacote para o prontuário
              </button>
              <p className="mt-2 text-xs text-muted">Consentimento de {formatDate(share.createdAt.slice(0, 10))}, válido até {formatDate(share.expiresAt.slice(0, 10))}.</p>
            </section>
          ) : (
            <p className="rounded-2xl bg-white p-5 text-sm leading-relaxed text-muted">
              O paciente não autorizou anexar estes laudos ao prontuário do hospital. Eles servem só para consulta durante a internação.
            </p>
          )}

          {d && (
            <section className="rounded-2xl bg-white p-5 text-sm text-muted">
              Acompanhamento até {formatDate(addDays(d.date, d.followUpDays - 1))}. Contato informado ao paciente: {d.teamContact}.
            </section>
          )}
        </aside>
      </div>
      <p className="mt-8 text-center text-xs text-muted">Dados informados pelo paciente. Protótipo: na versão real, a pasta chegaria ao sistema do hospital por integração, com identidade do paciente confirmada.</p>
    </main>
  );
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

export function StatusDot({ status }: { status: "ok" | "atencao" | "falta" }) {
  const map = {
    ok: ["bg-ok-soft text-ok", CheckIcon, "Completo"],
    atencao: ["bg-warn-soft text-warn", AlertIcon, "Conferir"],
    falta: ["bg-danger-soft text-danger", UrgentIcon, "Falta"],
  } as const;
  const [cls, Icon, label] = map[status];
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cls}`} title={label}>
      <Icon width={16} />
      <span className="sr-only">{label}</span>
    </span>
  );
}
