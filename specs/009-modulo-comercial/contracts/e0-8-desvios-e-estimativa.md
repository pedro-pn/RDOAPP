# E0-8 — Lista fechada de desvios e revisão da estimativa

Pacote de aprovação da última etapa da E0. Duas decisões suas:

- **Parte A** — a lista fechada de desvios deliberados, revisada com o que a E0
  descobriu. Depois de aprovada, **divergência fora da lista é bug, não escolha**.
- **Parte B** — a estimativa da §8 do plano, revisada. As lacunas L1 a L7 são
  trabalho novo que a §8 não precificou.

Nada aqui é irreversível: é o combinado que o `/speckit-specify` vai consumir.

---

## Parte A — Desvios deliberados

> **Nota de 03/08.** O item 11 entrou durante a implementação e está **proposto**, não
> aprovado. Uma coisa que *não* virou desvio: o vermelho dos campos obrigatórios só
> aparecer depois que o usuário tenta avançar. Isso é refinamento da lacuna **L1**, não
> divergência da referência — a referência não tem `aria-invalid` nenhum nesta tela, e
> portanto não há comportamento de origem do qual divergir.

A numeração 1 a 5 é a mesma da §5.7 do plano, para as referências existentes
continuarem valendo. Os itens **3** e **4** foram reescritos porque a E0 mostrou
que estavam subdimensionados. Os itens **6 a 10** são novos — o **9** entrou depois
da aprovação, na sua revisão do `baseline/roteiro.md` em 31/07.

| # | Desvio | Situação |
|---|---|---|
| 1 | PDF gerado no backend | Inalterado |
| 2 | Tailwind removido | Inalterado |
| 3 | Layout mobile inexistente será **criado** | **Reescrito** (era "corrigir `nowrap` das tabelas") |
| 4 | Acréscimos exigidos pela constitution | **Reescrito** (lista completa, L1/L3/L4/L5) |
| 5 | Fonte do chrome herda a do app | Inalterado |
| 6 | Drag and drop **ao lado** dos botões ↑/↓ | **Novo** (L2) |
| 7 | Paleta em bloco único, prefixada, com escopo | **Novo** (L6) |
| 8 | Fluxo "Nova proposta" sem baseline visual | **Novo** — limitação, não escolha |
| 9 | Entrada do módulo vira **menu**; proposta sai da raiz | **Novo** (revisão do roteiro, 31/07) |
| 10 | Módulo usa o **chrome da referência**, não o do filtroAPP | **Novo** (03/08) — *reduz* divergência |
| 12 | Documentos seguem os **`.docx` de 07/01/2026**, não o texto da referência | **Novo** (05/08) — decidido |
| 13 | Proposta de **hidrojateamento** é um modelo próprio, escolhido na criação | **Novo** (05/08) — decidido |

### 1. PDF gerado no backend

O download passa a ter uma ida ao servidor (§5.3). Imposto pela stack fixada na
constitution, não é escolha de produto.

### 2. Tailwind removido

Não era usado no rascunho. Nenhum efeito visual.

### 3. Layout mobile inexistente será criado — *reescrito*

**O que dizia:** "correção de scroll horizontal no celular onde o `nowrap` das
tabelas de custo estoura a viewport, preservando o desktop".

**Por que mudou:** a E0-7 mostrou que não é um ajuste pontual em tabela. **Não
existe layout mobile** — o desktop carrega no celular com rolagem horizontal
(lacuna L7). A causa raiz são **39 regras de `min-width` em pixel**, a pior
delas `.preview{min-width:390px}`, que sozinha estoura qualquer viewport de
390 px. Os 13 breakpoints do `globals.css` mostram que houve intenção
responsiva; os pisos fixos a anulam.

**O que fica combinado:** o módulo terá layout mobile próprio, seguindo a
padronização visual do desktop. **Em largura de celular não há paridade
pixel-a-pixel a perseguir** — não há do que ser fiel. O desktop continua
pixel-a-pixel.

**Sua decisão já registrada:** a passada de ajuste fino mobile fica para o fim do
porte. Isso é sequenciamento, não dispensa: segue sendo condição de aceite.

### 4. Acréscimos exigidos pela constitution — *reescrito*

