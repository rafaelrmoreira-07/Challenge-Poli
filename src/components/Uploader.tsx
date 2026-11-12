"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ageFrom } from "@/lib/dates";
import { ACCEPTED_TYPES, extractLabReport, fileType, MAX_UPLOAD_BYTES, NoKeyError } from "@/lib/extraction";
import { checkRepeats, labStatus } from "@/lib/health";
import { asset } from "@/lib/paths";
import { getDbSnapshot, saveExam, type SaveExamInput } from "@/lib/store";
import type { Confidence, Extraction, ExtractedResult } from "@/lib/types";
import { AlertIcon, CameraIcon, CheckIcon, FileIcon, HistoryIcon, ScanIcon } from "./icons";
import { SectionTitle, StatusBadge } from "./ui";

type Phase = { step: "review"; file: File; extraction: Extraction | null; warning?: string };

const SAMPLES = [
  { file: "laudo-vida-2026-11.pdf", type: "application/pdf", title: "PDF do laboratório", desc: "Laudo de nov/2026 com 14 exames" },
  { file: "exame-papel-2016.jpg", type: "image/jpeg", title: "Foto de exame em papel", desc: "Laudo antigo de 2016, fotografado" },
  { file: "exame-papel-carimbo-2020.jpg", type: "image/jpeg", title: "Foto difícil de ler", desc: "Papel de 2020, torto, com carimbo em cima de um valor" },
];

const STAGES = ["Enviando o arquivo…", "Lendo o documento…", "Identificando cada exame…", "Conferindo unidades e faixas de referência…"];

/** Aceita "5,8", "5.8", "7.200" e "250.000". */
const numOrNull = (raw: string) => {
  const s = raw.trim().replace(/\s/g, "");
  if (!s) return null;
  let norm = s;
  if (s.includes(",")) norm = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) norm = s.replace(/\./g, "");
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
};
const toInput = (n: number | null) => (n == null ? "" : n.toLocaleString("pt-BR", { maximumFractionDigits: 4, useGrouping: false }));

/** Máximo de laudos por envio: a IA lê um de cada vez, para não estourar o limite da chave gratuita. */
export const MAX_BATCH = 5;
/** Pausa entre uma leitura e a próxima (limite de pedidos por minuto da Gemini). */
const GAP_MS = 1500;

interface Item {
  file: File;
  preview: string;
  status: "lendo" | "pronto";
  extraction: Extraction | null;
  warning?: string;
}

