// Gera os laudos FICTÍCIOS usados na demo, a partir de src/lib/samples.json:
//   public/exemplos/laudo-vida-2026-11.pdf  (PDF de laboratório)
//   public/exemplos/exame-papel-2016.jpg    (foto de um laudo em papel antigo)
// Uso: npm run exemplos
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const samples = JSON.parse(await readFile(path.join(root, "src/lib/samples.json"), "utf8"));
const outDir = path.join(root, "public/exemplos");
await mkdir(outDir, { recursive: true });

const DECIMALS = { hba1c: 1, creatinina: 2, potassio: 1, tsh: 2, hemoglobina: 1, pcr: 1 };
const fmt = (r) =>
  r.valor.toLocaleString("pt-BR", { minimumFractionDigits: DECIMALS[r.chave] ?? 0, maximumFractionDigits: DECIMALS[r.chave] ?? 0 });
const br = (iso) => iso.split("-").reverse().join("/");
const AVISO = "DOCUMENTO FICTÍCIO GERADO PARA DEMONSTRAÇÃO. NÃO É UM LAUDO REAL.";

// ---------- PDF ----------
async function gerarPdf(file, s) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Laudo ${s.laboratorio}`);
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const teal = rgb(0.05, 0.45, 0.45);
  const gray = rgb(0.35, 0.35, 0.35);
  const text = (t, x, y, size = 10, f = font, color = rgb(0.1, 0.1, 0.1)) => page.drawText(t, { x, y, size, font: f, color });

  page.drawRectangle({ x: 0, y: 772, width: 595, height: 70, color: teal });
  text(s.laboratorio.toUpperCase(), 40, 808, 18, bold, rgb(1, 1, 1));
  text("Av. das Palmeiras, 1200 - São Paulo/SP - Responsável técnico: Dr. Paulo Viana CRF-SP 00000", 40, 788, 8.5, font, rgb(0.9, 1, 1));

  let y = 742;
  text(`Paciente: ${s.paciente}`, 40, y, 11, bold);
  text(`Data da coleta: ${br(s.data_coleta)}`, 380, y, 10);
  y -= 16;
  text("Sexo: Masculino    Data de nascimento: 14/03/1968    Convênio: Particular", 40, y, 9.5, font, gray);
  text(`Pedido nº 2026-${s.data_coleta.replaceAll("-", "").slice(2)}-0417`, 380, y, 9.5, font, gray);
  y -= 12;
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.8, color: gray });

  y -= 26;
  text("EXAME", 40, y, 9, bold, gray);
  text("RESULTADO", 230, y, 9, bold, gray);
  text("UNIDADE", 310, y, 9, bold, gray);
  text("VALORES DE REFERÊNCIA", 380, y, 9, bold, gray);
  y -= 8;

  for (const r of s.resultados) {
    y -= 22;
    text(r.nome, 40, y, 10);
    text(fmt(r), 230, y, 10.5, bold);
    text(r.unidade, 310, y, 9.5, font, gray);
    const ref = r.ref_texto.replace(/ ?(mg\/dL|g\/dL|mEq\/L|µUI\/mL|ng\/mL|mg\/L|\/mm³)$/, "");
    const parts = ref.split(" / ");
    parts.forEach((p, i) => text(p, 380, y - i * 11, 8.5, font, gray));
    y -= (parts.length - 1) * 11;
    page.drawLine({ start: { x: 40, y: y - 8 }, end: { x: 555, y: y - 8 }, thickness: 0.3, color: rgb(0.8, 0.8, 0.8) });
  }

  y -= 40;
  text("Método: química seca / HPLC / quimioluminescência. Material: soro e sangue total.", 40, y, 8.5, font, gray);
  y -= 13;
  text("Resultados liberados eletronicamente. Interpretação exclusiva do médico assistente.", 40, y, 8.5, font, gray);
  text(AVISO, 40, 40, 9, bold, rgb(0.75, 0.1, 0.1));
  await writeFile(path.join(outDir, file), await pdf.save());
}

// ---------- JPG (papel antigo) ----------
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function gerarFoto(file, s) {
  const W = 1240, H = 1700;
  const lines = [];
  let y = 330;
  for (const r of s.resultados) {
    lines.push(`<text x="110" y="${y}" font-size="34" font-weight="700">${esc(r.nome.toUpperCase())}</text>`);
    lines.push(`<text x="110" y="${y + 50}" font-size="32">Resultado: <tspan font-weight="700">${fmt(r)} ${esc(r.unidade)}</tspan></text>`);
    lines.push(`<text x="640" y="${y + 50}" font-size="27" fill="#3a3a3a">Ref.: ${esc(r.ref_texto)}</text>`);
    y += 150;
  }
  // manchas e sujeira aleatórias (determinísticas)
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const specks = Array.from({ length: 260 }, () =>
    `<circle cx="${(rnd() * W).toFixed(0)}" cy="${(rnd() * H).toFixed(0)}" r="${(rnd() * 2.2 + 0.3).toFixed(1)}" fill="#6b5a3a" opacity="${(rnd() * 0.35).toFixed(2)}"/>`,
  ).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="papel" cx="50%" cy="45%" r="75%">
      <stop offset="0%" stop-color="#f3ead2"/><stop offset="80%" stop-color="#e6d6ae"/><stop offset="100%" stop-color="#cdb98a"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#papel)"/>
  <rect x="${W * 0.62}" y="${H * 0.18}" width="300" height="220" rx="110" fill="#b89a5e" opacity="0.18"/>
  <line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2 + 6}" stroke="#a89466" stroke-width="3" opacity="0.5"/>
  ${specks}
  <g font-family="Noto Sans, DejaVu Sans, sans-serif" fill="#25211b">
    <text x="110" y="130" font-size="50" font-weight="700">${esc(s.laboratorio.toUpperCase())}</text>
    <text x="110" y="175" font-size="26" fill="#3a3a3a">Rua XV de Novembro, 88 - Campinas/SP - Tel. (19) 0000-0000</text>
    <line x1="110" y1="200" x2="${W - 110}" y2="200" stroke="#25211b" stroke-width="3"/>
    <text x="110" y="250" font-size="30">Paciente: <tspan font-weight="700">${esc(s.paciente.toUpperCase())}</tspan></text>
    <text x="760" y="250" font-size="30">Coleta: ${br(s.data_coleta)}</text>
    <line x1="110" y1="275" x2="${W - 110}" y2="275" stroke="#25211b" stroke-width="1.5"/>
    ${lines.join("\n    ")}
    <text x="110" y="${H - 230}" font-size="26" fill="#3a3a3a">Bioquímico responsável: Dra. Lúcia Andrade - CRF 00000</text>
    <ellipse cx="${W - 300}" cy="${H - 290}" rx="170" ry="70" fill="none" stroke="#2b3f8a" stroke-width="5" opacity="0.55" transform="rotate(-12 ${W - 300} ${H - 290})"/>
    <text x="${W - 420}" y="${H - 280}" font-size="30" fill="#2b3f8a" opacity="0.6" transform="rotate(-12 ${W - 300} ${H - 290})">CONFERIDO</text>
    <text x="110" y="${H - 120}" font-size="24" font-weight="700" fill="#9a1d1d">${AVISO}</text>
  </g>
</svg>`;

  // fundo de mesa + leve rotação e desfoque para parecer foto de celular
  const paper = await sharp(Buffer.from(svg)).rotate(-2.2, { background: "#5b4a3a" }).blur(0.6).toBuffer();
  await sharp(paper)
    .resize({ width: 1100 })
    .extend({ top: 40, bottom: 40, left: 40, right: 40, background: "#5b4a3a" })
    .modulate({ brightness: 0.97, saturation: 0.9 })
    .jpeg({ quality: 78 })
    .toFile(path.join(outDir, file));
}

await gerarPdf("laudo-vida-2026-11.pdf", samples["laudo-vida-2026-11.pdf"]);
await gerarFoto("exame-papel-2016.jpg", samples["exame-papel-2016.jpg"]);
console.log("Exemplos gerados em", outDir);
