import { SlidingTabs } from "./SlidingTabs";
import { PageHeader } from "./ui";

/** Cabeçalho da aba Médico: consulta, internação e acessos num lugar só. */
export function CareHeader({ active, children }: { active: "consulta" | "internacao" | "acessos"; children?: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Médico e hospital">{children}</PageHeader>
      <div className="mb-6">
        <SlidingTabs
          label="Médico e hospital"
          memoryKey="cuidado"
          active={active}
          items={[
            { key: "consulta", label: "Consulta", href: "/compartilhar" },
            { key: "internacao", label: "Internação", href: "/internacao" },
            { key: "acessos", label: "Acessos", href: "/acessos" },
          ]}
        />
      </div>
    </>
  );
}