**O que dizia:** "tutorial permanente de primeiro acesso, `aria-invalid` nos
campos inválidos, estado navegacional em query params".

**Por que mudou:** a lista estava incompleta e, mais importante, **estava citada
na §5.7 mas não precificada na §8**. A lista completa:

| Lacuna | Acréscimo | Onde |
|---|---|---|
| L1 | Campo inválido **destacado em vermelho** (`.field-invalid`) + `aria-invalid` e mensagem visível | `CUSTO` (465 controles) |
| L3 | Modo, base e seção em query param **+ rascunho local**, para o F5 não apagar o levantamento | `CUSTO`, `PROP` |
| L4 | Tutorial permanente de primeiro acesso + campanha de novidade de 10 dias | todas |
| L5 | Estado de campo inválido no login | `LOGIN` |

**Decidido por você em 31/07:** o campo obrigatório vazio fica destacado em
vermelho, no padrão `.field-invalid` do filtroAPP (`base.css:4085-4102`: rótulo
vermelho, borda vermelha, fundo `#fff5f5`). O banner único **não some** — vira
resumo no topo, e cada pendência ganha endereço.

**A L3 cresceu depois da confirmação na tela.** O documento previa "o F5 volta
para Premissas". O que acontece é que **o F5 volta para o diálogo de escolha de
modo e o levantamento inteiro se perde** — captura em
`baseline/L3-f5-perde-levantamento.png`. `app/custos/page.tsx:64-72` monta
`estimateMode` como `null` e `draft` como payload padrão, sem `localStorage`,
`sessionStorage` nem `beforeunload`. Um F5 acidental em 465 controles apaga tudo.
Por isso a L3 subiu para gravidade **Alta** e ganhou o rascunho local: a URL
sozinha recupera o caminho "Revisar proposta" (dá para refazer o fetch), mas não
recupera nem um "Levantar custos" começado do zero nem edições não salvas.

São **acréscimos, não substituições**: nenhum comportamento da referência é
removido por eles. A L1 é a mais séria — é a tela onde o preço é formado, e hoje
o app entrega todas as pendências grudadas num banner único (nos goldens, o
cenário 01 devolve 12 erros de uma vez). A informação para fazer certo já existe:
`validateCostEstimate` devolve `{ path, message, severity }` por item, e o
`path` é o endereço do campo. A referência joga isso fora.

### 5. Fonte do chrome herda a do app

`'Segoe UI', system-ui` em vez do `Arial, Helvetica` do rascunho. O fac-símile do
documento **mantém Arial/Helvetica**, para continuar fiel ao PDF.

Nota da E0-6: as fontes Geist que o rascunho baixa **nunca são usadas** —
`globals.css:26` fixa `font-family:Arial` e vence a variável do `layout.tsx:51`.
O desvio é menor do que parecia: só o chrome muda, e o documento não muda nada.

### 6. Drag and drop nas listas reordenáveis — *novo*

**Confirmado por você em 31/07:** só as setas funcionam, não é possível arrastar.
**Decisão:** tem de dar para arrastar, igual ao filtroAPP, com fantasma e
mostrando o novo local, **e as setas continuam**.

Com isso este item **deixa de ser substituição e vira acréscimo puro**: nenhum
controle da referência é removido. A lista de desvios volta a não ter nenhuma
remoção — toda divergência é adição exigida pela constitution, mudança de stack,
ou escrita de CSS.

Três listas em `app/page.tsx` (itens de serviço do escopo, serviços técnicos,
blocos de conteúdo) usam par de botões ↑/↓. O app inteiro tem **zero**
ocorrências de `onDrag`, `draggable`, `onPointerDown` ou `touch-action`.

**A peça já existe no filtroAPP** — `frontend/src/utils/reorderDrag.ts`, em uso em
quatro telas. Fantasma (`.app-reorder-drag-ghost`), destino marcado com
placeholder tracejado e legenda **"Soltar aqui"** (`base.css:12194-12215`), alça
com `aria-label`, toque por Pointer Events e rolagem na borda. É literalmente o
comportamento pedido.

