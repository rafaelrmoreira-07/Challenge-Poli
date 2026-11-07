"use client";

import Link from "next/link";
import { useState } from "react";
import { useAiEnabled } from "@/components/AiStatus";
import { SectionTitle } from "@/components/ui";
import { MODELS, setGeminiKey, testGeminiKey } from "@/lib/gemini";

export default function ConfiguracoesPage() {
  const enabled = useAiEnabled();
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<{ tone: "ok" | "erro" | "info"; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setGeminiKey(key);
    setKey("");
    setTesting(true);
    setStatus({ tone: "info", text: "Testando a chave…" });
    const r = await testGeminiKey();
    setTesting(false);
    if (r.ok) setStatus({ tone: "ok", text: `Chave funcionando (${r.model}). A leitura de laudos e o resumo do médico usam IA ao vivo.` });
    else {
      if (r.error === "Chave inválida.") setGeminiKey(null);
      setStatus({ tone: "erro", text: r.error });
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>

      <SectionTitle>Inteligência artificial</SectionTitle>
      <div className="card space-y-3 text-sm">
        <p className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${enabled ? "bg-emerald-500" : "bg-slate-300"}`} />
          {enabled == null ? "…" : enabled ? "IA ligada neste navegador" : "IA desligada"}
        </p>
        <p className="text-slate-600">
          A leitura de laudos e o resumo para o médico usam a Gemini API. Crie uma chave gratuita no{" "}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="font-semibold text-brand-700 underline">Google AI Studio</a>{" "}
          e cole abaixo.
        </p>
        <form onSubmit={save} className="flex gap-2">
          <input
            type="password"
            className="input"
            placeholder="Cole a chave aqui"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
            aria-label="Chave da Gemini API"
          />
          <button className="btn-primary shrink-0" disabled={testing || !key.trim()}>Salvar</button>
        </form>
        {status && (
          <p className={`rounded-lg px-3 py-2 text-xs ${status.tone === "ok" ? "bg-emerald-50 text-emerald-800" : status.tone === "erro" ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-600"}`}>
            {status.text}
          </p>
        )}
        {enabled && (
          <button type="button" className="btn-danger w-full" onClick={() => { setGeminiKey(null); setStatus(null); }}>
            Remover chave deste navegador
          </button>
        )}
        <p className="text-[11px] leading-relaxed text-slate-500">
          A chave fica salva só neste navegador e vai direto para o Google; o site não guarda nem envia para outro lugar.
          Não salve sua chave em computadores compartilhados. Modelos usados, em ordem: {MODELS.join(", ")}.
        </p>
      </div>

      <SectionTitle>Usar como app no celular</SectionTitle>
      <div className="card space-y-2 text-sm text-slate-700">
        <p><strong>iPhone (Safari):</strong> toque em Compartilhar e depois em <em>Adicionar à Tela de Início</em>.</p>
        <p><strong>Android (Chrome):</strong> toque no menu ⋮ e depois em <em>Instalar app</em> ou <em>Adicionar à tela inicial</em>.</p>
        <p className="text-[11px] text-slate-500">O ícone do Elo Saúde aparece na tela inicial e o app abre em tela cheia.</p>
      </div>

      <SectionTitle>Apresentação</SectionTitle>
      <div className="card space-y-2 text-sm">
        <p className="text-slate-600">Tela para projetar: o app do paciente num celular e a visão do médico lado a lado.</p>
        <Link href="/demo" className="btn-secondary w-full">Abrir modo apresentação</Link>
      </div>

      <SectionTitle>Privacidade</SectionTitle>
      <p className="card text-[12px] leading-relaxed text-slate-600">
        Todo o histórico fica salvo neste navegador. Para apagar tudo e voltar aos dados de demonstração, use Início → Controles da demonstração → Restaurar.
      </p>
    </div>
  );
}
