import Link from "next/link";

export function HistoryTabs({ active }: { active: "timeline" | "exames" }) {
  const tab = (key: "timeline" | "exames", href: string, label: string) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`flex-1 rounded-lg py-1.5 text-center text-sm font-semibold ${active === key ? "bg-white text-brand-700 shadow-sm" : "text-slate-600"}`}
    >
      {label}
    </Link>
  );
  return (
    <div className="mb-4 flex gap-1 rounded-xl bg-slate-200/70 p-1">
      {tab("timeline", "/historico", "Linha do tempo")}
      {tab("exames", "/exames", "Exames")}
    </div>
  );
}
