// Gera os ícones do app (PWA, favicon e tela inicial do iPhone).
// Uso: npm run icones
// O desenho é o mesmo do <LogoMark> em src/components/icons.tsx:
// um "e" geométrico em branco sobre azul-marinho, com o ponto laranja do elo.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");

export const MARK_E = "M8.5 16H23.5A7.5 7.5 0 1 0 21.3 21.3";

/** `pad` = fração do lado reservada como margem (ícones "maskable" precisam de mais). */
const svg = (size, { rounded, pad }) => {
  const inner = size * (1 - pad * 2);
  const s = inner / 32;
  const off = size * pad;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${rounded ? size * 0.24 : 0}" fill="#1f2b4d"/>
  <g transform="translate(${off} ${off}) scale(${s})">
    <path d="${MARK_E}" fill="none" stroke="#ffffff" stroke-width="3.4" stroke-linecap="round"/>
    <circle cx="25" cy="23.6" r="2.3" fill="#f7941d"/>
  </g>
</svg>`;
};

const out = [
  ["src/app/icon.png", 512, { rounded: true, pad: 0.14 }],
  ["src/app/apple-icon.png", 180, { rounded: false, pad: 0.16 }],
  ["public/icons/icon-192.png", 192, { rounded: true, pad: 0.14 }],
  ["public/icons/icon-512.png", 512, { rounded: true, pad: 0.14 }],
  ["public/icons/maskable-512.png", 512, { rounded: false, pad: 0.24 }],
];

await mkdir(path.join(root, "public/icons"), { recursive: true });
for (const [file, size, opts] of out) {
  await sharp(Buffer.from(svg(size, opts))).png().toFile(path.join(root, file));
}
console.log("Ícones gerados.");
