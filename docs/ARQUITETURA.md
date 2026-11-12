# Plano e arquitetura

## Escopo do protótipo

Um site web mobile-first para o paciente (instalável como app) e uma tela desktop para o médico. Um paciente de demonstração com dados sintéticos de 10 anos. Publicado como site estático no GitHub Pages, sem servidor.

| Parte | Real no protótipo | Simulado no protótipo |
|---|---|---|
| Leitura de laudos (foto/PDF) | Sim, Gemini API com saída em JSON estruturado | Leitura pré-gravada dos 2 laudos de exemplo, sem chave ou se a IA cair |
| Histórico de exames, consultas, remédios, vacinas | Sim | Dados iniciais sintéticos |
| Wearables | Regras de alerta e gráficos | Série de 90 dias gerada por script; botão que injeta episódios de ritmo irregular |
| Consentimento e visão do médico | Escopo, prazo, revogação e registro de acesso | Sem login de médico ou paciente |
| Resumo clínico por IA | Sim, Gemini | Resumo por regras sem chave ou se a IA cair |
| Conversa com o Elo (estilo WhatsApp) | Avisos de alerta, perguntas sobre exames e medições, envio de laudo e relatório para o médico | Roda dentro do app, sem WhatsApp de verdade; respostas por regras |

## Visão geral

```
 Navegador do paciente (celular ou notebook)
 ┌───────────────────────────────────────────────────────────┐
 │ Início · Histórico · Enviar · Sinais · Médico · ⚙️          │
 │                                                           │
 │ lib/store.ts ─── histórico em localStorage,               │
 │                  laudos originais em IndexedDB            │
 │ lib/health.ts ── séries de exames e regras de alerta      │
 │ lib/extraction.ts ─ prompt + schema + normalização ───────┼──► Gemini API (Google)
 │ lib/summary.ts ── contexto clínico + resumo ──────────────┼──► (chave do usuário)
 │ lib/share.ts ─── consentimento e link autocontido         │
 └───────────────┬───────────────────────────────────────────┘
                 │ link /medico/?t=TOKEN#d=<dados compactados>
                 ▼
 Navegador do médico: /medico/ (lê os dados do próprio link)

 GitHub Pages: só entrega os arquivos estáticos (HTML, JS, CSS, laudos de exemplo).
```

## Fluxo 1: do papel ao dado estruturado

1. O paciente fotografa ou escolhe um arquivo (PDF, JPG, PNG, WEBP, HEIC, até 10 MB).
2. O navegador envia o arquivo direto para a Gemini com:
   - instruções para laudos brasileiros (vírgula decimal, ponto de milhar, faixas por sexo e idade, "desejável < 130");
   - um catálogo de 24 analitos com sinônimos, para dar a cada exame uma chave canônica (`ldl`, `hba1c`...). É isso que junta, numa mesma curva, resultados que cada laboratório escreve de um jeito;
   - um `responseSchema` que obriga a resposta a vir em JSON.
3. A resposta é normalizada (números finitos, datas válidas, tamanhos limitados) e vai para a tela de revisão.
4. O paciente confere lado a lado com o original, corrige e salva. O arquivo original fica no IndexedDB e abre com "Ver original".

Se a chave não estiver configurada ou todos os modelos falharem, o app calcula o SHA-256 do arquivo. Se for um dos laudos de exemplo, usa a leitura pré-gravada e avisa na tela.

Nos testes, os 21 valores e faixas dos dois laudos de exemplo foram extraídos corretamente em 4 a 6 segundos.

## Fluxo 2: wearables e alertas

As regras ficam em `src/lib/health.ts`. Elas são simples e explicáveis: cada alerta mostra os dados que o geraram.

| Alerta | Regra | Nível |
|---|---|---|
| Ritmo cardíaco irregular | 2 ou mais episódios em 14 dias | Procure um médico (cardiologia) |
| Sinais de apneia do sono | 6 ou mais noites em 30 com SpO2 mínima < 90% e ≥ 15 distúrbios respiratórios/h | Procure um médico (medicina do sono) |
| Pressão acima da meta | Média de 30 dias ≥ 130/80 (≥ 140/90 sobe o nível) | Atenção ou procure um médico |
| FC de repouso mais alta | Média de 7 dias ≥ 5 bpm acima da média de 2 a 8 semanas atrás | Atenção |
| Exames fora da faixa | Último resultado do último ano fora da faixa do laudo | Atenção |

Os alertas indicam quando procurar atendimento. Eles não fazem diagnóstico, e a interface diz isso.

## Fluxo 3: consentimento e visão do médico

- O paciente escolhe o médico, o que compartilhar (exames, consultas, medicamentos, vacinas, wearables) e o prazo (1 h, 24 h, 7 ou 30 dias).
- O app gera um token aleatório de 144 bits e, com IA ligada, o resumo clínico (o contexto enviado à IA não leva o nome do paciente).
- O link do médico é `/medico/?t=TOKEN#d=...`. O trecho depois do `#` leva uma cópia compactada (deflate) **só dos dados autorizados** e do resumo. Navegadores não enviam esse trecho ao servidor, então o GitHub Pages nunca recebe os dados.
- **No mesmo navegador do paciente** (ex.: modo apresentação), a visão do médico lê os dados ao vivo: o registro de acesso funciona, e revogar bloqueia a tela na hora.
- **Em outro aparelho**, a visão do médico usa a cópia do link e confere o prazo. Revogar não alcança uma cópia já enviada: esse é o limite de não ter servidor (ver "O que falta para produção").
- O link tem cerca de 6 mil caracteres, o que é grande demais para um QR code. Por isso ele é enviado por WhatsApp ou e-mail (botão "Enviar link" no celular). O QR code do modo apresentação abre o app do paciente.

