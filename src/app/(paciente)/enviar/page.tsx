import { Uploader } from "@/components/Uploader";

export default function EnviarPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Enviar exame</h1>
      <p className="mb-4 mt-1 text-sm text-slate-600">
        Fotografe um laudo em papel ou envie o PDF do laboratório. A IA lê cada resultado com a faixa de referência, e você confere antes de salvar.
      </p>
      <Uploader />
    </div>
  );
}
