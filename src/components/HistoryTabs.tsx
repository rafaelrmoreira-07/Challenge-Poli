"use client";

import Link from "next/link";
import { PlusIcon } from "./icons";
import { SlidingTabs } from "./SlidingTabs";
import { PageHeader } from "./ui";

/** Cabeçalho comum das duas abas do Histórico. */
export function HistoryHeader({ active }: { active: "timeline" | "exames" }) {
  return (
    <>
      <PageHeader
        title="Histórico"
        action={
          <div className="flex items-center gap-1">
            <Link href="/enviar" className="btn-primary min-h-11 px-4 text-sm">
              <PlusIcon width={16} /> Adicionar
            </Link>
          </div>
        }
      />
      <div className="mb-6">
        <SlidingTabs
          label="Seções do histórico"
          memoryKey="historico"
          active={active}
          items={[
            { key: "timeline", label: "Linha do tempo", href: "/historico" },
            { key: "exames", label: "Exames", href: "/exames" },
          ]}
        />
      </div>
    </>
  );
}
