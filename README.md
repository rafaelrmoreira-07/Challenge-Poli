# Elo Saúde · hub de saúde pessoal

> ## ⛔ Versão congelada para a apresentação (14/11/2026)
>
> Este é o código que o time validou e apresenta para a Rivio. **Até o fim da apresentação, não altere o `main` nem publique o site.** Ideias novas ficam para depois (veja `AGENTS.md`).
>
> - **Site da apresentação:** https://rafaelrmoreira-07.github.io/Challenge-Poli/ · modo apresentação: https://rafaelrmoreira-07.github.io/Challenge-Poli/demo/
> - **Tag do código congelado:** `apresentacao-14-11`
> - **Cópia offline:** pacote `elo-saude-apresentacao.zip` com o site pronto (instruções dentro).


Protótipo para o desafio da Rivio (demo em 14/11/2026, Gama House). Usa IA para juntar o histórico de saúde de uma pessoa, do exame em papel de dez anos atrás aos dados dos wearables, e organizar tudo para ela e para o médico dela.

**Site antigo (redesenho do Matteo, sem as melhorias):** https://suzetemirandasilva5601-cpu.github.io/Challenge-Poli/
**Para apresentar, use o site congelado do aviso acima.**

> **Todos os dados são sintéticos.** O paciente "Carlos Mendes" e os laudos em `public/exemplos/` são fictícios.

## O que a demo mostra

| Pilar | Onde | O que acontece |
|---|---|---|
| Estruturar o histórico | Enviar | Foto ou PDF de um laudo → a Gemini extrai cada exame com valor, unidade e faixa de referência → a pessoa revisa e salva |
| Linha do tempo | Histórico | Exames, consultas, remédios e vacinas em ordem; curva de cada exame com a faixa do laudo e o início dos remédios marcado |
| Acompanhar o presente | Sinais | FC, VFC, ritmo irregular, sono, SpO2, pressão e passos; alertas de "procure um médico" |
| Mostrar ao médico | Médico | Consentimento com escopo e prazo; link para o médico com resumo clínico por IA; registro de acessos e revogação |

## Como funciona a versão web

- É um site estático (Next.js com `output: "export"`), publicado no GitHub Pages. Não há servidor.
- O histórico fica salvo **no navegador** de quem usa (localStorage + IndexedDB para os arquivos dos laudos).
- A IA é chamada direto do navegador. **A chave da Gemini não fica no site:** cada pessoa cola a sua em ⚙️ Configurações e ela fica salva só naquele navegador.
- Sem chave, os dois laudos de exemplo usam uma leitura pré-gravada e o resumo do médico é feito por regras. Todo o resto funciona.
- Instalável no celular (PWA): "Adicionar à Tela de Início" no iPhone ou "Instalar app" no Android.

## Rodar localmente

```bash
npm install
npm run dev                 # http://localhost:3000
```

Build estático: `npm run build` gera `out/`, e `npm start` serve essa pasta. Para o GitHub Pages use `npm run build:pages` (prefixo `/Challenge-Poli`).

Outros comandos: `npm run lint`, `npm run typecheck`, `npm run exemplos` (regera os laudos fictícios), `npm run exemplos:dificil` (regera o laudo com carimbo usado para mostrar a revisão por confiança), `npm run icones`.

## Publicar no GitHub Pages

O site é servido a partir do ramo `gh-pages`:

```bash
npm run build:pages
# copie o conteúdo de out/ para o ramo gh-pages (inclui o arquivo .nojekyll) e faça push
```

## Documentação

- [CONTRIBUTING.md](CONTRIBUTING.md): como clonar, estrutura das pastas, fluxo de branches e regras do grupo.
- [docs/ARQUITETURA.md](docs/ARQUITETURA.md): arquitetura, regras de alerta, privacidade e o que falta para produção.
- [docs/PITCH.md](docs/PITCH.md): roteiro da apresentação de 10 minutos com a demo ao vivo.
- [docs/LIMITACOES.md](docs/LIMITACOES.md): o que a arquitetura sem servidor não permite, como contornar na demo, e as personas de teste.
- [docs/APENDICES.md](docs/APENDICES.md): análise da Rivio e ideias que ligam o Elo ao ciclo de receita dos hospitais.
