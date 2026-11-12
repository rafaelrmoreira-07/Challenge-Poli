// Gera um laudo FICTÍCIO difícil de ler, para mostrar a revisão por confiança:
//   public/exemplos/exame-papel-carimbo-2020.jpg
// O carimbo do laboratório cai em cima do resultado da glicose e uma mancha
// borra a creatinina. A leitura esperada (e pré-gravada em src/lib/samples.json):
// glicose sem valor e confiança baixa; creatinina com confiança média.
// Uso: npm run exemplos:dificil
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const FILE = "exame-papel-carimbo-2020.jpg";
const samples = JSON.parse(await readFile(path.join(root, "src/lib/samples.json"), "utf8"));
const s = samples[FILE];
const outDir = path.join(root, "public/exemplos");
await mkdir(outDir, { recursive: true });

// Valores impressos no papel. A glicose (100) fica escondida sob o carimbo.
const IMPRESSO = { glicose: "100", colesterol_total: "224", hdl: "42", ldl: "148", triglicerides: "172", creatinina: "1,05", hemoglobina: "15,0" };
const AVISO = "DOCUMENTO FICTÍCIO GERADO PARA DEMONSTRAÇÃO. NÃO É UM LAUDO REAL.";
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const br = (iso) => iso.split("-").reverse().join("/");

const W = 1240, H = 1700;
const lines = [];
const pos = {};
let y = 330;
for (const r of s.resultados) {
  pos[r.chave] = y;
  lines.push(`<text x="110" y="${y}" font-size="34" font-weight="700">${esc(r.nome.toUpperCase())}</text>`);
  lines.push(`<text x="110" y="${y + 50}" font-size="32">Resultado: <tspan font-weight="700">${IMPRESSO[r.chave]} ${esc(r.unidade)}</tspan></text>`);
  lines.push(`<text x="640" y="${y + 50}" font-size="27" fill="#3a3a3a">Ref.: ${esc(r.ref_texto)}</text>`);
  y += 150;
}

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const specks = Array.from({ length: 320 }, () =>
  `<circle cx="${(rnd() * W).toFixed(0)}" cy="${(rnd() * H).toFixed(0)}" r="${(rnd() * 2.4 + 0.3).toFixed(1)}" fill="#6b5a3a" opacity="${(rnd() * 0.4).toFixed(2)}"/>`,
).join("");

const gy = pos.glicose + 40; // linha do resultado da glicose
const cy = pos.creatinina + 40;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="papel" cx="50%" cy="45%" r="75%">
      <stop offset="0%" stop-color="#efe3c4"/><stop offset="80%" stop-color="#dfcb98"/><stop offset="100%" stop-color="#c4ab74"/>
    </radialGradient>
    <filter id="borra"><feGaussianBlur stdDeviation="5"/></filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#papel)"/>
  <line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2 + 6}" stroke="#a89466" stroke-width="3" opacity="0.55"/>
  <line x1="${W * 0.48}" y1="0" x2="${W * 0.5}" y2="${H}" stroke="#a89466" stroke-width="2" opacity="0.4"/>
  ${specks}
  <g font-family="DejaVu Sans, Noto Sans, sans-serif" fill="#2a251d">
    <text x="110" y="130" font-size="50" font-weight="700">${esc(s.laboratorio.toUpperCase())}</text>
    <text x="110" y="175" font-size="26" fill="#3a3a3a">Rua XV de Novembro, 88 - Campinas/SP - Tel. (19) 0000-0000</text>
    <line x1="110" y1="200" x2="${W - 110}" y2="200" stroke="#25211b" stroke-width="3"/>
    <text x="110" y="250" font-size="30">Paciente: <tspan font-weight="700">${esc(s.paciente.toUpperCase())}</tspan></text>
    <text x="760" y="250" font-size="30">Coleta: ${br(s.data_coleta)}</text>
    <line x1="110" y1="275" x2="${W - 110}" y2="275" stroke="#25211b" stroke-width="1.5"/>
    ${lines.join("\n    ")}
    <text x="110" y="${H - 230}" font-size="26" fill="#3a3a3a">Bioquímico responsável: Dra. Lúcia Andrade - CRF 00000</text>
    <text x="110" y="${H - 120}" font-size="24" font-weight="700" fill="#9a1d1d">${AVISO}</text>
  </g>
  <!-- mancha de café borrando a creatinina -->
  <ellipse cx="330" cy="${cy}" rx="120" ry="42" fill="#8a6a3a" opacity="0.55" filter="url(#borra)"/>
  <!-- carimbo do laboratório em cima do resultado da glicose -->
  <g transform="rotate(-9 330 ${gy})">
    <rect x="190" y="${gy - 66}" width="330" height="118" rx="14" fill="#3a4f9c" fill-opacity="1" stroke="#22357a" stroke-width="6"/>
    <text x="350" y="${gy - 8}" font-family="DejaVu Sans, sans-serif" font-size="34" font-weight="700" fill="#e9ecf7" text-anchor="middle">LAB. SANTA RITA</text>
    <text x="350" y="${gy + 34}" font-family="DejaVu Sans, sans-serif" font-size="26" fill="#e9ecf7" text-anchor="middle">CONFERIDO 10/09/2020</text>
  </g>
</svg>`;

const paper = await sharp(Buffer.from(svg)).rotate(-4.5, { background: "#5b4a3a" }).blur(1.1).toBuffer();
await sharp(paper)
  .resize({ width: 1050 })
  .extend({ top: 50, bottom: 50, left: 50, right: 50, background: "#4f4032" })
  .modulate({ brightness: 0.93, saturation: 0.85 })
  .jpeg({ quality: 72 })
  .toFile(path.join(outDir, FILE));
console.log("Gerado", path.join(outDir, FILE));
