// Gera os ícones do app (PWA, favicon e tela inicial do iPhone).
// Uso: npm run icones
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const heart =
  "M20.8 6.6a5.5 5.5 0 0 0-8.8-1.6 5.5 5.5 0 0 0-8.8 1.6C1.6 10 4.4 13.5 12 20c7.6-6.5 10.4-10 8.8-13.4z";

/** `pad` = fração do lado reservada como margem (ícones "maskable" precisam de mais). */
const svg = (size, { rounded, pad }) => {
  const inner = size * (1 - pad * 2);
  const s = inner / 24;
  const off = size * pad;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${rounded ? size * 0.22 : 0}" fill="#0d8573"/>
  <g transform="translate(${off} ${off + inner * 0.03}) scale(${s})">
    <path d="${heart}" fill="none" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M6.5 11.5h2.6l1.4-2.6 2.2 5 1.5-2.4h3.3" fill="none" stroke="#c9f5ec" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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
