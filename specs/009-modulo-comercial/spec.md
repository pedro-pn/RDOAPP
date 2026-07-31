# Feature Specification: Módulo Comercial — porte fiel do gerador de propostas

**Feature Branch**: `feat/modulo-comercial`

**Created**: 2026-07-31

**Status**: Draft

**Input**: Portar o aplicativo de propostas comerciais `~/comercialAPP` (rascunho nunca colocado em produção) para dentro do filtroAPP como módulo novo **Comercial**, com paridade total de UI e UX recriadas na stack do projeto. Fontes da verdade: `contracts/ui-inventory.md` (oráculo de paridade visual), `contracts/goldens/` (oráculo numérico), `contracts/lacunas-constitucionais.md` (L1–L7), `contracts/e0-8-desvios-e-estimativa.md` (lista fechada de 9 desvios) e `contracts/baseline/` (baseline visual + roteiro clicável).

## Contexto e fonte da verdade

Esta feature **não é greenfield**. Existe um aplicativo de referência funcional,
congelado no commit `6f5b072`, que define o comportamento esperado até o nível do
rótulo de campo. A etapa E0 (concluída) produziu cinco artefatos que são o oráculo
desta especificação — requisito que não deriva deles é invenção:

| Artefato | O que decide | Onde |
|---|---|---|
| **Inventário de UI** | Todo elemento visível: 616 controles e 916 textos, com IDs estáveis | `contracts/ui-inventory.md` |
| **Goldens** | Todo resultado numérico: 16 cenários, 40 invariantes | `contracts/goldens/` |
| **Lacunas L1–L7** | O que a referência **não** tem e a constitution exige | `contracts/lacunas-constitucionais.md` |
| **Desvios (9, lista fechada)** | Toda divergência permitida. Fora da lista **é bug** | `contracts/e0-8-desvios-e-estimativa.md` |
| **Baseline + roteiro** | Aparência de referência e caminho clicável revisado | `contracts/baseline/` |

O plano técnico `docs/PLANO_MODULO_COMERCIAL.md` entra como **insumo/`research.md`**,
não como especificação.

**Escopo por tela** (IDs do inventário):

| Tela | ID | Controles | Textos |
|---|---|---:|---:|
| Login | `LOGIN` | 7 | 12 |
| Assistente de proposta | `PROP` | 137 | 330 |
| Levantamento de custos | `CUSTO` | 465 | 541 |
| Histórico | `HIST` | 7 | 33 |

## Clarifications

### Session 2026-07-31

Decisões já registradas na E0 e na §12.5 do plano, que esta spec incorpora:

- **Três papéis, não dois** (decidido em 31/07, revendo as decisões 1 e 2 da §12.5):
  **Gestor** edita e finaliza qualquer proposta; **Vendedor** cria, edita e finaliza
  **só as suas**; **Consulta** só lê, e **sem ver valores**.
- **Levantamento de custos**: gestor e vendedor. O vendedor levanta o custo do próprio
  serviço e vê custo e margem **apenas do que ele mesmo levantou**. O papel de consulta
  não alcança levantamento por nenhum caminho.
- **Finalização**: o autor finaliza a própria proposta; o gestor finaliza qualquer uma.
  Sem isso, toda proposta de vendedor ficaria parada esperando um gestor.
- **Autoria vale para duas entidades** — levantamento e proposta —, não só para a
  proposta como a §12.5 previa. Regra nova, inexistente na referência.
- **O papel de consulta não baixa a proposta comercial**, só a técnica: o documento
  comercial traz tabela de preços, condições de pagamento e valor total.
- **O menu de entrada e o diálogo de modo coexistem** (decidido em 31/07): dois passos
  de escolha, sem atalho. Preserva o fluxo da referência e mantém a lista fechada em
  9 desvios.
- **A lista de vendedores é derivada dos usuários, não um cadastro** (decidido em
  31/07, revendo a decisão 4 da §12.5): todo consultor de vendas é um usuário do app
  com o papel `comercial:seller`, então a lista se atualiza sozinha. Não há model
  `Seller`, nem CRUD, nem tela de cadastro.
- **O campo "Consultor de Vendas" se comporta por papel**: o vendedor vê **apenas o
  próprio nome**, já pré-selecionado; o gestor vê a lista completa.
- **Numeração**: gerada pelo próprio módulo (sequência no banco), não pelo CRM
  externo. Muda em relação à referência, que dependia de chamada ao CRM.
- **Retenção**: indefinida, como registro comercial; entra no ROPA.
- **Card no hub**: oculto para quem não tem a role.
- **Campo obrigatório vazio** fica destacado em vermelho no padrão compartilhado do
  filtroAPP, e o banner-resumo permanece (L1).
- **Reordenação** ganha arrastar com fantasma e destino visível, **e as setas ↑/↓
  continuam** (L2 / desvio nº 6).
- **Rascunho local** vale para levantamento **e** proposta, e cobre fechar a aba,
  não só recarregar (L3).
- **Entrada do módulo** é um menu de dois cartões (desvio nº 9).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Levantar custos e chegar a um preço de venda confiável (Priority: P1)

