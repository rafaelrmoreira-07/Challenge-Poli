"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useAiEnabled } from "@/components/AiStatus";
import { Switch } from "@/components/base/switch";
import { DataPortability } from "@/components/DataPortability";
import { DeleteMyData, ProfileSettings } from "@/components/ProfileSettings";
import { ReadingQuality } from "@/components/ReadingQuality";
import { PageHeader, SectionTitle } from "@/components/ui";
import { MODELS, setGeminiKey, testGeminiKey } from "@/lib/gemini";

export default function ConfiguracoesPage() {
  const enabled = useAiEnabled();
  const [key, setKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setGeminiKey(key);
    setKey("");
    setError(null);
    setTesting(true);
    const id = toast.loading("Testando a chave…");
    const r = await testGeminiKey();
    setTesting(false);
    if (r.ok) {
      toast.success("Leitura de laudos ligada", { id, description: `Modelo ${r.model}` });
    } else {
      if (r.error === "Chave inválida.") setGeminiKey(null);
      toast.error("A chave não funcionou", { id, description: r.error });
      setError(r.error);
    }
  }

  return (
    <div>
      <PageHeader title="Configurações" />
      <SectionTitle id="perfil">Seu perfil</SectionTitle>
      <ProfileSettings />


      <SectionTitle>Leitura de laudos</SectionTitle>
      <div className="tile space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[15px] font-medium" id="ia-estado">{enabled == null ? "…" : enabled ? "Ligada neste aparelho" : "Desligada"}</p>
            <p className="text-sm text-muted">Usa a Gemini para ler fotos e PDFs de laudos.</p>
          </div>
          <Switch
            aria-labelledby="ia-estado"
            checked={Boolean(enabled)}
            onCheckedChange={(on) => {
              if (!on) {
                setGeminiKey(null);
                toast("Leitura de laudos desligada", { description: "A chave foi apagada deste aparelho." });
              } else {
                document.getElementById("chave")?.focus();
              }
            }}
          />
        </div>
        {!enabled && (
          <form onSubmit={save} className="space-y-2">
            <label htmlFor="chave" className="label">Chave da Gemini</label>
            <div className="flex gap-2">
              <input id="chave" type="password" className="input" placeholder="Cole a chave aqui" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" autoCapitalize="none" autoCorrect="off" />
              <button className="btn-primary shrink-0" disabled={testing || !key.trim()}>Salvar</button>
            </div>
            {error && <p className="text-sm text-danger" role="alert">{error}</p>}
            <p className="text-sm text-muted">
              Crie uma chave gratuita no{" "}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="font-medium text-ink underline underline-offset-4">Google AI Studio</a>.
            </p>
          </form>
        )}
        <p className="text-sm leading-relaxed text-muted">
          A chave fica só neste navegador e vai direto para o Google. Não salve em computador compartilhado. Modelos, em ordem: {MODELS.join(", ")}.
        </p>
      </div>

      <SectionTitle id="qualidade">Qualidade da leitura</SectionTitle>
      <ReadingQuality />

      <SectionTitle id="dados">Seus dados em outros sistemas</SectionTitle>
      <DataPortability />

      <SectionTitle>Usar como app</SectionTitle>
      <div className="tile space-y-2 text-[15px] leading-relaxed">
        <p><span className="font-medium">iPhone (Safari):</span> Compartilhar, depois Adicionar à Tela de Início.</p>
        <p><span className="font-medium">Android (Chrome):</span> menu de três pontos, depois Instalar app.</p>
      </div>

      <SectionTitle>Apresentação</SectionTitle>
      <div className="tile space-y-3">
        <p className="text-[15px] text-muted">O app do paciente e a tela do médico lado a lado, para projetar, e os indicadores que um hospital ou plano pagaria por resultado.</p>
        <Link href="/demo" className="btn-secondary w-full">Abrir modo apresentação</Link>
        <Link href="/impacto" className="btn-secondary w-full">Ver indicadores de resultado</Link>
      </div>

      <SectionTitle>Privacidade</SectionTitle>
      <DeleteMyData />
    </div>
  );
}