**Setas mantidas — decidido em 31/07.** Alça de arrastar e par ↑/↓ convivem na
mesma linha. As setas são o caminho de teclado da reordenação, então isso também
resolve a acessibilidade do drag and drop sem trabalho extra.

Duas consequências para o `tasks.md`:

- **Uma fonte de verdade para a ordem.** Arraste e clique na seta têm de chamar a
  mesma função de reordenar (`reorderRowsById`), senão as duas divergem em lista
  filtrada ou com item recém-inserido.
- **Setas nas pontas ficam desabilitadas**, não some — o primeiro item sem ↑, o
  último sem ↓, com `disabled` e não com o botão oculto, para a linha não mudar
  de largura entre um item e outro.

**Auditoria antes de reusar** (exigida pelo `plan-template.md`): verificar
cancelamento por `Escape` restaurando a ordem inicial — não achei tratamento de
`Escape` no consumidor que li. Se faltar, o conserto é na origem e beneficia as
quatro telas que já usam o utilitário.

### 7. Paleta em bloco único, prefixada, com escopo — *novo*

O `globals.css` tem **dois** blocos `:root` (linhas 26 e 56) redefinindo os mesmos
sete tokens com valores diferentes. Mesma especificidade, então o segundo vence:
**o app renderiza verde, e a paleta azul da linha 26 é código morto**. Os nomes
`--navy` e `--blue` apontam para tons de verde.

Copiar isso como está tem dois efeitos ruins: nomes genéricos (`--ink`, `--line`,
`--bg`, `--muted`) em `:root` colidem com os tokens do `variables.css` do
filtroAPP e **vazam a paleta do módulo para o app inteiro**; e a duplicação já
produziu uma conclusão errada durante a própria E0 (ver
`baseline/README.md`, correção do stepper).

O porte usa um bloco único sob `.comercial-app`, com nomes `--com-*` escolhidos
**pela função e não pela cor**. **A cor renderizada não muda** — é a mesma paleta
verde da linha 56. Muda só como o CSS está escrito.

Isto é desvio de código, não de aparência. Está listado para que a comparação
lado a lado não o classifique como bug.

### 8. Fluxo "Nova proposta" sem baseline visual — *novo*

Não é escolha: é limitação registrada. `app/api/nectar/next-number/route.ts:24-30`
faz chamada real ao CRM Nectar para reservar a numeração e devolve **503 "Token do
Nectar não configurado."** sem `NECTAR_API_TOKEN`. Não há caminho local.

A baseline foi capturada pelo caminho **"Revisar proposta" → 4418**, que não toca
o Nectar. As telas de formulário são as mesmas — muda só o cabeçalho de modo — mas
**o passo de reserva do número ficou sem captura de referência**.

Consequência prática: a paridade visual desse passo específico será conferida
contra o código, não contra screenshot. Se você tiver um token de teste do Nectar,
eu capturo e este item some da lista.

### 9. A entrada do módulo é um menu, e a proposta sai da raiz — *novo*

> **Decisão do mantenedor, 31/07/2026**, na revisão do `baseline/roteiro.md`:
> *"seria necessario ele cair em `/`, porém ao invés de ser a pagina de proposta,
> ser um menu para ele escolher se quer levantar custo ou ver/criar propostas, ai
> sim, ser direcionado para `/custos` e um `/propostas`"*.

Na referência, o login desemboca no assistente de proposta, em `/`. Quem vai
levantar custos — que é o começo real do fluxo, já que é o levantamento que
carimba o código — tem de sair de lá e navegar até `/custos`.

**Metade disto já era inevitável.** No filtroAPP todo módulo mora atrás de um
prefixo (`/rdo`, `/estoque`, `/qualidade`, registrados em
`shared/modules/registry.json`), então a proposta nunca ia continuar na raiz do
app. O que a decisão acrescenta é a **tela de escolha**, que a referência não tem.

| Rota | Tela | Origem |
|---|---|---|
| `/comercial` | menu com dois cartões | **nova** |
| `/comercial/custos` | levantamento | o `/custos` da referência |
| `/comercial/propostas` | assistente de 7 etapas | o `/` da referência |
| `/comercial/historico` | histórico | o `/historico` da referência |

