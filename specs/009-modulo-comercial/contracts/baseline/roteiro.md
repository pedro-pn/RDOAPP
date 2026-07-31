# Roteiro clicável da referência

O caminho que um levantamento e uma proposta percorrem de ponta a ponta: o que se
preenche primeiro, o que destrava o quê, onde o app exige confirmação.

Vira duas coisas: o **script do tutorial de primeiro acesso** (lacuna L4) e o
**roteiro do aceite lado a lado** de E7 e E8.

## Como revisar isto

**Rascunho escrito a partir do código, não de uso real.** Cada trava, contagem e
mensagem daqui foi conferida no fonte da referência congelada e tem a linha
citada — então a *mecânica* está certa. O que eu não consigo tirar do código é a
**ordem em que se preenche na prática** e **onde as pessoas travam**. É isso que
preciso de você.

Marque direto no texto:

- **`OK`** — confere
- **`✏️`** — a ordem/descrição está errada, com o certo do lado
- **`⚠️`** — aqui as pessoas travam / erram / perguntam (isto vira passo do
  tutorial)

As perguntas que eu já sei que não consigo responder estão em **[?]** ao longo do
texto e reunidas no fim.

---

## O arco completo

```
/login  →  /custos  →  (salvar levantamento)  →  /  →  (finalizar)  →  /historico
           ↑ 5 seções                              ↑ 7 etapas
```

Ponto não óbvio: **o levantamento de custos vem antes da proposta**, e é ele que
carimba o código que os dois documentos vão usar. A proposta não é o começo do
fluxo; é a consequência do levantamento.

---

## 1. Login — `/login`

Usuário e senha. O erro de credencial é global, não por campo (lacuna L5).

Depois do login o app cai em `/` (proposta), **não** em `/custos`. **[?]** Na
prática as pessoas começam por onde? Se o normal for começar pelo levantamento,
cair na proposta é um desencontro que vale registrar.

---

## 2. Levantamento de custos — `/custos`

### 2.1 A porta de entrada: "Como deseja começar?"

Um diálogo modal bloqueia a tela até você escolher (`app/custos/page.tsx:440-460`):

| Opção | O que faz |
|---|---|
| **Levantar custos** | Calcula custos, impostos e margem antes da proposta |
| **Nova proposta** | Gera o conjunto técnico e comercial com número novo |
| **Revisar proposta** | Carrega os dados salvos e calcula a próxima revisão |

Duas coisas para saber:

- **"Nova proposta" chama o Nectar** para reservar a numeração
  (`app/api/nectar/next-number/route.ts:24-30`). Sem `NECTAR_API_TOKEN` devolve
  503 e não há caminho local — foi por isso que a baseline usou "Revisar".
- **Este diálogo é o que reaparece no F5** e apaga o levantamento em andamento
  (lacuna L3, captura em `L3-f5-perde-levantamento.png`).

### 2.2 As cinco seções

Tira horizontal no topo (`app/custos/page.tsx:54-59`):

1. **Premissas** — 2. **Mão de obra** — 3. **Materiais e insumos** —
4. **Mob. e desmob.** — 5. **Resumo e QQP**

As abas são livres: dá para pular para qualquer uma a qualquer momento. **Mas o
rodapé não é livre** — e é a peça mais interessante da tela.

### 2.3 O rodapé é um guia, não um botão

O botão primário do rodapé **muda de texto e de destino conforme o que falta**
(`app/custos/page.tsx:595-604`). É uma cadeia de prioridade fixa:

| Se falta… | O botão vira |
|---|---|
| item obrigatório de mão de obra | **"Preencher itens obrigatórios da mão de obra →"** |
| senão, material/insumo | **"Revisar materiais e insumos →"** |
| senão, logística | **"Preencher mobilização e desmobilização →"** |
| senão, comissão/indicação | **"Completar comissões e indicações →"** |
| nada | **"Salvar levantamento e criar proposta →"** |

Clicar leva direto à seção pendente. Ou seja: **o app já sabe o caminho e já sabe
o que falta** — ele só não diz *qual campo*. É exatamente o outro lado da lacuna
L1: a informação existe, a localização é que se perde.

Isso é um achado forte para o tutorial: o roteiro do L4 pode ser literalmente
essa cadeia.

O botão de salvar só habilita com **título preenchido**, **precificação válida** e
**preço de venda > 0** (`app/custos/page.tsx:602`).

**[?]** Na prática você segue essa cadeia do rodapé, ou clica direto nas abas?

### 2.4 Salvar exige confirmação do código

