// Gera os ícones do app (PWA, favicon e tela inicial do iPhone).
// Uso: npm run icones
// O desenho é o mesmo do <LogoMark> em src/components/icons.tsx: dois elos entrelaçados.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");

/** `pad` = fração do lado reservada como margem (ícones "maskable" precisam de mais). */
const svg = (size, { rounded, pad }) => {
  const inner = size * (1 - pad * 2);
  const s = inner / 32;
  const off = size * pad;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${rounded ? size * 0.22 : 0}" fill="#1f5e4c"/>
  <g transform="translate(${off} ${off}) scale(${s})" fill="none" stroke-width="3.2" stroke-linecap="round">
    <rect x="3" y="10" width="16" height="12" rx="6" stroke="#f5f2ec"/>
    <rect x="13" y="10" width="16" height="12" rx="6" stroke="#e39a78"/>
    <path d="M13 16a6 6 0 0 1 6-6" stroke="#f5f2ec"/>
  </g>
</svg>`;
};

const out = [
  ["src/app/icon.png", 512, { rounded: true, pad: 0.16 }],
  ["src/app/apple-icon.png", 180, { rounded: false, pad: 0.18 }],
  ["public/icons/icon-192.png", 192, { rounded: true, pad: 0.16 }],
  ["public/icons/icon-512.png", 512, { rounded: true, pad: 0.16 }],
  ["public/icons/maskable-512.png", 512, { rounded: false, pad: 0.26 }],
];

await mkdir(path.join(root, "public/icons"), { recursive: true });
for (const [file, size, opts] of out) {
  await sharp(Buffer.from(svg(size, opts))).png().toFile(path.join(root, file));
}
console.log("Ícones gerados.");
