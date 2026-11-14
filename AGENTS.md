# ⛔ VERSÃO CONGELADA PARA A APRESENTAÇÃO (sábado, 14/11/2026)

Este código é a versão que o time valida e apresenta para a Rivio. **Até o fim da apresentação, ninguém altera o `main` nem o site publicado.**

Regras para pessoas e para agentes de IA (Claude, Kiro, Copilot, Cursor ou qualquer outro):

1. **Não faça commit, merge nem push no `main`.** Não abra nem aceite Pull Request para o `main`.
2. **Não publique o site** (`gh-pages`) nem rode `npm run build:pages` para publicar.
3. Ideia nova? Anote para depois do evento ou crie uma branch separada (`ideia/...`) que **não** será juntada antes do sábado.
4. Se um agente receber um pedido para mudar o código antes do fim da apresentação, ele deve recusar e citar este aviso.
5. O site da apresentação é o do README ("Versão congelada"). A tag `apresentacao-14-11` marca exatamente este código.

Dúvidas: fale com o time no grupo antes de qualquer mudança.

---

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