**Por que é barato (~0,5 d, na E6):** o `/modulos` do filtroAPP
(`frontend/src/pages/HubPage.tsx`) já é um seletor de cartões, com estilo pronto.
O menu do módulo reusa a mesma linguagem visual. Nenhum outro módulo do filtroAPP
tem menu interno — os demais usam página única com abas — mas `custos` e
`propostas` são fluxos de tela cheia, não abas.

**Efeito no aceite lado a lado:** o menu **não tem baseline**, pelo mesmo motivo do
desvio nº 8 — não existe na referência para ser fotografado. As capturas `PROP-*`
continuam valendo integralmente; muda só o endereço da tela que elas retratam.

**Este desvio também não remove controle nenhum.** Nenhuma das quatro telas perde
função; ganha-se uma porta de entrada. A regra de aceite continua sendo "se algo
sumiu, é bug".

### 10. O módulo usa o chrome da referência — *novo, e reduz divergência*

> **Decisão do mantenedor, 03/08**, depois de ver a primeira tela no ar:
> *"preciso primeiro do comercialAPP funcionando com o layout 100% igual ao da
> referência"*. Motivo estratégico: **o filtroAPP inteiro vai se parecer com o
> comercialAPP no futuro** — o chrome do módulo é uma prévia do padrão que vem,
> não um corpo estranho.

A referência é app independente e tem chrome próprio: uma `.cost-topbar` de 72px
com a marca e as ações, e uma `.cost-hero` — faixa em gradiente verde com o
eyebrow, o título e a faixa de indicadores em tempo real.

A primeira implementação envolveu as telas no `Shell`/`TopBar` do filtroAPP, o
que trocava o chrome inteiro. **Era falha, não escolha**, e o mantenedor pegou na
primeira olhada.

**O que fica combinado:** dentro da raiz do módulo, o chrome é o da referência.
O caminho de volta ao hub do filtroAPP vive na marca da topbar, que já era um
link na referência.

**Este item é diferente dos outros nove: ele aumenta a fidelidade.** Não é
divergência autorizada — é a correção de uma. Entra na lista porque quem revisar
o módulo vai notar que ele não usa o `Shell` dos demais, e precisa saber que é
deliberado.

**Consequência para a §10.1.1 do plano:** o caminho de promoção da identidade a
padrão do app fica mais curto. Se o chrome do Comercial vira o chrome do
filtroAPP, o que se promove é um layout já em produção, não um protótipo.

---

### 11. Tela de custos sem `react-hook-form` — *proposto, pendente de decisão*

**Situação:** as cinco seções do levantamento (T038–T042) foram implementadas com
estado controlado em `custos/useLevantamento.ts`. O Princípio III pede
`react-hook-form` + `zodResolver`; o `@hookform/resolvers` está instalado (T003) e é
usado no resto do app.

**Por que saiu assim:** a tela recalcula **a cada tecla** sobre ~40 coleções
aninhadas — está no Complexity Tracking do plano e é comportamento da referência. O
`react-hook-form` existe justamente para *evitar* re-render por tecla. Usá-lo aqui
significaria assinar `watch()` no formulário inteiro, que é o modo dele de imitar um
componente controlado: mesma quantidade de render, com uma camada a mais no caminho.

**Escopo proposto do desvio:** apenas a tela de custos. As **7 etapas da proposta**
(T057–T063) são formulário de verdade — campos independentes, validação por etapa,
sem cálculo ao vivo — e ficam com RHF + `zodResolver` como o princípio manda.

**O que se perde:** nada de comportamento visível. A validação por campo (L1) já
funciona sem RHF, porque `validateCostEstimate` devolve o endereço do campo e o
`Field` do módulo consome `.field-invalid` / `.field-error` do `base.css`
compartilhado. O que se perde é uniformidade de código entre módulos.

**Custo de reverter:** reescrever cinco seções e ~2 000 linhas, sem ganho para o
usuário. **Decisão do mantenedor pendente.**

### 12. Os documentos seguem os `.docx`, não a referência — *decidido em 05/08*

**O que muda:** onde o texto fixo do gerador diverge dos quatro `.docx` de
`Modelos/definitivos/Comercial/` (datados de 07/01/2026), **o `.docx` vence**.
A análise campo a campo está em [`modelos-word.md`](modelos-word.md).

