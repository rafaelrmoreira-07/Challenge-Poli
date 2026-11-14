import { addDays, daysBetween, formatDate, todayISO } from "./dates";
import { RED_FLAGS, type Admission, type CheckIn, type Db, type Discharge } from "./types";

/**
 * Jornada da internação (apêndices A, C e H): pasta de pré-internação,
 * conferência de pendências e acompanhamento depois da alta.
 */

export type CheckStatus = "ok" | "atencao" | "falta";

export interface ChecklistItem {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** Código de glosa TISS que este item ajuda a evitar (artigo "Motivos de glosa", Rivio). */
  glosa?: { code: string; label: string };
}

export function latestAdmission(db: Pick<Db, "admissions">): Admission | undefined {
  return db.admissions?.at(-1);
}

/** O que falta na pasta para a internação andar sem retrabalho. */
export function admissionChecklist(ad: Admission, today = todayISO()): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  items.push({
    id: "plano",
    label: "Plano e carteirinha",
    status: ad.plan && ad.cardNumber ? "ok" : "falta",
    detail: ad.plan && ad.cardNumber ? `${ad.plan}, carteirinha ${ad.cardNumber}` : "Informe o plano e o número da carteirinha.",
  });
  items.push({
    id: "autorizacao",
    label: "Autorização do plano",
    status: ad.authNumber ? "ok" : "falta",
    detail: ad.authNumber ? `Senha ${ad.authNumber}` : "Sem a senha de autorização, o procedimento pode não ser pago.",
    glosa: { code: "1818", label: "procedimento sem autorização prévia" },
  });
  if (ad.authNumber) {
    const late = ad.authValidUntil && ad.plannedDate && ad.authValidUntil < ad.plannedDate;
    const expired = ad.authValidUntil && ad.authValidUntil < today;
    items.push({
      id: "validade",
      label: "Validade da autorização",
      status: !ad.authValidUntil ? "atencao" : late || expired ? "falta" : "ok",
      detail: !ad.authValidUntil
        ? "Confira até quando a senha vale."
        : expired
          ? `A senha venceu em ${formatDate(ad.authValidUntil)}. Peça uma nova ao plano.`
          : late
            ? `A senha vence em ${formatDate(ad.authValidUntil)}, antes da internação em ${formatDate(ad.plannedDate)}.`
            : `Vale até ${formatDate(ad.authValidUntil)}.`,
      glosa: { code: "1414", label: "senha de autorização com validade expirada" },
    });
  }
  items.push({
    id: "pedido",
    label: "Pedido médico",
    status: ad.order ? "ok" : "falta",
    detail: ad.order ? ad.order.name : "Anexe a foto ou o PDF do pedido do médico.",
    glosa: { code: "3052", label: "documentação incompleta, incorreta ou ausente" },
  });
  items.push({
    id: "laudos",
    label: "Exames que justificam o procedimento",
    status: ad.supportDocIds.length ? "ok" : "atencao",
    detail: ad.supportDocIds.length ? `${ad.supportDocIds.length} ${ad.supportDocIds.length === 1 ? "laudo escolhido" : "laudos escolhidos"}` : "Escolha os laudos que o médico usou para indicar o procedimento.",
    glosa: { code: "3052", label: "documentação incompleta, incorreta ou ausente" },
  });
  return items;
}

export function checklistScore(items: ChecklistItem[]) {
  const ok = items.filter((i) => i.status === "ok").length;
  return { ok, total: items.length, complete: ok === items.length };
}

// ---------- alta e pós-alta ----------

/** Alta simulada para a demonstração. Em produção, o resumo viria do hospital. */
export function simulatedDischarge(ad: Admission, today = todayISO()): Discharge {
  const start = ad.plannedDate && ad.plannedDate <= today ? ad.plannedDate : addDays(today, -2);
  return {
    date: today,
    simulated: true,
    followUpDays: 30,
    teamContact: `Equipe de transição do ${ad.hospital || "hospital"}`,
    summary: [
      `Você ficou internado de ${formatDate(start)} a ${formatDate(today)} no ${ad.hospital || "hospital"} para ${ad.procedure.toLowerCase() || "o procedimento"}.`,
      "O procedimento foi feito como planejado e você recebeu alta para continuar a recuperação em casa.",
      "A sua alergia a remédios foi registrada pela equipe e respeitada durante a internação.",
    ],
    newMeds: [{ name: "Paracetamol", dose: "750 mg", frequency: "até 4 vezes ao dia, se tiver dor", days: 7 }],
    nextSteps: [
      `Consulta de retorno com ${ad.requestingDoctor || "o médico que indicou o procedimento"} em 7 a 10 dias.`,
      "Continue tomando os remédios que você já usava, nos mesmos horários.",
      "Evite esforço físico e carregar peso até o retorno.",
    ],
    warningSigns: ["Febre acima de 38 °C", "Dor que não melhora com o remédio", "Falta de ar ou dor no peito", "Vermelhidão, inchaço ou secreção no corte"],
  };
}

export interface FollowUp {
  admission: Admission;
  discharge: Discharge;
  day: number;
  total: number;
  active: boolean;
  checkins: CheckIn[];
  checkedInToday: boolean;
}

export function followUp(db: Pick<Db, "admissions" | "checkins">, today = todayISO()): FollowUp | null {
  const ad = [...(db.admissions ?? [])].reverse().find((a) => a.discharge);
  if (!ad?.discharge) return null;
  const day = daysBetween(ad.discharge.date, today) + 1;
  const checkins = (db.checkins ?? []).filter((c) => c.admissionId === ad.id).sort((a, b) => b.at.localeCompare(a.at));
  return {
    admission: ad,
    discharge: ad.discharge,
    day,
    total: ad.discharge.followUpDays,
    active: day >= 1 && day <= ad.discharge.followUpDays,
    checkins,
    checkedInToday: checkins.some((c) => c.at.slice(0, 10) === today),
  };
}

/** Último registro dos 2 dias anteriores, para os alertas. */
export function recentCheckIn(f: FollowUp, today = todayISO()): CheckIn | undefined {
  return f.checkins.find((c) => daysBetween(c.at.slice(0, 10), today) <= 1);
}

export const hasRedFlag = (c: CheckIn) => c.symptoms.some((s) => RED_FLAGS.includes(s));