O orçamentista entra no módulo, escolhe **Levantar custos**, percorre as cinco seções
(Premissas, Mão de obra, Materiais e insumos, Mob. e desmob., Resumo e QQP) e obtém
custo total, impostos, comissões, margem e preço de venda. O rodapé o conduz: enquanto
faltar item obrigatório, o botão primário nomeia a seção pendente e leva até ela; quando
nada falta, ele vira **Salvar levantamento e criar proposta**.

**Why this priority**: é a tela onde o preço é formado e o começo real do fluxo — é o
levantamento que carimba o código que os dois documentos vão usar. Um erro aqui vira
proposta com preço errado, e ninguém percebe: o número sai, só sai errado. É também a
maior tela do porte (465 controles) e a que concentra o oráculo numérico.

**Independent Test**: com os 16 cenários golden como entrada, conferir que cada
resultado bate dígito a dígito; e percorrer as cinco seções na tela conferindo contra
`CUSTO-CTL-*` do inventário. Entrega valor sozinha: um orçamentista consegue precificar
sem que o assistente de proposta exista.

**Acceptance Scenarios**:

1. **Given** o cenário golden `01-default-intocado`, **When** o motor de custos calcula,
   **Then** todos os campos do resultado batem com o `.golden.json` dígito a dígito.
2. **Given** um levantamento com item obrigatório de mão de obra em branco, **When** o
   orçamentista olha o rodapé, **Then** o botão primário diz **"Preencher itens
   obrigatórios da mão de obra →"** e clicar nele leva à seção de mão de obra.
3. **Given** que só falta comissão, **When** o orçamentista olha o rodapé, **Then** o
   botão diz **"Completar comissões e indicações →"** — a cadeia de prioridade é mão de
   obra → materiais e insumos → mob./desmob. → comissões → salvar.
4. **Given** título preenchido, precificação válida e preço de venda maior que zero,
   **When** o orçamentista aciona salvar, **Then** aparece a confirmação do código
   avisando que levantamento, proposta técnica e comercial usarão o mesmo número, com as
   três saídas (confirmar, trocar para nova, informar outro número).
5. **Given** um campo obrigatório vazio ao tentar salvar, **When** a validação roda,
   **Then** **cada** campo pendente fica destacado em vermelho com mensagem visível, e o
   banner-resumo no topo continua mostrando a contagem total.
6. **Given** um usuário com apenas `comercial:viewer`, **When** ele tenta alcançar
   qualquer superfície de levantamento, **Then** o acesso é negado — custo e margem não
   aparecem para ele em lugar nenhum.
7. **Given** um `comercial:seller`, **When** ele abre a lista de levantamentos, **Then**
   vê apenas os de sua própria autoria; o levantamento de outro vendedor não aparece nem
   é alcançável por endereço direto.
8. **Given** um `comercial:manager`, **When** ele abre a lista de levantamentos,
   **Then** vê os de todos os autores.

---

### User Story 2 - Montar a proposta em sete etapas com trava por etapa (Priority: P1)

A partir do levantamento salvo, o orçamentista percorre **Cliente · Escopo ·
Responsabilidades · Prazos · Técnica · Comercial · Revisão**. Cada etapa trava o avanço
enquanto houver campo obrigatório pendente, mostrando quantos faltam. A prévia do
documento acompanha o preenchimento em tempo real, ao lado, nas sete etapas.

**Why this priority**: é a razão de ser do módulo — o levantamento sem a proposta não
entrega documento ao cliente. Junto com a US1 forma o produto mínimo.

**Independent Test**: percorrer as sete etapas conferindo cada `PROP-CTL-*` do
inventário e cada trava contra a tabela de campos obrigatórios por etapa. Testável com
um levantamento semeado, sem depender da finalização.

**Acceptance Scenarios**:

1. **Given** a etapa Cliente com CNPJ em branco, **When** o orçamentista tenta avançar,
   **Then** o botão está desabilitado e o rodapé mostra a contagem de pendências.
2. **Given** um e-mail preenchido com formato inválido, **When** a contagem de
   pendências é exibida, **Then** o campo de e-mail fica destacado em vermelho com a
   mensagem **"E-mail inválido"** — distinta de "Campo obrigatório", porque o campo
   *está* preenchido.
3. **Given** um CNPJ com menos de 14 dígitos, **When** a validação roda, **Then** a
   mensagem diz que o CNPJ é inválido, não que o campo está vazio.
4. **Given** a etapa Escopo com um item de serviço sem descrição, **When** o
   orçamentista tenta avançar, **Then** o avanço é bloqueado — **todo** item de escopo
   precisa de título *e* descrição.
5. **Given** uma lista reordenável (itens de escopo, serviços técnicos ou blocos de
   conteúdo), **When** o usuário arrasta um item pela alça, **Then** aparece um fantasma
   do item e um espaço indicando o destino, a ordem só é persistida ao soltar, e
   cancelar restaura a ordem inicial.
6. **Given** a mesma lista, **When** o usuário usa as setas ↑/↓, **Then** a reordenação
   funciona por teclado — as setas continuam existindo ao lado da alça.
7. **Given** qualquer etapa, **When** o usuário observa a lateral, **Then** a prévia do
   documento está presente com as abas Comercial/Técnica e o contador de páginas.

---