**Por que não é fidelidade quebrada:** os `.docx` *são* a origem editorial do
`app/proposal-pdf.ts`. Os dez itens do `TECHNICAL_INDEX` e os treze do
`COMMERCIAL_INDEX` batem palavra por palavra com o ÍNDICE dos documentos. O que
divergiu foi o conteúdo envelhecer no código enquanto o Word seguiu adiante — o
`DEFAULT_PAYMENT` da referência diz "pagamento em até 7 dias da NF" e o Word diz
"35% antecipado + medição quinzenal com 21 dias". O documento é o que vai ao
cliente; o código é a cópia atrasada.

**Efeito sobre os goldens:** os goldens de PDF nascem dos `.docx`, não de uma
captura do `comercialAPP`. A regra de que golden só se regenera quando a
referência congelada muda **continua valendo para tudo que não é texto de
documento** — cálculo de custo, precificação, paginação.

**Lacunas que entram junto (decidido):** prazo de integração
(`dias_treinamento`), bloco "Stand-by e Mobilização Adicional" (quatro valores
monetários + tabela de três linhas) e categoria na matriz de responsabilidade.

**Lacuna que fica de fora (decidido):** os três serviços do catálogo que só
existem no Word (Flushing com água, Remoção de verniz, Boroscopia) e os quatro
códigos de relatório ausentes (RH, RTPP, RFA, RIB). **Isto é uma tensão
consciente com o desvio:** o texto do Word vence, mas essas seções do Word não
terão como ser selecionadas, e hidrojateamento e passagem de PIG sairão sem
mencionar o relatório que o documento promete. Registrado como pendência, não
como esquecimento.

### 13. Hidrojateamento é um modelo próprio — *decidido em 05/08*

**O que muda:** a criação da proposta passa a escolher entre **padrão** e
**hidrojateamento**, e a escolha troca cinco coisas, não uma:

1. descrição dos serviços (tanque, tubulação, superfície metálica, caldeira — e
   a regra "em tubulações, máximo 20k; 40k é proibido");
2. matriz Filtrovali (efetivo e equipamento por configuração: 1 ou 2 bicos ×
   ONSHORE ou OFFSHORE);
3. lista de EPI (com e sem espaço confinado);
4. jornada (ONSHORE seg–qui 9h/sex 8h; OFFSHORE seg–dom e feriados 11h);
5. **duas** tabelas de preço, ONSHORE e OFFSHORE, cada uma com seu TOTAL GERAL.

**Por que diverge da referência:** lá `hidrojateamento` é um dos 11 itens do
catálogo técnico — troca o texto do escopo e as imagens, nada mais. O item 5 é o
que torna impossível resolver por catálogo: `renderPriceTable` desenha **uma**
tabela.

**Regras vindas dos comentários do documento** (14 comentários do Aliander nos
`.docx` de hidrojateamento — são regra, não recado):

- efetivo e configuração de equipamento são **definidos por proposta** e
  permanecem nela; não são texto fixo;
- os preços de equipe embutem **30% de margem**; na negociação a diária do
  hidrojato desce até R$ 4.000,00 e a da equipe até 20%;
- **o preço de frete é só ida** — considerar um frete de ida e outro de volta,
  independentemente de o equipamento esperar em obra ou não;
- mobilização e desmobilização em R$/km, "conforme a distância e as premissas da
  contratante".

---

## Parte B — Revisão da estimativa

### Por que revisar

A §8 dimensionou as etapas E4 a E8 como **reescrita fiel de UI**. As lacunas L1 a
L7 não são reescrita: são funcionalidade que a referência não tem e que a
constitution exige. Três delas (L1, L3, L4) até aparecem no texto da §5.7, mas
**nenhuma entrou nos números da §8**.

Além disso a E0 custou mais que o orçado: 2 dias previstos, ~3 realizados. O que
consumiu a diferença foram os goldens (7 iterações até fechar os invariantes) e
subir a referência (três obstáculos: `.openai/hosting.json` ausente, corepack
quebrado, e login sem senha real).

### Quadro revisado

