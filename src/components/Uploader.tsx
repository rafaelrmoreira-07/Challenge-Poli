"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ageFrom } from "@/lib/dates";
import { ACCEPTED_TYPES, extractLabReport, fileType, MAX_UPLOAD_BYTES, NoKeyError } from "@/lib/extraction";
import { labStatus } from "@/lib/health";
import { asset } from "@/lib/paths";
import { stageOf } from "@/lib/quality";
import { getDbSnapshot, recordReadingReview, saveExam, useDb, type SaveExamInput } from "@/lib/store";
import type { Extraction, ExtractedResult } from "@/lib/types";
import { toast } from "sonner";
import { CameraIcon, CloseIcon, FileIcon } from "./icons";
import { ReadingSteps } from "./ReadingSteps";
import { SectionTitle, StatusBadge } from "./ui";

type Phase =
  | { step: "idle"; error?: string; needsKey?: boolean }
  | { step: "reading"; filename: string }
  | { step: "review"; file: File; extraction: Extraction | null; warning?: string };

const SAMPLES = [
  { file: "laudo-vida-2026-11.pdf", type: "application/pdf", title: "PDF do laboratório", desc: "Laudo de nov/2026 com 14 exames" },
  { file: "exame-papel-2016.jpg", type: "image/jpeg", title: "Foto de exame em papel", desc: "Laudo antigo de 2016, fotografado" },
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

export function Uploader() {
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function upload(picked: File) {
    const type = fileType(picked);
    if (!ACCEPTED_TYPES.includes(type)) return setPhase({ step: "idle", error: "Formato não aceito. Envie PDF, JPG, PNG, WEBP ou HEIC." });
    if (picked.size > MAX_UPLOAD_BYTES) return setPhase({ step: "idle", error: "Arquivo maior que 10 MB." });
    const file = picked.type ? picked : new File([picked], picked.name, { type });

    setPreview(URL.createObjectURL(file));
    setPhase({ step: "reading", filename: file.name });
    const { patient } = getDbSnapshot();
    try {
      // A leitura pré-gravada volta na hora; o mínimo de 3,5 s deixa as etapas da leitura legíveis
      const [extraction] = await Promise.all([
        extractLabReport(file, { sex: patient.sex, age: ageFrom(patient.birthDate) }),
        new Promise((r) => setTimeout(r, 3500)),
      ]);
      setPhase({ step: "review", file, extraction });
    } catch (err) {
      if (err instanceof NoKeyError) {
        setPreview(null);
        setPhase({ step: "idle", needsKey: true, error: "Para ler este laudo com IA, informe uma chave da Gemini em Configurações. Os dois laudos de exemplo abaixo funcionam sem chave." });
        return;
      }
      setPhase({ step: "review", file, extraction: null, warning: "A IA não conseguiu ler o laudo agora. Tente de novo ou preencha os resultados à mão." });
    }
  }

  async function sendSample(s: (typeof SAMPLES)[number]) {
    const res = await fetch(asset(`/exemplos/${s.file}`));
    const blob = await res.blob();
    await upload(new File([blob], s.file, { type: s.type }));
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) upload(f);
  };

  if (phase.step === "reading") return <ReadingSteps filename={phase.filename} preview={preview} />;
  if (phase.step === "review")
    return <Review phase={phase} preview={preview} onCancel={() => { setPhase({ step: "idle" }); setPreview(null); }} />;

  return (
    <div>
      {phase.error && (
        <p className="mb-4 rounded-2xl bg-danger-soft p-4 text-[15px] text-danger" role="alert">
          {phase.error}
          {phase.needsKey && <> <Link href="/configuracoes" className="font-medium underline underline-offset-4">Abrir Configurações</Link></>}
        </p>
      )}
      <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={onPick} />
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
          <span className="block text-xl font-normal tracking-[-0.02em]">Escolher um arquivo</span>
          <span className="block text-[15px] text-muted">PDF do laboratório ou imagem, até 10 MB</span>
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
});

