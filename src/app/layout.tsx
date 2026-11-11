import type { Metadata, Viewport } from "next";
import { Newsreader, Source_Sans_3 } from "next/font/google";
import "./globals.css";

/** Títulos e números de destaque: serifa de leitura longa, com cara de prontuário. */
const display = Newsreader({ variable: "--font-display", subsets: ["latin"], display: "swap" });
/** Texto corrido e interface: sans humanista de alta legibilidade. */
const body = Source_Sans_3({ variable: "--font-body", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Elo Saúde · seu histórico de saúde em um só lugar",
  description: "Hub de saúde pessoal: exames, consultas, remédios, vacinas e wearables organizados por IA, para você e para o seu médico.",
  applicationName: "Elo Saúde",
};

export const viewport: Viewport = {
  themeColor: "#1f5e4c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
