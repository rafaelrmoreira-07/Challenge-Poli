"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/icons";
import { absoluteUrl, asset } from "@/lib/paths";
import { PERSONAS } from "@/lib/personas";
import { shareState } from "@/lib/share";
import { resetDemo, simulateIrregularRhythm, useDb } from "@/lib/store";

const PHONE_W = 390;
const PHONE_H = 844;
const BEZEL = 14;

/** Modo apresentação: celular do paciente e visão do médico lado a lado, para projetar. */
export default function DemoPage() {
  const db = useDb();
  const [scale, setScale] = useState(1);
  const [qr, setQr] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerHeight - 190) / (PHONE_H + BEZEL * 2)));
    fit();
    window.addEventListener("resize", fit);
    QRCode.toDataURL(absoluteUrl("/"), { width: 160, margin: 1 }).then(setQr);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const active = db?.shares.find((s) => shareState(s) === "ativo");
  const lastShare = db?.shares[0];
  const doctorToken = active?.token ?? lastShare?.token;

  return (
    <div className="flex h-dvh flex-col bg-brand-900 text-white">
      <header className="flex items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-paper"><LogoMark width={24} height={24} /></span>
          <span className="font-serif text-xl font-semibold">Elo Saúde</span>
          <span className="text-brand-200">· paciente e médico, ao vivo</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="flex items-center gap-2">
            <span className="text-brand-200">Persona</span>
            <select
              className="rounded-lg bg-brand-800 px-2 py-2 font-semibold text-white"
              value={db?.personaId ?? "carlos"}
              onChange={async (e) => {
                const id = e.target.value as (typeof PERSONAS)[number]["id"];
                if (!confirm(`Trocar para ${PERSONAS.find((x) => x.id === id)?.name}? Os dados da demonstração voltam ao início.`)) return;
                await resetDemo(id);
                setReloadKey((k) => k + 1);
              }}
            >
              {PERSONAS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
          <button
            className="rounded-lg bg-brand-800 px-3 py-2 font-semibold hover:bg-brand-700 disabled:opacity-40"
            disabled={!db?.wearableDays.length}
            title={db?.wearableDays.length ? undefined : "Esta persona não usa relógio"}
            onClick={() => simulateIrregularRhythm()}
          >
            Simular ritmo irregular
          </button>
          <button
            className="rounded-lg bg-brand-800 px-3 py-2 font-semibold text-danger-200 hover:bg-brand-700"
            onClick={async () => {
              if (!confirm("Voltar aos dados iniciais da demonstração?")) return;
              await resetDemo();
              setReloadKey((k) => k + 1);
            }}
          >
            Restaurar dados
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-6 px-6 pb-6">
        <div className="flex shrink-0 flex-col items-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-200">Celular do paciente</p>
          <div style={{ width: (PHONE_W + BEZEL * 2) * scale, height: (PHONE_H + BEZEL * 2) * scale }}>
            <div
              className="origin-top-left rounded-[46px] bg-black shadow-2xl ring-1 ring-brand-700"
              style={{ width: PHONE_W + BEZEL * 2, height: PHONE_H + BEZEL * 2, padding: BEZEL, transform: `scale(${scale})` }}
            >
              <iframe key={`p${reloadKey}`} src={asset("/")} title="App do paciente" className="h-full w-full rounded-[34px] bg-white" />
            </div>
          </div>
          {qr && (
            <div className="mt-3 flex items-center gap-2 text-xs text-brand-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR code para abrir o app" className="h-14 w-14 rounded bg-white p-1" />
              <span>Abra no seu celular</span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-200">
            Computador do médico {active ? `· ${active.doctorName}` : ""}
          </p>
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl bg-white ring-1 ring-brand-700">
            {doctorToken ? (
              <iframe key={`m${doctorToken}${reloadKey}`} src={asset(`/medico/?t=${encodeURIComponent(doctorToken)}`)} title="Visão do médico" className="h-full w-full" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-ink-500">
                <p className="text-lg font-semibold text-ink-700">Aguardando o paciente compartilhar</p>
                <p className="mt-1 max-w-sm text-sm">No celular, toque em <strong>Médico</strong> e crie um acesso. A tela do médico aparece aqui na hora.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
