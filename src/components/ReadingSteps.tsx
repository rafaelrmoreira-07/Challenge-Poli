"use client";

/*
 * Etapas da leitura do laudo, adaptadas do ThinkingState ("Steps") do
 * Beautiful UI (https://github.com/slev12397/beautiful-ui, MIT, Shane Levine / Turbo):
 * cada etapa entra subindo, mostra um indicador girando e vira um check
 * quando a próxima começa. O título brilha (shimmer) enquanto trabalha.
 */
import { useEffect, useState } from "react";

const STEPS = ["Recebendo o arquivo", "Lendo o documento", "Separando cada exame", "Conferindo unidades e referências"];
const DELAYS = [700, 1800, 2400];

export function ReadingSteps({ filename, preview }: { filename: string; preview: string | null }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= STEPS.length - 1) return;
    const t = setTimeout(() => setStep((s) => s + 1), DELAYS[step] ?? 2400);
    return () => clearTimeout(t);
  }, [step]);

  const isImage = /\.(jpe?g|png|webp|heic|heif)$/i.test(filename);

  return (
    <section className="tile" aria-busy="true" aria-label="Lendo o laudo">
      <div className="flex items-start gap-4">
        {preview && isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-24 w-20 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className="flex h-24 w-20 shrink-0 flex-col justify-center gap-1.5 rounded-xl bg-white px-3" aria-hidden>
            {[90, 70, 85, 55, 75].map((w, i) => <span key={i} className="h-1.5 rounded-full bg-line" style={{ width: `${w}%` }} />)}
          </span>
        )}
        <div className="min-w-0">
          <p role="status" className="t-shimmer text-[17px] font-medium">
            Lendo o laudo
          </p>
          <p className="mt-0.5 truncate text-sm text-muted">{filename}</p>
        </div>
      </div>

      <ol className="relative ml-[7px] mt-5 border-l border-line pl-5">
        {STEPS.slice(0, step + 1).map((s, i) => {
          const done = i < step;
          return (
            <li key={s} className="t-step relative flex min-h-9 items-center gap-2.5 text-[15px]" style={{ animationDelay: "0ms" }}>
              <span className="absolute -left-[27px] flex h-3.5 w-3.5 items-center justify-center bg-surface">
                {done ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-ok)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : (
                  <span className="t-spin h-3 w-3 rounded-full border-[1.5px] border-line-strong border-t-ink" aria-hidden />
                )}
              </span>
              <span className={done ? "text-muted" : "font-medium text-ink"}>{s}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
