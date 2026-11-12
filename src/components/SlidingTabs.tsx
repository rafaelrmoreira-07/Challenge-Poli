"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";

/**
 * Controle segmentado com o seletor deslizante do transitions.dev
 * ("Tabs sliding", skills/transitions-dev/16-tabs-sliding.md).
 * Abas que são links (rotas diferentes) lembram a aba anterior para
 * o seletor deslizar dela até a atual quando a nova tela abre.
 */
type Item = { key: string; label: React.ReactNode; href?: string };

export function SlidingTabs({ items, active, onChange, label, memoryKey }: { items: Item[]; active: string; onChange?: (key: string) => void; label: string; memoryKey?: string }) {
  const bar = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const b = bar.current;
    const p = pill.current;
    if (!b || !p) return;
    const place = (key: string, animate: boolean) => {
      const el = b.querySelector<HTMLElement>(`[data-tab="${CSS.escape(key)}"]`);
      if (!el) return;
      if (!animate) p.style.transition = "none";
      p.style.width = `${el.offsetWidth}px`;
      p.style.transform = `translateX(${el.offsetLeft - 3}px)`;
      if (!animate) {
        void p.offsetWidth;
        p.style.transition = "";
      }
    };
    const prev = memoryKey ? sessionStorage.getItem(`tabs:${memoryKey}`) : null;
    if (prev && prev !== active) {
      place(prev, false);
      requestAnimationFrame(() => place(active, true));
    } else {
      place(active, !!p.style.width);
    }
    if (memoryKey) sessionStorage.setItem(`tabs:${memoryKey}`, active);
    const ro = new ResizeObserver(() => place(active, false));
    ro.observe(b);
    return () => ro.disconnect();
  }, [active, memoryKey]);

  return (
    <div ref={bar} className="t-tabs" role={items[0]?.href ? undefined : "group"} aria-label={label}>
      <span ref={pill} className="t-tabs-pill" aria-hidden />
      {items.map((it) =>
        it.href ? (
          <Link key={it.key} href={it.href} data-tab={it.key} className="t-tab" aria-current={active === it.key ? "page" : undefined}>
            {it.label}
          </Link>
        ) : (
          <button key={it.key} type="button" data-tab={it.key} className="t-tab" aria-pressed={active === it.key} onClick={() => onChange?.(it.key)}>
            {it.label}
          </button>
        ),
      )}
    </div>
  );
}
