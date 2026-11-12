# Apêndices: a Rivio e o que o Elo Saúde pode somar

Material de apoio à proposta, além do escopo pedido no desafio. A primeira parte resume o que a Rivio é, com base no site dela. A segunda lista ideias que ligam o Elo Saúde ao negócio da Rivio, cada uma com o problema, a proposta, como medir e o esforço.

Fontes: páginas [Início](https://www.rivio.com.br/), [Quem somos](https://www.rivio.com.br/sobre), [Produtos](https://www.rivio.com.br/produtos), [anúncio da Série A](https://www.rivio.com.br/novidades/rivio-extensao-serie-a), [Conheça a Rivio](https://www.rivio.com.br/blog/conheca-a-rivio) e artigos do blog citados em cada apêndice. Lidas em 12/11/2026. Os textos foram resumidos com palavras nossas.

---

## Parte 1. O que é a Rivio

### Negócio

- **O que vende:** opera o ciclo de receita de hospitais (do atendimento ao recebimento do plano de saúde): auditoria de contas, envio dos lotes às operadoras, revisão de preços e recurso de glosas.
- **Para quem:** hospitais e clínicas que atendem planos de saúde, com ERP hospitalar (Tasy, MV, Pixeon, Wareline, SPDATA) e faturamento com planos acima de R$ 1 milhão por mês.
- **Como cobra:** pelo resultado, não por licença nem por hora. A "Garantia Rivio" cobre a diferença se a conta for glosada.
- **Como trabalha:** agentes de IA especializados (auditoria, contratos, preços, análise de glosa, recurso) mais especialistas humanos (enfermeiros auditores, faturistas, engenheiros). Um time fica dentro do hospital antes de qualquer promessa; leva em média 120 dias até operar.
- **Princípio de IA:** a autonomia vem por mérito. O agente começa sugerindo e a pessoa decide; depois executa com supervisão; só opera sozinho quando a precisão se sustenta.

### Números que a própria Rivio publica

| Indicador | Valor |
|---|---|
| Hospitais sem command center | 97% |
| Auditoria manual de 100 contas | 40 h (com a Rivio, 6 minutos) |
| Contas negadas na primeira submissão | 8% |
| Prazo médio entre atendimento e dinheiro | 80 dias |
| Aprovação na primeira submissão | de cerca de 60% para 95% |
| Ciclo de faturamento | de 30 para 7 dias |
| Recurso de glosa | de 6 horas para 30 minutos |
| Contas auditadas | 3,6 milhões |
| Horas de trabalho economizadas | 576 mil |
| Grupos hospitalares atendidos | 13 (Einstein, Sírio-Libanês, Oswaldo Cruz, A.C.Camargo, Hcor, São Camilo, AACD) |
| Captação | Série A de R$ 180 milhões, valor de mercado acima de R$ 1 bilhão (out/2026) |

### Visão e próximos passos

- A tese é "a saúde precisa de engenheiros": hospitais têm complexidade de banco e capacidade de engenharia muito menor.
- O ciclo de receita é a primeira camada, não o limite. As próximas frentes citadas são agendamento e escala, gestão da operação, cadeia de suprimentos e serviços financeiros.
- A ambição declarada é ser o sistema operacional da saúde na América Latina, cuidando de toda a parte administrativa do hospital. O cuidado com o paciente fica com quem cuida.

### Como a Rivio fala

- Frases curtas, números concretos e um vilão claro: a planilha, o retrabalho, a glosa.
- Muitos temas do blog tocam no paciente sem que ele seja o cliente: jornada do paciente, prontuário unificado, gestão de exames, interoperabilidade, FHIR, Meu SUS Digital, care management e saúde baseada em valor.

### Onde o Elo Saúde encaixa

A Rivio enxerga o hospital por dentro. O Elo enxerga o paciente por fora, antes e depois de ele passar pelo hospital. O ponto em comum é a **evidência clínica**: a Rivio audita a conta cruzando com o prontuário e perde dinheiro quando falta documento, autorização ou justificativa. O Elo junta exames, remédios, laudos e medições na mão do paciente, com consentimento. Os apêndices abaixo exploram essa ponte.

Cuidado no pitch: não dizer que existe parceria. Falar em "como o Elo poderia se conectar a quem opera o ciclo de receita, como a Rivio".

---

## Parte 2. Apêndices

Resumo, do mais próximo do negócio da Rivio ao mais distante:

| # | Apêndice | Liga com a Rivio por | Esforço | Dá para mostrar na demo |
|---|---|---|---|---|
| A | Pasta de pré-internação | Glosa por autorização e documentação | Médio | Sim, como protótipo de tela |
| B | Exames que não precisam ser repetidos | Gestão de exames e glosa | Baixo | Sim |
| C | Acompanhamento pós-alta | Care management, reinternação | Médio | Parcial (já temos os alertas) |
| D | Exportar e importar em FHIR, RNDS e Meu SUS Digital | Interoperabilidade | Médio | Sim (botão de exportar) |
| E | Evidência clínica autorizada para a auditoria | Auditoria de contas | Alto | Só como diagrama |
| F | "IA ganha autonomia por mérito" na leitura de laudos | Princípio de IA da Rivio | Baixo | Sim (métrica de correções) |
| G | Modelo de negócio B2B2C pago por resultado | Modelo de cobrança da Rivio | Só proposta | Slide |
| H | Resumo da internação em linguagem simples | Jornada do paciente | Alto | Só como ideia |

### A. Pasta de pré-internação

- **Problema:** em cirurgias e tratamentos eletivos, a falta de autorização prévia, a senha vencida e a documentação incompleta estão entre as glosas mais comuns no padrão TISS (códigos 1818, 1414 e 3052, segundo o artigo [Motivos de glosa](https://www.rivio.com.br/blog/principais-causas-de-glosa)). Na oncologia um único erro de autorização pode custar seis dígitos ([Erros de autorização](https://www.rivio.com.br/blog/erros-de-autorizacao-causam-glosas)).
- **Proposta:** antes da internação, o paciente monta no Elo uma pasta para o hospital: carteirinha do plano, pedido médico, laudos e exames que justificam o procedimento, alergias e remédios em uso. O hospital recebe por link, como o médico já recebe hoje, com prazo e revogação.
- **No Elo:** reaproveita o compartilhamento atual (escopo, prazo, registro de acesso). Novos campos: plano e carteirinha, pedido médico (foto), número da guia.
- **Como medir:** % de autorizações completas na primeira tentativa; tempo entre pedido e autorização; glosas por falta de documento.

### B. Exames que não precisam ser repetidos

- **Problema:** exames redundantes custam caro e também aparecem como glosa e tempo de equipe ([Gestão de exames](https://www.rivio.com.br/blog/gestao-de-exames)). Quando o resultado está em outro sistema, o médico muitas vezes repete o exame ([Interoperabilidade](https://www.rivio.com.br/blog/interoperabilidade-gestao-hospitalar)).
- **Proposta:** no relatório do médico, uma seção "Exames recentes" com o que foi feito nos últimos 90 dias, o valor, o laboratório e o laudo original a um clique.
- **No Elo:** os dados já existem (data, laboratório, laudo guardado). É uma seção nova no relatório do médico e um aviso ao paciente: "seu hemograma de 3 semanas atrás pode servir".
- **Como medir:** exames que o médico deixou de pedir porque já estavam no relatório (perguntar no fim da consulta); custo evitado pela tabela TUSS.
- **Cuidado:** quem decide se o exame vale é o médico. O Elo mostra a data e o valor, não diz "não repita".

### C. Acompanhamento pós-alta

- **Problema:** reinternações e idas evitáveis ao pronto-socorro pesam no custo; care management atua antes da descompensação ([Care management](https://www.rivio.com.br/blog/care-management)). Saúde baseada em valor mede desfecho, não volume ([Value-based healthcare](https://www.rivio.com.br/blog/value-based-healthcare)).
- **Proposta:** por 30 dias depois da alta, o relógio e o medidor de pressão alimentam um painel da equipe de transição do hospital, com os mesmos alertas explicáveis que o paciente já vê.
- **No Elo:** as regras de alerta e o compartilhamento com prazo já existem. Falta um "perfil de pós-alta" (limites próprios, contato da equipe) e o painel do hospital.
- **Como medir:** taxa de reinternação em 30 dias e idas ao pronto-socorro, comparando quem usou e quem não usou.

### D. FHIR, RNDS e Meu SUS Digital

- **Problema:** a RNDS já guarda bilhões de registros em FHIR, e o Meu SUS Digital mostra vacinas, exames e remédios do cidadão ([Prontuário unificado](https://www.rivio.com.br/blog/prontuario-eletronico-unificado-transformacao-digital-saude), [Meu SUS Digital](https://www.rivio.com.br/blog/meu-sus-digital), [FHIR](https://www.rivio.com.br/blog/fhir-o-que-e)). O Elo hoje fala só com ele mesmo.
- **Proposta:** botão "Baixar meu histórico em FHIR" (Patient, Observation, MedicationStatement, Immunization, DocumentReference) e, numa segunda etapa, importar do Meu SUS Digital.
- **No Elo:** os exames já têm chave padronizada por analito; falta mapear para LOINC e gerar o pacote FHIR R4 em JSON, tudo no navegador.
- **Como medir:** % do histórico exportado sem perda; tempo de importação.

### E. Evidência clínica autorizada para a auditoria

- **Problema:** a conta do hospital depende de evidência clínica guardada em outro sistema, em outro formato ([Quem somos](https://www.rivio.com.br/sobre)). A Rivio cruza prontuário e conta para justificar a cobrança.
- **Proposta:** com consentimento explícito e escopo limitado, o paciente autoriza o hospital a anexar ao prontuário os exames e laudos externos que ele trouxe. A evidência entra no prontuário pelo hospital, e é o hospital que a usa na conta.
- **No Elo:** exige servidor, identidade do paciente e integração com o ERP do hospital. É o apêndice de maior esforço.
- **Cuidado:** dado de saúde é sensível (LGPD, art. 11). O uso para faturamento precisa de base legal clara e de consentimento separado do consentimento de cuidado. O paciente nunca vê nem mexe na conta do hospital por aqui.

### F. "IA ganha autonomia por mérito" na leitura de laudos

- **Problema:** a Rivio só deixa o agente agir sozinho depois que a precisão se sustenta ([Quem somos](https://www.rivio.com.br/sobre)). É o mesmo dilema da leitura de laudos.
- **Proposta:** medir, por tipo de exame, quantos campos a pessoa corrige na tela de revisão. Exames com quase nenhuma correção podem ser salvos com um toque; os outros continuam pedindo conferência.
- **No Elo:** a tela de revisão já existe. Falta registrar as correções (valor, unidade, referência) e mostrar a taxa.
- **Como medir:** % de campos corrigidos por analito e por laboratório.

### G. Modelo de negócio B2B2C pago por resultado

- **Ideia:** o paciente não paga. Hospitais e operadoras oferecem o Elo aos seus pacientes e pagam pelo resultado, como a Rivio cobra dos hospitais: autorizações completas na primeira tentativa (A), exames repetidos evitados (B) e reinternações evitadas (C).
- **Por que faz sentido:** o hospital ganha documentação melhor e menos glosa; a operadora ganha menos exame repetido e menos reinternação; o paciente ganha o histórico dele organizado.

### H. Resumo da internação em linguagem simples

- **Ideia:** depois da alta, o paciente recebe no Elo um resumo do que foi feito (procedimentos, remédios, próximos passos) em português simples, ligado ao histórico dele. Melhora a transição para casa e a percepção da jornada ([Jornada do paciente](https://www.rivio.com.br/blog/jornada-do-paciente-e-gestao-hospitalar)).
- **Por que fica por último:** depende do hospital mandar os dados e de revisão clínica do texto.

---

## Sugestão para o pitch

1. Abrir com o problema do paciente (o histórico espalhado), como já está no roteiro.
2. Depois da demo, um slide "Onde o Elo encontra o ciclo de receita": antes da internação (apêndice A), na consulta (B), depois da alta (C).
3. Usar os números da própria Rivio quando falar de glosa e prazo, citando a fonte.
4. Fechar com o princípio comum: a IA lê e sugere, a pessoa confere, e quem cuida do paciente continua sendo quem sabe cuidar.
