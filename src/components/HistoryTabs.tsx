import Link from "next/link";

export function HistoryTabs({ active }: { active: "timeline" | "exames" }) {
  const tab = (key: "timeline" | "exames", href: string, label: string) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`-mb-px flex min-h-11 flex-1 items-center justify-center border-b-[3px] text-[15px] font-semibold transition-colors ${active === key ? "border-brand-600 text-brand-800" : "border-transparent text-ink-500 hover:text-ink-800"}`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Seções do histórico" className="mb-5 flex border-b border-ink-200">
      {tab("timeline", "/historico", "Linha do tempo")}
      {tab("exames", "/exames", "Exames")}
    </nav>
  );
}
