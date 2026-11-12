"use client";

import { useState } from "react";
import { toast } from "sonner";
import { addCheckIn } from "@/lib/store";
import { CHECKIN_SYMPTOMS, RED_FLAGS, type CheckInSymptom } from "@/lib/types";
import { Checkbox } from "./base/checkbox";
import { Switch } from "./base/switch";

/** Registro diário do pós-alta (apêndice C): sintomas e remédios. */
export function CheckInForm({ admissionId, onDone }: { admissionId: string; onDone?: () => void }) {
  const [symptoms, setSymptoms] = useState<CheckInSymptom[]>([]);
  const [tookMeds, setTookMeds] = useState(true);
  const toggle = (s: CheckInSymptom, on: boolean) => setSymptoms((xs) => (on ? [...xs, s] : xs.filter((x) => x !== s)));

  return (
    <form
      id="registro"
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        addCheckIn(admissionId, symptoms, tookMeds);
        const red = symptoms.some((s) => RED_FLAGS.includes(s));
        if (red) toast.error("Procure atendimento hoje", { description: "Se for forte ou estiver piorando, vá ao pronto-socorro ou ligue 192 agora. Se for leve, ligue para a equipe do hospital." });
        else if (symptoms.length) toast.warning("Registro salvo", { description: "Se o sintoma continuar amanhã, fale com a equipe." });
        else toast.success("Registro de hoje salvo", { description: "Sem sintomas. Até amanhã." });
        setSymptoms([]);
        onDone?.();
      }}
    >
      <fieldset>
        <legend className="label">Hoje você sentiu algum destes?</legend>
        <div className="divide-y divide-line rounded-2xl bg-white">
          {CHECKIN_SYMPTOMS.map((s) => (
            <label key={s} className="flex min-h-12 cursor-pointer items-center gap-3 px-4 text-[15px]">
              <Checkbox checked={symptoms.includes(s)} onCheckedChange={(on) => toggle(s, on)} />
              {s}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-white px-4 text-[15px]">
        Tomei os remédios de hoje
        <Switch checked={tookMeds} onCheckedChange={setTookMeds} />
      </label>
      <button className="btn-primary w-full">{symptoms.length ? "Salvar registro" : "Salvar: estou bem"}</button>
    </form>
  );
}