### User Story 3 - Finalizar, gerar os dois documentos e não perder trabalho (Priority: P1)

Na etapa de revisão, o orçamentista aciona a geração. O sistema valida tudo com mensagem
específica por problema, informa o progresso em quatro estágios, produz **duas** propostas
(técnica e comercial), salva no histórico e integra com os sistemas externos. Ao final,
oferece o download das duas juntas ou separadas.

**Why this priority**: é a entrega ao cliente. Sem ela o módulo não substitui nada.

**Independent Test**: finalizar uma proposta completa e conferir os quatro estágios
anunciados, os dois documentos gerados e o registro no histórico. Testável de ponta a
ponta com integrações simuladas.

**Acceptance Scenarios**:

1. **Given** uma proposta completa, **When** a finalização roda, **Then** o usuário vê a
   sequência: preparando a comercial → comercial pronta, preparando a técnica → as duas
   geradas, salvando no histórico → as duas salvas, escolha o que baixar.
2. **Given** que a geração dos documentos concluiu mas a integração externa falha,
   **When** o erro é exibido, **Then** a mensagem informa explicitamente que os
   documentos **continuam disponíveis para download** — o trabalho não se perde.
3. **Given** um usuário com `comercial:viewer`, **When** ele abre o módulo, **Then** não
   encontra caminho para criar, editar nem finalizar proposta — só consultar, e as
   superfícies de escrita não são alcançáveis nem por endereço direto.
4. **Given** uma proposta de outro autor, **When** um `comercial:seller` tenta editá-la
   ou finalizá-la, **Then** a ação é negada; **When** um `comercial:manager` faz o
   mesmo, **Then** é permitida.
5. **Given** uma proposta que o próprio `comercial:seller` montou, **When** ele aciona a
   finalização, **Then** ela roda normalmente — o autor conclui o próprio trabalho.
6. **Given** a proposta finalizada, **When** o autor ou um gestor abre o histórico,
   **Then** ela aparece com status de integração, valor, revisão e os dois arquivos.
7. **Given** a mesma proposta, **When** um `comercial:viewer` abre o histórico, **Then**
   ela aparece **sem valor, sem custo e sem margem**, e apenas a proposta técnica está
   disponível para download — a comercial não.

---

### User Story 4 - Não perder o levantamento por um F5 ou uma aba fechada (Priority: P2)

O orçamentista está no meio de um levantamento ou de uma proposta e recarrega a página
por acidente, ou fecha a aba. Ao voltar, o trabalho está lá — ou, no mínimo, o sistema
oferece recuperá-lo explicitamente.

**Why this priority**: é perda de trabalho, não de navegação. Na referência, um F5
acidental no meio de um levantamento de 465 controles apaga tudo, sem aviso e sem
confirmação de saída. Não é P1 só porque a US1 entrega valor sem isso — mas entrega com
um buraco que o usuário paga.

**Independent Test**: preencher parcialmente, recarregar, e conferir que o estado
navegacional volta pela URL e que o conteúdo não salvo é oferecido de volta.

**Acceptance Scenarios**:

1. **Given** um levantamento aberto na seção Mão de obra em modo revisão da proposta
   4418, **When** o usuário recarrega, **Then** volta para o mesmo modo, a mesma base e
   a mesma seção — o endereço carrega esse estado.
2. **Given** um levantamento começado do zero com edições não salvas, **When** o usuário
   recarrega, **Then** o sistema **pergunta** se deseja recuperar o rascunho não salvo,
   em vez de restaurar em silêncio ou descartar.
3. **Given** uma proposta em preenchimento com alterações pendentes, **When** o usuário
   tenta fechar a aba, **Then** o navegador avisa antes de sair.
4. **Given** um rascunho recuperável, **When** o usuário salva no servidor, **Then** o
   rascunho local é descartado — não sobra para reaparecer depois.
5. **Given** um endereço apontando para uma seção específica, **When** ele é aberto por
   outra pessoa com permissão, **Then** abre naquela seção.

---

### User Story 5 - Encontrar o caminho no primeiro acesso (Priority: P2)

Quem entra no módulo pela primeira vez encontra um menu que pergunta o que quer fazer —
levantar custos ou ver/criar propostas — e um tutorial guiado que apresenta o caminho.

**Why this priority**: módulo novo sem onboarding é exigência descumprida da
constitution, e o roteiro já existe pronto. Fica em P2 porque não bloqueia a operação de
quem já conhece a ferramenta de origem.

**Independent Test**: entrar com um usuário que nunca abriu o módulo e conferir que o
tutorial aparece uma vez, é dispensável e não volta sozinho.

**Acceptance Scenarios**:

1. **Given** um usuário com role do módulo, **When** ele entra no módulo, **Then** vê um
   menu com dois cartões — levantar custos e ver/criar propostas.
1a. **Given** que ele escolheu levantar custos, **When** a tela abre sem modo no
   endereço, **Then** o diálogo "Como deseja começar?" aparece com os três modos — os
   dois passos coexistem, sem atalho.
1b. **Given** um endereço que já traz o modo, **When** a tela abre, **Then** o diálogo
   **não** aparece — ele serve para escolher o modo, não para confirmá-lo.
2. **Given** o primeiro acesso de um usuário, **When** ele entra, **Then** o tutorial
   permanente de primeiro acesso é apresentado.