export function Uploader() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [current, setCurrent] = useState(0);
  const [saved, setSaved] = useState(0);
  const [idle, setIdle] = useState<{ error?: string; needsKey?: boolean; notice?: string }>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const batch = useRef(0); // invalida leituras de um envio cancelado
  const previews = useRef<string[]>([]);

  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const patch = (i: number, p: Partial<Item>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));

  async function read(file: File, i: number, id: number): Promise<"ok" | "nokey"> {
    patch(i, { status: "lendo", extraction: null, warning: undefined });
    const { patient } = getDbSnapshot();
    try {
      const extraction = await extractLabReport(file, { sex: patient.sex, age: ageFrom(patient.birthDate) });
      if (batch.current === id) patch(i, { status: "pronto", extraction });
      return "ok";
    } catch (err) {
      if (err instanceof NoKeyError) return "nokey";
      if (batch.current === id) patch(i, { status: "pronto", extraction: null, warning: "A IA não conseguiu ler este laudo agora. Tente de novo ou preencha os resultados à mão." });
      return "ok";
    }
  }

  function reset(state: typeof idle = {}) {
    batch.current++;
    previews.current.forEach((u) => URL.revokeObjectURL(u));
    previews.current = [];
    setItems([]);
    setCurrent(0);
    setSaved(0);
    setIdle(state);
  }

  async function start(picked: File[]) {
    const notices: string[] = [];
    let files = picked;
    if (files.length > MAX_BATCH) {
      notices.push(`Você escolheu ${files.length} arquivos. Vou ler os ${MAX_BATCH} primeiros; envie os outros na próxima rodada.`);
      files = files.slice(0, MAX_BATCH);
    }
    const ok: File[] = [];
    for (const f of files) {
      const type = fileType(f);
      if (!ACCEPTED_TYPES.includes(type)) notices.push(`${f.name}: formato não aceito (envie PDF, JPG, PNG, WEBP ou HEIC).`);
      else if (f.size > MAX_UPLOAD_BYTES) notices.push(`${f.name}: maior que 10 MB.`);
      else ok.push(f.type ? f : new File([f], f.name, { type }));
    }
    if (!ok.length) return setIdle({ error: notices.join(" ") || "Nenhum arquivo válido." });

    const id = ++batch.current;
    previews.current = ok.map((f) => URL.createObjectURL(f));
    setItems(ok.map((file, i) => ({ file, preview: previews.current[i], status: "lendo", extraction: null })));
    setCurrent(0);
    setSaved(0);
    setIdle(notices.length ? { notice: notices.join(" ") } : {});

    // Um de cada vez: a revisão do primeiro já abre enquanto os outros são lidos.
    for (let i = 0; i < ok.length; i++) {
      if (batch.current !== id) return;
      if (i > 0) await new Promise((r) => setTimeout(r, GAP_MS));
      if ((await read(ok[i], i, id)) === "nokey") {
        return reset({ needsKey: true, error: "Para ler laudos com IA, informe uma chave da Gemini em Configurações. Os laudos de exemplo abaixo funcionam sem chave." });
      }
    }
  }

  async function sendSample(s: (typeof SAMPLES)[number]) {
    const res = await fetch(asset(`/exemplos/${s.file}`));
    const blob = await res.blob();
    await start([new File([blob], s.file, { type: s.type })]);
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fs = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (fs.length) start(fs);
  };

  function next(docId: string | null) {
    const done = saved + (docId ? 1 : 0);
    setSaved(done);
    if (current + 1 < items.length) return setCurrent(current + 1);
    const total = items.length;
    reset();
    if (docId) router.push(`/exames/?novo=${docId}`);
    else if (done > 0) router.push("/exames");
    else if (total > 1) setIdle({ notice: "Nenhum laudo foi salvo." });
  }

  if (items.length) {
    const item = items[current];
    const multi = items.length > 1;
    const header = multi && (
      <div className="mb-3 flex items-center gap-2" aria-live="polite">
        <p className="text-sm font-semibold text-ink-700">
          Laudo {current + 1} de {items.length}
          {saved > 0 && <span className="font-normal text-ink-500"> · {saved} salvo{saved > 1 ? "s" : ""}</span>}
        </p>
        <div className="flex flex-1 justify-end gap-1" aria-hidden>
          {items.map((x, j) => (
            <span key={j} className={`h-1.5 w-6 rounded-full ${j < current ? "bg-brand-500" : j === current ? "bg-brand-300" : x.status === "pronto" ? "bg-ink-300" : "bg-ink-200"}`} />
          ))}
        </div>
      </div>
    );
    return (
      <div>
        {idle.notice && <p className="mb-3 rounded-xl bg-warn-50 px-3 py-2 text-sm text-warn-900 ring-1 ring-warn-300">{idle.notice}</p>}
        {header}
        {item.status === "lendo" ? (
          <>
            <Reading filename={item.file.name} preview={item.preview} />
            <button type="button" className="btn-secondary mt-3 w-full" onClick={() => reset()}>Cancelar envio</button>
          </>
        ) : (
          <Review
            key={current}
            phase={{ step: "review", file: item.file, extraction: item.extraction, warning: item.warning }}
            preview={item.preview}
            cancelLabel={multi ? "Pular este" : "Cancelar"}
            onCancel={() => (multi ? next(null) : reset())}
            onSaved={(docId) => next(docId)}
            onRetry={item.extraction ? undefined : () => read(item.file, current, batch.current)}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      {idle.error && (
        <p className="mb-3 rounded-xl bg-danger-50 px-3 py-2 text-sm text-danger-700 ring-1 ring-danger-200">
          {idle.error}
          {idle.needsKey && <> <Link href="/configuracoes" className="font-semibold underline">Abrir Configurações</Link></>}
        </p>
      )}
      {idle.notice && <p className="mb-3 rounded-xl bg-warn-50 px-3 py-2 text-sm text-warn-900 ring-1 ring-warn-300">{idle.notice}</p>}
      <input ref={fileRef} type="file" accept="application/pdf,image/*" multiple className="hidden" onChange={onPick} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => camRef.current?.click()} className="card flex flex-col items-center gap-2 py-6 transition-colors hover:border-brand-300 hover:bg-brand-50/40">
          <CameraIcon className="h-8 w-8 text-brand-700" />
          <span className="text-[15px] font-semibold">Fotografar</span>
          <span className="text-sm text-ink-500">Exame em papel</span>
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className="card flex flex-col items-center gap-2 py-6 transition-colors hover:border-brand-300 hover:bg-brand-50/40">
          <FileIcon className="h-8 w-8 text-brand-700" />
          <span className="text-[15px] font-semibold">Escolher arquivos</span>
          <span className="text-sm text-ink-500">Até {MAX_BATCH} por vez, PDF ou imagem</span>
        </button>
      </div>

      <SectionTitle>Laudos de exemplo (fictícios)</SectionTitle>
      <div className="space-y-2">
        {SAMPLES.map((s) => (
          <div key={s.file} className="card flex items-center gap-3 p-3">
            <FileIcon className="shrink-0 text-ink-500" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">{s.title}</p>
              <p className="text-sm text-ink-500">{s.desc}</p>
            </div>
            <a href={asset(`/exemplos/${s.file}`)} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-ink-600 underline underline-offset-4">ver</a>
            <button type="button" onClick={() => sendSample(s)} className="btn-primary px-3">Enviar</button>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm leading-relaxed text-ink-500">
        Com a IA ligada, o arquivo vai do seu navegador direto para a Gemini API (Google), só para leitura. O histórico fica
        salvo apenas neste navegador. Use dados sintéticos ou seus próprios; dados de outra pessoa só com o consentimento dela.
      </p>
    </div>
  );
}

function Reading({ filename, preview }: { filename: string; preview: string | null }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, STAGES.length - 1)), 2500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="card flex flex-col items-center py-8 text-center">
      {preview && filename.match(/\.(jpe?g|png|webp)$/i) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="mb-4 max-h-48 rounded-lg opacity-60 shadow" />
      )}
      <ScanIcon className="h-10 w-10 animate-pulse text-brand-600" />
      <p className="mt-3 font-semibold" aria-live="polite">{STAGES[i]}</p>
      <p className="mt-1 text-xs text-ink-500">{filename}</p>
      <div className="mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-ink-200" role="progressbar" aria-label="Progresso da leitura" aria-valuemin={0} aria-valuemax={STAGES.length} aria-valuenow={i + 1}>
        <div className="h-full rounded-full bg-brand-500 transition-all duration-[2500ms]" style={{ width: `${((i + 1) / STAGES.length) * 90}%` }} />
      </div>
    </div>
  );
}

