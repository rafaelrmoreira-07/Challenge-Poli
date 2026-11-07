import samples from "./samples.json";

/**
 * Laudos fictícios usados na demo (arquivos em public/exemplos, gerados por
 * scripts/gerar-exemplos.mjs a partir deste mesmo JSON). A extração
 * pré-gravada só é usada se a Gemini estiver fora do ar no momento da demo.
 */
export interface SampleExtraction {
  laboratorio: string | null;
  data_coleta: string | null;
  paciente: string | null;
  observacoes: string | null;
  resultados: {
    nome: string;
    chave: string;
    valor: number | null;
    valor_texto?: string | null;
    unidade: string;
    ref_min: number | null;
    ref_max: number | null;
    ref_texto: string | null;
  }[];
}

export const SAMPLE_EXTRACTIONS = samples as Record<string, SampleExtraction>;
