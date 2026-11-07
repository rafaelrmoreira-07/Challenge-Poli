# Plano e arquitetura

## Escopo do protótipo

Um app web mobile-first para o paciente e uma tela desktop para o médico, rodando num único servidor Next.js. Um paciente de demonstração com dados sintéticos de 10 anos.

| Parte | Real no protótipo | Simulado no protótipo |
|---|---|---|
| Leitura de laudos (foto/PDF) | Sim, Gemini API com saída em JSON estruturado | Leitura pré-gravada só se a IA cair |
| Histórico de exames, consultas, remédios, vacinas | Sim | Dados iniciais sintéticos |
| Wearables | Regras de alerta e gráficos | Série de 90 dias gerada por script; botão que injeta episódios de ritmo irregular |
| Consentimento e visão do médico | Sim: token, escopo, prazo, revogação, registro de acesso | Sem login de médico ou paciente |
| Resumo clínico por IA | Sim, Gemini | Resumo por regras se a IA cair |

## Visão geral

```
 Celular do paciente                         Navegador do médico
 ┌──────────────────────────┐                ┌──────────────────────────┐
 │ Início · Histórico ·     │                │ /medico/[token]          │
 │ Enviar · Sinais · Médico │                │ resumo IA, alertas,      │
 └────────────┬─────────────┘                │ curvas, laudos originais │
              │                              └────────────┬─────────────┘
              ▼                                           ▼
 ┌─────────────────────────────────────────────────────────────────────┐
 │ Next.js 16 (App Router, Cache Components)                           │
 │  Server Components ── leem o banco em tempo de requisição           │
 │  Server Actions ───── salvar exame, simular, compartilhar, revogar  │
 │  Route Handlers ───── POST /api/exames/extrair                      │
 │                       GET  /api/documentos/[id]                     │
 │                       GET  /api/medico/[token]/documentos/[id]      │
 │                       POST /api/medico/[token]/resumo               │
 │  lib/health.ts ────── séries de exames e regras de alerta           │
 │  lib/extraction.ts ── prompt + schema + normalização do laudo       │
 │  lib/summary.ts ───── contexto clínico + resumo para o médico       │
 │  lib/share.ts ─────── consentimento: validação, escopo, auditoria   │
 └──────────────┬──────────────────────────────────────┬───────────────┘
                ▼                                      ▼
   .data/db.json + .data/uploads/            Gemini API (Google)
   (banco JSON local do protótipo)           lista de modelos com fallback
```

## Fluxo 1: do papel ao dado estruturado

1. O paciente fotografa ou escolhe um arquivo (PDF, JPG, PNG, WEBP, HEIC, até 10 MB).
2. `POST /api/exames/extrair` confere tipo, tamanho e assinatura do arquivo, guarda o original e envia para a Gemini com:
   - instruções para laudos brasileiros (vírgula decimal, ponto de milhar, faixas por sexo e idade, "desejável < 130");
   - um catálogo de 24 analitos com sinônimos, para dar a cada exame uma chave canônica (`ldl`, `hba1c`...). É isso que junta, numa mesma curva, resultados que cada laboratório escreve de um jeito;
   - um `responseSchema` que obriga a resposta a vir em JSON.
3. A resposta é normalizada (números finitos, datas válidas, tamanhos limitados) e volta para a tela de revisão.
4. O paciente confere lado a lado com o original, corrige e salva. Cada resultado guarda o documento de origem, e o médico consegue abrir o laudo original.

Nos testes com os laudos de exemplo, os 21 valores e faixas foram extraídos corretamente em 3 a 6 segundos.

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
- É gerado um token aleatório de 144 bits. O link e o QR code levam a `/medico/[token]`.
- Em cada acesso o servidor confere se o token existe, se não expirou e se não foi revogado. Depois recorta os dados pelo escopo e registra o acesso, que o paciente vê.
- O resumo por IA recebe um contexto estruturado sem o nome do paciente. Ele é gerado em segundo plano quando o link é criado e fica em cache enquanto os dados não mudam.

## Modelo de dados (`src/lib/types.ts`)

`Patient`, `SourceDocument` (laudo e origem da leitura), `LabResult` (analito, valor, unidade, faixa, documento), `Encounter`, `Medication`, `Vaccine`, `WearableDay` (agregados diários), `WearableDevice`, `Share` (consentimento + `accessLog` + cache do resumo).

## Privacidade e segurança no protótipo

- A chave da IA fica só no servidor (`.env.local`, fora do git).
- Uploads: lista fechada de tipos, conferência dos bytes iniciais, limite de 10 MB, nomes gerados pelo servidor.
- Dados que vêm da IA ou do formulário são validados e limitados antes de gravar.
- A visão do médico não é indexada (`noindex`) e os laudos são servidos com `no-store`.
- Dado de saúde é dado sensível pela LGPD (art. 11). O consentimento é explícito, por finalidade, com prazo, revogável e auditável.

## O que falta para produção

1. **Contas e autenticação:** login do paciente, e médico identificado por CRM, com validação no conselho.
2. **Armazenamento:** Postgres com criptografia em repouso, arquivos em object storage, isolamento por paciente e trilha de auditoria imutável.
3. **Wearables de verdade:** app nativo para ler HealthKit (iOS) e Health Connect (Android), ou integração com as APIs dos fabricantes.
4. **Interoperabilidade:** padrão FHIR e integração com a RNDS (Rede Nacional de Dados em Saúde), laboratórios e operadoras.
5. **IA:** conjunto de laudos reais anonimizados para medir a acurácia da extração por laboratório, e contrato de processamento de dados com o provedor.
6. **Regulatório:** avaliar o enquadramento dos alertas como software médico na ANVISA, e revisão clínica das regras.
