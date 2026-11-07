/**
 * Catálogo de analitos conhecidos. A chave canônica permite juntar, numa mesma
 * curva, resultados que cada laboratório escreve de um jeito ("LDL-c",
 * "Colesterol LDL"...). As faixas aqui são só um fallback: a faixa exibida é
 * sempre a do laudo, quando ele traz uma.
 */
export interface AnalyteInfo {
  key: string;
  name: string;
  unit: string;
  category: string;
  refLow?: number;
  refHigh?: number;
  aliases: string[];
}

export const ANALYTES: AnalyteInfo[] = [
  { key: "glicose", name: "Glicose em jejum", unit: "mg/dL", category: "Metabolismo", refLow: 70, refHigh: 99, aliases: ["glicemia", "glicose jejum", "glucose"] },
  { key: "hba1c", name: "Hemoglobina glicada (HbA1c)", unit: "%", category: "Metabolismo", refLow: 4, refHigh: 5.6, aliases: ["hemoglobina glicada", "a1c", "glicohemoglobina"] },
  { key: "colesterol_total", name: "Colesterol total", unit: "mg/dL", category: "Lipídios", refHigh: 190, aliases: ["colesterol"] },
  { key: "ldl", name: "Colesterol LDL", unit: "mg/dL", category: "Lipídios", refHigh: 130, aliases: ["ldl-c", "ldl colesterol", "colesterol ldl"] },
  { key: "hdl", name: "Colesterol HDL", unit: "mg/dL", category: "Lipídios", refLow: 40, aliases: ["hdl-c", "hdl colesterol", "colesterol hdl"] },
  { key: "triglicerides", name: "Triglicerídeos", unit: "mg/dL", category: "Lipídios", refHigh: 150, aliases: ["triglicérides", "triglicerídios", "tg"] },
  { key: "creatinina", name: "Creatinina", unit: "mg/dL", category: "Rins", refLow: 0.7, refHigh: 1.3, aliases: ["creatinina sérica"] },
  { key: "ureia", name: "Ureia", unit: "mg/dL", category: "Rins", refLow: 15, refHigh: 45, aliases: ["uréia"] },
  { key: "tfg", name: "Taxa de filtração glomerular (TFG)", unit: "mL/min/1,73m²", category: "Rins", refLow: 90, aliases: ["tfge", "ckd-epi", "filtração glomerular"] },
  { key: "potassio", name: "Potássio", unit: "mEq/L", category: "Eletrólitos", refLow: 3.5, refHigh: 5.1, aliases: ["k", "potássio sérico"] },
  { key: "sodio", name: "Sódio", unit: "mEq/L", category: "Eletrólitos", refLow: 136, refHigh: 145, aliases: ["na", "sódio sérico"] },
  { key: "tsh", name: "TSH", unit: "µUI/mL", category: "Tireoide", refLow: 0.4, refHigh: 4.5, aliases: ["tireotrofina", "hormônio tireoestimulante"] },
  { key: "t4_livre", name: "T4 livre", unit: "ng/dL", category: "Tireoide", refLow: 0.8, refHigh: 1.8, aliases: ["t4l", "tiroxina livre"] },
  { key: "hemoglobina", name: "Hemoglobina", unit: "g/dL", category: "Hemograma", refLow: 13.5, refHigh: 17.5, aliases: ["hb", "hgb"] },
  { key: "hematocrito", name: "Hematócrito", unit: "%", category: "Hemograma", refLow: 40, refHigh: 52, aliases: ["ht", "hct"] },
  { key: "leucocitos", name: "Leucócitos", unit: "/mm³", category: "Hemograma", refLow: 4000, refHigh: 11000, aliases: ["leucócitos totais", "glóbulos brancos", "wbc"] },
  { key: "plaquetas", name: "Plaquetas", unit: "/mm³", category: "Hemograma", refLow: 150000, refHigh: 450000, aliases: ["contagem de plaquetas", "plt"] },
  { key: "vitamina_d", name: "Vitamina D (25-OH)", unit: "ng/mL", category: "Vitaminas", refLow: 30, refHigh: 100, aliases: ["25-hidroxivitamina d", "25(oh)d", "vitamina d3"] },
  { key: "vitamina_b12", name: "Vitamina B12", unit: "pg/mL", category: "Vitaminas", refLow: 200, refHigh: 900, aliases: ["cobalamina", "b12"] },
  { key: "acido_urico", name: "Ácido úrico", unit: "mg/dL", category: "Metabolismo", refLow: 3.5, refHigh: 7.2, aliases: ["urato"] },
  { key: "tgo", name: "TGO (AST)", unit: "U/L", category: "Fígado", refHigh: 40, aliases: ["ast", "aspartato aminotransferase"] },
  { key: "tgp", name: "TGP (ALT)", unit: "U/L", category: "Fígado", refHigh: 41, aliases: ["alt", "alanina aminotransferase"] },
  { key: "psa", name: "PSA total", unit: "ng/mL", category: "Próstata", refHigh: 4, aliases: ["antígeno prostático específico"] },
  { key: "pcr", name: "Proteína C reativa", unit: "mg/L", category: "Inflamação", refHigh: 5, aliases: ["pcr ultrassensível", "proteína c-reativa"] },
];

const byKey = new Map(ANALYTES.map((a) => [a.key, a]));

export function analyteInfo(key: string): AnalyteInfo | undefined {
  return byKey.get(key);
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Garante uma chave canônica conhecida; senão cria uma a partir do nome. */
export function resolveAnalyteKey(suggestedKey: string, name: string): string {
  if (byKey.has(suggestedKey)) return suggestedKey;
  const n = normalize(name);
  for (const a of ANALYTES) {
    if (normalize(a.name) === n || a.aliases.some((al) => normalize(al) === n)) {
      return a.key;
    }
  }
  return "outro_" + n.replace(/ /g, "_").slice(0, 40);
}

export function analyteCatalogForPrompt(): string {
  return ANALYTES.map((a) => `${a.key}: ${a.name} (${a.aliases.join(", ")})`).join("\n");
}
