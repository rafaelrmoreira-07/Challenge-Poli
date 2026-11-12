import type { Metadata } from "next";
import { OnboardingGate } from "@/components/OnboardingGate";
import { ChatView } from "@/components/views/ChatView";

export const metadata: Metadata = {
  title: "Conversa · Elo Saúde",
};

/** Conversa com o Elo em tela cheia, sem a barra inferior, como um chat no celular. */
export default function ConversaPage() {
  return (
    <>
      <ChatView />
      <OnboardingGate />
    </>
  );
}
