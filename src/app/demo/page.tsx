"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/icons";
import { absoluteUrl, asset } from "@/lib/paths";
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
    <div className="flex h-dvh flex-col bg-ink text-white">
      <header className="flex items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-3">
          <LogoMark width={32} height={32} className="rounded-lg ring-1 ring-white/20" />
          <span className="text-xl font-medium tracking-[-0.02em]">Elo Saúde</span>
          <span className="text-navy-200">Paciente e médico, ao vivo</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <a href={asset("/impacto/")} target="_blank" rel="noopener" className="rounded-xl bg-white/10 px-3.5 py-2 text-sm font-medium hover:bg-white/15">
            Indicadores
          </a>
          <button className="rounded-xl bg-white/10 px-3.5 py-2 text-sm font-medium hover:bg-white/15" onClick={() => simulateIrregularRhythm()}>
            Simular ritmo irregular
          </button>
          <button
            className="rounded-xl bg-white/10 px-3.5 py-2 text-sm font-medium text-danger-line hover:bg-white/15"
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
          <p className="mb-2 text-sm text-navy-200">Celular do paciente</p>
          <div style={{ width: (PHONE_W + BEZEL * 2) * scale, height: (PHONE_H + BEZEL * 2) * scale }}>
            <div
              className="origin-top-left rounded-[46px] bg-black shadow-2xl ring-1 ring-white/10"
              style={{ width: PHONE_W + BEZEL * 2, height: PHONE_H + BEZEL * 2, padding: BEZEL, transform: `scale(${scale})` }}
            >
              <iframe key={`p${reloadKey}`} src={asset("/")} title="App do paciente" className="h-full w-full rounded-[34px] bg-white" />
            </div>
          </div>
          {qr && (
            <div className="mt-3 flex items-center gap-2 text-xs text-navy-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR code para abrir o app" className="h-14 w-14 rounded bg-white p-1" />
              <span>Abra no seu celular</span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <p className="mb-2 text-sm text-navy-200">
            Computador do médico {active ? `· ${active.doctorName}` : ""}
          </p>
          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl bg-white ring-1 ring-white/10">
            {doctorToken ? (
              <iframe key={`m${doctorToken}${reloadKey}`} src={asset(`/medico/?t=${encodeURIComponent(doctorToken)}`)} title="Visão do médico" className="h-full w-full" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted">
                <p className="text-lg font-medium text-ink">Aguardando o paciente compartilhar</p>
                <p className="mt-1 max-w-sm text-sm">No celular, toque em <strong>Médico</strong> e crie um acesso. A tela do médico aparece aqui na hora.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
