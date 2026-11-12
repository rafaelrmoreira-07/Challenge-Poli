import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk } from "next/font/google";
import { Toaster } from "@/components/base/toaster";
import "./globals.css";

/** Fonte única, sorteada pela taste-skill para clínicas: neo-grotesca calma e confiável. */
const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Elo Saúde · seus exames e medições num lugar só",
  description: "Exames, consultas, remédios, vacinas e medições do relógio organizados para você e para o seu médico.",
  applicationName: "Elo Saúde",
};

/** mobile-native (Emil): conteúdo até as bordas, com o recuo do notch feito no CSS. */
export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${hanken.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
