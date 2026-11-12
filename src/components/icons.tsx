import type { SVGProps } from "react";
import {
  ArrowDownIcon as PhArrowDown,
  ArrowLeftIcon as PhArrowLeft,
  ArrowUpIcon as PhArrowUp,
  CameraIcon as PhCamera,
  CaretRightIcon as PhCaretRight,
  ChatCircleTextIcon as PhChat,
  CheckIcon as PhCheck,
  ChecksIcon as PhChecks,
  ClipboardTextIcon as PhClipboardText,
  ClockCounterClockwiseIcon as PhClock,
  CopyIcon as PhCopy,
  DropIcon as PhDrop,
  FileTextIcon as PhFileText,
  GaugeIcon as PhGauge,
  GearSixIcon as PhGear,
  HeartbeatIcon as PhHeartbeat,
  HeartIcon as PhHeart,
  HouseIcon as PhHouse,
  IntersectIcon as PhIntersect,
  MinusIcon as PhMinus,
  MoonIcon as PhMoon,
  PaperclipIcon as PhPaperclip,
  PaperPlaneRightIcon as PhSend,
  PhoneIcon as PhPhone,
  PillIcon as PhPill,
  PlusIcon as PhPlus,
  ScanIcon as PhScan,
  ShieldCheckIcon as PhShieldCheck,
  StethoscopeIcon as PhStethoscope,
  SyringeIcon as PhSyringe,
  TestTubeIcon as PhTestTube,
  WarningIcon as PhWarning,
  WarningOctagonIcon as PhWarningOctagon,
  WatchIcon as PhWatch,
  WhatsappLogoIcon as PhWhatsapp,
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
/** Dois dados de fontes diferentes conectados ("Juntando seus dados"). */
export const InsightIcon = wrap(PhIntersect);
export const WhatsappIcon = wrap(PhWhatsapp);

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

// Conversa
export const ChatIcon = wrap(PhChat);
export const SendIcon = wrap(PhSend, "fill");
export const PaperclipIcon = wrap(PhPaperclip);
export const BackIcon = wrap(PhArrowLeft);
export const ReadIcon = wrap(PhChecks, "bold");
export const CopyIcon = wrap(PhCopy);
export const PhoneIcon = wrap(PhPhone);
export const CloseIcon = wrap(PhX);

/** Marca do Elo Saúde: dois elos entrelaçados (o mesmo desenho de scripts/gerar-icones.mjs). */
export const LogoMark = ({ className, ...p }: SVGProps<SVGSVGElement>) => (
  <svg width={28} height={28} viewBox="0 0 32 32" fill="none" strokeWidth={3.2} strokeLinecap="round" aria-hidden className={className} {...p}>
    <rect x="3" y="10" width="16" height="12" rx="6" stroke="var(--color-brand-600)" />
    <rect x="13" y="10" width="16" height="12" rx="6" stroke="var(--color-clay-500)" />
    <path d="M13 16a6 6 0 0 1 6-6" stroke="var(--color-brand-600)" />
  </svg>
);
