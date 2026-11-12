"use client";

import { ANALYTES } from "./analytes";
import { getChatSnapshot, markActionsDone, menuActions, alertDraft, setFlow, type BotDraft, type ChatResultRow } from "./chat";
import { ageFrom, formatDate } from "./dates";
import { aiReply, chatAiAvailable } from "./chatAi";
import { buildDoctorLink } from "./doctor";
import { ACCEPTED_TYPES, extractLabReport, fileType, MAX_UPLOAD_BYTES, NoKeyError } from "./extraction";
import { analyteSeries, computeAlerts, fmt, formatRef, hasBloodPressure, labStatus, wearableSnapshot, type LabStatus } from "./health";
import { absoluteUrl } from "./paths";
import { whatsappDoctorUrl } from "./whatsapp";
import { shareState } from "./share";
import { createShare, getDbSnapshot, revokeShare, saveExam } from "./store";
import { SCOPES, type Extraction } from "./types";

/**
 * Respostas do Elo. Regras por palavra-chave para o que precisa ser
 * previsível (emergência, revogar, enviar laudo, criar relatório, menu).
 * Com a chave da Gemini configurada, as perguntas abertas vão para a IA
 * (lib/chatAi.ts), que responde em linguagem natural a partir do histórico.
 * Sem chave, ou se a IA falhar, as regras abaixo respondem como antes.
 */

/** Mostra "digitando…" e então publica a mensagem do Elo. */
export type Say = (d: BotDraft, opts?: { delay?: number }) => Promise<void>;

const norm = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

const has = (t: string, re: RegExp) => re.test(t);

const STATUS_WORD: Record<LabStatus, string> = { alto: "alto", baixo: "baixo", normal: "normal", sem_faixa: "sem referência" };

export const SAMPLE_FILES = [
  { file: "laudo-vida-2026-11.pdf", mime: "application/pdf", label: "Exemplo: PDF do laboratório" },
  { file: "exame-papel-2016.jpg", mime: "image/jpeg", label: "Exemplo: foto de exame antigo" },
  { file: "exame-papel-carimbo-2020.jpg", mime: "image/jpeg", label: "Exemplo: foto difícil de ler" },
];

const HOURS: { re: RegExp; hours: number; label: string }[] = [
  { re: /\b(1 ?h|1 hora|uma hora)\b/, hours: 1, label: "1 hora" },
  { re: /\b(24 ?h|24 horas|1 dia|um dia)\b/, hours: 24, label: "24 horas" },
  { re: /\b(7 dias|uma semana|1 semana|semana)\b/, hours: 168, label: "7 dias" },
  { re: /\b(30 dias|um mes|1 mes|mes)\b/, hours: 720, label: "30 dias" },
];

/** Nomes e apelidos de exames, do mais longo ao mais curto (o mais específico ganha). */
const ANALYTE_TERMS = ANALYTES.flatMap((a) =>
  [a.name.replace(/\s*\(.*\)/, ""), a.key.replace(/_/g, " "), ...a.aliases].map((term) => ({ key: a.key, term: norm(term) })),
)
  .filter((x) => x.term.length >= 3)
  .sort((a, b) => b.term.length - a.term.length);

