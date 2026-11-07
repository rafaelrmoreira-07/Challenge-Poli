"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveExam, type SaveExamInput } from "@/app/actions";
import { labStatus } from "@/lib/health";
import type { Extraction, ExtractedResult } from "@/lib/types";
import { CameraIcon, FileIcon, SparkIcon } from "./icons";
import { StatusBadge } from "./ui";

type Phase =
  | { step: "idle"; error?: string }
  | { step: "reading"; filename: string }
  | { step: "review"; uploadId: string; filename: string; mimeType: string; extraction: Extraction | null; warning?: string };

const SAMPLES = [
  { file: "laudo-vida-2026-11.pdf", type: "application/pdf", title: "PDF do laboratório", desc: "Laudo de nov/2026 com 14 exames" },
  { file: "exame-papel-2016.jpg", type: "image/jpeg", title: "Foto de exame em papel", desc: "Laudo antigo de 2016, fotografado" },
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

export function Uploader() {
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function upload(file: File) {
    setPreview(URL.createObjectURL(file));
    setPhase({ step: "reading", filename: file.name });
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch("/api/exames/extrair", { method: "POST", body });
      const json = await res.json();
      if (!json.uploadId) {
        setPhase({ step: "idle", error: json.error ?? "Não foi possível enviar o arquivo." });
        return;
      }
      setPhase({ step: "review", uploadId: json.uploadId, filename: json.filename, mimeType: json.mimeType, extraction: json.extraction, warning: json.error });
    } catch {
      setPhase({ step: "idle", error: "Falha de conexão. Tente de novo." });
    }
  }

  async function sendSample(s: (typeof SAMPLES)[number]) {
    const res = await fetch(`/exemplos/${s.file}`);
    const blob = await res.blob();
    await upload(new File([blob], s.file, { type: s.type }));
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) upload(f);
  };

  if (phase.step === "reading") return <Reading filename={phase.filename} preview={preview} />;
  if (phase.step === "review")
    return <Review phase={phase} preview={preview} onCancel={() => { setPhase({ step: "idle" }); setPreview(null); }} />;

  return (
    <div>
      {phase.error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{phase.error}</p>}
      <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={onPick} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => camRef.current?.click()} className="card flex flex-col items-center gap-2 py-6 hover:ring-brand-300">
          <CameraIcon className="h-8 w-8 text-brand-600" />
          <span className="text-sm font-semibold">Fotografar</span>
          <span className="text-[11px] text-slate-500">Exame em papel</span>
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className="card flex flex-col items-center gap-2 py-6 hover:ring-brand-300">
          <FileIcon className="h-8 w-8 text-brand-600" />
          <span className="text-sm font-semibold">Escolher arquivo</span>
          <span className="text-[11px] text-slate-500">PDF ou imagem, até 10 MB</span>
        </button>
      </div>

      <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">Laudos de exemplo (fictícios)</h2>
      <div className="space-y-2">
        {SAMPLES.map((s) => (
          <div key={s.file} className="card flex items-center gap-3 p-3">
            <FileIcon className="shrink-0 text-sky-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{s.title}</p>
              <p className="text-[11px] text-slate-500">{s.desc}</p>
            </div>
            <a href={`/exemplos/${s.file}`} target="_blank" rel="noopener" className="text-xs font-semibold text-slate-500">ver</a>
            <button type="button" onClick={() => sendSample(s)} className="btn-primary px-3 py-1.5 text-xs">Enviar</button>
          </div>
        ))}
      </div>
      <p className="mt-6 text-[11px] leading-relaxed text-slate-500">
        O arquivo é enviado para a Gemini API (Google) só para leitura. Use dados sintéticos ou seus próprios; dados de outra pessoa
        só com o consentimento dela.
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
      <SparkIcon className="h-10 w-10 animate-pulse text-brand-600" />
      <p className="mt-3 font-semibold">{STAGES[i]}</p>
      <p className="mt-1 text-xs text-slate-500">{filename}</p>
      <div className="mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-slate-200">
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
  const ex = phase.extraction;
  const [lab, setLab] = useState(ex?.lab ?? "");
  const [date, setDate] = useState(ex?.examDate ?? "");
  const [rows, setRows] = useState<Row[]>(() => (ex?.results ?? []).map(toRow));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [showOriginal, setShowOriginal] = useState(false);
  const nextId = useRef(1000);

  const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  function submit() {
    setError(null);
    const input: SaveExamInput = {
      uploadId: phase.uploadId,
      filename: phase.filename,
      mimeType: phase.mimeType,
      extractedBy: ex?.source ?? "simulado",
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
      if (res?.error) setError(res.error);
    });
  }

  const isImage = phase.mimeType.startsWith("image/");

  return (
    <div>
      <div className={`mb-3 rounded-xl px-3 py-2 text-sm ring-1 ${ex?.source === "gemini" ? "bg-brand-50 text-brand-900 ring-brand-200" : "bg-amber-50 text-amber-900 ring-amber-200"}`}>
        {ex?.source === "gemini" && <>A IA leu <strong>{rows.length} resultados</strong> ({ex.model}). Confira e corrija o que for preciso antes de salvar.</>}
        {ex?.source === "simulado" && <>A IA está indisponível agora. Mostrando a leitura pré-gravada deste laudo de exemplo.</>}
        {!ex && <>{phase.warning ?? "Não foi possível ler o laudo."} Você pode adicionar os resultados manualmente.</>}
      </div>
      {ex?.patientName && <p className="mb-2 text-xs text-slate-500">Nome no laudo: {ex.patientName}</p>}
      {ex?.notes && <p className="mb-2 text-xs text-slate-500">Observação da IA: {ex.notes}</p>}

      {preview && (
        <div className="mb-3">
          <button type="button" className="text-xs font-semibold text-brand-700" onClick={() => setShowOriginal((v) => !v)}>
            {showOriginal ? "Esconder original" : "Comparar com o original"}
          </button>
          {showOriginal &&
            (isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Laudo original" className="mt-2 w-full rounded-lg ring-1 ring-slate-200" />
            ) : (
              <iframe src={preview} title="Laudo original" className="mt-2 h-96 w-full rounded-lg ring-1 ring-slate-200" />
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
          return (
            <div key={r.id} className="card p-3">
              <div className="flex items-center gap-2">
                <input className="input flex-1 font-medium" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} aria-label="Exame" />
                <StatusBadge status={st} />
                <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} className="px-1 text-lg text-slate-400 hover:text-red-600" aria-label={`Remover ${r.name}`}>
                  ×
                </button>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2">
                <label><span className="label">Valor</span><input className="input" inputMode="decimal" value={r.value} onChange={(e) => update(r.id, { value: e.target.value })} placeholder={r.valueText ?? ""} /></label>
                <label><span className="label">Unidade</span><input className="input" value={r.unit} onChange={(e) => update(r.id, { unit: e.target.value })} /></label>
                <label><span className="label">Ref. mín.</span><input className="input" inputMode="decimal" value={r.refLow} onChange={(e) => update(r.id, { refLow: e.target.value })} /></label>
                <label><span className="label">Ref. máx.</span><input className="input" inputMode="decimal" value={r.refHigh} onChange={(e) => update(r.id, { refHigh: e.target.value })} /></label>
              </div>
              {r.refText && <p className="mt-1.5 text-[11px] text-slate-500">No laudo: {r.refText}</p>}
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

      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
      <div className="sticky bottom-20 mt-4 flex gap-2 rounded-2xl bg-[#f4f6f8]/90 py-2 backdrop-blur">
        <button type="button" className="btn-secondary flex-1" onClick={onCancel} disabled={pending}>Cancelar</button>
        <button type="button" className="btn-primary flex-[2]" onClick={submit} disabled={pending || !rows.length || !date}>
          {pending ? "Salvando…" : `Salvar ${rows.length} resultados`}
        </button>
      </div>
    </div>
  );
}
