import type { NextConfig } from "next";

/**
 * Site 100% estático: os dados ficam no navegador e a IA é chamada direto do
 * navegador. Assim ele pode ser publicado no GitHub Pages, sem servidor.
 * NEXT_PUBLIC_BASE_PATH = "/Challenge-Poli" no build do GitHub Pages; vazio local.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