function findAnalyte(t: string): string | null {
  for (const { key, term } of ANALYTE_TERMS) {
    const re = new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`);
    if (re.test(t)) return key;
  }
  return null;
}

// ---------- texto ----------

export async function respondToText(raw: string, say: Say, opts: { fromButton?: boolean } = {}) {
  const text = raw.trim().slice(0, 500);
  const t = norm(text);
  if (!t) return;

  // Emergência vem antes de tudo
  if (has(t, /dor no peito|falta de ar|nao consigo respirar|desmai|emergencia|infarto|\bavc\b|derrame|sangramento forte/)) {
    return say({
      alert: { id: "emergencia", severity: "procure_medico" },
      text: "Se você está com esses sintomas agora, ligue *192* (SAMU) ou vá ao pronto-socorro mais próximo. Não espere a resposta por aqui.",
      actions: [{ kind: "tel", label: "Ligar 192", number: "192" }],
    });
  }

  const flow = getChatSnapshot()?.flow ?? null;
  if (flow) {
    if (has(t, /^(cancelar|cancela|parar|sair)$/)) {
      setFlow(null);
      return say({ text: "Tudo bem, cancelei. Posso ajudar com outra coisa?", actions: menuActions() });
    }
    if (flow.step === "doctor_name" && !opts.fromButton) return askHours(text, say);
    if (flow.step === "share_hours") {
      const h = HOURS.find((x) => x.re.test(t));
      if (h) return createReport(flow.doctorName, h.hours, h.label, say);
      if (!opts.fromButton) return say({ text: "Por quanto tempo o médico pode ver? Escolha uma opção:", actions: hoursActions() });
    }
    setFlow(null); // um botão de outro assunto encerra a etapa
  }

  const ai = chatAiAvailable() && !opts.fromButton;
  const short = t.split(" ").length <= 4;

  if (has(t, /^(oi|ola|opa|bom dia|boa tarde|boa noite|menu|ajuda|inicio|opcoes|comecar)\b/) && (!ai || short)) {
    const name = getDbSnapshot().patient.name.split(" ")[0];
    return say({ text: `Olá, ${name}. Em que posso ajudar?`, actions: menuActions() });
  }
  if (has(t, /revogar|tirar o acesso|cancelar acesso|cancelar o acesso/)) return listShares(say);
  if (has(t, /alerta|aviso/) && (!ai || short)) return listAlerts(say);
  if (has(t, /\b(enviar|mandar|anexar|subir|carregar|fotografar)\b/) && !/\b(medic[oa]|doutor|dra?)\b|relatorio/.test(t)) return askFile(say);
  if (ai && has(t, /relatorio|compartilh|(enviar|mandar|passar).*(medic[oa]|doutor|\bdra?\b)/)) return startReport(say);

  // Pergunta aberta: com chave, a IA responde em linguagem natural.
  if (ai) {
    try {
      const history = (getChatSnapshot()?.messages ?? []).slice(0, -1);
      const reply = await aiReply(text, history);
      return say({ text: reply.text, actions: reply.actions.length ? reply.actions : undefined }, { delay: 150 });
    } catch (err) {
      console.warn("[elo] IA indisponível, usando as regras:", (err as Error).message.slice(0, 160));
    }
  }

  const analyte = findAnalyte(t);
  if (analyte) return describeAnalyte(analyte, say);
  if (has(t, /exame|resultado|alterad/)) return listAltered(say);
  if (has(t, /pressao|batiment|frequencia|coracao|sono|dormi|saturacao|oxigen|spo2|passos|relogio|sinais/)) return describeVitals(say);
  if (has(t, /remedio|medicamento|medicac|tomando/)) return listMeds(say);
  if (has(t, /relatorio|\bmedic[oa]\b|consulta|compartilh|doutor|\bdra?\b/)) return startReport(say);
  if (has(t, /obrigad|valeu|brigad/)) return say({ text: "Por nada. Se precisar, é só chamar." });

  return say({
    text: "Não entendi. Posso ajudar com estes assuntos, ou você pode perguntar por um exame, por exemplo: *como está meu colesterol LDL?*",
    actions: menuActions(),
  });
}

function startReport(say: Say) {
  setFlow({ step: "doctor_name" });
  return say({ text: "Vou preparar um relatório com seus exames, remédios e medições.\n\nQual é o nome do médico ou da médica?" });
}

function hoursActions() {
  return HOURS.slice(0, 3).map((h) => ({ kind: "reply" as const, label: h.label, text: h.label }));
}

async function askHours(rawName: string, say: Say) {
  const doctorName = rawName.replace(/\s+/g, " ").trim().slice(0, 100);
  if (doctorName.length < 2) return say({ text: "Não peguei o nome. Pode escrever o nome do médico ou da médica?" });
  setFlow({ step: "share_hours", doctorName });
  return say({ text: `Por quanto tempo *${doctorName}* pode ver o relatório? Depois do prazo, o link para de abrir.`, actions: hoursActions() });
}

async function createReport(doctorName: string, hours: number, label: string, say: Say) {
  setFlow(null);
  const res = createShare({ doctorName, scopes: [...SCOPES], hours });
  if ("error" in res) return say({ text: res.error });
  await say({ text: "Preparando o relatório…" }, { delay: 400 });
  const link = await buildDoctorLink(res.token);
  if (!link) return say({ text: "Não consegui montar o link agora. Tente pela aba Médico." });
  return say({
    text:
      `Pronto. O relatório para *${doctorName}* fica disponível por *${label}*.\n\n` +
      "Envie o link para o médico. Ele vê seus exames, remédios, consultas, vacinas e as medições do relógio numa tela só. Você pode revogar quando quiser.",
    actions: [
      { kind: "link", label: "Enviar pelo WhatsApp", href: whatsappDoctorUrl(doctorName, getDbSnapshot().shares.find((s) => s.token === res.token)?.expiresAt ?? new Date().toISOString(), absoluteUrl(link.path)), newTab: true },
      { kind: "copy", label: "Copiar link", text: absoluteUrl(link.path) },
      { kind: "link", label: "Abrir relatório", href: `/medico/?t=${encodeURIComponent(res.token)}`, newTab: true },
      { kind: "revoke", label: "Revogar acesso", token: res.token },
    ],
  });
}

async function listShares(say: Say) {
  const active = getDbSnapshot().shares.filter((s) => shareState(s) === "ativo");
  if (!active.length) return say({ text: "Nenhum médico tem acesso ao seu histórico agora." });
  return say({
    text: "Estes médicos têm acesso agora:\n\n" + active.map((s) => `• *${s.doctorName}*, até ${formatDate(s.expiresAt)}`).join("\n"),
    actions: active.slice(0, 4).map((s) => ({ kind: "revoke" as const, label: `Revogar ${s.doctorName}`, token: s.token })),
  });
}

async function listAlerts(say: Say) {
  const alerts = computeAlerts(getDbSnapshot());
  if (!alerts.length) return say({ text: "Nenhum alerta no momento. Eu aviso por aqui se aparecer algum." });
  await say({ text: alerts.length === 1 ? "Você tem *1 alerta*:" : `Você tem *${alerts.length} alertas*:` }, { delay: 400 });
  for (const a of alerts) await say(alertDraft(a), { delay: 500 });
}

function row(s: ReturnType<typeof analyteSeries>[number]): ChatResultRow {
  return {
    name: s.name,
    value: s.latest.value != null ? fmt(s.latest.value) : s.latest.valueText ?? "—",
    unit: s.unit,
    ref: formatRef(s.latest),
    status: s.status,
  };
}

async function listAltered(say: Say) {
  const series = analyteSeries(getDbSnapshot().labResults);
  const altered = series.filter((s) => s.status === "alto" || s.status === "baixo");
  if (!altered.length) {
    return say({ text: "Seus últimos resultados estão dentro da referência.", actions: [{ kind: "link", label: "Ver todos os exames", href: "/exames" }] });
  }
  return say({
    text: `${altered.length === 1 ? "Este exame está" : `Estes ${altered.length} exames estão`} fora da referência no último resultado. Quem interpreta é o médico.`,
    results: altered.map(row),
    actions: [
      { kind: "link", label: "Ver todos os exames", href: "/exames" },
      { kind: "reply", label: "Mandar relatório ao médico", text: "relatório para o médico" },
    ],
  });
}

async function describeAnalyte(key: string, say: Say) {
  const s = analyteSeries(getDbSnapshot().labResults).find((x) => x.key === key);
  const name = ANALYTES.find((a) => a.key === key)?.name ?? key;
  if (!s) return say({ text: `Ainda não tenho resultado de *${name}* no seu histórico. Se tiver o laudo, me mande a foto ou o PDF.`, actions: [{ kind: "attach", label: "Enviar exame" }] });

  const l = s.latest;
  const value = l.value != null ? fmt(l.value) : l.valueText ?? "—";
  const lines = [`*${s.name}*: ${value} ${s.unit} em ${formatDate(l.date)}.`, `Referência do laudo: ${formatRef(l)}. Resultado ${STATUS_WORD[s.status]}.`];
  const p = s.previous;
  if (p?.value != null && l.value != null) {
    const d = l.value - p.value;
    const how = d === 0 ? "ficou igual" : `${d > 0 ? "subiu" : "caiu"} ${fmt(Math.abs(d))} ${s.unit}`;
    lines.push("", `O exame anterior, de ${formatDate(p.date)}, deu ${fmt(p.value)} ${s.unit}: ${how}.`);
  }
  return say({ text: lines.join("\n"), actions: [{ kind: "link", label: "Ver gráfico", href: `/exame/?a=${encodeURIComponent(key)}` }] });
}

async function describeVitals(say: Say) {
  const db = getDbSnapshot();
  if (!db.wearableDays.length) return say({ text: "Ainda não recebi medições do relógio nem do medidor de pressão." });
  const w = wearableSnapshot(db.wearableDays);
  const bpHigh = w.systolic >= 130 || w.diastolic >= 80;
  return say({
    text: [
      "Suas medições dos últimos 7 dias:",
      "",
      `• Batimentos em repouso: *${w.restingHr} bpm* (média)`,
      ...(hasBloodPressure(db.wearableDays) ? [`• Pressão: *${w.systolic}/${w.diastolic} mmHg* (média)${bpHigh ? ", acima da meta de 130/80" : ""}`] : []),
      `• Saturação mínima: *${w.spo2Min}%*${w.spo2Min < 90 ? ", abaixo de 90%" : ""}`,
      `• Sono: *${fmt(w.sleepHours)} h* por noite`,
      `• Passos: *${w.steps.toLocaleString("pt-BR")}* por dia`,
    ].join("\n"),
    actions: [{ kind: "link", label: "Ver gráficos", href: "/wearables" }],
  });
}

async function listMeds(say: Say) {
  const meds = getDbSnapshot().medications.filter((m) => !m.endDate);
  if (!meds.length) return say({ text: "Não tenho nenhum remédio em uso registrado." });
  return say({ text: "Remédios em uso:\n\n" + meds.map((m) => `• *${m.name} ${m.dose}*, ${m.frequency}${m.reason ? ` (${m.reason.toLowerCase()})` : ""}`).join("\n") });
}

async function askFile(say: Say) {
  return say({
    text: "Pode mandar a foto do exame em papel ou o PDF do laboratório. Eu leio os resultados e você confere antes de salvar.",
    actions: [{ kind: "attach", label: "Escolher arquivo" }, ...SAMPLE_FILES.map((s) => ({ kind: "sample" as const, ...s }))],
  });
}

// ---------- arquivos de exame ----------

/** Arquivos lidos esperando o "Salvar". Ficam só na memória: recarregar a página descarta. */
const pending = new Map<string, { file: File; ex: Extraction }>();

export async function respondToFile(picked: File, say: Say) {
  const type = fileType(picked);
  if (!ACCEPTED_TYPES.includes(type)) return say({ text: "Esse formato eu não consigo ler. Mande PDF, JPG, PNG, WEBP ou HEIC." });
  if (picked.size > MAX_UPLOAD_BYTES) return say({ text: "O arquivo passa de 10 MB. Tente uma foto menor ou o PDF do laboratório." });
  const file = picked.type ? picked : new File([picked], picked.name, { type });

  await say({ text: "Recebi. Estou lendo o laudo…" }, { delay: 400 });
  const { patient } = getDbSnapshot();
  let ex: Extraction;
  try {
    ex = await extractLabReport(file, { sex: patient.sex, age: ageFrom(patient.birthDate) });
  } catch (err) {
    if (err instanceof NoKeyError) {
      return say({
        text: "Para ler este arquivo eu preciso da leitura por IA, que está desligada. Você pode ligar em Configurações ou testar com um dos laudos de exemplo.",
        actions: [{ kind: "link", label: "Abrir Configurações", href: "/configuracoes" }, ...SAMPLE_FILES.map((s) => ({ kind: "sample" as const, ...s }))],
      });
    }
    return say({
      text: "Não consegui ler o laudo agora. Tente de novo daqui a pouco, ou use a tela Adicionar, onde dá para digitar os resultados.",
      actions: [{ kind: "link", label: "Abrir Adicionar", href: "/enviar" }],
    });
  }

  if (!ex.results.length) {
    return say({ text: `Não encontrei resultados de exame neste arquivo.${ex.notes ? `\n\n${ex.notes}` : ""}` });
  }

  const rows: ChatResultRow[] = ex.results.map((r) => ({
    name: r.name,
    value: r.value != null ? fmt(r.value) : r.valueText ?? "—",
    unit: r.unit,
    ref: formatRef({ refLow: r.refLow, refHigh: r.refHigh, refText: r.refText ?? undefined }),
    status: labStatus(r),
  }));
  const altered = rows.filter((r) => r.status === "alto" || r.status === "baixo").length;
  const header = [
    `Li *${rows.length} resultados*${ex.lab ? ` do laudo *${ex.lab}*` : ""}${ex.examDate ? `, coleta de ${formatDate(ex.examDate)}` : ""}.`,
    altered ? `${altered === 1 ? "1 está" : `${altered} estão`} fora da referência.` : "Todos dentro da referência.",
    ex.source === "simulado" ? "Esta é a leitura pré-gravada do laudo de exemplo." : "",
  ].filter(Boolean).join(" ");

  if (!ex.examDate) {
    return say({
      text: `${header}\n\nNão achei a data da coleta, então não consigo salvar por aqui. Na tela Adicionar você confere tudo e preenche a data.`,
      results: rows,
      actions: [{ kind: "link", label: "Abrir Adicionar", href: "/enviar" }],
    });
  }

  const id = crypto.randomUUID();
  pending.set(id, { file, ex });
  return say({
    text: `${header}\n\nConfira os valores abaixo. Se estiver tudo certo, eu salvo no seu histórico.`,
    results: rows,
    actions: [
      { kind: "save-exam", label: "Salvar no histórico", pendingId: id },
      { kind: "discard-exam", label: "Descartar", pendingId: id },
    ],
  });
}

/** Botões que mudam dados: salvar ou descartar laudo, revogar acesso. */
export async function runAction(
  action: { kind: "save-exam" | "discard-exam"; pendingId: string } | { kind: "revoke"; token: string },
  messageId: string,
  say: Say,
) {
  if (action.kind === "revoke") {
    revokeShare(action.token);
    markActionsDone(messageId);
    return say({ text: "Acesso revogado. O link do relatório não abre mais." });
  }

  const item = pending.get(action.pendingId);
  markActionsDone(messageId);
  if (action.kind === "discard-exam") {
    pending.delete(action.pendingId);
    return say({ text: "Tudo bem, descartei o arquivo. Nada foi salvo." });
  }
  if (!item) return say({ text: "Esse arquivo não está mais aqui porque a página foi recarregada. Pode mandar de novo?" });

  const { file, ex } = item;
  const res = await saveExam({
    file,
    extractedBy: ex.source,
    model: ex.model,
    lab: ex.lab ?? "",
    examDate: ex.examDate!,
    results: ex.results,
  });
  pending.delete(action.pendingId);
  if ("error" in res) return say({ text: `Não consegui salvar: ${res.error}` });
  return say({
    text: `Pronto, salvei *${ex.results.length} resultados* no seu histórico.`,
    actions: [{ kind: "link", label: "Ver no histórico", href: `/exames/?novo=${res.docId}` }],
  });
}
