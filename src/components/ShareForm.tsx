"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { buildDoctorLink } from "@/lib/doctor";
import { absoluteUrl } from "@/lib/paths";
import { createShare, useDb } from "@/lib/store";
import { whatsappDoctorUrl } from "@/lib/whatsapp";
import { SCOPE_LABELS, SCOPES } from "@/lib/types";
import { useAiEnabled } from "./AiStatus";
import { CheckIcon, ClipboardIcon, ShieldIcon, WhatsappIcon } from "./icons";

const DURATIONS = [
  { hours: 1, label: "1 hora (durante a consulta)" },
  { hours: 24, label: "24 horas" },
  { hours: 168, label: "7 dias" },
  { hours: 720, label: "30 dias" },
];

/** Limite prático de um QR code legível pela câmera do celular. */
const QR_MAX_CHARS = 2300;

export function ShareForm() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (token) return <ShareResult key={token} token={token} onDone={() => setToken(null)} />;

  return (
    <form
      className="card space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const res = createShare({
          doctorName: String(f.get("doctorName") ?? ""),
          doctorCrm: String(f.get("doctorCrm") ?? ""),
          scopes: f.getAll("scopes").map(String),
          hours: Number(f.get("hours")),
        });
        if ("error" in res) setError(res.error);
        else {
          setError(null);
          setToken(res.token);
        }
      }}
    >
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
        <div className="space-y-2">
          {SCOPES.map((s) => (
            <label key={s} className="flex min-h-11 items-center gap-3 rounded-lg border border-ink-200 px-3 text-[15px] has-[:checked]:border-brand-300 has-[:checked]:bg-brand-50/50">
              <input type="checkbox" name="scopes" value={s} defaultChecked className="h-5 w-5 accent-brand-600" />
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

      <div className="flex gap-3 rounded-lg border border-brand-100 bg-brand-50 p-3 text-sm leading-relaxed text-ink-700">
        <ShieldIcon className="h-5 w-5 shrink-0 text-brand-700" />
        <p>
          Ao criar o acesso, você autoriza este médico a ver os dados marcados até o prazo escolhido, para fins de cuidado
          com a sua saúde (LGPD, art. 11). Você pode revogar quando quiser, e cada acesso fica registrado.
        </p>
      </div>

      {error && <p className="rounded-xl bg-danger-50 px-3 py-2 text-sm text-danger-700 ring-1 ring-danger-200">{error}</p>}
      <button className="btn-primary w-full">Autorizar e gerar link</button>
    </form>
  );
}

function ShareResult({ token, onDone }: { token: string; onDone: () => void }) {
  const ai = useAiEnabled();
  const [url, setUrl] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    buildDoctorLink(token).then(async (link) => {
      if (!link || cancelled) return;
      const full = absoluteUrl(link.path);
      setUrl(full);
      if (full.length <= QR_MAX_CHARS) setQr(await QRCode.toDataURL(full, { width: 260, margin: 1, errorCorrectionLevel: "L", color: { dark: "#10372d" } }));
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  const share = useDb()?.shares.find((s) => s.token === token);

  return (
    <div className="card text-center">
      <p className="flex items-center justify-center gap-1.5 font-serif text-xl font-semibold text-brand-800"><CheckIcon width={20} height={20} strokeWidth={2.4} /> Acesso criado</p>
      {!url ? (
        <div className="py-8">
          <ClipboardIcon className="mx-auto h-8 w-8 animate-pulse text-brand-600" />
          <p className="mt-2 text-sm text-ink-600">{ai ? "Preparando o resumo por IA para o médico…" : "Preparando o link…"}</p>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-500">
            {qr ? "Mostre o QR code ao médico ou envie o link." : "Envie o link ao médico (por WhatsApp ou e-mail)."}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr && <img src={qr} alt="QR code do link de acesso" className="mx-auto mt-3 h-52 w-52" />}
          <div className="mt-3 flex flex-col gap-2">
            {share && (
              <a href={whatsappDoctorUrl(share.doctorName, share.expiresAt, url)} target="_blank" rel="noopener" className="btn-primary">
                <WhatsappIcon width={20} /> Enviar pelo WhatsApp
              </a>
            )}
            {canShare && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigator.share({ title: "Histórico de saúde", text: "Acesso ao meu histórico de saúde", url }).catch(() => undefined)}
              >
                Enviar link
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                } catch {
                  window.prompt("Copie o link:", url);
                }
              }}
            >
              {copied ? "Link copiado" : "Copiar link"}
            </button>
            <Link href={`/medico/?t=${encodeURIComponent(token)}`} target="_blank" className="btn-secondary">
              Abrir visão do médico aqui
            </Link>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-500">
            O link leva uma cópia compactada só dos dados autorizados e deixa de abrir no fim do prazo. Até lá, quem tiver o link
            consegue abrir: envie só para o médico.
          </p>
        </>
      )}
      <button type="button" className="mt-2 inline-flex min-h-11 items-center px-2 text-sm font-semibold text-ink-600" onClick={onDone}>
        Criar outro acesso
      </button>
    </div>
  );
}
