# Limites do protótipo e como contornar na demo

O Elo Saúde é um site estático (GitHub Pages, sem servidor). Isso deixa o protótipo simples, gratuito e robusto, mas impõe alguns limites. Este documento lista o que **não dá para fazer** com essa arquitetura até sábado, por que, e como contornar na apresentação. Complementa a seção "O que falta para produção" de [ARQUITETURA.md](ARQUITETURA.md).

## Resumo rápido

| Limite | Por quê | Contorno na demo |
|---|---|---|
| Revogar não bloqueia o médico em outro aparelho | O link leva uma cópia dos dados; sem servidor, nada "puxa de volta" | Mostrar a revogação no **modo apresentação** (mesmo navegador), onde ela é instantânea, e dizer em voz alta como fica em produção |
| Não dá QR code para o médico | O link tem cerca de 6 mil caracteres | Enviar por WhatsApp ou e-mail; o QR do modo apresentação abre o app |
| Cada aparelho tem o seu histórico | Os dados ficam no navegador (localStorage + IndexedDB) | Ensaiar e apresentar no mesmo notebook; nunca em aba anônima |
| A chave da Gemini fica no navegador | Sem servidor para guardá-la | Criar uma chave só para a demo e apagá-la no AI Studio depois de sábado |
| Sem login, sem contas, sem modo cuidador | Sem servidor | Trocar de persona no modo apresentação mostra outros casos; modo cuidador vira slide |
| Wearables não sincronizam sozinhos | Ler o Apple Saúde ou o Health Connect continuamente exige um app nativo no celular | A pessoa exporta os dados do celular e envia o arquivo (Enviar → Importar dados do relógio). Exportação do Apple Saúde e planilhas CSV são lidas no próprio aparelho; outros formatos, pela IA. As personas usam dados simulados, e a tela Sinais diz isso |
| "WhatsApp" é um chat dentro do app | WhatsApp de verdade exige Cloud API da Meta e servidor | Slide de próximos passos |
| Remédios e vacinas não podem ser adicionados pela tela | Ainda não existe formulário; vêm dos dados iniciais | Mostrar os já carregados; se der tempo, adicionar um formulário simples |
| Até 5 laudos por envio | A chave gratuita da Gemini aceita poucas leituras por minuto | A IA lê um de cada vez; se um falhar, só ele pede "Tentar ler de novo" |
| Laudo de imagem guarda o texto, não a imagem do exame | Ler a imagem médica (DICOM) é outro problema; o que o médico usa no dia a dia é o laudo | A IA copia a conclusão como está e resume os achados, sem interpretar; o original fica a um clique |
| O Elo não converte unidades | Converter exige regras por exame e validação clínica | Nomes diferentes viram o mesmo exame; unidades diferentes geram aviso para o médico conferir |

## Em detalhe

### 1. Revogação entre aparelhos

No mesmo navegador, a tela do médico lê os dados ao vivo e bloqueia na hora quando o paciente revoga. É o que o modo apresentação (`/demo/`) faz, com o celular e a tela do médico lado a lado.

Em outro aparelho, o médico abre uma cópia que veio dentro do link. O app confere o prazo ao abrir, mas não tem como saber que o paciente revogou depois.

**Na demo:** fazer a revogação no modo apresentação. Usar prazo curto ("1 hora") para mostrar que o acesso expira sozinho.

**O que resolveria:** um servidor (ex.: Supabase) guardando os acessos. O link vira curto, o servidor confere o consentimento a cada abertura, e a revogação vale em qualquer aparelho, com QR code. É cerca de um dia de trabalho e mexe na base do app; não vale o risco antes de sábado.

### 2. Dados só no navegador

O histórico fica no navegador de quem usa. Consequências:

- quem abrir o site no próprio celular (pelo QR) vê os dados iniciais da persona, não o que foi feito no notebook da apresentação;
- limpar os dados do navegador, ou usar aba anônima, apaga tudo;
- dois notebooks não compartilham o mesmo histórico.

**Na demo:** um notebook só, sempre o mesmo navegador. "Restaurar dados" antes de cada ensaio.

### 3. Chave da Gemini

Cada pessoa cola a própria chave em Configurações, e ela fica salva naquele navegador. Para um protótipo é aceitável; em produção a chave ficaria no servidor.

**Na demo:** criar uma chave nova só para o sábado, colar no notebook da apresentação, testar na sexta e apagar no AI Studio depois do evento. Se a IA falhar ao vivo, os três laudos de exemplo usam a leitura pré-gravada e a tela avisa isso (diga em voz alta, sem esconder).

### 4. A IA pode errar

Mesmo com a revisão por confiança, a IA pode ler um número errado com "alta" confiança. Por isso nenhum resultado entra no histórico sem a pessoa conferir e salvar, e cada resultado tem link para o laudo original.

### 5. Insights cruzados são regras fixas

O cartão "Juntando seus dados" vem de três regras escritas à mão (batimentos em repouso + tireoide ou hemoglobina; ritmo irregular + TSH ou potássio; sinais de apneia + pressão acima da meta). Elas foram escolhidas porque funcionam sempre, sem depender da IA, e nunca dizem o que a pessoa tem: só mostram os dois fatos e orientam levar ao médico. Não descobrem relações novas. As regras são de demonstração e precisam de revisão clínica (estudantes de medicina e residentes podem ajudar a validar).

