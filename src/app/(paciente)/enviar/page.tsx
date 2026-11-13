import Link from "next/link";
import { BackIcon } from "@/components/icons";
import { PageHeader } from "@/components/ui";
import { Uploader } from "@/components/Uploader";

export default function EnviarPage() {
  return (
    <div>
      <Link href="/historico" className="-ml-2 inline-flex min-h-11 items-center gap-1.5 px-2 text-[15px] font-medium text-ink">
        <BackIcon width={20} /> Histórico
      </Link>
      <PageHeader title="Adicionar ao histórico">
        Laudos em papel ou PDF e os dados exportados do relógio. A leitura organiza tudo e você confere antes de salvar.
      </PageHeader>
      <Uploader />
    </div>
  );
}
