import { CareHeader } from "@/components/CareHeader";
import { Shares } from "@/components/care/Shares";

export default function AcessosPage() {
  return (
    <div>
      <CareHeader active="acessos">Quem pode ver seu histórico agora, quantas vezes abriu e até quando. Segure o botão para revogar.</CareHeader>
      <Shares />
    </div>
  );
}