Salvar abre um segundo modal, **"Confirme a proposta"**
(`app/custos/page.tsx:468-492`), avisando que levantamento, proposta técnica e
comercial vão usar o mesmo código. Três saídas:

- **Confirmar `<código>`** — salva e abre a criação das propostas
- **Trocar para nova** — reserva outra numeração (volta a depender do Nectar)
- **Informar outro número** — volta para o diálogo de modo

**[?]** Alguém já usou "Trocar para nova" nesse ponto, ou é saída morta?

---

## 3. Proposta — `/`

### 3.1 As sete etapas

`app/page.tsx:92`: **Cliente · Escopo · Responsabilidades · Prazos · Técnica ·
Comercial · Revisão**.

### 3.2 A trava é etapa a etapa, e é contada

"Salvar e continuar →" fica **desabilitado** enquanto houver campo obrigatório
vazio, com o rodapé mostrando **"Preencha N campo(s) obrigatório(s)"**
(`app/page.tsx:1147-1149`). Não dá para pular etapa incompleta.

O que cada etapa exige (`app/page.tsx:472-486`):

| # | Etapa | Trava |
|---|---|---|
| 1 | Cliente | proposta, cliente, contato, **e-mail válido**, **CNPJ válido**, site, consultor de vendas, orçamentista — 8 campos |
| 2 | Escopo | título, e **todo** item de escopo com título *e* descrição |
| 3 | Responsabilidades | ao menos uma linha na matriz |
| 4 | Prazos | mobilização, permanência, execução, atendimento, jornada — 5 campos |
| 5 | Técnica | os requisitos dos serviços técnicos selecionados |
| 6 | Comercial | ao menos um preço com descrição + unidade + valor, condição de pagamento, validade |
| 7 | Revisão | funil do Nectar + escolha de card (existente ou novo) |

Note que e-mail e CNPJ contam como pendência **só quando inválidos** — digitar
errado é indistinguível de não ter digitado, do ponto de vista do contador.
**⚠️ provável ponto de travamento**: o contador diz "1 campo obrigatório" e o
campo *está* preenchido, só que inválido. Sem marcação no campo (lacuna L1), não
há como saber qual é.

### 3.3 A prévia fica sempre à direita

Painel lateral fixo (`app/page.tsx:1155`) com abas **Comercial / Técnica**,
contador de páginas e **"Imprimir prévia"**, que chama o `window.print()` do
navegador. Ele acompanha o preenchimento em tempo real, nas 7 etapas.

Índices dos documentos: **13 itens** no comercial, **10** no técnico
(`app/page.tsx:94-95`).

### 3.4 Finalizar: quatro estágios

Na etapa 7, **"Gerar e salvar técnica + comercial"**. Antes de começar, uma
bateria de validações com mensagem específica (`app/page.tsx:615-639`): e-mail,
CNPJ de 14 dígitos, departamento, consultor + orçamentista, funil do Nectar,
empresa e contato vindos do Nectar, escolha de card.

Depois, quatro estágios anunciados ao usuário (`lib/finalization.ts:15-19` e
`app/page.tsx:640-762`):

1. **"Preparando a proposta comercial..."**
2. **"Proposta comercial pronta. Preparando a proposta técnica..."**
3. **"As duas propostas foram geradas. Salvando no histórico..."**
4. **"As duas propostas foram salvas. Escolha abaixo quais deseja baixar."**

Detalhe de robustez que o porte tem de preservar: **se a integração falhar depois
dos PDFs prontos, a mensagem de erro avisa que eles continuam disponíveis para
download** (`app/page.tsx:765`). O trabalho não se perde.

No fim, download de **técnica + comercial** juntas ou separadas.

---

## 4. Histórico — `/historico`

Lista as propostas emitidas com status de integração (Nectar e SharePoint),
valor, revisão e arquivos. É por aqui que se descobre o número para revisar
depois.

---

## Perguntas que só você responde

1. Depois do login, o app abre em `/` (proposta). Na prática se começa por
   `/custos`. **É desencontro real ou não incomoda?**
2. No levantamento, você segue a **cadeia do rodapé** ou vai direto nas abas?
3. **Onde as pessoas mais travam?** Meu palpite pelo código é o e-mail/CNPJ
   inválido da etapa 1 — o contador acusa pendência num campo que parece
   preenchido. Confere?
4. "Trocar para nova" no modal de confirmação: alguém usa?
5. Tem algum passo que **todo mundo erra na primeira vez**? É o candidato
   número um a virar passo do tutorial da L4.
6. Falta alguma coisa aqui que você faz sempre e não está descrito?