function Review({ phase, preview, onCancel }: { phase: Extract<Phase, { step: "review" }>; preview: string | null; onCancel: () => void }) {
  const router = useRouter();
  const ex = phase.extraction;
  const [lab, setLab] = useState(ex?.lab ?? "");
  const [date, setDate] = useState(ex?.examDate ?? "");
  const [rows, setRows] = useState<Row[]>(() => (ex?.results ?? []).map(toRow));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [showOriginal, setShowOriginal] = useState(false);
  const nextId = useRef(1000);
  const stats = useDb()?.readingStats ?? {};
  const quick = rows.filter((r) => stageOf(stats[r.analyteKey]) === "rapida").length;

  const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

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
        router.push(`/exames/?novo=${res.docId}`);
      }
    });
  }

  const isImage = phase.file.type.startsWith("image/");

  return (
    <div>
      <div className={`mb-4 rounded-2xl p-4 text-[15px] leading-relaxed ${ex?.source === "gemini" ? "bg-navy-50 text-ink" : "bg-warn-soft text-ink"}`}>
        {ex?.source === "gemini" && <>A IA leu <strong>{rows.length} resultados</strong> ({ex.model}). Confira e corrija o que for preciso antes de salvar.</>}
        {ex?.source === "simulado" && <>Leitura pré-gravada deste laudo de exemplo (IA desligada ou indisponível). Com uma chave da Gemini em Configurações, a leitura é feita ao vivo.</>}
        {!ex && <>{phase.warning ?? "Não foi possível ler o laudo."} Você pode adicionar os resultados manualmente.</>}
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
          return (
            <div key={r.id} className="tile p-3">
              <div className="flex items-center gap-2">
                <input className="input flex-1 font-medium" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} aria-label="Exame" />
                <StatusBadge status={st} />
                {stageOf(stats[r.analyteKey]) === "rapida" && <span className="hidden rounded-full bg-ok-soft px-2 py-0.5 text-xs font-medium text-ok sm:inline">Sem correção</span>}
                <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-danger-soft hover:text-danger" aria-label={`Remover ${r.name || "resultado"}`}>
                  <CloseIcon width={18} />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label><span className="label">Valor</span><input className="input" inputMode="decimal" value={r.value} onChange={(e) => update(r.id, { value: e.target.value })} placeholder={r.valueText ?? ""} /></label>
                <label><span className="label">Unidade</span><input className="input" value={r.unit} onChange={(e) => update(r.id, { unit: e.target.value })} /></label>
                <label><span className="label">Ref. mín.</span><input className="input" inputMode="decimal" value={r.refLow} onChange={(e) => update(r.id, { refLow: e.target.value })} /></label>
                <label><span className="label">Ref. máx.</span><input className="input" inputMode="decimal" value={r.refHigh} onChange={(e) => update(r.id, { refHigh: e.target.value })} /></label>
              </div>
              {r.refText && <p className="mt-1.5 text-sm text-muted">No laudo: {r.refText}</p>}
            </div>
          );
        })}
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={() => setRows((rs) => [...rs, { id: nextId.current++, name: "", analyteKey: "", value: "", valueText: null, unit: "", refLow: "", refHigh: "", refText: null }])}
        >
          + Adicionar resultado
        </button>
      </div>

      {error && <p className="mt-3 rounded-2xl bg-danger-soft p-3 text-[15px] text-danger" role="alert">{error}</p>}
      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] mt-4 flex gap-2 bg-white/95 py-3 backdrop-blur">
        <button type="button" className="btn-secondary flex-1" onClick={onCancel} disabled={pending}>Cancelar</button>
        <button type="button" className="btn-primary flex-[2]" onClick={submit} disabled={pending || !rows.length || !date}>
          {pending ? "Salvando…" : `Salvar ${rows.length} resultados`}
        </button>
      </div>
    </div>
  );
}
