"use client";

/*
 * Sonner (Emil Kowalski) com o visual do Elo Saúde. Fica no layout raiz;
 * qualquer tela chama toast() de "sonner". Os avisos aparecem no topo,
 * longe da barra de navegação inferior.
 */
import { Toaster as Sonner } from "sonner";
import { AlertIcon, CheckIcon, UrgentIcon } from "@/components/icons";

export function Toaster() {
  return (
    <Sonner
      position="top-center"
      offset={12}
      mobileOffset={12}
      gap={8}
      visibleToasts={3}
      icons={{
        success: <CheckIcon width={18} />,
        warning: <AlertIcon width={18} />,
        error: <UrgentIcon width={18} />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-2xl !border-0 !bg-ink !text-white !shadow-[0_12px_32px_-8px_rgb(20_28_51/0.45)] !font-sans !text-[15px] !gap-3 !p-3.5",
          title: "!font-medium !text-white",
          description: "!text-navy-100 !text-sm",
          actionButton: "!rounded-lg !bg-accent !text-ink !font-medium !text-sm !h-9 !px-3",
          cancelButton: "!rounded-lg !bg-white/10 !text-white !text-sm !h-9 !px-3",
          icon: "!text-accent",
        },
      }}
    />
  );
}
