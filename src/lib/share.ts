import "server-only";
import { randomBytes } from "node:crypto";
import { computeAlerts } from "./health";
import { readDb, updateDb } from "./db";
import type { Db, Scope, Share } from "./types";

export function newShareToken(): string {
  return randomBytes(18).toString("base64url");
}

export type ShareState = "ativo" | "expirado" | "revogado";

export function shareState(s: Share, now = new Date()): ShareState {
  if (s.revokedAt) return "revogado";
  if (new Date(s.expiresAt) <= now) return "expirado";
  return "ativo";
}

/** Recorte do histórico que o médico pode ver, conforme o consentimento. */
export function scopedData(db: Db, scopes: Scope[]) {
  const has = (s: Scope) => scopes.includes(s);
  return {
    patient: db.patient,
    labResults: has("exames") ? db.labResults : [],
    documents: has("exames") ? db.documents : [],
    encounters: has("consultas") ? db.encounters : [],
    medications: has("medicamentos") ? db.medications : [],
    vaccines: has("vacinas") ? db.vaccines : [],
    wearableDays: has("wearables") ? db.wearableDays : [],
    devices: has("wearables") ? db.devices : [],
    alerts: has("wearables")
      ? computeAlerts(db)
      : computeAlerts(db).filter((a) => a.kind === "exames" && has("exames")),
  };
}

export type ScopedData = ReturnType<typeof scopedData>;

export type ShareAccess =
  | { ok: true; share: Share; data: ScopedData }
  | { ok: false; reason: "nao_encontrado" | "expirado" | "revogado" };

/** Valida o token. Com logAccess, registra o acesso no histórico do paciente. */
export async function openShare(token: string, opts: { logAccess?: boolean; userAgent?: string } = {}): Promise<ShareAccess> {
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(token)) return { ok: false, reason: "nao_encontrado" };
  const db = await readDb();
  const share = db.shares.find((s) => s.token === token);
  if (!share) return { ok: false, reason: "nao_encontrado" };
  const state = shareState(share);
  if (state !== "ativo") return { ok: false, reason: state };

  if (opts.logAccess) {
    await updateDb((d) => {
      const s = d.shares.find((x) => x.token === token);
      if (!s) return;
      const now = new Date();
      const userAgent = opts.userAgent?.slice(0, 200);
      // Recarregar a página em menos de 1 minuto conta como o mesmo acesso.
      const last = s.accessLog.at(-1);
      if (last && last.userAgent === userAgent && now.getTime() - new Date(last.at).getTime() < 60_000) return;
      s.accessLog.push({ at: now.toISOString(), userAgent });
    });
  }
  return { ok: true, share, data: scopedData(db, share.scopes) };
}
