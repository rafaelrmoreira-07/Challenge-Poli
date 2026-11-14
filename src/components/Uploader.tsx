"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ageFrom } from "@/lib/dates";
import { ACCEPTED_TYPES, extractLabReport, fileType, MAX_UPLOAD_BYTES, NoKeyError } from "@/lib/extraction";
import { checkRepeats, labStatus } from "@/lib/health";
import { asset } from "@/lib/paths";
import { stageOf } from "@/lib/quality";
import { getDbSnapshot, recordReadingReview, saveExam, useDb, type SaveExamInput } from "@/lib/store";
import { REPORT_CATEGORY_LABELS, type Confidence, type DescriptiveReport, type Extraction, type ExtractedResult, type ReportCategory } from "@/lib/types";
import { toast } from "sonner";
import { AlertIcon, CameraIcon, CheckIcon, CloseIcon, FileIcon, HistoryIcon, WatchIcon } from "./icons";
import { WearableImport } from "./WearableImport";
import { ReadingSteps } from "./ReadingSteps";
import { SectionTitle, StatusBadge } from "./ui";

type Phase = { step: "review"; file: File; extraction: Extraction | null; warning?: string };

const SAMPLES = [
  { file: "laudo-vida-2026-11.pdf", type: "application/pdf", title: "PDF do laboratório", desc: "Laudo de nov/2026 com 14 exames" },
  { file: "exame-papel-2016.jpg", type: "image/jpeg", title: "Foto de exame em papel", desc: "Laudo antigo de 2016, fotografado" },
  { file: "exame-papel-carimbo-2020.jpg", type: "image/jpeg", title: "Foto difícil de ler", desc: "Papel de 2020, torto, com carimbo em cima de um valor" },
  { file: "ecocardiograma-2025.pdf", type: "application/pdf", title: "Laudo de ecocardiograma", desc: "Exame do coração de 2025: texto, sem tabela de números" },
];


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
  // "relogio": importar os dados exportados do relógio ou anel (atalho: /enviar/?tipo=relogio)
  const [mode, setMode] = useState<"exames" | "relogio">("exames");

  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), []);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tipo") === "relogio") queueMicrotask(() => setMode("relogio"));
  }, []);

  const patch = (i: number, p: Partial<Item>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));

  async function read(file: File, i: number, id: number): Promise<"ok" | "nokey"> {
    patch(i, { status: "lendo", extraction: null, warning: undefined });
    const { patient } = getDbSnapshot();
    try {
      // A leitura pré-gravada volta na hora; no primeiro laudo, o mínimo de 3,5 s deixa as etapas da leitura legíveis
      const [extraction] = await Promise.all([
        extractLabReport(file, { sex: patient.sex, age: ageFrom(patient.birthDate) }),
        new Promise((r) => setTimeout(r, i === 0 ? 3500 : 0)),
      ]);
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

  const notice = idle.notice && <p className="mb-4 rounded-2xl bg-warn-soft p-4 text-[15px] text-ink" role="status">{idle.notice}</p>;

  if (mode === "relogio") return <WearableImport onBack={() => setMode("exames")} />;

  if (items.length) {
    const item = items[current];
    const multi = items.length > 1;
    return (
      <div>
        {notice}
        {multi && (
          <div className="mb-4 flex items-center gap-3" aria-live="polite">
            <p className="text-[15px] font-medium text-ink">
              Laudo {current + 1} de {items.length}
              {saved > 0 && <span className="font-normal text-muted"> · {saved} salvo{saved > 1 ? "s" : ""}</span>}
            </p>
            <div className="flex flex-1 justify-end gap-1" aria-hidden>
              {items.map((x, j) => (
                <span key={j} className={`h-1.5 w-6 rounded-full ${j < current ? "bg-ink" : j === current ? "bg-accent" : x.status === "pronto" ? "bg-line-strong" : "bg-line"}`} />
              ))}
            </div>
          </div>
        )}
        {item.status === "lendo" ? (
          <>
            <ReadingSteps filename={item.file.name} preview={item.preview} />
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
        <p className="mb-4 rounded-2xl bg-danger-soft p-4 text-[15px] text-danger" role="alert">
          {idle.error}
          {idle.needsKey && <> <Link href="/configuracoes" className="font-medium underline underline-offset-4">Abrir Configurações</Link></>}
        </p>
      )}
      {notice}
      <input ref={fileRef} type="file" accept="application/pdf,image/*" multiple className="hidden" onChange={onPick} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />

      <button type="button" onClick={() => camRef.current?.click()} className="lift flex w-full items-center gap-4 rounded-3xl bg-ink p-5 text-left text-white">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-ink">
          <CameraIcon width={28} />
        </span>
        <span>
          <span className="block text-xl font-normal tracking-[-0.02em]">Fotografar o laudo</span>
          <span className="block text-[15px] text-navy-100">Papel, antigo ou dobrado, também serve</span>
        </span>
      </button>
      <button type="button" onClick={() => fileRef.current?.click()} className="lift mt-2 flex w-full items-center gap-4 rounded-3xl bg-surface p-5 text-left">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white">
          <FileIcon width={28} />
        </span>
        <span>
          <span className="block text-xl font-normal tracking-[-0.02em]">Escolher arquivos</span>
          <span className="block text-[15px] text-muted">Até {MAX_BATCH} de uma vez: PDF do laboratório ou imagem, até 10 MB cada</span>
        </span>
      </button>
      <button type="button" onClick={() => setMode("relogio")} className="lift mt-2 flex w-full items-center gap-4 rounded-3xl bg-surface p-5 text-left">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white">
          <WatchIcon width={28} />
        </span>
        <span>
          <span className="block text-xl font-normal tracking-[-0.02em]">Importar dados do relógio</span>
          <span className="block text-[15px] text-muted">Arquivo exportado do Apple Saúde ou do Google: batimento, sono, passos</span>
        </span>
      </button>

      <SectionTitle>Laudos de exemplo</SectionTitle>
      <ul className="divide-y divide-line border-y border-line">
        {SAMPLES.map((s) => (
          <li key={s.file} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium">{s.title}</p>
              <p className="text-sm text-muted">{s.desc}</p>
            </div>
            <a href={asset(`/exemplos/${s.file}`)} target="_blank" rel="noopener" className="btn-quiet text-sm">Ver</a>
            <button type="button" onClick={() => sendSample(s)} className="btn-secondary min-h-11 px-4 text-sm">Usar</button>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm leading-relaxed text-muted">
        Com a leitura ligada, o arquivo vai do seu navegador direto para a Gemini (Google), só para leitura. O histórico fica salvo apenas neste aparelho. Os exemplos são fictícios.
      </p>
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

/**
 * Procedência de cada valor para o médico: a linha veio da leitura e foi mudada
 * ("corrigido"), foi digitada à mão ("adicionado") ou ficou como a IA leu.
 */
function reviewOf(r: Row, ex: Extraction | null): "corrigido" | "adicionado" | undefined {
  const orig = ex?.results[r.id];
  if (!ex || ex.source === "manual" || !orig) return "adicionado";
  const same = (a: number | null, b: number | null) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) < 1e-9);
  const changed = !same(numOrNull(r.value), orig.value) || !same(numOrNull(r.refLow), orig.refLow) || !same(numOrNull(r.refHigh), orig.refHigh) || r.unit.trim() !== orig.unit.trim();
  return changed ? "corrigido" : undefined;
}

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

type ReviewProps = {
  phase: Phase;
  preview: string | null;
  onCancel: () => void;
  onSaved: (docId: string) => void;
  onRetry?: () => void;
  cancelLabel?: string;
};

/** Laudo com tabela de números (LabReview) ou laudo descritivo de imagem e procedimentos (ReportReview). */
function Review(props: ReviewProps) {
  const [asReport, setAsReport] = useState(false);
  if (props.phase.extraction?.report || asReport) return <ReportReview {...props} />;
  return <LabReview {...props} onAsReport={props.phase.extraction ? undefined : () => setAsReport(true)} />;
}

function LabReview({
  onAsReport,
  phase,
  preview,
  onCancel,
  onSaved,
  onRetry,
  cancelLabel = "Cancelar",
}: {
  phase: Phase;
  preview: string | null;
  onCancel: () => void;
  onSaved: (docId: string) => void;
  onRetry?: () => void;
  cancelLabel?: string;
  onAsReport?: () => void;
}) {
  const ex = phase.extraction;
  const [lab, setLab] = useState(ex?.lab ?? "");
  const [date, setDate] = useState(ex?.examDate ?? "");
  const [rows, setRows] = useState<Row[]>(() => (ex?.results ?? []).map(toRow));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [showOriginal, setShowOriginal] = useState(() => (ex?.results ?? []).some((r) => r.confidence === "baixa" || r.confidence === "media"));
  const nextId = useRef(1000);
  const stats = useDb()?.readingStats ?? {};
  const quick = rows.filter((r) => stageOf(stats[r.analyteKey]) === "rapida").length;

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
        review: reviewOf(r, ex),
      })),
    };
    start(async () => {
      const res = await saveExam(input);
      if ("error" in res) setError(res.error);
      else {
        // Apêndice F: compara o que a leitura trouxe com o que foi salvo
        if (ex && ex.source !== "manual") {
          recordReadingReview(
            ex.results,
            ex.results.map((_, i) => {
              const r = rows.find((x) => x.id === i);
              return r
                ? { ...ex.results[i], name: r.name, value: numOrNull(r.value), valueText: numOrNull(r.value) == null ? r.valueText : null, unit: r.unit, refLow: numOrNull(r.refLow), refHigh: numOrNull(r.refHigh) }
                : null;
            }),
          );
        }
        toast.success(`${rows.length} resultados salvos`, { description: lab || undefined });
        onSaved(res.docId);
      }
    });
  }

  const isImage = phase.file.type.startsWith("image/");

  return (
    <div>
      <div className={`mb-4 rounded-2xl p-4 text-[15px] leading-relaxed ${ex?.source === "gemini" ? "bg-navy-50 text-ink" : "bg-warn-soft text-ink"}`}>
        {ex?.source === "gemini" && <>A IA leu <strong>{rows.length} resultados</strong> ({ex.model}). Confira e corrija o que for preciso antes de salvar.</>}
        {ex?.source === "simulado" && <>Leitura pré-gravada deste laudo de exemplo (IA desligada ou indisponível). Com uma chave da Gemini em Configurações, a leitura é feita ao vivo.</>}
        {!ex && (
          <>
            {phase.warning ?? "Não foi possível ler o laudo."} Você pode adicionar os resultados manualmente.
            {onRetry && <button type="button" onClick={onRetry} className="btn-quiet ml-1">Tentar ler de novo</button>}
            {onAsReport && <button type="button" onClick={onAsReport} className="btn-quiet ml-1">É um laudo de imagem ou procedimento</button>}
          </>
        )}
      </div>
      {ex && rows.length > 0 && (
        <p className="mb-3 text-sm text-muted">
          {quick === rows.length
            ? "Estes exames vieram sem correção nas últimas leituras. Confira por cima e salve."
            : quick
              ? `${quick} de ${rows.length} exames costumam vir sem correção. Confira com atenção os outros.`
              : "Primeiras leituras destes exames: confira cada valor com o laudo."}
        </p>
      )}
      {ex?.patientName && <p className="mb-2 text-sm text-muted">Nome no laudo: {ex.patientName}</p>}
      {ex?.notes && <p className="mb-2 text-sm text-muted">Observação da IA: {ex.notes}</p>}

      {toCheck > 0 && (
        <p className="mb-3 flex gap-2.5 rounded-2xl bg-warn-soft p-4 text-[15px] leading-relaxed text-ink" role="status">
          <AlertIcon width={20} className="mt-0.5 shrink-0 text-warn" />
          <span>
            <strong className="font-medium">{toCheck === 1 ? "1 valor para conferir." : `${toCheck} valores para conferir.`}</strong>{" "}
            A IA marcou o que não conseguiu ler com segurança, em vez de adivinhar. Compare com o original.
          </span>
        </p>
      )}
      {repeat.duplicate && (
        <p className="mb-3 flex gap-2.5 rounded-2xl bg-warn-soft p-4 text-[15px] leading-relaxed text-ink" role="status">
          <AlertIcon width={20} className="mt-0.5 shrink-0 text-warn" />
          <span><strong className="font-medium">Este laudo parece já estar no seu histórico</strong> (mesma data e laboratório). Se salvar de novo, os resultados ficam duplicados.</span>
        </p>
      )}
      {repeat.repeats.length > 0 && (
        <p className="mb-3 flex gap-2.5 rounded-2xl bg-navy-50 p-4 text-[15px] leading-relaxed text-ink" role="status">
          <HistoryIcon width={20} className="mt-0.5 shrink-0" />
          <span>
            <strong className="font-medium">Exame repetido:</strong> você já tinha feito {listNames(repeat.repeats.map((x) => x.name))} em{" "}
            {formatShort(repeat.repeats[0].prevDate)}, {repeat.repeats[0].days} dias antes desta coleta. Da próxima vez, vale mostrar o resultado
            anterior ao médico antes de repetir.
          </span>
        </p>
      )}

      {preview && (
        <div className="mb-3">
          <button type="button" className="btn-quiet text-sm" onClick={() => setShowOriginal((v) => !v)}>
            {showOriginal ? "Esconder original" : "Comparar com o original"}
          </button>
          {showOriginal &&
            (isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Laudo original" className="mt-2 w-full rounded-2xl border border-line" />
            ) : (
              <iframe src={preview} title="Laudo original" className="mt-2 h-96 w-full rounded-2xl border border-line" />
            ))}
        </div>
      )}

      <div className="tile space-y-3">
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
            <div key={r.id} className={`tile p-3 ${doubt ? "bg-warn-soft ring-1 ring-warn-line" : ""}`}>
              <div className="flex items-center gap-2">
                <input className="input flex-1 font-medium" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} aria-label="Exame" />
                <StatusBadge status={st} />
                {stageOf(stats[r.analyteKey]) === "rapida" && <span className="hidden rounded-full bg-ok-soft px-2 py-0.5 text-xs font-medium text-ok sm:inline">Sem correção</span>}
                <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-danger-soft hover:text-danger" aria-label={`Remover ${r.name || "resultado"}`}>
                  <CloseIcon width={18} />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label><span className="label">Valor</span><input className={`input ${gone ? "border-warn-mark" : ""}`} inputMode="decimal" value={r.value} onChange={(e) => update(r.id, { value: e.target.value, checked: true })} placeholder={gone ? "Digite o valor" : r.valueText ?? ""} aria-invalid={gone || undefined} /></label>
                <label><span className="label">Unidade</span><input className="input" value={r.unit} onChange={(e) => update(r.id, { unit: e.target.value })} /></label>
                <label><span className="label">Ref. mín.</span><input className="input" inputMode="decimal" value={r.refLow} onChange={(e) => update(r.id, { refLow: e.target.value })} /></label>
                <label><span className="label">Ref. máx.</span><input className="input" inputMode="decimal" value={r.refHigh} onChange={(e) => update(r.id, { refHigh: e.target.value })} /></label>
              </div>
              {r.refText && <p className="mt-1.5 text-sm text-muted">No laudo: {r.refText}</p>}
              {doubt && (
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-warn-line pt-2">
                  <p className="flex flex-1 items-center gap-1.5 text-[15px] font-medium text-warn">
                    <AlertIcon width={16} className="shrink-0" />
                    {gone ? "Não consegui ler este valor. Confira no original e preencha, ou remova a linha." : "Confira este valor no original."}
                  </p>
                  {!gone && (
                    <button type="button" onClick={() => update(r.id, { checked: true })} className="btn-secondary min-h-11 bg-white px-4 text-sm">
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

      {error && <p className="mt-3 rounded-2xl bg-danger-soft p-3 text-[15px] text-danger" role="alert">{error}</p>}
      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] mt-4 flex gap-2 bg-white/95 py-3 backdrop-blur">
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

/**
 * Revisão de laudo descritivo (ecocardiograma, eletrocardiograma, ultrassom,
 * endoscopia...): a IA copia a conclusão e resume os achados; a pessoa confere
 * com o original e salva. O texto não é interpretado: vai para o médico como está.
 */
function ReportReview({ phase, preview, onCancel, onSaved, cancelLabel = "Cancelar" }: ReviewProps) {
  const ex = phase.extraction;
  const r = ex?.report;
  const [examName, setExamName] = useState(r?.examName ?? "");
  const [category, setCategory] = useState<ReportCategory>(r?.category ?? "imagem");
  const [lab, setLab] = useState(ex?.lab ?? "");
  const [date, setDate] = useState(ex?.examDate ?? "");
  const [conclusion, setConclusion] = useState(r?.conclusion ?? "");
  const [findings, setFindings] = useState(r?.findings ?? "");
  const [physician, setPhysician] = useState(r?.physician ?? "");
  const [showOriginal, setShowOriginal] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const isImage = phase.file.type.startsWith("image/");

  function submit() {
    setError(null);
    const report: DescriptiveReport = { examName, category, conclusion, findings: findings || undefined, physician: physician || undefined };
    start(async () => {
      const res = await saveExam({ file: phase.file, extractedBy: ex?.source ?? "manual", model: ex?.model, lab, examDate: date, results: [], report });
      if ("error" in res) setError(res.error);
      else {
        toast.success("Laudo salvo", { description: examName });
        onSaved(res.docId);
      }
    });
  }

  return (
    <div>
      <div className={`mb-4 rounded-2xl p-4 text-[15px] leading-relaxed ${ex?.source === "gemini" ? "bg-navy-50 text-ink" : "bg-warn-soft text-ink"}`}>
        {ex?.source === "gemini" && <>A IA identificou um <strong>laudo descritivo</strong> ({ex.model}): copiou a conclusão e resumiu os achados. Confira com o original antes de salvar.</>}
        {ex?.source === "simulado" && <>Leitura pré-gravada deste laudo de exemplo (IA desligada ou indisponível). Com uma chave da Gemini em Configurações, a leitura é feita ao vivo.</>}
        {!ex && <>Preencha o laudo a partir do original: o nome do exame e a conclusão são obrigatórios.</>}
      </div>
      {ex?.patientName && <p className="mb-2 text-sm text-muted">Nome no laudo: {ex.patientName}</p>}

      {preview && (
        <div className="mb-3">
          <button type="button" className="btn-quiet text-sm" onClick={() => setShowOriginal((v) => !v)}>
            {showOriginal ? "Esconder original" : "Comparar com o original"}
          </button>
          {showOriginal &&
            (isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Laudo original" className="mt-2 w-full rounded-2xl border border-line" />
            ) : (
              <iframe src={preview} title="Laudo original" className="mt-2 h-96 w-full rounded-2xl border border-line" />
            ))}
        </div>
      )}

      <div className="tile space-y-3">
        <label className="block">
          <span className="label">Exame</span>
          <input className="input font-medium" value={examName} onChange={(e) => setExamName(e.target.value)} placeholder="Ex.: Ecocardiograma transtorácico" />
        </label>
        <label className="block">
          <span className="label">Tipo</span>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value as ReportCategory)}>
            {(Object.keys(REPORT_CATEGORY_LABELS) as ReportCategory[]).map((k) => <option key={k} value={k}>{REPORT_CATEGORY_LABELS[k]}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="label">Clínica ou hospital</span>
            <input className="input" value={lab} onChange={(e) => setLab(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Data do exame</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
        </div>
        <label className="block">
          <span className="label">Conclusão (como está no laudo)</span>
          <textarea className="input min-h-28 py-3 leading-relaxed" value={conclusion} onChange={(e) => setConclusion(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Achados principais (opcional)</span>
          <textarea className="input min-h-24 py-3 leading-relaxed" value={findings} onChange={(e) => setFindings(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Médico que assina (opcional)</span>
          <input className="input" value={physician} onChange={(e) => setPhysician(e.target.value)} />
        </label>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted">O texto vai para o médico como está no laudo. O Elo não interpreta a conclusão.</p>

      {error && <p className="mt-3 rounded-2xl bg-danger-soft p-3 text-[15px] text-danger" role="alert">{error}</p>}
      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] mt-4 flex gap-2 bg-white/95 py-3 backdrop-blur">
        <button type="button" className="btn-secondary flex-1" onClick={onCancel} disabled={pending}>{cancelLabel}</button>
        <button type="button" className="btn-primary flex-[2]" onClick={submit} disabled={pending || !examName.trim() || !conclusion.trim() || !date}>
          {pending ? "Salvando…" : "Salvar laudo"}
        </button>
      </div>
    </div>
  );
}
