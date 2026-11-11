# Identidade visual do Elo Saúde

Referência rápida para quem mexer na interface. Os tokens ficam em `src/app/globals.css`; a paleta dos gráficos em `CHART` (`src/components/charts.tsx`).

## Ideia

O app trata de histórico de saúde, então a referência é um **prontuário bem diagramado**: papel quente, tinta escura, títulos em serifa, fios finos separando seções. Isso afasta o visual genérico de "app de IA" (gradientes, azul-ciano, brilhos, cartões muito arredondados com sombra) e passa calma e credibilidade.

## Marca

- **Símbolo:** dois elos entrelaçados (`<LogoMark>` em `src/components/icons.tsx`). Um elo em verde-pinho, outro em argila. O mesmo desenho gera os ícones do app (`npm run icones`).
- **Nome:** "Elo Saúde" sempre em Newsreader seminegrito.

## Cores

| Uso | Token | Hex |
|---|---|---|
| Fundo (papel) | `paper` | `#f5f2ec` |
| Texto principal | `ink-900` | `#1c1b18` |
| Texto secundário (mínimo para texto) | `ink-500` | `#6b665c` |
| Marca, botões, aba ativa | `brand-600` | `#1f5e4c` |
| Acento decorativo (logo, anos da linha do tempo) | `clay-500` / `clay-600` | `#c8673e` / `#a9532f` |
| Acima da faixa, "procure um médico" | `danger-600` / `danger-700` | `#b42318` / `#912018` |
| Abaixo da faixa, "atenção" | `warn-500` / `warn-800` | `#c98a12` / `#6b4508` |

Regras:

- `ink-400` e mais claros **não** servem para texto (contraste abaixo de 4,5:1); use só em ícones decorativos e bordas.
- A argila é decorativa. Nunca use em status, para não confundir com vermelho de alerta.
- Status clínico **nunca depende só da cor**: sempre ícone + texto (`<StatusBadge>`: ↑ Acima, ↓ Abaixo, ✓ Na faixa).
- "Na faixa" é neutro de propósito: o olho deve ir direto ao que está fora.

## Tipografia

- **Títulos e números de destaque:** Newsreader (utilitário `page-title`, classe `font-serif`).
- **Interface e texto corrido:** Source Sans 3, base de 16 px.
- **Valores clínicos:** classe `num` (algarismos de largura fixa, alinham em colunas).
- Tamanho mínimo de texto: 12 px (`text-xs`). Nada de `text-[10px]` ou `text-[11px]`.

Os pares vieram das buscas da skill ui-ux-pro-max ("News Editorial" para títulos, "Corporate Trust" para o corpo, ambos marcados para saúde e legibilidade).

## Componentes e layout

- **Cartão** (`card`): borda `ink-200`, raio 12 px, sem sombra.
- **Título de seção** (`<SectionTitle>`): versalete pequeno com um fio até a margem.
- **Alertas** (`<AlertCard>`): faixa de 4 px à esquerda na cor da gravidade, rótulo com ícone, recomendação separada por um fio.
- **Alvos de toque:** botões, links de ação e abas com pelo menos 44 px de altura (`min-h-11`).
- **Foco:** contorno verde de 2 px em todo elemento focado pelo teclado (definido em `globals.css`).
- **Movimento:** transições de 200 ms, desligadas com `prefers-reduced-motion`.

## Gráficos

- Linha principal em `CHART.ink`; pontos fora da faixa são **maiores e cheios** em vermelho, os normais são vazados (forma + cor).
- Faixa de referência sombreada e rotulada "faixa de referência".
- Início de remédio: linha pontilhada roxa com o nome.
- Duas séries no mesmo gráfico: mesma cor, traços diferentes (`dashed: true`), com legenda.
