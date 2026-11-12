"use client";

import { needsOnboarding } from "@/lib/personas";
import { useDb } from "@/lib/store";
import { Onboarding } from "./Onboarding";

/** Mostra o guia de boas-vindas por cima do app enquanto o perfil não tem cadastro. */
export function OnboardingGate() {
  const db = useDb();
  return db && needsOnboarding(db) ? <Onboarding /> : null;
}
