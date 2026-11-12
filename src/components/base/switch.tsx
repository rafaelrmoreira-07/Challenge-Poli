"use client";

/*
 * Switch do shadcn/ui (variante Base UI, apps/v4/registry/bases/base/ui/switch.tsx),
 * com as cores e tamanhos do Elo Saúde. Base UI cuida de teclado e acessibilidade.
 */
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@/lib/cn";

export function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "group/switch relative inline-flex h-7 w-12 shrink-0 items-center rounded-full bg-line-strong p-0.5 outline-none transition-colors duration-200 after:absolute after:-inset-x-3 after:-inset-y-2 data-checked:bg-ink data-disabled:cursor-not-allowed data-disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block h-6 w-6 rounded-full bg-white shadow-[0_1px_3px_rgb(31_43_77/0.25)] transition-transform duration-250 ease-[cubic-bezier(0.34,1.36,0.64,1)] data-checked:translate-x-5"
      />
    </SwitchPrimitive.Root>
  );
}
