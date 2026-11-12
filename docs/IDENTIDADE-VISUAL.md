# Identidade visual do Elo Saúde

Terceira versão, refeita do zero. Os tokens ficam em `src/app/globals.css`; a paleta dos gráficos em `CHART` (`src/components/charts.tsx`).

## De onde veio cada decisão

| Frente | Fonte | O que entrou no app |
|---|---|---|
| Cores e fonte | taste-skill (`start.mjs deal --page service --trade clinic`) | Paleta "white-navy-tab" (branco, azul-marinho `#1f2b4d`, laranja `#f7941d`) e Hanken Grotesk. Títulos em peso 400 com tracking negativo |
| Marca | taste-skill (sorteio "initial") | Monograma "e" com o ponto laranja do elo (`LogoMark`) |
| Regras de texto | taste-skill (`copy.md`) | Títulos com substantivo, botões com verbo e objeto ("Adicionar exame", "Montar relatório para o médico") |
| Acessibilidade e saúde | ui-ux-pro-max | Contraste AA, status com ícone e texto, alvos de 44 px, texto mínimo de 12 px |
| Celular de verdade | mobile-native (Emil Kowalski) | Sem flash ao tocar, sem zoom em campos, `touch-action`, `overscroll-behavior`, `viewport-fit=cover` e recuo do notch |
| Movimento | transitions.dev | Tokens de duração e curva; seletor deslizante (abas, prazo, período), sanfona (alertas), check de sucesso, brilho no texto "Lendo o laudo", entrada única dos títulos |
| Primitivos acessíveis | Base UI (via shadcn/ui) | `Switch` e `Checkbox` em `src/components/base/` |
| Avisos | Sonner | Alerta novo, laudo salvo, link copiado, acesso revogado, chave testada |
| Gaveta | Vaul | Busca de exames abre de baixo e fecha puxando |
| Busca | cmdk | Busca de exames com teclado e ⌘K / Ctrl+K |
| Números | NumberFlow | Sinais da tela Hoje e de Sinais, valor do exame |
| Momento de destaque | Beautiful UI (ThinkingState) | Etapas da leitura do laudo (`ReadingSteps`) |
| Confirmação | React Bits (HoldButton) | "Segure para revogar" acesso de médico |
| Escolha das bibliotecas | pick-ui-library (Emil) e o artigo de Griffin Wooldridge | Base UI + Sonner + Vaul + cmdk + NumberFlow + motion; uma peça de destaque por tela |

Magic UI, Aceternity, RareUI e 21st.dev foram avaliados e ficaram de fora: são feitos para landing pages (fundos animados, efeitos 3D, brilhos) e deixariam o app com a aparência que queremos evitar.

## Cores

| Uso | Token | Hex |
|---|---|---|
| Fundo | `bg` | `#ffffff` |
| Superfície (cartões) | `surface` | `#f4f4f2` |
| Texto principal | `ink` | `#1f2b4d` |
| Texto secundário (mínimo para texto) | `muted` | `#646b81` |
| Ação e marca | `accent` | `#f7941d` (texto sobre ele sempre `ink`) |
| Alto, "procure um médico" | `danger` / `danger-soft` | `#b3261e` / `#fdecea` |
| Baixo, "atenção" | `warn` / `warn-soft` | `#7a5200` / `#fff5d6` |
| Confirmação | `ok` / `ok-soft` | `#2f6b3f` / `#e8f3eb` |

- `faint` (`#8b90a0`, 3,2:1) só serve para ícones e traços, nunca para texto.
- Texto branco sobre laranja não passa no contraste (2,3:1). O botão principal usa texto azul-marinho (6,1:1).
- Status clínico nunca depende só da cor: Alto ↑, Baixo ↓, Normal ✓, Sem referência −.

## Tipografia

- Hanken Grotesk em tudo. Títulos grandes em peso 400 (`display`, `title`), corpo em 15 e 16 px.
- Números com algarismos de largura fixa (`num`, `big-num`).

## Componentes

- **Superfície** (`tile`): fundo `surface`, raio 16 px, sem borda nem sombra.
- **Botões**: `btn-primary` (laranja), `btn-secondary` (contorno), `btn-danger`, `btn-quiet` (link sublinhado). Altura mínima 48 px. Sobem 1 px no hover do mouse e afundam ao pressionar.
- **Alertas** (`AlertCard`): sanfona. Fechado mostra gravidade e título; aberto mostra o que aconteceu, o que fazer e as medições. Na tela do médico ficam sempre abertos.
- **Navegação inferior**: Hoje, Histórico, Sinais, Conversa (com contador), Médico. A aba ativa tem ícone preenchido e um ponto laranja.

## Movimento

Tokens do transitions.dev em `:root` (`--duration-*`, `--ease-*`, `--distance-*`, `--blur-*`). Fechar é mais rápido que abrir. Tudo para com `prefers-reduced-motion`.

## Código de terceiros

- `src/components/vendor/react-bits/HoldButton.tsx`: React Bits, MIT + Commons Clause (`LICENSE.md` na pasta).
- `src/components/ReadingSteps.tsx`: adaptado do ThinkingState do Beautiful UI (MIT).
- `src/components/base/*`: adaptados do shadcn/ui (variante Base UI, MIT).
