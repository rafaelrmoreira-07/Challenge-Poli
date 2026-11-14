"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/base/checkbox";
import { CheckInForm } from "@/components/CheckInForm";
import { CareHeader } from "@/components/CareHeader";
import { CameraIcon, CheckIcon, FileIcon, PhoneIcon, AlertIcon, UrgentIcon } from "@/components/icons";
import { ShareResult } from "@/components/ShareForm";
import { SlidingTabs } from "@/components/SlidingTabs";
import { SectionTitle, Skeleton } from "@/components/ui";
import { StatusDot } from "@/components/views/HospitalView";
import { admissionChecklist, checklistScore, followUp, hasRedFlag, latestAdmission } from "@/lib/admission";
import { formatDate, formatDateTime } from "@/lib/dates";
import { labStatus } from "@/lib/health";
import { createShare, openDocumentFile, saveAdmission, simulateDischargeFor, useDb, type AdmissionInput } from "@/lib/store";
import { shareState } from "@/lib/share";
import type { Admission, Db } from "@/lib/types";

const HOURS = [
  { hours: 24, label: "24 horas" },
  { hours: 168, label: "7 dias" },
  { hours: 720, label: "30 dias" },
];

export function InternacaoView() {
  const db = useDb();
  const [editing, setEditing] = useState(false);
  if (!db) return <Skeleton lines={4} />;
  const ad = latestAdmission(db);
  const fu = followUp(db);

  return (
    <div>
      <CareHeader active="internacao">
        Antes: uma pasta com o que o hospital e o plano pedem. Depois: o resumo da alta e um registro diário por 30 dias.
      </CareHeader>

      {!ad || editing ? (
        <AdmissionForm db={db} admission={editing ? ad : undefined} onSaved={() => setEditing(false)} onCancel={ad ? () => setEditing(false) : undefined} />
      ) : (
        <>
          <Pasta db={db} ad={ad} onEdit={() => setEditing(true)} />
          {!ad.discharge && <SendToHospital db={db} ad={ad} />}
          {ad.discharge && fu ? (
            <>
              <AfterDischarge ad={ad} fu={fu} />
              <SendToHospital db={db} ad={ad} />
            </>
          ) : (
            <DischargeDemo ad={ad} />
          )}
        </>
      )}
    </div>
  );
}

// ---------- pasta (apêndice A) ----------

