"use client";

import { formatDate } from "@/lib/dates";
import { REPORT_CATEGORY_LABELS, type SourceDocument } from "@/lib/types";
import { FileIcon } from "./icons";

/** De onde veio o texto: o médico precisa saber se foi lido por IA e conferido. */
export const REPORT_SOURCE_LABEL: Record<SourceDocument["extractedBy"], string> = {
  gemini: "lido por IA e conferido pelo paciente",
  simulado: "leitura pré-gravada, conferida pelo paciente",
  manual: "digitado pelo paciente a partir do laudo",
  seed: "importado",
};

/** Documentos que são laudos descritivos, do mais recente para o mais antigo. */
export function reportDocuments(docs: SourceDocument[]): (SourceDocument & { report: NonNullable<SourceDocument["report"]> })[] {
  return docs
    .filter((d): d is SourceDocument & { report: NonNullable<SourceDocument["report"]> } => Boolean(d.report))
    .sort((a, b) => b.examDate.localeCompare(a.examDate));
}

/**
 * Laudos de imagem, coração e endoscopia: nome do exame, local, data e a
 * conclusão copiada do laudo. `openDoc` abre o original quando ele está no aparelho.
 */
export function ReportList({
  documents,
  openDoc,
  audience = "paciente",
  highlight,
}: {
  documents: SourceDocument[];
  openDoc?: (storedAs: string) => void;
  audience?: "paciente" | "medico";
  highlight?: string;
}) {
  const reports = reportDocuments(documents);
  if (!reports.length) return null;
  return (
    <ul className="space-y-2">
      {reports.map((d) => (
        <li key={d.id} className={`tile ${highlight === d.id ? "ring-2 ring-accent" : ""}`}>
          <div className="flex items-start gap-3">
            <FileIcon width={22} className="mt-0.5 shrink-0 text-ink-soft" />
            <div className="min-w-0 flex-1">
              <p className="num text-sm text-muted">
                {formatDate(d.examDate)} · {REPORT_CATEGORY_LABELS[d.report.category]}
              </p>
              <p className="text-[17px] font-medium leading-snug text-ink">{d.report.examName}</p>
              {d.lab && <p className="text-sm text-muted">{d.lab}{d.report.physician ? ` · ${d.report.physician}` : ""}</p>}
            </div>
            {d.storedAs && openDoc && (
              <button type="button" onClick={() => openDoc(d.storedAs!)} className="btn-secondary min-h-10 shrink-0 px-3 text-sm">
                {audience === "medico" ? "Original" : "Ver laudo"}
              </button>
            )}
          </div>
          <p className="mt-3 rounded-xl bg-white p-3 text-[15px] leading-relaxed text-ink">
            <span className="font-medium">Conclusão: </span>
            {d.report.conclusion}
          </p>
          {d.report.findings && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{d.report.findings}</p>}
          <p className="mt-2 text-xs text-muted">Texto do laudo, sem interpretação · {REPORT_SOURCE_LABEL[d.extractedBy]}</p>
        </li>
      ))}
    </ul>
  );
}
