import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Elo Saúde · seu histórico de saúde em um só lugar",
  description: "Hub de saúde pessoal: exames, consultas, remédios, vacinas e wearables organizados por IA, para você e para o seu médico.",
  applicationName: "Elo Saúde",
};

export const viewport: Viewport = {
  themeColor: "#0d8573",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
