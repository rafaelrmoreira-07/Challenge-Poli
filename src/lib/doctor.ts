"use client";

import { dataForShare, encodeSharePayload, type ScopedData } from "./share";
import { cacheSummary, getDbSnapshot } from "./store";
import { buildClinicalContext, contextHash, generateDoctorSummary, isRuleSummary } from "./summary";
import type { DoctorSummary, Share } from "./types";

const inFlight = new Map<string, Promise<DoctorSummary>>();

/** Resumo do cache do compartilhamento, ou gera (com IA se houver chave). */
export async function summaryForShare(share: Share, data: ScopedData): Promise<DoctorSummary> {
  const hash = await contextHash(buildClinicalContext(data));
  const fresh = getDbSnapshot().shares.find((s) => s.token === share.token)?.summaryCache;
  if (fresh?.hash === hash) return fresh.summary;

  const key = share.token + hash;
  let job = inFlight.get(key);
  if (!job) {
    job = generateDoctorSummary(data).then((summary) => {
      if (!isRuleSummary(summary)) cacheSummary(share.token, hash, summary);
      return summary;
    });
    inFlight.set(key, job);
    job.finally(() => inFlight.delete(key)).catch(() => undefined);
  }
  return job;
}

/**
 * Monta o link do médico com a cópia compactada dos dados autorizados
 * (e o resumo por IA, quando existe) no fragmento da URL.
 */
export async function buildDoctorLink(token: string): Promise<{ path: string; summary: DoctorSummary | null } | null> {
  const db = getDbSnapshot();
  const share = db.shares.find((s) => s.token === token);
  if (!share) return null;
  const data = dataForShare(db, share);
  const path = (payload: string) => `/medico/?t=${encodeURIComponent(token)}#d=${payload}`;
  // Hospital: a pasta e o pós-alta vão no link; o resumo clínico por IA é só para o médico
  if (share.kind === "hospital") {
    const admission = db.admissions?.find((a) => a.id === share.admissionId);
    const checkins = (db.checkins ?? []).filter((c) => c.admissionId === share.admissionId);
    const payload = await encodeSharePayload(share, data, undefined, { admission, checkins });
    return { path: path(payload), summary: null };
  }
  const summary = await summaryForShare(share, data);
  const payload = await encodeSharePayload(share, data, isRuleSummary(summary) ? undefined : summary);
  return { path: path(payload), summary };
}
