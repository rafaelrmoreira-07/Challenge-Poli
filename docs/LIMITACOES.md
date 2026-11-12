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
| Wearables são simulados | Ler Apple Health ou Health Connect exige app nativo | Dizer que o modelo de dados (agregados diários) já está pronto para isso |
| "WhatsApp" é um chat dentro do app | WhatsApp de verdade exige Cloud API da Meta e servidor | Slide de próximos passos |
| Remédios e vacinas não podem ser adicionados pela tela | Ainda não existe formulário; vêm dos dados iniciais | Mostrar os já carregados; se der tempo, adicionar um formulário simples |

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

### 6. Personas

O modo apresentação e os "Controles da demonstração" (no fim da tela inicial) trocam entre quatro personas sintéticas:

| Persona | Para quê |
|---|---|
| Carlos Mendes, 58 | A demo principal (dados originais do protótipo) |
| Juliana Rocha, 34 | Insight cruzado: batimentos subindo no anel + TSH baixo em março |
| Lúcia Ferreira, 78 | Sem relógio nenhum: todas as telas precisam funcionar vazias |
| Pedro Lima, 22 | Saudável e atleta: nenhum alerta pode aparecer |

Trocar de persona apaga os exames enviados e os acessos criados. Não há "uma conta com vários perfis" (modo cuidador): isso exigiria contas e servidor.