### 6. Começar do zero e personas

Dois links prontos para a apresentação (troque o endereço base se usar outro site):

- **App vazio, com guia de boas-vindas:** `…/Challenge-Poli/?persona=nova`
- **Histórico completo do Carlos:** `…/Challenge-Poli/?persona=carlos`

Abrir um desses links **apaga os dados deste navegador** e começa a persona do início. Depois de aberto, o parâmetro sai do endereço: recarregar a página não apaga o progresso. Tudo o que a pessoa envia fica salvo no navegador, mesmo fechando a aba (vale o limite do item 2: não aparece em outro aparelho).

Roteiro sugerido: abrir o app vazio ("é assim que a Ana encontra o Elo no primeiro dia"), passar pelo guia, enviar um laudo ao vivo e então abrir o link do Carlos ("agora imagine a pasta inteira de dez anos").

O modo apresentação e os "Controles da demonstração" (no fim da tela inicial) também trocam de persona:

| Persona | Para quê |
|---|---|
| Começar do zero | Primeiro uso: guia de boas-vindas, cadastro e telas vazias |
| Carlos Mendes, 58 | A demo principal (dados originais do protótipo) |
| Juliana Rocha, 34 | Insight cruzado: batimentos subindo no anel + TSH baixo em março |
| Lúcia Ferreira, 78 | Sem relógio nenhum: todas as telas precisam funcionar vazias |
| Pedro Lima, 22 | Saudável e atleta: nenhum alerta pode aparecer |

Trocar de persona apaga os exames enviados e os acessos criados. Não há "uma conta com vários perfis" (modo cuidador): isso exigiria contas e servidor.

### 7. Dados do relógio por arquivo

O app não se conecta ao relógio. A pessoa exporta os dados do celular e envia o arquivo em **Enviar → Importar dados do relógio**:

| Arquivo | Como é lido |
|---|---|
| Exportação do Apple Saúde (`exportar.zip` ou `export.xml`) | No navegador, em partes (arquivos de centenas de MB funcionam). Tipos do HealthKit: batimento em repouso, variabilidade, passos (sem somar iPhone e relógio em dobro), sono, saturação, distúrbios respiratórios, pressão e batimento irregular |
| Planilha CSV com uma linha por dia (Health Auto Export, Health Data Export, Google Fit diário, a nossa) | No navegador; as colunas são reconhecidas pelo nome, em português ou inglês |
| `.zip` do Google Takeout | No navegador, usando a planilha diária de dentro do arquivo |
| Outros (PDF de relatório, JSON, planilha sem colunas reconhecíveis) | Pela Gemini, com a chave de Configurações |

Entram os últimos 180 dias. A primeira importação troca a simulação; as seguintes se juntam às anteriores. Um sinal que o aparelho não mede fica "sem medição" e nunca vira zero (saturação zero dispararia o alerta de apneia). A tela Sinais e a do médico mostram a origem dos dados.

Na demo: **Enviar → Importar dados do relógio → Exportação do Apple Saúde (exemplo) → Usar**. O exemplo é gerado com datas até hoje e tem 3 dias de batimento irregular nas últimas duas semanas, então o alerta aparece.


### 8. Laudos de imagem e procedimentos

Ecocardiograma, eletrocardiograma, ultrassom, raio X, tomografia, endoscopia: o valor está no texto, não numa tabela. A leitura por IA reconhece o tipo do laudo, **copia a conclusão como está escrita** e resume os achados em até 4 frases, sem interpretar. A pessoa confere com o original ao lado e salva. Se a leitura falhar, dá para preencher à mão ("É um laudo de imagem ou procedimento").

O laudo aparece no Histórico (seção própria e linha do tempo), na tela do médico ("Laudos de imagem e procedimentos", com a origem do texto), no resumo por IA e no FHIR (DiagnosticReport com a conclusão).

Na demo: **Enviar → Laudo de ecocardiograma → Usar**. O Carlos já tem um eletrocardiograma de 2024 em ritmo sinusal, a referência para o médico comparar com o ritmo irregular do relógio.

### 9. Padronização, procedência e cobertura

- **Padronização:** cada laboratório escreve o exame de um jeito ("Glicemia de jejum", "Glicose plasmática"). O Elo guarda o nome do laudo e junta tudo numa chave padronizada. A tela de cada exame mostra "Mesmo exame, nomes diferentes"; no médico, cada gráfico diz de quantos locais e nomes veio.
- **Procedência:** cada valor sabe se ficou como a IA leu, se foi corrigido ou digitado pelo paciente. O médico vê isso em cada resultado; corrigido e digitado aparecem em destaque.
- **Cobertura:** período, laudos, locais, dias de relógio, lacunas de 18 meses ou mais e o que não foi compartilhado. No médico, "Cobertura do histórico"; no Histórico, o convite a enviar exames do período que falta.

Na demo: o Carlos tem uma lacuna de ago/2019 a mar/2021. O laudo de exemplo **Foto difícil de ler** é de 2020: enviar fecha a lacuna ao vivo, e o valor ilegível que a pessoa preenche aparece para o médico como "corrigido pelo paciente".
