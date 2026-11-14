"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { todayISO } from "@/lib/dates";
import { resetDemo, saveProfile, useDb } from "@/lib/store";
import type { Patient } from "@/lib/types";

/**
 * Perfil de saúde e contato de emergência (ideia do Plinio, reescrita sobre o
 * visual atual). O que é salvo aqui aparece no topo da tela do médico.
 */
export function ProfileSettings() {
  const db = useDb();
  if (!db) return <div className="tile h-40 animate-pulse" />;
  // key: recria o formulário quando a persona muda
  return <ProfileForm key={`${db.personaId}-${db.createdAt}`} patient={db.patient} />;
}

function ProfileForm({ patient }: { patient: Patient }) {
  const [name, setName] = useState(patient.name);
  const [birthDate, setBirthDate] = useState(patient.birthDate);
  const [sex, setSex] = useState<"F" | "M">(patient.sex);
  const [bloodType, setBloodType] = useState(patient.bloodType ?? "");
  const [allergies, setAllergies] = useState(patient.allergies.join(", "));
  const [ecName, setEcName] = useState(patient.emergencyContact?.name ?? "");
  const [ecPhone, setEcPhone] = useState(patient.emergencyContact?.phone ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Informe o nome.");
    if (!birthDate) return setError("Informe a data de nascimento.");
    if (!!ecName.trim() !== !!ecPhone.trim()) return setError("Para o contato de emergência, informe nome e telefone.");
    setError(null);
    saveProfile({
      name: name.trim(),
      birthDate,
      sex,
      bloodType,
      allergies: allergies.split(/[,;]/).map((a) => a.trim()).filter(Boolean),
      emergencyContact: ecName.trim() ? { name: ecName, phone: ecPhone } : null,
    });
    toast.success("Perfil salvo");
  }

  return (
    <form onSubmit={submit} className="tile space-y-3">
      <label className="block">
        <span className="label">Nome</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="label">Nascimento</span>
          <input className="input" type="date" value={birthDate} max={todayISO()} onChange={(e) => setBirthDate(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Tipo sanguíneo</span>
          <select className="input" value={bloodType} onChange={(e) => setBloodType(e.target.value)}>
            <option value="">Não sei</option>
            {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
      </div>
      <fieldset>
        <legend className="label">Sexo</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["F", "M"] as const).map((v) => (
            <label key={v} className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border text-[15px] font-medium transition-colors ${sex === v ? "border-ink bg-navy-50 text-ink" : "border-line-strong bg-white text-ink-soft"}`}>
              <input type="radio" name="perfil-sexo" value={v} checked={sex === v} onChange={() => setSex(v)} className="sr-only" />
              {v === "F" ? "Feminino" : "Masculino"}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="label">Alergias</span>
        <input className="input" value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="Ex.: dipirona, penicilina" />
      </label>
      <p className="pt-1 text-[15px] font-medium text-ink">Contato de emergência</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="label">Nome</span>
          <input className="input" value={ecName} onChange={(e) => setEcName(e.target.value)} placeholder="Ex.: Marta (esposa)" />
        </label>
        <label className="block">
          <span className="label">Telefone</span>
          <input className="input" type="tel" inputMode="tel" value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} placeholder="(11) 90000-0000" />
        </label>
      </div>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <button className="btn-primary w-full">Salvar perfil</button>
    </form>
  );
}

/** Apagar tudo deste aparelho (direito do titular, LGPD art. 18). Volta ao app vazio. */
export function DeleteMyData() {
  const router = useRouter();
  return (
    <div className="tile space-y-3">
      <p className="text-[15px] leading-relaxed text-muted">
        Todo o histórico fica salvo só neste navegador. Apagar remove exames, laudos, medições, acessos de médicos e a conversa deste aparelho. Links já enviados a médicos expiram no prazo escolhido.
      </p>
      <button
        type="button"
        className="btn-danger w-full"
        onClick={async () => {
          if (!confirm("Apagar todos os seus dados deste aparelho? Não dá para desfazer.")) return;
          await resetDemo("nova");
          toast.success("Dados apagados");
          router.push("/");
        }}
      >
        Apagar meus dados
      </button>
    </div>
  );
}
