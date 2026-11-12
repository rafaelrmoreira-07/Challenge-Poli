"use client";

/*
 * Checkbox do shadcn/ui (variante Base UI), com o traço do check desenhado
 * como no "Checkbox check" do transitions.dev (caixa preenche, depois o traço).
 */
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { cn } from "@/lib/cn";

export function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "group/check relative flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-line-strong bg-white outline-none transition-colors duration-150 after:absolute after:-inset-2 data-checked:border-ink data-checked:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator keepMounted className="text-white">
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <path
            d="M2.5 7.5l3 3 6-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="[stroke-dasharray:14] [stroke-dashoffset:14] transition-[stroke-dashoffset] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-checked/check:[stroke-dashoffset:0] group-data-checked/check:delay-75"
          />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
