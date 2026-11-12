"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { todayISO } from "@/lib/dates";
import { resetDemo, saveProfile } from "@/lib/store";
import { FileIcon, LogoMark, ShieldIcon, WatchIcon } from "./icons";
import { MAX_BATCH } from "./Uploader";

/**
 * Guia de boas-vindas do perfil "Começar do zero": explica em poucos passos
 * como o Elo funciona e pede o mínimo para começar (nome, nascimento, sexo).
 * O sexo é usado nas faixas de referência de alguns exames.
 */

const STEPS: { icon: React.ReactNode; title: string; body: React.ReactNode }[] = [
  {
    icon: <LogoMark width={44} height={44} />,
    title: "Seu histórico de saúde num lugar só",
    body: (
      <>
        <p>Exames de laboratórios diferentes, remédios, vacinas e os dados do seu relógio, organizados numa linha do tempo.</p>
        <p>Você vê como cada resultado mudou ao longo dos anos e, quando quiser, mostra tudo ao seu médico.</p>
      </>
    ),
  },
  {
    icon: <FileIcon width={40} className="text-brand-700" />,
    title: "Envie seus exames",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>Fotografe o laudo em papel ou envie o PDF do laboratório, até {MAX_BATCH} de uma vez.</li>
        <li>Exames antigos também valem: quanto mais anos, mais claro fica o que mudou.</li>
        <li>A IA lê cada laudo e você confere os valores antes de salvar. O que ela não conseguir ler com segurança aparece em amarelo.</li>
        <li>Recebeu um laudo novo? Envie no mesmo dia.</li>
      </ul>
    ),
  },
  {
    icon: <WatchIcon width={40} className="text-brand-700" />,
    title: "Relógio e anel inteligentes",
    body: (
      <>
        <p>Batimento, sono e atividade entram no mesmo histórico todos os dias, sem você precisar fazer nada.</p>
        <p>Se os dados mostrarem algo que vale levar ao médico, como batimentos irregulares, o Elo avisa.</p>
        <p className="text-sm text-ink-500">Neste perfil de demonstração ainda não há relógio conectado.</p>
      </>
    ),
  },
  {
    icon: <ShieldIcon width={40} className="text-brand-700" />,
    title: "Você decide quem vê",
    body: (
      <>
        <p>Para mostrar ao médico, você escolhe o que compartilhar e por quanto tempo, e pode encerrar o acesso quando quiser.</p>
        <p>O Elo não dá diagnóstico: organiza seus dados e indica quando procurar um médico.</p>
      </>
    ),
  },
];

export function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState<"F" | "M" | "">("");
  const [allergies, setAllergies] = useState("");
  const [error, setError] = useState<string | null>(null);
  const atForm = step === STEPS.length;
  const total = STEPS.length + 1;

  function finish(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setError("Informe o nome.");
    if (!birthDate || birthDate > todayISO() || birthDate < "1900-01-01") return setError("Informe uma data de nascimento válida.");
    if (!sex) return setError("Escolha o sexo.");
    saveProfile({
      name: name.trim().replace(/\s+/g, " "),
      birthDate,
      sex,
      allergies: allergies.split(/[,;]/).map((a) => a.trim()).filter(Boolean),
    });
    router.push("/enviar");
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-paper">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5" aria-label={`Passo ${step + 1} de ${total}`}>
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={`h-1.5 w-7 rounded-full ${i <= step ? "bg-brand-600" : "bg-ink-200"}`} />
            ))}
          </div>
          {!atForm && (
            <button type="button" onClick={() => setStep(STEPS.length)} className="min-h-11 px-2 text-sm font-semibold text-ink-600">
              Pular
            </button>
          )}
        </div>

        {!atForm ? (
          <section className="flex flex-1 flex-col pt-10" aria-live="polite">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-ink-200">{STEPS[step].icon}</div>
            <h1 className="mt-6 font-serif text-[1.9rem] font-semibold leading-tight text-ink-900">{STEPS[step].title}</h1>
            <div className="mt-4 space-y-3 text-[17px] leading-relaxed text-ink-700">{STEPS[step].body}</div>
            <div className="mt-auto flex gap-3 pt-10">
              {step > 0 && (
                <button type="button" className="btn-secondary flex-1" onClick={() => setStep(step - 1)}>
                  Voltar
                </button>
              )}
              <button type="button" className="btn-primary flex-[2]" onClick={() => setStep(step + 1)}>
                {step === STEPS.length - 1 ? "Criar meu perfil" : "Continuar"}
              </button>
            </div>
          </section>
        ) : (
          <form onSubmit={finish} onChange={() => setError(null)} className="flex flex-1 flex-col pt-8" noValidate>
            <h1 className="font-serif text-[1.9rem] font-semibold leading-tight text-ink-900">Para começar</h1>
            <p className="mt-2 text-[15px] text-ink-600">Só o essencial. O resto vem dos seus exames.</p>
            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="label">Nome</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Ex.: Carlos Mendes" />
              </label>
              <label className="block">
                <span className="label">Data de nascimento</span>
                <input className="input" type="date" value={birthDate} max={todayISO()} onChange={(e) => setBirthDate(e.target.value)} />
              </label>
              <fieldset>
                <legend className="label">Sexo</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(["F", "M"] as const).map((v) => (
                    <label key={v} className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border text-[15px] font-semibold ${sex === v ? "border-brand-600 bg-brand-50 text-brand-800" : "border-ink-300 bg-white text-ink-700"}`}>
                      <input type="radio" name="sex" value={v} checked={sex === v} onChange={() => setSex(v)} className="sr-only" />
                      {v === "F" ? "Feminino" : "Masculino"}
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-sm text-ink-500">Usado para escolher as faixas de referência de alguns exames.</p>
              </fieldset>
              <label className="block">
                <span className="label">Alergias (opcional)</span>
                <input className="input" value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="Ex.: dipirona, penicilina" />
              </label>
            </div>
            {error && <p className="mt-4 rounded-xl bg-danger-50 px-3 py-2 text-sm text-danger-700 ring-1 ring-danger-200" role="alert">{error}</p>}
            <p className="mt-6 text-sm text-ink-500">Tudo fica salvo neste navegador. Use dados fictícios ou os seus.</p>
            <div className="mt-auto flex flex-col gap-2 pt-8">
              <button type="submit" className="btn-primary w-full">Começar e enviar meu primeiro exame</button>
              <button type="button" className="btn-secondary w-full" onClick={() => setStep(STEPS.length - 1)}>Voltar</button>
              <button
                type="button"
                className="min-h-11 text-sm font-semibold text-brand-700 underline underline-offset-4"
                onClick={async () => {
                  await resetDemo("carlos");
                  router.push("/");
                }}
              >
                Prefiro ver um exemplo pronto (Carlos Mendes)
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