3. **Given** que o usuário já viu o tutorial, **When** ele entra de novo, **Then** o
   tutorial não reaparece sozinho, mas continua disponível para ser chamado.
4. **Given** um usuário sem nenhuma role do módulo, **When** ele abre o hub do
   filtroAPP, **Then** o card do módulo não aparece.

---

### User Story 6 - A lista de vendedores se mantém sozinha (Priority: P3)

Ninguém mantém uma lista de vendedores. Todo consultor de vendas é um usuário do app com
o papel de vendedor, e a lista da etapa Cliente é derivada disso. Quem entra no quadro
aparece; quem sai, some — sem cadastro paralelo para esquecer de atualizar.

**Why this priority**: é consequência da unificação decidida em 31/07, não uma
funcionalidade à parte. Não bloqueia nada, e o custo é uma consulta, não uma tela.

**Independent Test**: conceder `comercial:seller` a um usuário e conferir que ele passa a
aparecer na seleção da etapa Cliente para um gestor — sem nenhum passo de cadastro.

**Acceptance Scenarios**:

1. **Given** um usuário que acabou de receber o papel `comercial:seller`, **When** um
   gestor abre a etapa Cliente, **Then** ele aparece na seleção de consultor de vendas,
   sem nenhum cadastro intermediário.
2. **Given** um `comercial:seller` montando uma proposta, **When** ele chega à etapa
   Cliente, **Then** o campo Consultor de Vendas já vem preenchido com o próprio nome, e
   é a **única** opção disponível.
3. **Given** um `comercial:manager` montando uma proposta, **When** ele chega à etapa
   Cliente, **Then** vê a lista completa e pode escolher qualquer vendedor.
4. **Given** um vendedor citado por propostas já emitidas, **When** o usuário dele é
   desativado ou renomeado, **Then** as propostas antigas continuam mostrando o nome
   original — o documento é registro histórico.

---

### Edge Cases

- **Recarregar no meio do levantamento**: hoje volta ao diálogo de escolha de modo e
  apaga tudo. Precisa restaurar estado pela URL e oferecer o rascunho não salvo (US4).
- **Campo preenchido porém inválido**: o contador acusa pendência num campo que parece
  cheio. Sem marcação e sem mensagem específica, o usuário não descobre qual é — é o
  ponto de travamento mais provável do fluxo (US2, cenários 2 e 3).
- **Integração externa cai depois dos documentos prontos**: os documentos têm de
  continuar baixáveis (US3, cenário 2).
- **Numeração colidindo**: se um número for criado diretamente no sistema externo, a
  sequência do módulo pode colidir. A semente da sequência precisa considerar o maior
  número já existente nas duas origens.
- **Proposta antiga sem campos completos**: revisar uma proposta gerada antes do
  armazenamento completo dos campos exibe aviso ao usuário em vez de falhar.
- **Levantamento sem insumos confirmado**: cenário golden `16` — o fluxo aceita escopo
  sem insumos, e o resultado numérico precisa bater.
- **Celular estreito (390 px)**: nenhuma das quatro telas pode produzir rolagem
  horizontal de página, incluindo a faixa de sete indicadores de custo e a tira de cinco
  seções, que são os dois pontos de estouro conhecidos.
- **Reordenação por toque**: arrastar precisa funcionar em tela sensível ao toque, não
  só com mouse.
- **Sessão sem permissão**: quem alcança endereço de levantamento sem o papel recebe
  negativa, não tela vazia. Vale também para um vendedor tentando abrir levantamento de
  outro autor.
- **Proposta sem autor identificável**: proposta semeada ou importada sem autor
  registrado precisa de regra explícita — cair no caso "só gestor edita" é o
  comportamento seguro.
- **Vendedor desativado com propostas em aberto**: as propostas continuam existindo e
  passam a ser alcançáveis apenas por gestor.
- **Papel de consulta olhando o histórico**: a coluna de valor e os rótulos de custo e
  margem não podem existir na resposta, não apenas ficar ocultos na tela — esconder no
  cliente não é restrição.

## Requirements *(mandatory)*

### Functional Requirements

#### Paridade com a referência

- **FR-001**: O módulo DEVE reproduzir todos os elementos catalogados no inventário de
  UI — **616 controles e 916 textos visíveis** — em rótulo, unidade, tipo,
  obrigatoriedade, valor padrão e máscara. Cobre `LOGIN-CTL-001`…`007`,
  `PROP-CTL-001`…`137`, `CUSTO-CTL-001`…`465`, `HIST-CTL-001`…`007` e os textos
  correspondentes.
- **FR-002**: O módulo DEVE preservar o número e a ordem das etapas do assistente
  (7: Cliente, Escopo, Responsabilidades, Prazos, Técnica, Comercial, Revisão) e das
  seções do levantamento (5: Premissas, Mão de obra, Materiais e insumos, Mob. e
  desmob., Resumo e QQP).
- **FR-003**: O módulo DEVE preservar todas as regras condicionais da referência —
  parâmetros pedidos só quando o serviço exige, espelhamento da desmobilização, travas e
  desabilitações.
