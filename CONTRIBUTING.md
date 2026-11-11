# Como contribuir

Guia rápido para quem entra no grupo.

## 1. Pegar o código

```bash
git clone https://github.com/suzetemirandasilva5601-cpu/Challenge-Poli.git
cd Challenge-Poli
npm install
npm run dev        # http://localhost:3000
```

Requisito: Node.js 20 ou mais novo.

## 2. Onde mexer

```
src/
├── app/
│   ├── (paciente)/   páginas do paciente: enviar, exames, histórico, wearables, compartilhar, configurações
│   ├── medico/       página que o médico abre pelo link compartilhado
│   └── demo/         modo apresentação (para projetar no palco)
├── components/
│   ├── views/        telas completas (Home, Exames, Exame, Médico)
│   └── *.tsx         peças reutilizáveis (Uploader, gráficos, formulário de compartilhamento…)
└── lib/              regras e dados, sem interface
    ├── extraction.ts, gemini.ts   leitura de laudos com IA
    ├── health.ts                  regras de alerta dos sinais vitais
    ├── summary.ts, doctor.ts      resumo clínico para o médico
    ├── share.ts                   consentimento, link e QR code
    ├── store.ts                   dados salvos no navegador
    └── seed.ts                    dados sintéticos do paciente "Carlos Mendes"
public/exemplos/      laudos fictícios usados na demo
docs/                 ARQUITETURA.md e PITCH.md
scripts/              geradores de laudos de exemplo e ícones
```

Leia [docs/ARQUITETURA.md](docs/ARQUITETURA.md) antes de mudar regras de alerta ou o fluxo de consentimento.

## 3. Fluxo de trabalho

1. Atualize o `main`: `git pull origin main`.
2. Crie uma branch por tarefa, com nome curto: `feat/nome-da-tarefa` ou `fix/nome-do-bug`.
3. Faça commits pequenos, com mensagem em português que diga o que mudou.
4. Antes de enviar, rode:
   ```bash
   npm run lint
   npm run typecheck
   npm run build
   ```
5. Envie a branch (`git push -u origin feat/nome-da-tarefa`) e abra um Pull Request para o `main`.
6. Peça a revisão de pelo menos uma pessoa do grupo antes de mesclar.

Evite trabalhar duas pessoas no mesmo arquivo ao mesmo tempo. Combine no grupo quem pega qual tela ou módulo.

## 4. Regras do projeto

- **Só dados sintéticos.** Nunca suba exame, nome ou dado de saúde de pessoa real.
- **Nunca suba chaves de API.** A chave da Gemini fica só no navegador de cada pessoa (⚙ Configurações). Arquivos `.env*` já estão no `.gitignore`.
- O site é estático (sem servidor). Não adicione rotas de API nem código que dependa de servidor.
- Se mudar a estrutura de dados em `src/lib/types.ts`, ajuste também `seed.ts` e `store.ts`.

## 5. Publicar o site (GitHub Pages)

```bash
npm run build:pages     # gera out/ com o prefixo /Challenge-Poli
```

Copie o conteúdo de `out/` (inclusive `.nojekyll`) para a branch `gh-pages` e faça push. O Pages já está configurado para servir a branch `gh-pages` (Settings → Pages).
O script `build:pages` usa sintaxe de shell Unix. No Windows, rode-o pelo Git Bash ou pelo WSL.
