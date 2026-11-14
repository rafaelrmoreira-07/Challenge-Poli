// Gera um laudo descritivo FICTÍCIO (ecocardiograma), para mostrar que o Elo
// também guarda exames de imagem e procedimentos, não só tabelas de números:
//   public/exemplos/ecocardiograma-2025.pdf
// O texto vem de src/lib/samples.json (a mesma leitura pré-gravada usada sem IA).
// Uso: npm run exemplos:laudo
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const root = path.resolve(import.meta.dirname, "..");
const FILE = "ecocardiograma-2025.pdf";
const s = JSON.parse(await readFile(path.join(root, "src/lib/samples.json"), "utf8"))[FILE];
const outDir = path.join(root, "public/exemplos");
await mkdir(outDir, { recursive: true });

const AVISO = "DOCUMENTO FICTÍCIO GERADO PARA DEMONSTRAÇÃO. NÃO É UM LAUDO REAL.";
const br = (iso) => iso.split("-").reverse().join("/");

const pdf = await PDFDocument.create();
pdf.setTitle(`${s.laudo_descritivo.exame} - ${s.laboratorio}`);
const page = pdf.addPage([595, 842]);
const font = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
const wine = rgb(0.45, 0.1, 0.18);
const gray = rgb(0.35, 0.35, 0.35);
const ink = rgb(0.1, 0.1, 0.1);
const text = (t, x, y, size = 10, f = font, color = ink) => page.drawText(t, { x, y, size, font: f, color });

/** Quebra o texto em linhas que cabem na largura. */
function wrap(t, f, size, width) {
  const lines = [];
  let line = "";
  for (const w of t.split(" ")) {
    const next = line ? `${line} ${w}` : w;
    if (f.widthOfTextAtSize(next, size) > width && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

page.drawRectangle({ x: 0, y: 772, width: 595, height: 70, color: wine });
text(s.laboratorio.toUpperCase(), 40, 808, 17, bold, rgb(1, 1, 1));
text("Rua das Acácias, 450 - São Paulo/SP - Diretor técnico: Dr. Marcos Lemos CRM-SP 000000", 40, 788, 8.5, font, rgb(1, 0.92, 0.94));

let y = 742;
text(`Paciente: ${s.paciente}`, 40, y, 11, bold);
text(`Data do exame: ${br(s.data_coleta)}`, 380, y, 10);
y -= 16;
text("Sexo: Masculino    Nascimento: 14/03/1968    Peso: 84 kg    Altura: 1,74 m", 40, y, 9.5, font, gray);
y -= 12;
page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.8, color: gray });

y -= 30;
text(s.laudo_descritivo.exame.toUpperCase(), 40, y, 13, bold, wine);
y -= 16;
text("Indicação clínica: hipertensão arterial sistêmica, avaliação de lesão de órgão-alvo.", 40, y, 9.5, font, gray);

// Medidas (tabela curta, como num laudo real)
y -= 28;
text("MEDIDAS", 40, y, 9, bold, gray);
const medidas = [
  ["Aorta (raiz)", "33 mm", "Átrio esquerdo", "41 mm"],
  ["Septo interventricular", "12 mm", "Parede posterior", "11 mm"],
  ["Diâmetro diastólico do VE", "50 mm", "Diâmetro sistólico do VE", "31 mm"],
  ["Fração de ejeção (Teichholz)", "64%", "Relação E/A", "0,7"],
];
for (const [a, va, b, vb] of medidas) {
  y -= 17;
  text(a, 40, y, 9.5);
  text(va, 215, y, 9.5, bold);
  text(b, 300, y, 9.5);
  text(vb, 480, y, 9.5, bold);
}

y -= 30;
text("DESCRIÇÃO", 40, y, 9, bold, gray);
const descricao = [
  "Ventrículo esquerdo com dimensões cavitárias normais e espessura parietal discretamente aumentada, de padrão concêntrico.",
  "Função sistólica global preservada, sem alterações da contratilidade segmentar.",
  "Padrão de relaxamento ventricular anormal ao Doppler (disfunção diastólica grau I).",
  "Átrio esquerdo discretamente aumentado. Câmaras direitas com dimensões e função normais.",
  "Valvas cardíacas com morfologia e função preservadas. Pericárdio sem derrame.",
];
for (const d of descricao) {
  for (const l of wrap(d, font, 10, 515)) {
    y -= 15;
    text(l, 40, y, 10);
  }
  y -= 4;
}

y -= 22;
text("CONCLUSÃO", 40, y, 9, bold, gray);
for (const item of s.laudo_descritivo.conclusao.split(". ").map((x) => x.replace(/\.$/, ""))) {
  for (const [i, l] of wrap(`${item}.`, bold, 10.5, 500).entries()) {
    y -= 16;
    text(i === 0 ? "- " + l : "  " + l, 40, y, 10.5, bold);
  }
}

y -= 50;
page.drawLine({ start: { x: 330, y }, end: { x: 555, y }, thickness: 0.6, color: gray });
y -= 13;
text(s.laudo_descritivo.medico, 330, y, 9.5, bold);
y -= 12;
text("Cardiologia e ecocardiografia - CRM-SP 000000", 330, y, 8.5, font, gray);

text(AVISO, 40, 40, 9, bold, rgb(0.75, 0.1, 0.1));
await writeFile(path.join(outDir, FILE), await pdf.save());
console.log(`ok: public/exemplos/${FILE}`);
