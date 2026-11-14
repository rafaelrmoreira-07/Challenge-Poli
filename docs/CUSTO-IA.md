# Qual IA usar: custo por laudo e privacidade

Levantamento feito em 12/11/2026 nas páginas oficiais de preço. Preços em dólar por 1 milhão de tokens (MTok). Preços mudam com frequência: confira as fontes antes de decidir.

## O que a IA faz no Elo Saúde

1. **Ler o laudo** (foto ou PDF) e devolver JSON com exame, valor, unidade e faixa. É a parte mais cara: entra imagem.
2. **Resumo para o médico**: texto curto a partir do histórico já estruturado. Só texto.

A IA **não guarda** nada. Armazenar e organizar é papel do banco de dados do app. A IA só lê e estrutura.

## Modelos baratos que leem imagem e PDF

| Modelo | Entrada | Saída | Lote (50% off) | Plano gratuito | Usa os dados para treinar? |
|---|---|---|---|---|---|
| Gemini 2.5 Flash-Lite (Google) | $0,10 | $0,40 | $0,05 / $0,20 | Sim | **Sim no gratuito**, não no pago |
| Gemini 3.1 Flash-Lite (Google) | $0,25 | $1,50 | $0,125 / $0,75 | Sim | **Sim no gratuito**, não no pago |
| Gemini 3.5 Flash-Lite (Google) | $0,30 | $2,50 | $0,15 / $1,25 | Sim | **Sim no gratuito**, não no pago |
| Claude Haiku 5.5 (Anthropic), até 100 mil tokens | $0,10 | $0,50 | $0,05 / $0,25 | Não | Não, por padrão |
| gpt-6-luna (OpenAI) | $0,10 | $0,50 | $0,05 / $0,25 | Não | Não, por padrão (logs de abuso até 30 dias) |
| Mistral OCR (só OCR, sem estruturar) | ~$4 por mil páginas | — | ~$2 por mil páginas | — | — |

Quanto pesa cada arquivo:

- **Gemini:** cada página de PDF vale 258 tokens; texto embutido no PDF não é cobrado.
- **Claude:** foto de ~1000×1400 px ≈ 1.500 tokens; página de PDF ≈ 1.500 a 3.000 tokens (texto + imagem).
- **OpenAI (família luna):** foto de ~1000×1400 px ≈ 1.700 tokens em alta resolução. A página de preços não confirma entrada em PDF para esse modelo.

## Custo estimado por uso

Premissas: instruções + catálogo de exames ≈ 2.000 tokens; laudo de 2 páginas ou 1 foto; resposta JSON com 14 exames ≈ 1.500 tokens; resumo do médico ≈ 3.000 tokens de entrada e 600 de saída.

| Modelo | Ler 1 laudo | 1 resumo para o médico |
|---|---|---|
| Gemini 2.5 Flash-Lite | ~US$ 0,0009 | ~US$ 0,0005 |
| Claude Haiku 5.5 | ~US$ 0,001 a 0,002 | ~US$ 0,0006 |
| gpt-6-luna | ~US$ 0,001 a 0,002 | ~US$ 0,0006 |
| Gemini 3.1 Flash-Lite | ~US$ 0,003 | ~US$ 0,0017 |
| Mistral OCR + um LLM para estruturar | ~US$ 0,009 | — |

Ordem de grandeza: **menos de 1 centavo de real por laudo** em qualquer um dos modelos "lite". Um usuário que envia 1 laudo e gera 3 resumos por semana custa ~US$ 0,01 a 0,03 por mês. Mil usuários assim: **~US$ 15 a 30 por mês**.

Uma cota gratuita de **10 leituras e 20 resumos por dia** custaria, no pior caso, ~US$ 0,03 por usuário por dia. Na prática quase ninguém usa a cota inteira.

## Conclusões

1. **Preço não é o critério que decide.** Entre os modelos "lite" a diferença é de frações de centavo por laudo. O que decide é **ler certo** os laudos brasileiros (vírgula decimal, faixas por idade, foto torta).
2. **Plano gratuito do Gemini não serve para dado de saúde real.** A página de preços diz que, no gratuito, o conteúdo é usado para melhorar os produtos do Google. Dado de saúde é sensível (LGPD, art. 11). No protótipo, com dados fictícios, tudo bem; em produção, só plano pago ou um provedor que não treine com os dados.
3. **A chave nunca vai no app.** Site estático e repositório público: qualquer um copiaria a chave. Ela fica num servidor pequeno (ex.: Cloudflare Worker) que também controla a cota diária de cada usuário.
4. **OCR dedicado (Mistral) sai mais caro** e ainda precisa de um segundo modelo para estruturar. Os modelos multimodais fazem as duas coisas numa chamada.

## Recomendação

- **Para a demo de 14/11:** manter o Gemini, que o código já usa (`src/lib/gemini.ts`, com `responseSchema`). Se a IA for embutida, usar conta **paga** com Gemini 2.5 Flash-Lite ou 3.1 Flash-Lite atrás de um Worker. Trocar de provedor agora é risco sem ganho visível.
- **Para produção:** testar Gemini Flash-Lite, Claude Haiku 5.5 e gpt-6-luna com os mesmos 30 a 50 laudos anonimizados e medir a acurácia por campo (valor, unidade, faixa). Escolher o mais preciso; o custo é praticamente igual. Usar lote (50% mais barato) para reprocessar históricos antigos.

## Fontes

- Google, preços da Gemini API: https://aistudio.google.com/docs/pricing
- Google, processamento de documentos (258 tokens por página): https://aistudio.google.com/docs/document-processing
- Google, limites de uso (os limites gratuitos aparecem só no AI Studio): https://aistudio.google.com/docs/rate-limits
- Anthropic, preços: https://platform.claude.com/docs/en/about-claude/pricing
- Anthropic, tokens de imagem: https://platform.claude.com/docs/en/build-with-claude/vision
- Anthropic, suporte a PDF (1.500 a 3.000 tokens por página): https://platform.claude.com/docs/en/build-with-claude/pdf-support
- Anthropic, uso de dados para treino: https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training
- OpenAI, preços: https://developers.openai.com/api/docs/pricing
- OpenAI, tokens de imagem: https://developers.openai.com/api/docs/guides/images-vision
- OpenAI, uso dos dados da API: https://developers.openai.com/api/docs/guides/your-data
- Mistral OCR (preço por fontes secundárias, não confirmado na página da Mistral): https://docs.mistral.ai/models/model-cards/ocr-4-0 e https://aiproductivity.ai/pricing/mistral-ocr/
