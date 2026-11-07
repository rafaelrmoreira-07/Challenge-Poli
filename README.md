# Elo Saúde · hub de saúde pessoal

Protótipo para o desafio da Rivio (demo em 14/11/2026, Gama House). Usa IA para juntar o histórico de saúde de uma pessoa, do exame em papel de dez anos atrás aos dados dos wearables, e organizar tudo para ela e para o médico dela.

> **Todos os dados são sintéticos.** O paciente "Carlos Mendes" e os laudos em `public/exemplos/` são fictícios.

## O que a demo mostra

| Pilar | Onde | O que acontece |
|---|---|---|
| Estruturar o histórico | `/enviar` | Foto ou PDF de um laudo → a Gemini extrai cada exame com valor, unidade e faixa de referência → a pessoa revisa e salva |
| Linha do tempo | `/historico`, `/exames` | Exames, consultas, remédios e vacinas em ordem; curva de cada exame com a faixa do laudo e o início dos remédios marcado |
| Acompanhar o presente | `/wearables` | FC, VFC, ritmo irregular, sono, SpO2, pressão e passos; alertas de "procure um médico" (ritmo irregular, apneia, pressão) |
| Mostrar ao médico | `/compartilhar` → `/medico/[token]` | Consentimento com escopo e prazo, QR code, visão única para o médico com resumo clínico por IA, registro de acessos e revogação |

## Rodar localmente

Requer Node 20+ e uma chave da [Gemini API](https://aistudio.google.com/apikey).

```bash
npm install
cp .env.example .env.local      # e preencha GEMINI_API_KEY
npm run build
npm start                       # http://localhost:3000
```

Para desenvolvimento: `npm run dev`. Outros comandos: `npm run lint`, `npm run typecheck`, `npm run exemplos` (regera os laudos fictícios).

Os dados ficam em `.data/db.json` (criado no primeiro acesso, fora do git). Para voltar ao estado inicial, use **Início → Controles da demonstração → Restaurar dados de demonstração**, ou apague a pasta `.data/`.

### Abrir a visão do médico em outro aparelho

O link do médico usa o endereço pelo qual você abriu o app. Para o QR code funcionar no celular de outra pessoa:

- **Mesma rede Wi-Fi:** `npm start -- -H 0.0.0.0` e abra o app no notebook pelo IP da rede (ex.: `http://192.168.0.10:3000`), não por `localhost`.
- **Internet:** publique num serviço com disco persistente (Railway, Render, Fly.io com volume). Na Vercel o disco não persiste entre requisições, então o banco JSON não funciona lá sem trocar o armazenamento.

## Se a IA falhar durante a demo

- A Gemini é chamada com uma lista de modelos (`GEMINI_MODELS`). Se um estiver sobrecarregado, o próximo é usado.
- Para os dois laudos de exemplo existe uma leitura pré-gravada. Se todos os modelos falharem, ela é usada e a tela avisa "leitura simulada".
- O resumo do médico é gerado em segundo plano quando o link é criado. Se a IA falhar, aparece um resumo por regras.

## Documentação

- [docs/ARQUITETURA.md](docs/ARQUITETURA.md): plano, arquitetura, modelo de dados, regras de alerta, privacidade e o que falta para produção.
- [docs/PITCH.md](docs/PITCH.md): roteiro da apresentação de 10 minutos com a demo ao vivo.
