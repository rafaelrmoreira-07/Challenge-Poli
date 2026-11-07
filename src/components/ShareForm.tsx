"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useActionState, useEffect, useState } from "react";
import { createShare } from "@/app/actions";
import { SCOPE_LABELS, SCOPES } from "@/lib/types";
import { ShieldIcon } from "./icons";

const DURATIONS = [
  { hours: 1, label: "1 hora (durante a consulta)" },
  { hours: 24, label: "24 horas" },
  { hours: 168, label: "7 dias" },
  { hours: 720, label: "30 dias" },
];

export function ShareForm() {
  const [state, action, pending] = useActionState(createShare, {});
  const [dismissed, setDismissed] = useState<string | null>(null);

  if (state.token && dismissed !== state.token) {
    const token = state.token;
    return <ShareResult key={token} token={token} onDone={() => setDismissed(token)} />;
  }
  return <Form action={action} pending={pending} error={state.error} />;
}

function ShareResult({ token, onDone }: { token: string; onDone: () => void }) {
  // Só renderiza no navegador, depois que a Server Action devolve o token.
  const url = `${window.location.origin}/medico/${token}`;
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(url, { width: 240, margin: 1, color: { dark: "#0b3b35" } }).then(setQr);
  }, [url]);

  return (
      <div className="card text-center">
        <p className="text-sm font-semibold text-brand-700">Acesso criado</p>
        <p className="mt-1 text-xs text-slate-500">Mostre o QR code ao médico ou envie o link.</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr && <img src={qr} alt="QR code do link de acesso" className="mx-auto mt-3 h-48 w-48" />}
        <p className="mt-3 break-all rounded-lg bg-slate-100 px-3 py-2 font-mono text-[11px]">{url}</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="btn-secondary flex-1"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              } catch {
                // Sem HTTPS o navegador bloqueia a área de transferência; o link continua visível acima.
                window.prompt("Copie o link:", url);
              }
            }}
          >
            {copied ? "Copiado ✓" : "Copiar link"}
          </button>
          <Link href={`/medico/${token}`} target="_blank" className="btn-primary flex-1">
            Abrir visão do médico
          </Link>
        </div>
        <button type="button" className="mt-3 text-xs font-semibold text-slate-500" onClick={onDone}>
          Criar outro acesso
        </button>
      </div>
  );
}

function Form({ action, pending, error }: { action: (form: FormData) => void; pending: boolean; error?: string }) {
  return (
    <form action={action} className="card space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <label className="col-span-2 block">
          <span className="label">Nome do médico</span>
          <input name="doctorName" className="input" placeholder="Dra. Ana Ribeiro" required maxLength={100} />
        </label>
        <label className="block">
          <span className="label">CRM (opcional)</span>
          <input name="doctorCrm" className="input" placeholder="123456/SP" maxLength={30} />
        </label>
      </div>

      <fieldset>
        <legend className="label">O que compartilhar</legend>
        <div className="space-y-1.5">
          {SCOPES.map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="scopes" value={s} defaultChecked className="h-4 w-4 accent-brand-600" />
              {SCOPE_LABELS[s]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="label">Por quanto tempo</span>
        <select name="hours" className="input" defaultValue="24">
          {DURATIONS.map((d) => <option key={d.hours} value={d.hours}>{d.label}</option>)}
        </select>
      </label>

      <div className="flex gap-2 rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
        <ShieldIcon className="h-5 w-5 shrink-0 text-brand-600" />
        <p>
          Ao criar o acesso, você autoriza este médico a ver os dados marcados até o prazo escolhido, para fins de cuidado
          com a sua saúde (LGPD, art. 11). Você pode revogar quando quiser, e cada acesso fica registrado.
        </p>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Criando…" : "Autorizar e gerar link"}</button>
    </form>
  );
}