| Etapa | Escopo | Antes | **Agora** | O que entrou |
|---|---|---|---|---|
| E0 | Preparação, goldens, inventário, referência rodando | 2 d | **3 d** | Realizado |
| E-1 | Fluxo spec-kit + emenda à constitution | 2–2,5 d | 2–2,5 d | — |
| E1 | Scaffold do módulo | 0,5 d | 0,5 d | — |
| E2 | `shared/comercial` | 2 d | 2 d | — |
| E3 | Banco e dois schemas | 1,5 d | 1,5 d | — |
| E4 | Backend — levantamentos, vendedores, numeração | 3 d | 3 d | — |
| E5 | Backend — propostas, autoria, PDFs, integrações | 5,5 d | 5,5 d | — |
| E6 | Frontend — base, histórico, porte do CSS | 2 d | **3–3,5 d** | L6 (auditar bloco ativo) + primitivas seguras de mobile + **menu do módulo** (desvio 9) |
| E7 | Frontend — levantamento de custos | 5–6 d | **9–10 d** | **L1** (+3 d) e **L3** (+1 d, com o rascunho local) |
| E8 | Frontend — assistente da proposta + vendedores | 5–6 d | **9–10 d** | **L2** (+1,5 d), **L4** (+1 d), **L3** (+1,5 d, com rascunho na proposta) |
| **E8.5** | **Passada de mobile sobre as 4 telas** | — | **3–4 d** | **L7** |
| E9 | Testes e CI | 2 d | **2,5 d** | Testes de validação por campo e de ausência de scroll horizontal |
| E10 | Produção | 1,5 d | 1,5 d | — |
| | **Até produção** | **32–35,5 d** | **45,5–49,5 d** | **+14 dias úteis (~3 semanas)** |
| E11 | Substituir o import do Access | 3–5 d | 3–5 d | — |

**~7 semanas → ~9 a 10 semanas.**

> **Revisão de 31/07, depois da aprovação.** O quadro aprovado fechava em
> **44–48 d**. A sua revisão do `baseline/roteiro.md` acrescentou **+1,5 d**: o
> menu de entrada do módulo (+0,5 d, E6) e o rascunho local da proposta (+1 d,
> E8). A terceira decisão daquela revisão — distinguir "vazio" de "inválido" nas
> mensagens — **cabe nos +3 d da L1** e não move o total.

### De onde vem cada delta

**L1 → +3 d em E7.** Não são 465 edições manuais: os campos saem de poucos
componentes repetidos por alocação e por item. O custo real é (a) generalizar o
componente `Field` de `app/page.tsx:1187` — que já faz o certo e é o **único**
`aria-invalid` do app — para consumir o `.field-invalid` do filtroAPP, (b)
escrever o resolvedor de `path` → id de campo, e (c) ligar as 5 seções. ~1 d de
encanamento, ~1,5 d de ligação, ~0,5 d de teste. As classes vermelhas em si não
custam nada: já existem no `base.css`.

**L2 → +1,5 d em E8.** 0,5 d para auditar o `reorderDrag.ts` do filtroAPP contra
a constitution (o `plan-template.md` exige a checagem antes de reusar, e manda
corrigir a origem se houver dívida) e 1 d para aplicar nas três listas. **Risco de
+1 d** se a auditoria reprovar — aí o conserto é no utilitário compartilhado e
beneficia as quatro telas que já o usam.

**L3 → +2,5 d, sendo +1 d em E7 e +1,5 d em E8.** Era +0,5 d quando a lacuna era
só "volta para Premissas". Com o F5 apagando o levantamento, são duas peças:
query param (barato — 5 seções em `CUSTO`, 7 etapas em `PROP`, mais a limpeza de
params incompatíveis na troca) e **rascunho local com oferta de recuperação**
(~1 d: autossalvamento com *debounce*, chave por modo + código de proposta,
descarte ao salvar no servidor, e o diálogo "recuperar rascunho não salvo?" —
restaurar em silêncio é pior que perder, porque o usuário não sabe o que está
vendo).