interface Row {
  id: number;
  name: string;
  analyteKey: string;
  value: string;
  valueText: string | null;
  unit: string;
  refLow: string;
  refHigh: string;
  refText: string | null;
  confidence: Confidence | null;
  /** A pessoa conferiu este valor (editou ou tocou em "Está certo"). */
  checked: boolean;
}

/** Valor que a IA não conseguiu ler: precisa ser preenchido ou removido. */
const isMissing = (r: Row) => r.confidence != null && !r.value.trim() && !r.valueText;
/** Valor lido com dúvida, ainda não conferido. */
const needsCheck = (r: Row) => !r.checked && (isMissing(r) || r.confidence === "baixa" || r.confidence === "media");

const toRow = (r: ExtractedResult, id: number): Row => ({
  id,
  name: r.name,
  analyteKey: r.analyteKey,
  value: toInput(r.value),
  valueText: r.valueText,
  unit: r.unit,
  refLow: toInput(r.refLow),
  refHigh: toInput(r.refHigh),
  refText: r.refText,
  confidence: r.confidence ?? null,
  checked: false,
});

function Review({
  phase,
  preview,
  onCancel,
  onSaved,
  onRetry,
  cancelLabel = "Cancelar",
}: {
  phase: Extract<Phase, { step: "review" }>;
  preview: string | null;
  onCancel: () => void;
  onSaved: (docId: string) => void;
  onRetry?: () => void;
  cancelLabel?: string;
}) {
  const ex = phase.extraction;
  const [lab, setLab] = useState(ex?.lab ?? "");
  const [date, setDate] = useState(ex?.examDate ?? "");
  const [rows, setRows] = useState<Row[]>(() => (ex?.results ?? []).map(toRow));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [showOriginal, setShowOriginal] = useState(() => (ex?.results ?? []).some((r) => r.confidence === "baixa" || r.confidence === "media"));
  const nextId = useRef(1000);

  const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const toCheck = rows.filter(needsCheck).length;
  const missing = rows.filter(isMissing).length;
  const repeat = checkRepeats(getDbSnapshot(), date, lab, rows.map((r) => r.analyteKey));

  function submit() {
    setError(null);
    const input: SaveExamInput = {
      file: phase.file,
      extractedBy: ex?.source ?? "manual",
      model: ex?.model,
      lab,
      examDate: date,
      results: rows.map((r) => ({
        name: r.name,
        analyteKey: r.analyteKey,
        value: numOrNull(r.value),
        valueText: numOrNull(r.value) == null ? r.valueText ?? (r.value || null) : null,
        unit: r.unit,
        refLow: numOrNull(r.refLow),
        refHigh: numOrNull(r.refHigh),
        refText: r.refText,
      })),
    };
    start(async () => {
      const res = await saveExam(input);
      if ("error" in res) setError(res.error);
      else onSaved(res.docId);
    });
  }

  const isImage = phase.file.type.startsWith("image/");

  return (
    <div>
      <div className={`mb-3 rounded-xl px-3 py-2 text-sm ring-1 ${ex?.source === "gemini" ? "bg-brand-50 text-brand-900 ring-brand-200" : "bg-warn-50 text-warn-900 ring-warn-200"}`}>
        {ex?.source === "gemini" && <>A IA leu <strong>{rows.length} resultados</strong> ({ex.model}). Confira e corrija o que for preciso antes de salvar.</>}
        {ex?.source === "simulado" && <>Leitura pré-gravada deste laudo de exemplo (IA desligada ou indisponível). Com uma chave da Gemini em Configurações, a leitura é feita ao vivo.</>}
        {!ex && (
          <>
            {phase.warning ?? "Não foi possível ler o laudo."} Você pode adicionar os resultados manualmente.
            {onRetry && <button type="button" onClick={onRetry} className="ml-1 font-semibold underline underline-offset-2">Tentar ler de novo</button>}
          </>
        )}
      </div>
      {ex?.patientName && <p className="mb-2 text-xs text-ink-500">Nome no laudo: {ex.patientName}</p>}
      {ex?.notes && <p className="mb-2 text-xs text-ink-500">Observação da IA: {ex.notes}</p>}

      {toCheck > 0 && (
        <p className="mb-3 flex gap-2 rounded-xl bg-warn-50 px-3 py-2 text-sm text-warn-900 ring-1 ring-warn-300" role="status">
          <AlertIcon width={18} className="mt-0.5 shrink-0" />
          <span>
            <strong>{toCheck === 1 ? "1 valor para conferir." : `${toCheck} valores para conferir.`}</strong>{" "}
            A IA marcou em amarelo o que não conseguiu ler com segurança, em vez de adivinhar. Compare com o original abaixo.
          </span>
        </p>
      )}
      {repeat.duplicate && (
        <p className="mb-3 flex gap-2 rounded-xl bg-warn-50 px-3 py-2 text-sm text-warn-900 ring-1 ring-warn-300" role="status">
          <AlertIcon width={18} className="mt-0.5 shrink-0" />
          <span><strong>Este laudo parece já estar no seu histórico</strong> (mesma data e laboratório). Se salvar de novo, os resultados ficam duplicados.</span>
        </p>
      )}
      {repeat.repeats.length > 0 && (
        <p className="mb-3 flex gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-900 ring-1 ring-brand-200" role="status">
          <HistoryIcon width={18} className="mt-0.5 shrink-0" />
          <span>
            <strong>Exame repetido:</strong> você já tinha feito {listNames(repeat.repeats.map((x) => x.name))} em{" "}
            {formatShort(repeat.repeats[0].prevDate)}, {repeat.repeats[0].days} dias antes desta coleta. Da próxima vez, vale mostrar o resultado
            anterior ao médico antes de repetir.
          </span>
        </p>
      )}

      {preview && (
        <div className="mb-3">
          <button type="button" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 underline underline-offset-4" onClick={() => setShowOriginal((v) => !v)}>
            {showOriginal ? "Esconder original" : "Comparar com o original"}
          </button>
          {showOriginal &&
            (isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Laudo original" className="mt-2 w-full rounded-lg ring-1 ring-ink-200" />
            ) : (
              <iframe src={preview} title="Laudo original" className="mt-2 h-96 w-full rounded-lg ring-1 ring-ink-200" />
            ))}
        </div>
      )}

      <div className="card space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 block">
            <span className="label">Laboratório</span>
            <input className="input" value={lab} onChange={(e) => setLab(e.target.value)} />
          </label>
          <label className="col-span-2 block">
            <span className="label">Data da coleta</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {rows.map((r) => {
          const st = labStatus({ value: numOrNull(r.value), refLow: numOrNull(r.refLow), refHigh: numOrNull(r.refHigh) });
          const doubt = needsCheck(r);
          const gone = isMissing(r);
          return (
            <div key={r.id} className={`card p-3 ${doubt ? "border-warn-300 bg-warn-50 ring-1 ring-warn-200" : ""}`}>
              <div className="flex items-center gap-2">
                <input className="input flex-1 font-medium" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} aria-label="Exame" />
                <StatusBadge status={st} />
                <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl text-ink-500 transition-colors hover:bg-danger-50 hover:text-danger-700" aria-label={`Remover ${r.name || "resultado"}`}>
                  ×
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label><span className="label">Valor</span><input className={`input ${gone ? "border-warn-500 bg-white" : ""}`} inputMode="decimal" value={r.value} onChange={(e) => update(r.id, { value: e.target.value, checked: true })} placeholder={gone ? "Digite o valor" : r.valueText ?? ""} aria-invalid={gone || undefined} /></label>
                <label><span className="label">Unidade</span><input className="input" value={r.unit} onChange={(e) => update(r.id, { unit: e.target.value })} /></label>
                <label><span className="label">Ref. mín.</span><input className="input" inputMode="decimal" value={r.refLow} onChange={(e) => update(r.id, { refLow: e.target.value })} /></label>
                <label><span className="label">Ref. máx.</span><input className="input" inputMode="decimal" value={r.refHigh} onChange={(e) => update(r.id, { refHigh: e.target.value })} /></label>
              </div>
              {r.refText && <p className="mt-1.5 text-xs text-ink-500">No laudo: {r.refText}</p>}
              {doubt && (
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-warn-200 pt-2">
                  <p className="flex flex-1 items-center gap-1.5 text-sm font-semibold text-warn-800">
                    <AlertIcon width={16} className="shrink-0" />
                    {gone ? "Não consegui ler este valor. Confira no original e preencha, ou remova a linha." : "Confira este valor no original."}
                  </p>
                  {!gone && (
                    <button type="button" onClick={() => update(r.id, { checked: true })} className="btn-secondary min-h-11 px-3 text-sm">
                      <CheckIcon width={16} /> Está certo
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={() => setRows((rs) => [...rs, { id: nextId.current++, name: "", analyteKey: "", value: "", valueText: null, unit: "", refLow: "", refHigh: "", refText: null, confidence: null, checked: true }])}
        >
          + Adicionar resultado
        </button>
      </div>

      {error && <p className="mt-3 rounded-xl bg-danger-50 px-3 py-2 text-sm text-danger-700 ring-1 ring-danger-200">{error}</p>}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] mt-4 flex gap-2 border-t border-ink-200 bg-paper py-3">
        <button type="button" className="btn-secondary flex-1" onClick={onCancel} disabled={pending}>{cancelLabel}</button>
        <button type="button" className="btn-primary flex-[2]" onClick={submit} disabled={pending || !rows.length || !date || missing > 0}>
          {pending ? "Salvando…" : missing > 0 ? `Preencha ou remova ${missing === 1 ? "1 valor" : `${missing} valores`}` : `Salvar ${rows.length} resultados`}
        </button>
      </div>
    </div>
  );
}

const listNames = (names: string[]) =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
const formatShort = (iso: string) => iso.split("-").reverse().join("/");