function AdmissionForm({ db, admission, onSaved, onCancel }: { db: Db; admission?: Admission; onSaved: () => void; onCancel?: () => void }) {
  const [f, setF] = useState(() => ({
    hospital: admission?.hospital ?? "",
    procedure: admission?.procedure ?? "",
    plannedDate: admission?.plannedDate ?? "",
    requestingDoctor: admission?.requestingDoctor ?? "",
    plan: admission?.plan ?? "",
    cardNumber: admission?.cardNumber ?? "",
    authNumber: admission?.authNumber ?? "",
    authValidUntil: admission?.authValidUntil ?? "",
    supportDocIds: admission?.supportDocIds ?? [],
  }));
  const [orderFile, setOrderFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const docs = [...db.documents].sort((a, b) => b.examDate.localeCompare(a.examDate));
  const toggleDoc = (id: string, on: boolean) => setF((x) => ({ ...x, supportDocIds: on ? [...x.supportDocIds, id] : x.supportDocIds.filter((d) => d !== id) }));
  const fillExample = () =>
    setF((x) => ({
      ...x,
      hospital: "Hospital Santa Clara",
      procedure: "Cateterismo cardíaco eletivo",
      plannedDate: x.plannedDate || new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10),
      requestingDoctor: "Dr. Rafael Costa, cardiologista",
      plan: "Plano Saúde Exemplo",
      cardNumber: "0001 2345 6789 0001",
      authNumber: "",
      authValidUntil: "",
      supportDocIds: docs.slice(0, 2).map((d) => d.id),
    }));

  return (
    <form
      className="space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        const input: AdmissionInput = { ...f, orderFile };
        const res = await saveAdmission(input, admission?.id);
        setSaving(false);
        if ("error" in res) return setError(res.error);
        toast.success(admission ? "Pasta atualizada" : "Pasta criada", { description: "Confira o que ainda falta." });
        onSaved();
      }}
    >
      {!admission && (
        <button type="button" className="btn-quiet text-sm" onClick={fillExample}>
          Preencher com um exemplo fictício
        </button>
      )}
      <div className="grid gap-3">
        <label className="block"><span className="label">Hospital</span><input className="input" value={f.hospital} onChange={set("hospital")} placeholder="Hospital Santa Clara" required /></label>
        <label className="block"><span className="label">Procedimento</span><input className="input" value={f.procedure} onChange={set("procedure")} placeholder="Ex.: cirurgia de vesícula" required /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="label">Data prevista</span><input className="input" type="date" value={f.plannedDate} onChange={set("plannedDate")} /></label>
          <label className="block"><span className="label">Médico que indicou</span><input className="input" value={f.requestingDoctor} onChange={set("requestingDoctor")} placeholder="Nome" /></label>
        </div>
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-xl font-medium tracking-[-0.02em]">Plano de saúde</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="label">Plano</span><input className="input" value={f.plan} onChange={set("plan")} placeholder="Nome do plano" /></label>
          <label className="block"><span className="label">Carteirinha</span><input className="input" value={f.cardNumber} onChange={set("cardNumber")} inputMode="numeric" placeholder="Número" /></label>
          <label className="block"><span className="label">Senha da autorização</span><input className="input" value={f.authNumber} onChange={set("authNumber")} placeholder="Se já tiver" autoCapitalize="characters" /></label>
          <label className="block"><span className="label">Senha vale até</span><input className="input" type="date" value={f.authValidUntil} onChange={set("authValidUntil")} /></label>
        </div>
      </fieldset>

      <div>
        <p className="mb-2 text-xl font-medium tracking-[-0.02em]">Pedido médico</p>
        <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setOrderFile(e.target.files?.[0] ?? null)} />
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setOrderFile(e.target.files?.[0] ?? null)} />
        {orderFile || admission?.order ? (
          <p className="flex items-center gap-2 rounded-2xl bg-ok-soft p-3 text-[15px] text-ok">
            <CheckIcon width={18} /> {orderFile?.name ?? admission?.order?.name}
            <button type="button" className="btn-quiet ml-auto text-sm" onClick={() => fileRef.current?.click()}>Trocar</button>
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-secondary" onClick={() => camRef.current?.click()}><CameraIcon width={18} /> Fotografar</button>
            <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}><FileIcon width={18} /> Arquivo</button>
          </div>
        )}
      </div>

      <fieldset>
        <legend className="mb-1 text-xl font-medium tracking-[-0.02em]">Laudos que justificam</legend>
        <p className="mb-2 text-sm text-muted">O hospital vê só os laudos que você marcar, não o histórico inteiro.</p>
        <div className="divide-y divide-line rounded-2xl bg-surface">
          {docs.map((d) => {
            const results = db.labResults.filter((r) => r.documentId === d.id);
            const altered = results.filter((r) => ["alto", "baixo"].includes(labStatus(r))).length;
            return (
              <label key={d.id} className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2 text-[15px]">
                <Checkbox checked={f.supportDocIds.includes(d.id)} onCheckedChange={(on) => toggleDoc(d.id, on)} />
                <span className="min-w-0">
                  <span className="block font-medium">{d.lab ?? "Laudo"}</span>
                  <span className="num block text-sm text-muted">{formatDate(d.examDate)} · {results.length} resultados{altered ? `, ${altered} alterados` : ""}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {error && <p className="rounded-2xl bg-danger-soft p-3 text-[15px] text-danger" role="alert">{error}</p>}
      <div className="flex gap-2">
        {onCancel && <button type="button" className="btn-secondary flex-1" onClick={onCancel}>Cancelar</button>}
        <button className="btn-primary flex-[2]" disabled={saving}>{saving ? "Salvando…" : admission ? "Salvar alterações" : "Criar pasta"}</button>
      </div>
    </form>
  );
}

function Pasta({ db, ad, onEdit }: { db: Db; ad: Admission; onEdit: () => void }) {
  const items = admissionChecklist(ad);
  const score = checklistScore(items);
  const pct = Math.round((score.ok / score.total) * 100);
  return (
    <section className="rounded-3xl bg-surface p-5">
      <p className="text-sm text-muted">{ad.hospital}{ad.plannedDate ? ` · ${formatDate(ad.plannedDate)}` : ""}</p>
      <h2 className="title mt-1">{ad.procedure}</h2>
      <div className="mt-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white" role="progressbar" aria-label="Pasta completa" aria-valuemin={0} aria-valuemax={score.total} aria-valuenow={score.ok}>
          <div className={`h-full rounded-full transition-[width] duration-500 ${score.complete ? "bg-ok" : "bg-accent"}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="num text-sm font-medium">{score.ok} de {score.total}</span>
      </div>
      <ul className="mt-4 divide-y divide-line">
        {items.map((i) => (
          <li key={i.id} className="flex gap-3 py-3">
            <StatusDot status={i.status} />
            <div className="min-w-0">
              <p className="text-[15px] font-medium">{i.label}</p>
              <p className="text-sm text-muted">{i.detail}</p>
              {i.status !== "ok" && i.glosa && <p className="mt-0.5 text-xs text-muted">Sem isso, o plano pode negar o pagamento (glosa {i.glosa.code}).</p>}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="btn-secondary min-h-11 flex-1" onClick={onEdit}>Completar a pasta</button>
        {ad.order?.storedAs && (
          <button type="button" className="btn-secondary min-h-11 flex-1" onClick={() => openDocumentFile(ad.order!.storedAs!)}>Ver pedido</button>
        )}
      </div>
      {db.shares.some((s) => s.kind === "hospital" && s.admissionId === ad.id && shareState(s) === "ativo") && (
        <p className="mt-3 flex items-center gap-2 text-sm text-ok"><CheckIcon width={16} /> Pasta enviada ao hospital</p>
      )}
    </section>
  );
}

function SendToHospital({ db, ad }: { db: Db; ad: Admission }) {
  const [hours, setHours] = useState(168);
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const score = checklistScore(admissionChecklist(ad));

  if (token) {
    return (
      <div className="mt-6">
        <ShareResult token={token} onDone={() => setToken(null)} eyebrow="Pasta pronta" title={`Envie o link ao ${ad.hospital}`} viewLabel="Ver como o hospital vê" againLabel="Fechar" />
      </div>
    );
  }
  return (
    <section className="mt-8 space-y-4">
      <h2 className="text-xl font-medium tracking-[-0.02em]">{ad.discharge ? "Enviar os registros à equipe" : "Enviar ao hospital"}</h2>
      {ad.discharge && (
        <p className="text-sm leading-relaxed text-muted">O link leva uma cópia do que existe agora: o resumo da alta, os registros diários e as medições. Gere um novo quando quiser atualizar a equipe.</p>
      )}
      {!score.complete && !ad.discharge && (
        <p className="flex gap-2 rounded-2xl bg-warn-soft p-3 text-[15px] text-ink">
          <AlertIcon width={18} className="mt-0.5 shrink-0 text-warn" /> Faltam {score.total - score.ok} itens. Dá para enviar assim, mas o hospital vai precisar pedir o resto.
        </p>
      )}
      <div>
        <p className="label">Por quanto tempo o hospital pode ver</p>
        <SlidingTabs label="Prazo" active={String(hours)} onChange={(k) => setHours(Number(k))} items={HOURS.map((h) => ({ key: String(h.hours), label: h.label }))} />
      </div>
      <label className="flex cursor-pointer gap-3 rounded-2xl bg-surface p-4 text-[15px]">
        <Checkbox checked={consent} onCheckedChange={setConsent} className="mt-0.5" />
        <span>
          <span className="block font-medium">Autorizo anexar estes laudos ao meu prontuário no hospital</span>
          <span className="block text-sm leading-relaxed text-muted">Opcional e separado. Os laudos passam a fazer parte do registro do hospital, que também os usa na conta do plano. Sem isso, o hospital só consulta.</span>
        </span>
      </label>
      <button
        type="button"
        className="btn-primary w-full"
        onClick={() => {
          const res = createShare({ doctorName: ad.hospital, scopes: ["exames", "medicamentos", "wearables"], hours, kind: "hospital", admissionId: ad.id, evidenceConsent: consent });
          if ("error" in res) return toast.error(res.error);
          setToken(res.token);
        }}
      >
        Gerar link para o hospital
      </button>
      <p className="text-sm text-muted">
        Vão no link: dados da internação, plano e senha, alergias, remédios e os {ad.supportDocIds.length} laudos marcados. {db.patient.name.split(" ")[0]}, você pode revogar em Médico → Acessos.
      </p>
    </section>
  );
}

// ---------- alta e pós-alta (apêndices C e H) ----------

function DischargeDemo({ ad }: { ad: Admission }) {
  return (
    <section className="mt-10 rounded-2xl border border-dashed border-line-strong p-4">
      <p className="text-[15px] font-medium">Depois da alta</p>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Na versão real, o hospital manda o resumo da alta para cá e começa o acompanhamento de 30 dias. Na demonstração, simule a alta.
      </p>
      <button
        type="button"
        className="btn-secondary mt-3 w-full"
        onClick={() => {
          simulateDischargeFor(ad.id);
          toast.success("Alta recebida do hospital", { description: "Resumo da alta e registro diário liberados." });
        }}
      >
        Simular alta do hospital (demonstração)
      </button>
    </section>
  );
}

function AfterDischarge({ ad, fu }: { ad: Admission; fu: NonNullable<ReturnType<typeof followUp>> }) {
  const d = ad.discharge!;
  const pct = Math.min(100, Math.round((Math.min(fu.day, fu.total) / fu.total) * 100));
  return (
    <div>
      <SectionTitle>Resumo da alta</SectionTitle>
      <section className="space-y-5 rounded-3xl bg-surface p-5">
        {d.simulated && <p className="text-xs text-muted">Resumo simulado para a demonstração. Na versão real ele vem do hospital, revisado pela equipe.</p>}
        <Block title="O que aconteceu">
          {d.summary.map((x) => <p key={x}>{x}</p>)}
        </Block>
        <Block title="Remédios novos">
          {d.newMeds.map((m) => (
            <p key={m.name}><span className="font-medium">{m.name} {m.dose}</span>, {m.frequency}, por {m.days} dias.</p>
          ))}
        </Block>
        <Block title="Próximos passos">
          <ul className="list-disc space-y-1 pl-5">{d.nextSteps.map((x) => <li key={x}>{x}</li>)}</ul>
        </Block>
        <Block title="Procure atendimento se tiver">
          <ul className="list-disc space-y-1 pl-5 text-danger">{d.warningSigns.map((x) => <li key={x}><span className="text-ink">{x}</span></li>)}</ul>
        </Block>
        <p className="flex items-center gap-2 text-[15px]"><PhoneIcon width={18} /> {d.teamContact}</p>
      </section>

      <SectionTitle>Pós-alta</SectionTitle>
      <div className="rounded-3xl bg-ink p-5 text-white">
        <p className="text-sm text-navy-200">{fu.active ? `Dia ${fu.day} de ${fu.total}` : "Acompanhamento encerrado"}</p>
        <p className="mt-1 text-2xl font-normal tracking-[-0.03em]">{fu.checkedInToday ? "Registro de hoje feito" : "Como você está hoje?"}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} /></div>
        <p className="mt-3 text-sm text-navy-100">O relógio e o medidor de pressão continuam medindo. Os registros vão para a equipe do hospital pelo link da pasta.</p>
      </div>
      {fu.active && (
        <div className="mt-4 rounded-3xl bg-surface p-4">
          <CheckInForm admissionId={ad.id} />
        </div>
      )}
      {fu.checkins.length > 0 && (
        <>
          <SectionTitle>Registros</SectionTitle>
          <ul className="divide-y divide-line border-y border-line">
            {fu.checkins.map((c) => {
              const red = hasRedFlag(c);
              return (
                <li key={c.id} className="flex items-start gap-3 py-3 text-[15px]">
                  <span className={`mt-0.5 ${red ? "text-danger" : c.symptoms.length ? "text-warn" : "text-ok"}`}>
                    {red ? <UrgentIcon width={18} /> : c.symptoms.length ? <AlertIcon width={18} /> : <CheckIcon width={18} />}
                  </span>
                  <span>
                    <span className="num block text-sm text-muted">{formatDateTime(c.at)}</span>
                    {c.symptoms.length ? c.symptoms.join(", ") : "Sem sintomas"}
                    {c.tookMeds ? "" : " · não tomou os remédios"}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-muted">{title}</h3>
      <div className="mt-1 space-y-1 text-[15px] leading-relaxed">{children}</div>
    </div>
  );
}