O acréscimo de +1 d em E8 veio da sua revisão do roteiro: o rascunho local passa a
valer **também para a proposta**, e *"mesmo se fechar a página"* torna o
`beforeunload` obrigatório nas duas telas. As 7 etapas acumulam tanto trabalho não
salvo quanto as 5 seções do levantamento, e nada delas vai ao servidor antes da
finalização.

**Desvio 9 → +0,5 d em E6.** O menu de entrada do módulo. Sai barato porque o
`HubPage.tsx` do filtroAPP já é um seletor de cartões com estilo pronto; o custo é
a tela, os dois destinos e o registro em `shared/modules/registry.json`. A troca
de `/` por `/comercial/propostas` não custa nada — o prefixo de módulo já era
obrigatório no filtroAPP.

**L4 → +1 d em E8.** O `driver.js` já está nas dependências do frontend; a peça
existe. O que custa é escrever o roteiro. **Destravado em 31/07**: o `roteiro.md`
ficou pronto e revisado, e o script sai da cadeia do rodapé de `/custos` mais a
armadilha do e-mail/CNPJ da etapa 1.

**L5 → 0 d.** Absorvido pela L1: o mesmo componente generalizado resolve o login.

**L6 → +0,25 d em E6.** A §5.6 já previa a paleta prefixada. O acréscimo é a
auditoria regra a regra de qual bloco `:root` está ativo — a duplicação já me fez
errar uma vez.

**L7 → +3–4 d em uma etapa nova (E8.5), mais ~0,5 d diluído em E6–E8.** A parte
diluída é disciplina, não tempo: ao escrever cada tela, nunca portar `min-width`
em pixel de container, `min-width: 0` em filho de flex/grid desde o início,
tabela larga já dentro do próprio `overflow-x: auto`, grade de cards com
`minmax(min(100%, Npx), 1fr)`. Com isso a E8.5 é ajuste de espaçamento e ordem.
**Sem isso, a E8.5 é reescrita de layout e custa o dobro.**

### Se 9 semanas não couber

As alavancas são suas. As três, com o custo honesto de cada uma:

| Alavanca | Economia | O que custa |
|---|---|---|
| Adiar a **E8.5 mobile** para depois do go-live | −3 a 4 d | O módulo entra em produção com scroll horizontal no celular. É condição de aceite da constitution: precisa de decisão explícita registrada, e vira dívida com prazo |
| Adiar o **tutorial (L4)** | −1 d | Módulo novo sem onboarding. A campanha de novidade tem expiração de 10 dias contados da implementação, então adiar desalinha a campanha do release |
| Cortar a **L1** | −3 d | **Não recomendo.** É a tela onde o preço é formado. Levantamento com campo obrigatório em branco vira proposta com preço errado, e o formulário não aponta onde |

O que **não** é alavanca: a L6 e as primitivas de mobile diluídas em E6–E8. As
duas são mais baratas agora do que depois, e a L6 tem efeito colateral no app
inteiro se for feita errado.

---

## O que ainda falta para fechar a E0

Independente desta aprovação:

- [x] Confirmar **L1**, **L2** e **L3** — feito em 31/07/2026. As três se
      confirmaram, e a **L3 veio pior** que o documentado
- [x] Os **↑/↓ ficam** ao lado da alça (desvio nº 6) — decidido em 31/07
- [x] Capturas de prioridade 2 — **dispensadas** por você em 31/07
- [x] `roteiro.md` — escrito e **revisado** em 31/07. Rendeu o desvio nº 9, o
      crescimento da L3 para a proposta e o requisito de mensagem da L1

**A E0 está fechada.** O que sobrou de aberto é uma pergunta que só o uso real
responde — *o que todo mundo erra na primeira vez* — e ela não bloqueia nada:
entra no roteiro do tutorial depois, sem invalidar o que já está escrito.

### Se 9 semanas não couber — atualização

A alavanca "adiar o tutorial (L4)" ficou **mais barata de decidir**, porque o
roteiro já está escrito: adiar agora custa só a implementação, não a pesquisa.

Nenhuma das três alavancas alcança os +1,5 d que entraram em 31/07. O menu de
entrada e o rascunho da proposta são decisões suas de produto, não exigências da
constitution — se o prazo apertar, **essas duas voltam a ser negociáveis**, e são
as únicas do quadro que estão nessa condição.
