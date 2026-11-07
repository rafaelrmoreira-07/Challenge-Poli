import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...p,
});

export const HomeIcon = (p: P) => (
  <svg {...base(p)}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>
);
export const TimelineIcon = (p: P) => (
  <svg {...base(p)}><path d="M12 3v18M7 6h-3M7 12H4M7 18H4M17 6h3M17 12h3M17 18h3" /><circle cx="12" cy="6" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="18" r="1.5" /></svg>
);
export const PlusIcon = (p: P) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
);
export const WatchIcon = (p: P) => (
  <svg {...base(p)}><rect x="6" y="6" width="12" height="12" rx="3" /><path d="M9 6l1-3h4l1 3M9 18l1 3h4l1-3M10 12h1l1-2 1 4 1-2h1" /></svg>
);
export const DoctorIcon = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="7" r="4" /><path d="M5 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2M15 14v3a2 2 0 1 0 4 0" /></svg>
);
export const HeartIcon = (p: P) => (
  <svg {...base(p)}><path d="M20.8 6.6a5.5 5.5 0 0 0-8.8-1.6 5.5 5.5 0 0 0-8.8 1.6C1.6 10 4.4 13.5 12 20c7.6-6.5 10.4-10 8.8-13.4z" /></svg>
);
export const MoonIcon = (p: P) => (
  <svg {...base(p)}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
);
export const DropIcon = (p: P) => (
  <svg {...base(p)}><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" /></svg>
);
export const GaugeIcon = (p: P) => (
  <svg {...base(p)}><path d="M12 14l4-4M3.5 17a9 9 0 1 1 17 0" /></svg>
);
export const AlertIcon = (p: P) => (
  <svg {...base(p)}><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4M12 17h.01" /></svg>
);
export const FileIcon = (p: P) => (
  <svg {...base(p)}><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>
);
export const PillIcon = (p: P) => (
  <svg {...base(p)}><rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)" /><path d="m8.5 8.5 7 7" /></svg>
);
export const SyringeIcon = (p: P) => (
  <svg {...base(p)}><path d="m18 2 4 4M15 5l4 4M17 7l-9.5 9.5-3-3L14 4M7.5 16.5 3 21M9 11l2 2M11.5 8.5l2 2" /></svg>
);
export const StethoscopeIcon = (p: P) => (
  <svg {...base(p)}><path d="M6 3v6a4 4 0 0 0 8 0V3M10 13v2a5 5 0 0 0 10 0v-3" /><circle cx="20" cy="10" r="2" /></svg>
);
export const CameraIcon = (p: P) => (
  <svg {...base(p)}><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.5" /></svg>
);
export const SparkIcon = (p: P) => (
  <svg {...base(p)}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></svg>
);
export const ShieldIcon = (p: P) => (
  <svg {...base(p)}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></svg>
);
export const ChevronRight = (p: P) => (
  <svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>
);
export const StepsIcon = (p: P) => (
  <svg {...base(p)}><path d="M8 3c-2 0-3 2-3 5s1 5 3 5 3-2 3-5-1-5-3-5zM6 15h4v2a2 2 0 0 1-4 0zM16 7c-2 0-3 2-3 5s1 5 3 5 3-2 3-5-1-5-3-5zM14 19h4v.5a2 2 0 0 1-4 0z" /></svg>
);
