"use client";

/*
 * Busca de exames com cmdk (filtra e ordena, navegação por teclado,
 * ⌘K / Ctrl+K no computador) dentro de uma gaveta do Vaul.
 */
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Drawer } from "vaul";
import { analyteSeries, fmt } from "@/lib/health";
import { useDb } from "@/lib/store";
import { openChat } from "@/lib/chatOpen";
import { BedIcon, ChartIcon, ChatIcon, DoctorIcon, DownloadIcon, ScanIcon, SearchIcon, VitalsIcon } from "./icons";

/** Todas as funcionalidades, para a busca achar pelo nome ou por palavras do dia a dia. */
const FEATURES: { label: string; hint: string; keywords: string; href?: string; icon: typeof SearchIcon }[] = [
  { label: "Conversar com o Elo", hint: "Perguntas, alertas e envio de exame pelo chat", keywords: "chat conversa assistente ajuda pergunta", icon: ChatIcon },
  { label: "Adicionar exame", hint: "Foto ou PDF do laudo", keywords: "enviar laudo foto pdf resultado upload", href: "/enviar", icon: ScanIcon },
  { label: "Relatório para o médico", hint: "Link com prazo para a consulta", keywords: "consulta compartilhar link medico", href: "/compartilhar", icon: DoctorIcon },
  { label: "Internação", hint: "Pasta para o hospital, alta e pós-alta", keywords: "cirurgia hospital autorizacao plano alta pos-alta internar", href: "/internacao", icon: BedIcon },
  { label: "Quem tem acesso", hint: "Ver e revogar links", keywords: "revogar acesso links compartilhados", href: "/acessos", icon: DoctorIcon },
  { label: "Sinais do relógio e da pressão", hint: "Gráficos de 14 a 90 dias", keywords: "pressao batimentos sono saturacao relogio wearable", href: "/wearables", icon: VitalsIcon },
  { label: "Baixar ou importar histórico (FHIR)", hint: "Levar para outro sistema ou trazer de lá", keywords: "exportar importar fhir rnds meu sus digital dados", href: "/configuracoes#dados", icon: DownloadIcon },
  { label: "Qualidade da leitura", hint: "Quanto você corrigiu dos laudos lidos", keywords: "ia leitura correcao precisao", href: "/configuracoes#qualidade", icon: ScanIcon },
  { label: "Indicadores de resultado", hint: "O que hospitais e planos pagariam", keywords: "impacto metricas resultado negocio", href: "/impacto", icon: ChartIcon },
];
import { StatusBadge } from "./ui";

export function ExamSearch({ variant = "field" }: { variant?: "field" | "icon" }) {
  const [open, setOpen] = useState(false);
  const db = useDb();
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const series = db ? analyteSeries(db.labResults) : [];
  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        {variant === "icon" ? (
          <button type="button" aria-label="Buscar exame ou funcionalidade" className="flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface">
            <SearchIcon width={22} />
          </button>
        ) : (
          <button type="button" className="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-surface px-4 text-left text-[15px] text-muted transition-colors hover:bg-surface-2">
            <SearchIcon width={20} className="text-ink" />
            Buscar exame ou funcionalidade
          </button>
        )}
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-navy-900/40" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[85dvh] max-w-md flex-col rounded-t-[28px] bg-white outline-none">
          <div className="mx-auto mt-3 h-1.5 w-11 shrink-0 rounded-full bg-line-strong" aria-hidden />
          <Drawer.Title className="sr-only">Buscar</Drawer.Title>
          <Drawer.Description className="sr-only">Digite o nome de um exame ou do que você quer fazer.</Drawer.Description>
          <Command label="Buscar exame" className="flex min-h-0 flex-1 flex-col">
            <div className="mx-5 mt-4 flex items-center gap-3 rounded-2xl bg-surface px-4 outline-ink focus-within:outline-2">
              <SearchIcon width={20} className="shrink-0 text-ink" />
              <Command.Input autoFocus placeholder="Exame ou o que você quer fazer" className="min-h-12 w-full bg-transparent text-base text-ink outline-none placeholder:text-muted focus-visible:outline-none" />
            </div>
            <Command.List className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <Command.Empty className="px-2 py-6 text-[15px] text-muted">Nada com esse nome. Tente outra palavra, ou pergunte na conversa.</Command.Empty>
              <Command.Group heading="Exames" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-sm [&_[cmdk-group-heading]]:text-muted">
                {series.map((s) => (
                  <Command.Item
                    key={s.key}
                    value={`${s.name} ${s.key}`}
                    onSelect={() => go(`/exame/?a=${encodeURIComponent(s.key)}`)}
                    className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-2 py-2 data-[selected=true]:bg-navy-50"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-ink">{s.name}</span>
                      <span className="block text-sm text-muted">{s.category}</span>
                    </span>
                    <span className="num text-[15px] font-medium text-ink">
                      {s.latest.value != null ? fmt(s.latest.value) : s.latest.valueText} <span className="text-xs font-normal text-muted">{s.unit}</span>
                    </span>
                    <StatusBadge status={s.status} />
                  </Command.Item>
                ))}
              </Command.Group>
              <Command.Group heading="O que dá para fazer" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-sm [&_[cmdk-group-heading]]:text-muted">
                {FEATURES.map((f) => (
                  <Command.Item
                    key={f.label}
                    value={`${f.label} ${f.keywords}`}
                    onSelect={() => {
                      if (f.href) go(f.href);
                      else {
                        setOpen(false);
                        setTimeout(openChat, 250);
                      }
                    }}
                    className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-2 py-2 data-[selected=true]:bg-navy-50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-ink"><f.icon width={18} /></span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-medium text-ink">{f.label}</span>
                      <span className="block text-sm text-muted">{f.hint}</span>
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
