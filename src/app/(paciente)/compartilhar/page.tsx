import { CareHeader } from "@/components/CareHeader";
import { ShareForm } from "@/components/ShareForm";

export default function CompartilharPage() {
  return (
    <div>
      <CareHeader active="consulta">Um link para o médico ver exames, remédios e medições numa tela só. Você escolhe o quê e por quanto tempo.</CareHeader>
      <ShareForm />
    </div>
  );
}
