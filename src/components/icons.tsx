import type { SVGProps } from "react";
import {
  ArrowDownIcon as PhArrowDown,
  ArrowLeftIcon as PhArrowLeft,
  ArrowUpIcon as PhArrowUp,
  CameraIcon as PhCamera,
  CaretDownIcon as PhCaretDown,
  CaretRightIcon as PhCaretRight,
  ChatCircleTextIcon as PhChat,
  CheckIcon as PhCheck,
  ChecksIcon as PhChecks,
  ClipboardTextIcon as PhClipboardText,
  ClockCounterClockwiseIcon as PhClock,
  CalendarBlankIcon as PhCalendar,
  CopyIcon as PhCopy,
  DropIcon as PhDrop,
  FileTextIcon as PhFileText,
  FootprintsIcon as PhSteps,
  GaugeIcon as PhGauge,
  GearSixIcon as PhGear,
  HeartbeatIcon as PhHeartbeat,
  HeartIcon as PhHeart,
  HouseIcon as PhHouse,
  MinusIcon as PhMinus,
  MoonIcon as PhMoon,
  PaperclipIcon as PhPaperclip,
  PaperPlaneRightIcon as PhSend,
  PhoneIcon as PhPhone,
  PillIcon as PhPill,
  PlusIcon as PhPlus,
  ScanIcon as PhScan,
  MagnifyingGlassIcon as PhSearch,
  ShieldCheckIcon as PhShieldCheck,
  StethoscopeIcon as PhStethoscope,
  SyringeIcon as PhSyringe,
  TestTubeIcon as PhTestTube,
  WarningIcon as PhWarning,
  WarningOctagonIcon as PhWarningOctagon,
  WatchIcon as PhWatch,
  XIcon as PhX,
} from "@phosphor-icons/react/ssr";
import type { Icon as PhIcon, IconWeight } from "@phosphor-icons/react/lib";

/**
 * Ícones do app. Todos vêm do Phosphor (MIT, https://phosphoricons.com),
 * para manter um traço só. Use `weight="fill"` para o estado ativo
 * (ex.: aba selecionada) e "regular" no resto.
 *
 * O import "/ssr" funciona em componentes de servidor e de cliente.
 */
export type IconProps = Omit<SVGProps<SVGSVGElement>, "ref"> & { weight?: IconWeight };

function wrap(Ph: PhIcon, defaultWeight: IconWeight = "regular") {
  function AppIcon({ width, height, strokeWidth: _ignored, weight, ...rest }: IconProps) {
    void _ignored;
    return <Ph size={width ?? height ?? 22} weight={weight ?? defaultWeight} aria-hidden {...rest} />;
  }
  AppIcon.displayName = `Icon(${Ph.displayName ?? "Phosphor"})`;
  return AppIcon;
}

// Navegação
export const HomeIcon = wrap(PhHouse);
export const HistoryIcon = wrap(PhClock);
export const PlusIcon = wrap(PhPlus, "bold");
export const VitalsIcon = wrap(PhHeartbeat);
export const DoctorIcon = wrap(PhStethoscope);
export const GearIcon = wrap(PhGear);

// Registros clínicos
export const LabIcon = wrap(PhTestTube);
export const FileIcon = wrap(PhFileText);
export const StethoscopeIcon = wrap(PhStethoscope);
export const PillIcon = wrap(PhPill);
export const SyringeIcon = wrap(PhSyringe);
export const ClipboardIcon = wrap(PhClipboardText);

// Sinais vitais e dispositivos
export const HeartIcon = wrap(PhHeart);
export const MoonIcon = wrap(PhMoon);
export const DropIcon = wrap(PhDrop);
export const GaugeIcon = wrap(PhGauge);
export const WatchIcon = wrap(PhWatch);

// Envio de laudo
export const CameraIcon = wrap(PhCamera);
export const ScanIcon = wrap(PhScan);

// Status e alertas: a forma muda com a gravidade (triângulo × octógono)
export const AlertIcon = wrap(PhWarning, "bold");
export const UrgentIcon = wrap(PhWarningOctagon, "fill");
export const ArrowUpIcon = wrap(PhArrowUp, "bold");
export const ArrowDownIcon = wrap(PhArrowDown, "bold");
export const CheckIcon = wrap(PhCheck, "bold");
export const MinusIcon = wrap(PhMinus, "bold");
export const ShieldIcon = wrap(PhShieldCheck);
export const ChevronRight = wrap(PhCaretRight);
export const ChevronDown = wrap(PhCaretDown);
export const CalendarIcon = wrap(PhCalendar);
export const SearchIcon = wrap(PhSearch);
export const StepsIcon = wrap(PhSteps);

// Conversa
export const ChatIcon = wrap(PhChat);
export const SendIcon = wrap(PhSend, "fill");
export const PaperclipIcon = wrap(PhPaperclip);
export const BackIcon = wrap(PhArrowLeft);
export const ReadIcon = wrap(PhChecks, "bold");
export const CopyIcon = wrap(PhCopy);
export const PhoneIcon = wrap(PhPhone);
export const CloseIcon = wrap(PhX);

/**
 * Marca do Elo Saúde: monograma "e" sobre azul-marinho, com o ponto laranja
 * do elo. Mesmo desenho de scripts/gerar-icones.mjs.
 */
export const LogoMark = ({ className, width = 28, height = 28, ...p }: SVGProps<SVGSVGElement>) => (
  <svg width={width} height={height} viewBox="0 0 32 32" aria-hidden className={className} {...p}>
    <rect width="32" height="32" rx="8" fill="var(--color-ink)" />
    <g transform="translate(4.5 4.5) scale(0.72)">
      <path d="M8.5 16H23.5A7.5 7.5 0 1 0 21.3 21.3" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="25" cy="23.6" r="2.3" fill="var(--color-accent)" />
    </g>
  </svg>
);

/** Logo completo: marca + nome. */
export const Logo = ({ size = 28 }: { size?: number }) => (
  <span className="flex items-center gap-2">
    <LogoMark width={size} height={size} />
    <span className="text-[17px] font-semibold tracking-[-0.02em] text-ink">Elo Saúde</span>
  </span>
);
