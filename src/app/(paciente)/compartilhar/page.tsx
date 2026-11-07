"use client";

import Link from "next/link";
import { ShareForm } from "@/components/ShareForm";
import { SectionTitle } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { shareState } from "@/lib/share";
import { revokeShare, useDb } from "@/lib/store";
import { SCOPE_LABELS } from "@/lib/types";

export default function CompartilharPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Mostrar ao médico</h1>
      <p className="mb-4 mt-1 text-sm text-slate-600">
        Como no open finance: você escolhe quem vê, o quê e por quanto tempo. O médico recebe um link com tudo organizado numa tela só.
      </p>
      <ShareForm />
      <Shares />
    </div>
  );
}

function Shares() {
  const db = useDb();
  if (!db?.shares.length) return null;
  const now = new Date();
  return (
    <>
      <SectionTitle>Acessos concedidos</SectionTitle>
      <ul className="space-y-2">
        {db.shares.map((s) => {
          const st = shareState(s, now);
          return (
            <li key={s.token} className="card p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{s.doctorName}{s.doctorCrm ? ` · CRM ${s.doctorCrm}` : ""}</p>
                  <p className="text-[11px] text-slate-500">
                    Criado em {formatDateTime(s.createdAt)} · {st === "ativo" ? `válido até ${formatDateTime(s.expiresAt)}` : st === "revogado" ? `revogado em ${formatDateTime(s.revokedAt!)}` : "expirado"}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${st === "ativo" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-slate-200"}`}>
                  {st}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-600">{s.scopes.map((x) => SCOPE_LABELS[x]).join(" · ")}</p>
              <details className="mt-1.5 text-[11px] text-slate-600">
                <summary className="cursor-pointer font-medium">
                  {s.accessLog.length} {s.accessLog.length === 1 ? "acesso registrado neste aparelho" : "acessos registrados neste aparelho"}
                </summary>
                <ul className="mt-1 list-disc pl-4">
                  {s.accessLog.slice(-10).reverse().map((a) => <li key={a.at}>{formatDateTime(a.at)}</li>)}
                </ul>
              </details>
              {st === "ativo" && (
                <div className="mt-2 flex gap-2">
                  <Link href={`/medico/?t=${encodeURIComponent(s.token)}`} target="_blank" className="btn-secondary flex-1 py-1.5 text-xs">Abrir</Link>
                  <button className="btn-danger flex-1 py-1.5 text-xs" onClick={() => revokeShare(s.token)}>Revogar</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
