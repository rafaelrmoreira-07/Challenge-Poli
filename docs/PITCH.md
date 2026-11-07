# Roteiro do pitch (10 minutos, demo ao vivo)

Personagem: **Carlos, 58 anos** (sintético). Hipertenso, com colesterol alto, exames espalhados por quatro laboratórios desde 2016 e um relógio no pulso.

## Antes de subir no palco

- [ ] Rodar `npm run build && npm start -- -H 0.0.0.0` no notebook e abrir pelo IP da rede.
- [ ] **Restaurar dados de demonstração** (Início → Controles da demonstração).
- [ ] Abrir o app no celular (ou no DevTools em modo celular) e deixar uma aba desktop pronta para a visão do médico.
- [ ] Testar uma extração antes de começar, para confirmar que a chave e a rede funcionam.
- [ ] Ter os dois laudos de exemplo à mão: `public/exemplos/laudo-vida-2026-11.pdf` e o `exame-papel-2016.jpg` impresso, para fotografar ao vivo.

## Roteiro

| Tempo | Quem fala | O que mostrar | O que dizer |
|---|---|---|---|
| 0:00 – 1:00 | Abertura | Slide com o Carlos | O histórico do Carlos está em quatro laboratórios, dois hospitais, uma gaveta e um relógio. O médico vê só o que ele lembra de levar. Resultado: exame repetido e decisão com informação incompleta. |
| 1:00 – 1:45 | Solução | Slide com os três pilares | Estruturar o passado, acompanhar o presente, mostrar ao médico. Mais de 230 milhões de pessoas por semana já perguntam sobre saúde ao ChatGPT (dado da OpenAI): essas conversas precisam do histórico completo. |
| 1:45 – 2:15 | Demo | **Início** | Já há dois alertas vindos do relógio e do medidor de pressão: sinais de apneia e pressão acima da meta mesmo com remédio. Abra "Ver dados" de um deles. |
| 2:15 – 3:30 | Demo | **Enviar → PDF do laboratório** | A IA lê 14 exames em poucos segundos, com unidade e faixa do laudo. Mostre "Comparar com o original" e salve. Os resultados fora da faixa aparecem em destaque. |
| 3:30 – 4:30 | Demo | **Enviar → Fotografar** o papel de 2016 | É o exame de dez anos atrás, torto e amarelado. Salve e abra **Exames → Colesterol LDL**: dez anos numa curva, a faixa do laudo em verde e o início da atorvastatina marcado. O LDL caiu com o remédio e voltou a subir. |
| 4:30 – 5:15 | Demo | **Histórico → Linha do tempo** | Exames, consultas, remédios e vacinas na mesma linha, filtráveis. |
| 5:15 – 6:15 | Demo | **Sinais → Simular episódios de ritmo irregular** | O relógio registrou episódios de ritmo irregular (no espírito da notificação de fibrilação atrial liberada pela FDA em 2018). Aparece o alerta vermelho "procure um cardiologista", com o que fazer numa emergência. |
| 6:15 – 7:45 | Demo | **Médico → criar acesso** para "Dra. Ana", 1 hora, tudo marcado → QR code | Igual ao open finance: o paciente escolhe quem vê, o quê e até quando. Peça a alguém da banca para ler o QR, ou abra a aba desktop. A médica vê numa tela: resumo clínico por IA com os pontos de atenção, alertas, curvas, remédios, consultas e o laudo original a um clique. |
| 7:45 – 8:15 | Demo | Voltar ao celular → **Acessos concedidos** → Revogar | O acesso ficou registrado. Revogue e recarregue a tela do médico: "O paciente revogou este acesso". |
| 8:15 – 9:15 | Fechamento | Slide de arquitetura e confiança | Next.js + Gemini; extração com schema e revisão humana; regras de alerta explicáveis; consentimento com escopo, prazo, revogação e auditoria (LGPD art. 11); alertas não são diagnóstico. |
| 9:15 – 10:00 | Fechamento | Slide de próximos passos | App nativo para HealthKit e Health Connect, FHIR e RNDS, laboratórios e operadoras como canais. Referências: Estônia (cidadão acessa os próprios registros desde 2008) e ChatGPT Health (EUA, jan/2026). Frase final: "O Carlos não precisa lembrar de levar nada. O histórico vai com ele." |

## Plano B

- **A IA demorou ou falhou:** o app usa outro modelo automaticamente. Para os laudos de exemplo existe uma leitura pré-gravada, e a tela avisa "leitura simulada": diga isso em voz alta, sem esconder.
- **O QR não abre no celular da banca:** use a aba desktop pelo botão "Abrir visão do médico".
- **Sem internet:** sem a IA, a extração dos exemplos usa a leitura pré-gravada e o resumo do médico vira um resumo por regras. O resto funciona offline.
- **Dados bagunçados de um ensaio:** Controles da demonstração → Restaurar.

## Perguntas prováveis da banca

- **Como vocês sabem que a IA leu certo?** Saída em schema fixo, revisão do paciente antes de salvar, link para o original em cada resultado. Próximo passo: medir a acurácia por laboratório com laudos anonimizados.
- **Isso é dispositivo médico?** Os alertas orientam a procurar atendimento e não fecham diagnóstico. Para produção, avaliar o enquadramento na ANVISA e fazer revisão clínica das regras.
- **Onde ficam os dados?** No protótipo, num arquivo local. Em produção: banco criptografado, isolamento por paciente, auditoria. A Rivio não recebe dados.
- **Como os dados reais dos wearables entram?** Por um app nativo lendo HealthKit e Health Connect, ou pelas APIs dos fabricantes. O modelo de dados (agregados diários + eventos) já está pronto para isso.