- **FR-004**: O módulo DEVE preservar todos os textos pt-BR de erro, aviso, estado vazio
  e ajuda, sem reescrita.
- **FR-005**: O módulo DEVE preservar o índice dos documentos: 13 itens no comercial e
  10 no técnico, na mesma ordem (`PROP-H-006`…`PROP-H-021`).
- **FR-006**: Toda divergência em relação à referência DEVE constar da lista fechada de
  9 desvios. Divergência não listada **é defeito**, não escolha.

#### Motor de custos

- **FR-007**: O cálculo DEVE reproduzir os **16 cenários golden dígito a dígito**,
  incluindo custo, impostos, comissões, margem e preço de venda.
- **FR-008**: Os goldens NÃO PODEM ser regenerados para fazer passar uma implementação
  divergente. Só se regenera se a referência congelada mudar.
- **FR-009**: A validação do levantamento DEVE devolver as pendências **item a item**,
  com endereço do campo, e não como texto único concatenado.

#### Validação e comunicação de erro (L1, L5)

- **FR-010**: Ao tentar salvar com campo obrigatório vazio, o sistema DEVE destacar em
  vermelho **cada campo pendente**, no padrão compartilhado de campo inválido do
  filtroAPP, com mensagem visível associada ao campo.
- **FR-011**: O sistema DEVE distinguir dois estados na mensagem: **vazio** ("Campo
  obrigatório") e **preenchido porém inválido** ("E-mail inválido", "CNPJ inválido").
  Marcar sem distinguir não atende.
- **FR-012**: O banner-resumo de pendências no topo DEVE permanecer, com a contagem
  total — o destaque por campo é acréscimo, não substituição.
- **FR-013**: O login DEVE ter estado de campo inválido, não apenas erro global de
  credencial (`LOGIN-CTL-004`, `LOGIN-CTL-006`).
- **FR-014**: Todo campo inválido DEVE ser marcado como inválido para tecnologia
  assistiva, com a mensagem associada — não basta a validação nativa do navegador.

#### Reordenação (L2)

- **FR-015**: As três listas reordenáveis do assistente DEVEM aceitar reordenação por
  arrastar, com alça dedicada, reordenação ao vivo durante o arrasto, espaço/marcador
  indicando o destino, fantasma visual, cancelamento restaurando a ordem inicial e
  persistência só ao soltar.
- **FR-016**: A reordenação por arrastar DEVE funcionar em tela sensível ao toque.
- **FR-017**: Os botões ↑/↓ DEVEM continuar existindo ao lado da alça, como caminho de
  teclado (`PROP-CTL-029`, `PROP-CTL-030` e equivalentes).

#### Estado e continuidade do trabalho (L3)

- **FR-018**: Modo, base da proposta e seção/etapa ativa DEVEM estar no endereço, de
  forma que recarregar restaure a posição e que o endereço possa ser compartilhado.
  Parâmetros incompatíveis DEVEM ser limpos na troca.
- **FR-019**: O levantamento **e** o assistente de proposta DEVEM manter rascunho local
  do que ainda não foi salvo, com salvamento automático, chave por modo e código de
  proposta.
- **FR-020**: A recuperação de rascunho DEVE ser **oferecida explicitamente** ao
  usuário, nunca aplicada em silêncio.
- **FR-021**: O rascunho local DEVE ser descartado quando o conteúdo é salvo no
  servidor.
- **FR-022**: Sair da página com alterações pendentes DEVE disparar aviso do navegador,
  nas duas telas.

#### Navegação e entrada do módulo (desvio nº 9)

- **FR-023**: A entrada do módulo DEVE ser um menu com dois destinos — levantar custos e
  ver/criar propostas — e as telas DEVEM atender em endereços próprios sob a raiz do
  módulo.
- **FR-024**: O card do módulo no hub do filtroAPP DEVE ficar oculto para quem não tem
  nenhuma role do módulo.

#### Onboarding (L4)

- **FR-025**: O módulo DEVE ter tutorial permanente de primeiro acesso, marcado por
  usuário, dispensável e rechamável, sem reaparecer sozinho depois de visto.
- **FR-026**: O roteiro do tutorial DEVE cobrir, no mínimo, a cadeia de prioridade do
  rodapé do levantamento e a armadilha de e-mail/CNPJ inválido da primeira etapa da
  proposta.

#### Permissões e autoria

O módulo tem **três** papéis, e a diferença entre dois deles é a **autoria**, não a
funcionalidade:

| Papel | Título | Levantamentos | Propostas | Valores |
|---|---|---|---|---|
| `comercial:manager` | Comercial — Gestor | cria; vê **todos** | cria, edita e finaliza **qualquer uma** | vê tudo |
| `comercial:seller` | Comercial — Vendedor | cria; vê **só os seus** | cria, edita e finaliza **só as suas** | vê os seus |
| `comercial:viewer` | Comercial — Consulta | nenhum acesso | **somente leitura** | **não vê valor nenhum** |

- **FR-027**: O levantamento de custos DEVE ser restrito a `comercial:manager` e
  `comercial:seller`. `comercial:viewer` NÃO PODE alcançá-lo por nenhum caminho.
- **FR-027a**: `comercial:seller` DEVE ver, editar e finalizar **apenas os levantamentos
  e propostas de sua própria autoria**. Custo, margem e preço de venda de trabalho
  alheio NÃO PODEM aparecer para ele em nenhuma superfície, incluindo listagens.
- **FR-027b**: `comercial:manager` DEVE alcançar levantamentos e propostas de **qualquer
  autor**, com poder de edição e finalização.
- **FR-028**: A finalização DEVE ser permitida ao autor da proposta (`comercial:seller`
  ou `comercial:manager`) e a qualquer `comercial:manager`. `comercial:viewer` nunca
  finaliza.
- **FR-029**: Escrita em levantamento e em proposta DEVE ser permitida apenas ao **autor
  ou a um gestor**. A verificação de autoria vale para **as duas entidades**, não só
  para a proposta, e é regra nova — não existe na referência.
- **FR-030**: `comercial:viewer` DEVE ser **somente leitura** e **sem valores**: sua
  única superfície é a **listagem do histórico**, sem ver preço, valor total, custo nem
  margem em nenhuma coluna. Não cria, não edita, não finaliza e **não tem tela de detalhe de proposta** — nenhuma tela nova nasce por
  causa deste papel.
- **FR-030a**: `comercial:viewer` PODE baixar a **proposta técnica** e NÃO PODE baixar a
  **proposta comercial** — esta carrega a tabela de preços, as condições de pagamento e
  o valor total, e liberá-la contornaria o FR-030 por outra porta.
- **FR-030b**: As superfícies de criação e edição não devem ser apenas desabilitadas
  para quem não tem o papel — elas não devem ser alcançáveis, nem por endereço direto.
  O mesmo vale para o levantamento de outro autor no caso do `comercial:seller`.

#### Finalização e documentos

- **FR-031**: A finalização DEVE validar com mensagem específica por problema antes de
  começar a gerar.
- **FR-032**: A finalização DEVE anunciar os quatro estágios ao usuário, na ordem da
  referência.
- **FR-033**: A finalização DEVE produzir os dois documentos, salvá-los no histórico e
  oferecer download conjunto ou separado.
- **FR-034**: Se a integração externa falhar **depois** dos documentos prontos, a
  mensagem de erro DEVE informar que eles continuam disponíveis para download.
- **FR-035**: A numeração DEVE ser gerada pelo próprio módulo, e a semente da sequência
  DEVE considerar o maior número já existente tanto no sistema externo quanto no
  histórico do módulo, para não colidir.

#### Responsividade (L7)

- **FR-036**: Nenhuma das quatro telas PODE produzir rolagem horizontal de página em
  largura de celular, incluindo a faixa de indicadores de custo e a tira de seções.
- **FR-037**: Tabelas largas DEVEM ter alternativa empilhada em telas estreitas.
- **FR-038**: Rótulos longos e valores monetários grandes DEVEM quebrar, truncar ou
  empilhar sem aumentar a largura do contêiner.

#### Dados e isolamento

- **FR-039**: Os dados do módulo DEVEM viver em schema próprio, separado do schema do
  filtroAPP, na mesma instância de banco.
- **FR-040**: Não há migração de dados — a referência nunca esteve em produção.
- **FR-041**: A lista de consultores de vendas DEVE ser **derivada dos usuários com o
  papel `comercial:seller`**, atualizando-se sozinha conforme o quadro muda. Não existe
  cadastro paralelo de vendedores.
- **FR-041a**: A proposta DEVE guardar o **nome do consultor no momento da emissão**,
  além do vínculo com o usuário. Desativar ou renomear um usuário NÃO PODE alterar
  proposta já emitida — o documento é registro histórico.
- **FR-041b**: No campo "Consultor de Vendas" (`PROP-CTL-016`), `comercial:seller` DEVE
  ver **apenas o próprio nome**, já pré-selecionado; `comercial:manager` DEVE ver a
  lista completa e poder escolher. O controle continua sendo o mesmo do inventário — o
  que muda é o conjunto de opções, decidido no servidor.
- **FR-042**: As propostas DEVEM ser retidas por prazo indefinido, como registro
  comercial, com a entrada correspondente no registro de tratamento de dados.

#### Fluxo de entrada

- **FR-043**: O menu de entrada e o diálogo de modo do levantamento DEVEM **coexistir
  como dois passos**. O menu escolhe a tela; o diálogo "Como deseja começar?" continua
  oferecendo os três modos (Levantar custos, Nova proposta, Revisar proposta) como na
  referência. O menu NÃO PODE oferecer atalho que dispense o diálogo — isso alteraria o
  fluxo da referência e exigiria um décimo desvio, que não existe.
- **FR-044**: Quando o endereço já trouxer o modo (por recuperação de estado, FR-018), o
  diálogo NÃO deve reaparecer — ele existe para escolher o modo, não para confirmá-lo.

### Visual/UI Contract *(mandatory if feature touches frontend)*

**Exceção de identidade portada (Princípio VI) — declarada e aplicável.**

| | |
|---|---|
| Aplicativo de origem reproduzido | `~/comercialAPP`, congelado em `6f5b072`, aprovado pela diretoria |
| Raiz de CSS que escopa todo seletor | raiz do módulo Comercial; nenhum seletor vaza para o restante do app, e `base.css` não afeta o interior |
| Prefixo das custom properties | `--com-*`, em **bloco único**, nomeadas **por função** (`--com-superficie`, `--com-borda`, `--com-texto-fraco`) e nunca por cor |
| Comportamentos obrigatórios (alínea c) | **Todos preservados** — ver FR-010 a FR-022, FR-025, FR-036 |

A alínea (c) **não é dispensada em nada**: campo inválido marcado com mensagem visível,
estados de foco/desabilitado/erro em seleção, reordenação no padrão compartilhado,
navegação no endereço, tutorial permanente de primeiro acesso e ausência de rolagem
horizontal de página continuam obrigatórios. A exceção é de aparência.

| Surface | Existing reference inspected | Components/classes to use | Form/dropdown pattern | Reorder drag/drop pattern | Navigation persistence | Novelty/tutorial contract | Responsive/overflow contract |
|---------|------------------------------|---------------------------|-----------------------|---------------------------|------------------------|---------------------------|------------------------------|
| Menu de entrada do módulo (novo, desvio nº 9) | `frontend/src/pages/HubPage.tsx` (seletor de cartões do filtroAPP) | linguagem de cartões do hub, sob a raiz do módulo | N/A | N/A | endereço próprio da raiz do módulo | ponto de partida do tutorial permanente | grade de cartões com `minmax(min(100%, N), 1fr)`; sem estouro em 390 px |
| `LOGIN` — login (7 controles) | `contracts/ui-inventory.md` §LOGIN; `frontend/src/styles/base.css` (`.field-invalid`) | padrão compartilhado de campo inválido | campo obrigatório vazio destacado em vermelho + mensagem; erro de credencial segue global | N/A | N/A | N/A — o tutorial é do módulo, não do login | formulário de dois campos; sem rolagem horizontal |
| `PROP` — assistente de 7 etapas (137 controles) | `contracts/ui-inventory.md` §PROP; capturas `baseline/PROP-*-1440.png`; `frontend/src/utils/reorderDrag.ts` | padrão compartilhado de campo inválido; utilitário compartilhado de reordenação | destaque por campo com mensagens distintas para vazio e inválido (FR-011); trava de avanço por etapa com contagem | alça + reordenação ao vivo + espaço de destino + fantasma + cancelar restaura + persiste ao soltar + toque; **setas ↑/↓ mantidas** | etapa ativa no endereço; rascunho local com oferta de recuperação e aviso ao sair | tutorial permanente do módulo cobre a armadilha de e-mail/CNPJ | prévia lateral não pode impor largura mínima em pixel; tabelas de preço empilham em tela estreita |
| `CUSTO` — levantamento, 5 seções (465 controles) | `contracts/ui-inventory.md` §CUSTO; capturas `baseline/CUSTO-*-1440.png`; `baseline/L3-f5-perde-levantamento.png` | padrão compartilhado de campo inválido; primitivas responsivas do projeto | destaque por campo resolvido a partir do endereço de cada pendência da validação; banner-resumo mantido | N/A | modo, base e seção no endereço; rascunho local com oferta de recuperação e aviso ao sair | tutorial permanente cobre a cadeia de prioridade do rodapé | faixa de 7 indicadores e tira de 5 seções são os pontos de estouro conhecidos: quebrar, rolar internamente ou virar seleção em tela estreita |
| `HIST` — histórico (7 controles) | `contracts/ui-inventory.md` §HIST; captura `baseline/HIST-lista-1440.png` | tabela do padrão do projeto | N/A | N/A | filtros no endereço quando houver | N/A | tabela vira cards empilhados em tela estreita; valores monetários e status não podem alargar o card |
| Campo "Consultor de Vendas" (`PROP-CTL-016`) | `contracts/ui-inventory.md` §PROP | mesmo `SelectField` do inventário | opções decididas no servidor: **vendedor vê só o próprio nome, pré-selecionado; gestor vê a lista completa** | N/A | N/A | N/A | herda a etapa Cliente |

### Key Entities *(include if feature involves data)*

- **Levantamento de custos**: o cálculo completo de um serviço — premissas, mão de obra,
  materiais e insumos, logística de mobilização/desmobilização, impostos, comissões,
  margem e preço de venda. Carimba o código usado pelos documentos. **Tem autor** — é
  por ele que se decide quem pode abri-lo e editá-lo.
- **Proposta**: o conjunto comercial + técnico de um cliente, com dados do cliente,
  escopo, matriz de responsabilidades, prazos, conteúdo técnico, preços e condições.
  Tem autor, revisão e vínculo com o levantamento que lhe deu origem.
- **Revisão de proposta**: uma versão numerada de uma proposta, derivada da anterior.
- **Documento gerado**: o arquivo comercial ou técnico produzido na finalização, com seu
  vínculo à proposta e à revisão.
- **Consultor de vendas**: **não é entidade própria** — é o usuário com o papel
  `comercial:seller`. A lista da etapa Cliente é derivada dos usuários. A proposta
  guarda o vínculo **e o nome no momento da emissão**, para que desativar ou renomear
  o usuário não altere documento já emitido.
- **Numeração**: a sequência que atribui código novo, semeada acima do maior número
  existente nas duas origens.
- **Registro de integração**: o estado de envio de cada documento aos sistemas externos,
  exibido no histórico.
- **Papel do usuário no módulo**: gestor, vendedor ou consulta. Determina o alcance
  (todos os registros, só os próprios, ou nenhum) e a visibilidade de valores.
- **Rascunho local**: conteúdo não salvo de um levantamento ou proposta, guardado no
  navegador do usuário, com chave por modo e código, descartado ao salvar.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: **100%** dos 616 controles e 916 textos do inventário estão presentes no
  módulo, verificados item a item — nenhum item de inventário fica sem cobertura.
- **SC-002**: **16 de 16** cenários golden reproduzem os valores dígito a dígito.
- **SC-003**: **Zero** divergências em relação à referência fora da lista fechada de 9
  desvios, no aceite lado a lado das quatro telas.
- **SC-004**: **Zero** rolagem horizontal de página nas quatro telas em largura de 390 px.
- **SC-005**: Ao tentar salvar com pendências, **100%** dos campos pendentes ficam
  visualmente identificados, e **e-mail/CNPJ inválidos** recebem mensagem que os
  identifica como inválidos, não como vazios.
- **SC-006**: Recarregar ou fechar a página no meio de um levantamento ou proposta
  resulta em **zero** perda silenciosa de trabalho: ou o estado volta, ou a recuperação
  é oferecida, ou houve aviso antes de sair.
- **SC-007**: Um orçamentista que nunca usou o módulo conclui um levantamento completo
  sem ajuda externa, apoiado apenas no tutorial e na cadeia de orientação do rodapé.
- **SC-008**: **Zero** acessos bem-sucedidos de um usuário de consulta a valor, custo,
  margem, à proposta comercial ou a qualquer operação de escrita — incluindo tentativa
  por endereço direto.
- **SC-008a**: **Zero** vazamentos entre vendedores: um `comercial:seller` não alcança
  levantamento nem proposta de outro autor, por listagem ou por endereço direto.
- **SC-009**: Falha de integração após a geração dos documentos resulta em **100%** dos
  documentos ainda baixáveis.
- **SC-010**: **Zero** colisões de numeração entre o módulo e o sistema externo após a
  semeadura da sequência.
- **SC-011**: Toda a interface do módulo está em pt-BR, sem exceção.

## Assumptions

- A referência `~/comercialAPP` permanece **congelada** em `6f5b072` durante todo o
  porte. Os IDs do inventário derivam da ordem de linha do arquivo de origem: se a
  referência mudar, os IDs passam a apontar para outro elemento **em silêncio**, e tanto
  o inventário quanto os goldens precisam ser refeitos.
- Nenhum dado precisa ser migrado, porque a referência nunca esteve em produção.
- Autenticação, sessão e o hub de módulos do filtroAPP são reaproveitados — o módulo não
  traz login próprio, apesar de a tela `LOGIN` existir no inventário da referência.
- A infraestrutura é a mesma: mesmo servidor de aplicação, mesmo servidor web, mesma
  instância de banco.
- O ajuste fino de responsividade é **sequenciado para o fim do porte**, por decisão do
  mantenedor. Isso é ordem de execução, **não dispensa** — continua condição de aceite.
- As telas nascem com as primitivas responsivas corretas desde o início. Sem isso, a
  passada final de responsividade deixa de ser ajuste e vira reescrita de layout.
- O fluxo de reserva de numeração da referência **não tem captura de baseline** (desvio
  nº 8), porque exigia chamada real ao sistema externo. Sua paridade será conferida
  contra o código. Com a numeração passando a ser do próprio módulo, esse passo deixa de
  depender de credencial externa.
- As decisões da §12.5 do plano (permissões, autoria, lista de vendedores, numeração,
  retenção) são **escopo além do porte fiel** e já foram aprovadas. Elas divergem da
  referência sem constar da lista de 9 desvios porque aquela lista trata de paridade de
  UI/UX, não de regra de negócio.
- **As decisões 1 e 2 da §12.5 foram revistas em 31/07** e o plano precisa acompanhar:
  o levantamento deixa de ser exclusivo do gestor (passa a incluir o vendedor, limitado
  à própria autoria) e a finalização deixa de ser exclusiva do gestor (o autor finaliza
  a própria). O papel intermediário `comercial:seller` não existia no plano.
- **A superfície de consulta do papel `comercial:viewer` é o histórico** — confirmado
  pelo mantenedor em 31/07: *"não precisa de tela nova. Ele só vê a lista e pode baixar
  a proposta técnica."* Não há tela de detalhe de proposta em modo leitura, nem na
  referência nem no porte. **Nenhum escopo novo de tela entra por causa do papel de
  consulta** — o que entra é a resposta do histórico variando por papel.
- A supressão de valores para o papel de consulta acontece **na origem dos dados**, não
  por ocultação na tela. Um valor que chega ao navegador e é escondido por estilo
  continua acessível.
- Os padrões que o filtroAPP já tem — utilitário de reordenação, classes de campo
  inválido, biblioteca de tutorial guiado, linguagem de cartões do hub — são
  reaproveitados em vez de reescritos. Se algum deles não passar na auditoria contra a
  constitution, o conserto é feito na origem compartilhada e beneficia os módulos que já
  os usam.
