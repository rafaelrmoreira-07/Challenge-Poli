# Roteiro do pitch (10 minutos, demo ao vivo)

Personagem: **Carlos, 58 anos** (sintético). Hipertenso, com colesterol alto, exames espalhados por quatro laboratórios desde 2016 e um relógio no pulso.

Site: https://suzetemirandasilva5601-cpu.github.io/Challenge/
Modo apresentação (para projetar): https://suzetemirandasilva5601-cpu.github.io/Challenge/demo/

## Antes de subir no palco

- [ ] No notebook da apresentação, abra o site, vá em ⚙️ **Configurações** e cole a chave da Gemini. Espere "Chave funcionando".
- [ ] Abra o **modo apresentação** (`/demo/`) em tela cheia (F11). Do lado esquerdo fica o celular do paciente; do lado direito, a tela do médico.
- [ ] Clique em **Restaurar dados** no topo, para começar limpo.
- [ ] Faça um teste de leitura de laudo, depois restaure de novo.
- [ ] Opcional: tenha o `exame-papel-2016.jpg` impresso, para fotografar ao vivo com o celular de vocês.

## Roteiro

| Tempo | Parte | O que mostrar | O que dizer |
|---|---|---|---|
| 0:00 – 1:00 | Abertura | Slide com o Carlos | O histórico do Carlos está em quatro laboratórios, dois hospitais, uma gaveta e um relógio. O médico vê só o que ele lembra de levar. Resultado: exame repetido e decisão com informação incompleta. |
| 1:00 – 1:45 | Solução | Slide com os três pilares | Estruturar o passado, acompanhar o presente, mostrar ao médico. Mais de 230 milhões de pessoas por semana já perguntam sobre saúde ao ChatGPT (dado da OpenAI): essas conversas precisam do histórico completo. |
| 1:45 – 2:15 | Demo | Celular: **Início** | Já há dois alertas do relógio e do medidor de pressão: sinais de apneia e pressão acima da meta mesmo com remédio. Abra "Ver dados". |
| 2:15 – 3:30 | Demo | Celular: **Enviar → PDF do laboratório** | A IA lê 14 exames em poucos segundos, com unidade e faixa do laudo. Toque em "Comparar com o original" e salve. Os resultados fora da faixa aparecem em destaque. |
| 3:30 – 4:30 | Demo | **Enviar → Foto de exame em papel** (ou fotografe o impresso) | É o exame de dez anos atrás, torto e amarelado. Salve e abra **Histórico → Exames → Colesterol LDL**: dez anos numa curva, faixa do laudo em verde e o início da atorvastatina marcado. O LDL caiu com o remédio e voltou a subir. |
| 4:30 – 5:00 | Demo | **Histórico → Linha do tempo** | Exames, consultas, remédios e vacinas na mesma linha, com filtros. |
| 5:00 – 6:00 | Demo | Botão do topo **Simular ritmo irregular** | O relógio registrou episódios de ritmo irregular (no espírito do aviso de fibrilação atrial liberado pela FDA em 2018). Aparece o alerta vermelho "procure um cardiologista", com o que fazer numa emergência. |
| 6:00 – 7:30 | Demo | Celular: **Médico** → "Dra. Ana", 1 hora, tudo marcado → Autorizar | Igual ao open finance: o paciente escolhe quem vê, o quê e até quando. **A tela do médico aparece do lado direito na hora**, com o resumo clínico por IA, os alertas, as curvas, os remédios e o laudo original a um clique. |
| 7:30 – 8:00 | Demo | Celular: **Médico → Revogar** | O acesso ficou registrado. Revogue: a tela do médico bloqueia na hora, sem recarregar. |
| 8:00 – 9:15 | Fechamento | Slide de arquitetura e confiança | Os dados ficam com o paciente; a IA lê o laudo e a pessoa confere; regras de alerta explicáveis; consentimento com escopo, prazo, revogação e registro (LGPD art. 11); alertas não são diagnóstico. |
| 9:15 – 10:00 | Fechamento | Slide de próximos passos | App nativo para HealthKit e Health Connect, FHIR e RNDS, laboratórios e operadoras como canais. Referências: Estônia (cidadão acessa os próprios registros desde 2008) e ChatGPT Health (EUA, jan/2026). Frase final: "O Carlos não precisa lembrar de levar nada. O histórico vai com ele." |

**Para a banca testar:** o QR code abaixo do celular no modo apresentação abre o app no celular de quem ler. A pessoa pode navegar, enviar os laudos de exemplo e criar um acesso para médico. No celular dela a IA fica desligada, então os exemplos usam a leitura pré-gravada.

## Plano B

- **A IA demorou ou falhou:** o app tenta outro modelo sozinho. Para os laudos de exemplo existe a leitura pré-gravada, e a tela avisa: diga isso em voz alta, sem esconder.
- **Sem internet:** o site precisa carregar uma vez. Depois disso, sem IA, os exemplos usam a leitura pré-gravada e o resumo do médico vira um resumo por regras.
- **Dados bagunçados de um ensaio:** botão **Restaurar dados** no topo do modo apresentação.

## Perguntas prováveis da banca

- **Como vocês sabem que a IA leu certo?** Saída em schema fixo, revisão do paciente antes de salvar, link para o original em cada resultado. Próximo passo: medir a acurácia por laboratório com laudos anonimizados.
- **Isso é dispositivo médico?** Os alertas orientam a procurar atendimento e não fecham diagnóstico. Para produção, avaliar o enquadramento na ANVISA e fazer revisão clínica das regras.
- **Onde ficam os dados?** No protótipo, no próprio aparelho do paciente; o site não tem servidor. O link do médico leva só o que foi autorizado. Em produção: servidor com banco criptografado, auditoria e revogação válida em qualquer aparelho. A Rivio não recebe dados.
- **Como os dados reais dos wearables entram?** Por um app nativo lendo HealthKit e Health Connect, ou pelas APIs dos fabricantes. O modelo de dados (agregados diários + eventos) já está pronto para isso.
