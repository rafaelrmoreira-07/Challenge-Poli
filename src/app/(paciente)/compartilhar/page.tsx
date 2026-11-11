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
      <h1 className="page-title">Mostrar ao médico</h1>
      <p className="mb-5 mt-1 text-[15px] text-ink-600">
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
                  <p className="text-[15px] font-semibold">{s.doctorName}{s.doctorCrm ? ` · CRM ${s.doctorCrm}` : ""}</p>
                  <p className="text-xs text-ink-500">
                    Criado em {formatDateTime(s.createdAt)} · {st === "ativo" ? `válido até ${formatDateTime(s.expiresAt)}` : st === "revogado" ? `revogado em ${formatDateTime(s.revokedAt!)}` : "expirado"}
                  </p>
                </div>
                <span className={`rounded-md border px-1.5 py-0.5 text-xs font-semibold capitalize ${st === "ativo" ? "border-brand-200 bg-brand-50 text-brand-800" : "border-ink-200 bg-ink-100 text-ink-600"}`}>
                  {st}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-ink-600">{s.scopes.map((x) => SCOPE_LABELS[x]).join(" · ")}</p>
              <details className="mt-1 text-sm text-ink-600">
                <summary className="flex min-h-11 items-center font-semibold">
                  {s.accessLog.length} {s.accessLog.length === 1 ? "acesso registrado neste aparelho" : "acessos registrados neste aparelho"}
                </summary>
                <ul className="mt-1 list-disc pl-4">
                  {s.accessLog.slice(-10).reverse().map((a) => <li key={a.at}>{formatDateTime(a.at)}</li>)}
                </ul>
              </details>
              {st === "ativo" && (
                <div className="mt-2 flex gap-2">
                  <Link href={`/medico/?t=${encodeURIComponent(s.token)}`} target="_blank" className="btn-secondary flex-1">Abrir</Link>
                  <button className="btn-danger flex-1" onClick={() => revokeShare(s.token)}>Revogar</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
