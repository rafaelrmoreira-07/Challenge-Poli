"use client";

import Link from "next/link";
import { toast } from "sonner";
import HoldButton from "@/components/vendor/react-bits/HoldButton";
import { formatDateTime } from "@/lib/dates";
import { shareState } from "@/lib/share";
import { revokeShare, useDb } from "@/lib/store";
import { SCOPE_LABELS } from "@/lib/types";

const STATE_LABEL = { ativo: "Ativo", expirado: "Expirado", revogado: "Revogado" } as const;

export function Shares() {
  const db = useDb();
  if (!db) return null;
  if (!db.shares.length) return <p className="tile text-[15px] text-muted">Você ainda não deu acesso a nenhum médico ou hospital.</p>;
  const now = new Date();
  return (
    <>
      <ul className="space-y-2">
        {db.shares.map((s) => {
          const st = shareState(s, now);
          return (
            <li key={s.token} className="tile">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-muted">{s.kind === "hospital" ? "Hospital · pasta de internação" : "Médico · relatório"}</p>
                  <p className="text-[17px] font-medium">{s.doctorName}{s.doctorCrm ? ` · CRM ${s.doctorCrm}` : ""}</p>
                  <p className="num text-sm text-muted">
                    {st === "ativo" ? `Vale até ${formatDateTime(s.expiresAt)}` : st === "revogado" ? `Revogado em ${formatDateTime(s.revokedAt!)}` : "Prazo encerrado"}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${st === "ativo" ? "bg-ok-soft text-ok" : "bg-white text-muted"}`}>{STATE_LABEL[st]}</span>
              </div>
              <p className="mt-2 text-sm text-muted">{s.scopes.map((x) => SCOPE_LABELS[x]).join(" · ")}</p>
              <p className="mt-1 text-sm text-muted">
                {s.accessLog.length ? `Aberto ${s.accessLog.length} ${s.accessLog.length === 1 ? "vez" : "vezes"} neste aparelho, a última em ${formatDateTime(s.accessLog.at(-1)!.at)}` : "Ainda não foi aberto neste aparelho"}
              </p>
              {st === "ativo" && (
                <div className="mt-3 flex gap-2">
                  <Link href={`/medico/?t=${encodeURIComponent(s.token)}`} target="_blank" className="btn-secondary flex-1">Abrir</Link>
                  {/* Segurar para revogar (HoldButton do React Bits): evita revogar sem querer */}
                  <HoldButton
                    className="flex-1"
                    size="lg"
                    radius={12}
                    holdTime={1200}
                    backgroundColor="#fdecea"
                    fillColor="#b3261e"
                    textColor="#b3261e"
                    fillTextColor="#ffffff"
                    glow={false}
                    doneLabel="Revogado"
                    onHold={() => {
                      revokeShare(s.token);
                      toast.success(`Acesso de ${s.doctorName} revogado`, { description: "O link não abre mais." });
                    }}
                    onTap={() => toast("Segure o botão para revogar", { id: "segure" })}
                  >
                    Segure para revogar
                  </HoldButton>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
