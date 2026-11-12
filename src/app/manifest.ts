import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${base}/`,
    name: "Elo Saúde · seu histórico de saúde",
    short_name: "Elo Saúde",
    description: "Exames, consultas, remédios, vacinas e medições do relógio organizados para você e para o seu médico.",
    lang: "pt-BR",
    start_url: `${base}/`,
    scope: `${base}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    categories: ["health", "medical"],
    icons: [
      { src: `${base}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${base}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
      { src: `${base}/icons/maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Adicionar exame", url: `${base}/enviar/` },
      { name: "Relatório para o médico", url: `${base}/compartilhar/` },
    ],
  };
}
