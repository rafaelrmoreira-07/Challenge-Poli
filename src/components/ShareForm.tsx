"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { buildDoctorLink } from "@/lib/doctor";
import { absoluteUrl } from "@/lib/paths";
import { createShare, useDb } from "@/lib/store";
import { whatsappDoctorUrl } from "@/lib/whatsapp";
import { SCOPE_LABELS, SCOPES, type Scope } from "@/lib/types";
import { Checkbox } from "./base/checkbox";
import { CopyIcon, ShieldIcon, WhatsappIcon } from "./icons";
import { SlidingTabs } from "./SlidingTabs";

const DURATIONS = [
  { hours: 1, label: "1 hora" },
  { hours: 24, label: "24 horas" },
  { hours: 168, label: "7 dias" },
  // Médico que acompanha o paciente (ideia do Plinio): acesso longo, sempre revogável
  { hours: 2160, label: "90 dias" },
  { hours: 8760, label: "1 ano" },
];

/** Limite prático de um QR code legível pela câmera do celular. */
const QR_MAX_CHARS = 2300;

export function ShareForm() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [crm, setCrm] = useState("");
  const [scopes, setScopes] = useState<Scope[]>([...SCOPES]);
  const [hours, setHours] = useState(24);

  if (token) return <ShareResult key={token} token={token} onDone={() => setToken(null)} />;

  const toggle = (s: Scope, on: boolean) => setScopes((xs) => (on ? [...xs, s] : xs.filter((x) => x !== s)));

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        const res = createShare({ doctorName: name, doctorCrm: crm, scopes, hours });
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
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Dra. Ana Ribeiro" required maxLength={100} autoComplete="off" />
        </label>
        <label className="block">
          <span className="label">CRM</span>
          <input value={crm} onChange={(e) => setCrm(e.target.value)} className="input" placeholder="Opcional" maxLength={30} autoComplete="off" autoCapitalize="characters" />
        </label>
      </div>

      <fieldset>
        <legend className="label">O que o médico pode ver</legend>
        <div className="divide-y divide-line rounded-2xl bg-surface">
          {SCOPES.map((s) => (
            <label key={s} className="flex min-h-14 cursor-pointer items-center gap-3 px-4 text-[15px]">
              <Checkbox checked={scopes.includes(s)} onCheckedChange={(on) => toggle(s, on)} />
              {SCOPE_LABELS[s]}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <p className="label" id="prazo">Por quanto tempo</p>
        <SlidingTabs label="Por quanto tempo" active={String(hours)} onChange={(k) => setHours(Number(k))} items={DURATIONS.map((d) => ({ key: String(d.hours), label: d.label }))} />
      </div>

      <p className="flex gap-3 rounded-2xl bg-navy-50 p-4 text-sm leading-relaxed text-ink-soft">
        <ShieldIcon width={20} className="mt-0.5 shrink-0 text-ink" />
        <span>
          Você autoriza este médico a ver os dados marcados até o fim do prazo, para cuidar da sua saúde (LGPD, art. 11). Dá para revogar quando quiser, e cada acesso fica registrado.
        </span>
      </p>

      {error && <p className="rounded-2xl bg-danger-soft p-3 text-[15px] text-danger" role="alert">{error}</p>}
      <button className="btn-primary w-full" disabled={!scopes.length}>Autorizar e gerar link</button>
    </form>
  );
}

export function ShareResult({
  token,
  onDone,
  title = "Envie o link ao médico",
  viewLabel = "Ver como o médico vê",
  againLabel = "Montar outro relatório",
  eyebrow = "Relatório pronto",
}: {
  token: string;
  onDone: () => void;
  title?: string;
  viewLabel?: string;
  againLabel?: string;
  eyebrow?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    buildDoctorLink(token).then(async (link) => {
      if (!link || cancelled) return;
      const full = absoluteUrl(link.path);
      setUrl(full);
      if (full.length <= QR_MAX_CHARS) setQr(await QRCode.toDataURL(full, { width: 260, margin: 1, errorCorrectionLevel: "L", color: { dark: "#1f2b4d" } }));
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  const share = useDb()?.shares.find((s) => s.token === token);

  return (
    <section className="rounded-3xl bg-ink p-5 text-white" aria-live="polite">
      <p className="text-sm text-navy-200">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-normal tracking-[-0.03em]">{title}</h2>
      {!url ? (
        <p className="t-shimmer mt-6 text-[15px] [--color-muted:#bcc3d6] [--color-ink:#fff]">Montando o relatório…</p>
      ) : (
        <>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR code do link do relatório" className="mx-auto mt-5 h-48 w-48 rounded-2xl bg-white p-3" />
          )}
          <div className="mt-5 flex flex-col gap-2">
            {share && (
              <a href={whatsappDoctorUrl(share.doctorName, share.expiresAt, url)} target="_blank" rel="noopener" className="btn-primary">
                <WhatsappIcon width={20} /> Enviar pelo WhatsApp
              </a>
            )}
            {canShare && (
              <button
                type="button"
                className="btn border border-white/20 bg-white/5 text-white hover:bg-white/10"
                onClick={() => navigator.share({ title: "Relatório de saúde", text: "Meu relatório de saúde", url }).catch(() => undefined)}
              >
                Enviar link
              </button>
            )}
            <button
              type="button"
              className="btn border border-white/20 bg-white/5 text-white hover:bg-white/10"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  toast.success("Link copiado", { description: "Cole no WhatsApp ou no e-mail do médico." });
                } catch {
                  window.prompt("Copie o link:", url);
                }
              }}
            >
              <CopyIcon width={18} /> Copiar link
            </button>
            <Link href={`/medico/?t=${encodeURIComponent(token)}`} target="_blank" className="btn border border-white/20 bg-white/5 text-white hover:bg-white/10">
              {viewLabel}
            </Link>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-navy-200">
            O link leva só os dados autorizados e para de abrir no fim do prazo. Até lá, quem tiver o link consegue abrir, então envie só para o médico.
          </p>
        </>
      )}
      <button type="button" className="mt-3 inline-flex min-h-11 items-center text-[15px] font-medium text-white underline decoration-white/30 underline-offset-4" onClick={onDone}>
        {againLabel}
      </button>
    </section>
  );
}