## Modelo de dados (`src/lib/types.ts`)

`Patient`, `SourceDocument` (laudo e origem da leitura), `LabResult` (analito, valor, unidade, faixa, documento), `Encounter`, `Medication`, `Vaccine`, `WearableDay` (agregados diários), `WearableDevice`, `Share` (consentimento + `accessLog` + cache do resumo).

## Privacidade e segurança no protótipo

- Nenhuma chave no código nem no site publicado. A chave da Gemini fica no navegador de quem a digitou.
- O histórico nunca sai do aparelho, exceto: (1) o arquivo do laudo e o contexto clínico, enviados à Gemini quando a IA está ligada; (2) a cópia autorizada, dentro do link que o paciente envia ao médico.
- Uploads: lista fechada de tipos e limite de 10 MB. Dados vindos da IA ou do formulário são validados e limitados antes de gravar.
- A visão do médico não é indexada por buscadores (`noindex`).
- Dado de saúde é dado sensível pela LGPD (art. 11). O consentimento é explícito, por finalidade, com prazo, revogável e registrado.

## O que falta para produção

1. **Servidor e contas:** login do paciente; médico identificado por CRM; links curtos que apontam para o servidor, que confere o consentimento a cada acesso. Isso torna a revogação imediata em qualquer aparelho e permite QR code.
2. **Armazenamento:** Postgres com criptografia em repouso, arquivos em object storage, isolamento por paciente e trilha de auditoria imutável. A chave da IA fica no servidor.
3. **Wearables de verdade:** app nativo para ler HealthKit (iOS) e Health Connect (Android), ou integração com as APIs dos fabricantes.
4. **Interoperabilidade:** padrão FHIR e integração com a RNDS (Rede Nacional de Dados em Saúde), laboratórios e operadoras.
5. **IA:** conjunto de laudos reais anonimizados para medir a acurácia da extração por laboratório, e contrato de processamento de dados com o provedor.
6. **Regulatório:** avaliar o enquadramento dos alertas como software médico na ANVISA, e revisão clínica das regras.

A primeira versão com servidor (Next.js com rotas de API, banco em arquivo e links de médico validados no servidor) está no histórico do git, no commit `5b3e9cd`.

## Conversa com o Elo

Chat dentro do app, no estilo do WhatsApp (`/conversa`, botão de balão no cabeçalho). Não usa o WhatsApp de verdade: roda no navegador, como o resto do protótipo.

- `lib/chat.ts`: mensagens salvas no navegador (`localStorage`, chave `elo-saude:chat:v1`) e a lista de alertas já avisados. Restaurar a demonstração apaga a conversa.
- `lib/chatbot.ts`: respostas por palavra-chave, sem IA na conversa. Cada resposta vem dos dados do histórico: alertas, exames alterados, um exame pelo nome ("como está meu colesterol LDL?"), medições dos últimos 7 dias, remédios e acessos de médicos. Sintomas de emergência ("dor no peito", "falta de ar"...) sempre recebem a orientação de ligar 192 antes de qualquer outra coisa.
- **Alertas:** `components/ChatNotifier.tsx` compara os alertas atuais com os já avisados. Alerta novo vira mensagem na conversa e um aviso no topo da tela. Na primeira visita, os alertas existentes entram na conversa sem aviso (só o contador).
- **Envio de laudo:** o arquivo passa pela mesma leitura da tela Adicionar (`extractLabReport`). O Elo mostra todos os valores lidos e só salva quando o paciente toca em "Salvar no histórico". O arquivo esperando confirmação fica só na memória: recarregar a página descarta.
- **Relatório para o médico:** o Elo pergunta o nome do médico e o prazo, cria o acesso com `createShare` (todos os tipos de dado) e devolve o link, com botão para revogar.

Para virar WhatsApp de verdade: WhatsApp Business Cloud API (conta Meta verificada, número próprio, templates aprovados), um servidor para o webhook, os dados do paciente num banco com login e vínculo do número de WhatsApp à conta, e cuidados de LGPD para dado de saúde (consentimento, criptografia, registro de acesso). As regras de `lib/chatbot.ts` podem ser reaproveitadas no servidor.

## Apêndices no app

Detalhes em [APENDICES.md](APENDICES.md). No código:

- `lib/admission.ts`: pasta de pré-internação, conferência (com o código de glosa de cada pendência), alta simulada e pós-alta.
- `lib/fhir.ts`: exportar e importar em FHIR R4. Exemplo fictício em `public/exemplos/rnds-exemplo.json`.
- `lib/quality.ts`: estágio de conferência de cada exame na leitura de laudos.
- `components/views/InternacaoView.tsx` (paciente) e `components/views/HospitalView.tsx` (o que o hospital vê pelo link).
- O link do hospital usa a mesma rota `/medico/`, com `kind: "hospital"` no compartilhamento. Ele leva só os laudos escolhidos na pasta, a pasta (sem o arquivo do pedido, que fica no aparelho) e os registros do pós-alta.
- Campos novos no banco (`admissions`, `checkins`, `readingStats`, `fhirExports`) são opcionais, para não apagar o que já estava salvo no navegador.
