---
description: "Task list — Módulo Comercial (porte fiel do gerador de propostas)"
---

# Tasks: Módulo Comercial — porte fiel do gerador de propostas

**Input**: Design documents from `/specs/009-modulo-comercial/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

> **Retomando em outro ambiente? Leia [HANDOFF.md](./HANDOFF.md) primeiro.**
> Há quatro coisas que não vêm no `git clone` — a mais traiçoeira é que
> `shared/comercial/dist/` é gerado e está no `.gitignore`: sem compilar, nada do
> módulo carrega. O documento também lista as armadilhas do `.docx` que já
> custaram tempo, e a única falha de teste que é esperada.
>
> **Estado em 13/08/2026: 153 tarefas fechadas, 28 abertas** (de 181). O contador
> vinha desatualizado desde 10/08 — dizia 94/61 — e um contador velho é pior do que
> nenhum: ele foi lido como estado real numa revisão. Ao fechar tarefa, corrija aqui
> **e** no [HANDOFF.md](./HANDOFF.md), que tem o seu próprio.
>
> O próximo item do caminho crítico é a busca do CRM na etapa Cliente (T121a).
> Depois: arrastar
> (T068–T071), tutorial e
> login (T096–T098a), validação das 7 etapas (T067), mobile restante e a matriz de
> permissões (T108–T112).

**Tests**: **Obrigatórios.** Esta feature tem dois oráculos que só existem como teste — os
16 goldens e a matriz de permissão. Sem eles não há como provar paridade.

**Organization**: agrupadas por história de usuário, com a **etapa E1–E11** marcada em
cada tarefa para preservar a ordem de execução acordada na §6 do
`docs/PLANO_MODULO_COMERCIAL.md`.


## Estado da implementação — 03/08/2026

Atualizado **a partir do código**, não do plano. `[X]` significa que existe e passa nos
testes; onde a implementação divergiu da tarefa, a divergência está anotada logo abaixo
dela, com o motivo.

| Fase | Estado |
|---|---|
| 1 — Setup `(E1+E2)` | **completa** — 16 goldens verdes |
| 2 — Foundational `(E3 + base E6)` | **completa** — dois schemas aplicados, acesso e CSS escopado |
| 3 — US1 levantamento `(E4+E7)` | **as 5 seções da tela existem e calculam**; faltam T043 (541 textos), T046 (RHF) e o salvamento a partir da tela |
| 4 a 9 | não iniciadas |

**Números de agora:** 144 testes no frontend, 824 no backend (1 falha preexistente de
SMTP, alheia ao módulo), `architecture:check` verde, CSS do módulo com **0** regras fora
de `.com-root`.

**O que a tela de custos já faz de ponta a ponta:** escolher o modo, dimensionar equipe
por fase com alocações e despesas, materiais, circuitos de volume, produtos dosados e
filtros, mobilização e desmobilização com os seis modos de cálculo, e a formação do
preço com comissão e preço global fechado — tudo recalculando ao vivo, com a faixa de 7
indicadores e o rodapé-guia apontando a próxima pendência real.

**O que ela ainda não faz:** salvar. O botão do rodapé abre a confirmação e para ali; a
rota `POST /api/comercial/levantamentos` existe e está testada no backend, mas a tela
não a chama.

### Correções da E0 descobertas implementando

Documentar a referência lendo o fonte erra em coisas que só aparecem quando se constrói
a tela. Três correções, todas já aplicadas no código e nos artefatos:

1. **O diálogo "Como deseja começar?" tem duas opções, não três.** "Levantar custos" é
   um *link*, não um modo — o tipo da referência é `EstimateMode = "new" | "revision"`.
   O enum Prisma já tinha nascido errado (`LEVANTAR`) e foi corrigido para
   `NOVA | REVISAO`.
2. **A terceira saída do modal de confirmação é "Trocar para revisão"**, não "Informar
   outro número".
3. **Os subtítulos das opções eram de outra tela.**

---

## Format: `[ID] [P?] [Story] Descrição`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1 a US6, conforme o `spec.md`
- **`(EN)`**: a etapa do plano técnico a que a tarefa pertence

## Mapa fase × etapa

| Fase | Etapa do plano | Dias |
|---|---|---|
| 1 — Setup | E1 + E2 | 2,75 |
| 2 — Foundational | E3 + base da E6 | ~3 |
| 3 — US1 levantamento | E4 + E7 | 12,5–13,5 |
| 4 — US2 proposta | E5 + E8 (parcial) | ~10 |
| 5 — US3 finalização | E5 + E8 (parcial) | ~6 |
| 6 — US4 continuidade | L3, dentro de E7/E8 | 2,5 |
| 7 — US5 entrada e onboarding | E6 + E8 | ~2 |
| 8 — US6 lista de vendedores | E4 | ~0,25 |
| 9 — Polish | E8.5 + E9 + E10 | 7,5–8,5 |
| Depois | E11 | 3–5 |

**Caminho crítico: Fases 3 e 4 (E7 e E8).**

## Cobertura do inventário

Faixas de ID de `contracts/ui-inventory.md`. **Nenhuma faixa pode ficar sem tarefa** —
o `/speckit-analyze` acusa item órfão, e ausência de campo não gera erro: só some.

| Faixa | Onde é coberta |
|---|---|
| `CUSTO-CTL-001..027` (shell e modais) | T037, T045 |
| `CUSTO-CTL-028..038` (Premissas) | T038 |
| `CUSTO-CTL-039..137` (Mão de obra) | T039 |
| `CUSTO-CTL-138..228` (Insumos) | T040 |
| `CUSTO-CTL-229..394` (Mob./Desmob.) | T041 |
| `CUSTO-CTL-395..465` (Resumo e QQP) | T042 |
| `CUSTO-H-001..017`, `CUSTO-TXT-001..541` | T038–T042, T043 |
| `PROP-CTL-001..010` (shell e modo) | T055 |
| `PROP-CTL-011..025` (E1 Cliente) | T057, T102 |
| `PROP-CTL-026..033` **+ `113..128`** (E2 Escopo, incl. blocos de conteúdo) | T058, **T058a–T058d** |
| `PROP-CTL-034..042` (E3 Responsabilidades) | T059 |
| `PROP-CTL-043..048` (E4 Prazos) | T060 |
| `PROP-CTL-049..057` **+ `098..112`** (E5 Técnica, incl. editor de serviços) | T061 |
| `PROP-CTL-058..071` (E6 Comercial) | T062 |
| `PROP-CTL-072..085` **+ `129..130`** (E7 Revisão, incl. funil, cards, OneDrive e anexos) | T063, **T063a** |
| `PROP-CTL-086..089` **+ `131..137`** (prévia) | T064 |
| `PROP-CTL-090..097` (primitivas `Step`/`Field`/`Area`/`SelectField`) | T030 |
| `PROP-H-001..003` (chrome), `PROP-H-004..022` (fac-símile) | T055, T064 |
| `PROP-TXT-001..330` | T057–T064, T058a–T058d |

> **Correção de 31/07 — as faixas não seguem a ordem do arquivo.** A primeira versão
> desta tabela mapeou `PROP-CTL-086..137` inteiro para a prévia, porque esses IDs vêm
> depois dela **no fonte**. Só que ali estão **definições de componente**, e cada uma
> renderiza em outro lugar: `ScopeContentEditor` (`113..128`) é a **etapa 2**,
> `TechnicalServicesEditor` (`098..112`) é a **etapa 5**, `PipelineSelector` e
> `OpportunityList` (`129..130`) são a **etapa 7**, e as primitivas (`090..097`) valem
> para todas. Só `086..089` e `131..137` são prévia de verdade.
>
> **Foi esse erro que escondeu o subsistema de blocos de conteúdo** (tabelas e fotos do
> escopo): os 16 controles estavam "cobertos" por uma tarefa que fala de abas e contador
> de páginas. Cobertura por faixa prova que ninguém esqueceu de listar o controle — não
> prova que alguém entendeu o que ele faz.
| `HIST-CTL-001..007`, `HIST-H-001`, `HIST-TXT-001..033` | T084 |
| `LOGIN-CTL-001..007`, `LOGIN-H-001`, `LOGIN-TXT-001..012` | **T098** — **não portados**, com motivo registrado |

> **Os IDs `LOGIN-*` não têm tela de destino.** O módulo não traz login próprio: reusa
> o do filtroAPP, o que era premissa desde o início ("mesmo nginx, mesmo login"). Isso
> **não é um décimo desvio** — é consequência de ser módulo, como o prefixo de rota.
> A T098 registra a não-portabilidade com motivo, para o `/speckit-analyze` não os
> acusar como órfãos, e corrige a **dívida da fonte** que o reuso expõe.

---

## Phase 1: Setup — scaffold e regra compartilhada `(E1 + E2)`

**Purpose**: módulo registrado, dependências resolvidas e o motor de custos disponível
nas duas pontas.

### Auditorias que precedem reuso

- [X] T001 [P] Auditar `frontend/src/utils/reorderDrag.ts` contra a constitution (alça dedicada, reordenação ao vivo, placeholder com legenda de posição, fantasma, cancelar restaura, persistência só ao soltar, toque via Pointer Events com `touch-action: none`) e registrar o laudo em `specs/009-modulo-comercial/contracts/auditoria-reorder.md`. **Se reprovar, o conserto é na origem compartilhada (T002), não no módulo.**
- [X] T002 Corrigir `frontend/src/utils/reorderDrag.ts` se T001 reprovar — beneficia `QualityNaturesTab.tsx`, `CategoryManager.tsx`, `TechnicalSchemaBuilder.tsx` e `GestorPage.tsx`, que já o usam. Pular se T001 aprovar.

  > **Dispensada.** A T001 aprovou (`contracts/auditoria-reorder.md`). O utilitário é um kit, não o padrão inteiro: placeholder, cancelar e `touch-action` continuam vindo do CSS e do chamador, e é a T081 que os verifica.
- [X] T003 [P] Instalar `@hookform/resolvers` em `frontend/package.json`. Não está no projeto e `zodResolver` não aparece em nenhum arquivo, apesar de o Princípio III exigir react-hook-form com resolver Zod.

### Scaffold `(E1)`

- [X] T004 Rodar `npm run new:module -- comercial --title "Comercial"` e conferir a árvore gerada em `frontend/src/pages/comercial/` e `backend/src/routes/comercial/`.
- [X] T005 Registrar o módulo em `shared/modules/registry.json`: badge `COM`, `pathPrefixes: ["/comercial"]`, `hub.path: "/comercial"`, rotas `index` (`/comercial`), `custos`, `propostas`, `historico`, e os **três** papéis — `comercial:manager` ("Comercial — Gestor"), `comercial:seller` ("Comercial — Vendedor"), `comercial:viewer` ("Comercial — Consulta").
- [X] T006 Rodar `npm run modules:generate` e conferir `frontend/src/modules/registry.generated.ts`.
- [X] T007 Criar migration dos enums `AppModule.COMERCIAL` e `ModuleRoleCode.COMERCIAL_MANAGER|COMERCIAL_SELLER|COMERCIAL_VIEWER` em `backend/prisma/migrations/`.
- [X] T008 Implementar `requireComercialAccess`, `requireComercialEstimator` (gestor **ou** vendedor) e `requireComercialManager` em `backend/src/middleware/auth.js`, no padrão de `requireQualidadeAccess`.

### Regra de negócio compartilhada `(E2)`

- [X] T009 [P] Copiar **sem alterar** `cost-model.ts` da referência para `shared/comercial/cost-model.ts`. É o arquivo que os 16 goldens verificam — qualquer edição aqui invalida a prova.
- [X] T010 [P] Copiar sem alterar `technical-services.ts` e `scope-content.ts` para `shared/comercial/`.
- [X] T011 [P] Copiar sem alterar `proposal-visuals.ts` e `nectar-pipelines.ts` para `shared/comercial/`.
- [X] T012 [P] Copiar sem alterar `finalization.ts` para `shared/comercial/finalization.ts` — contém os 4 estágios anunciados ao usuário (FR-032).  ↳ `FR-032`
- [X] T013 Criar `shared/comercial/tsconfig.json` gerando `dist/` com `.js` + `.d.ts`, e ligar ao build do backend e do frontend.
- [X] T014 Escrever `backend/test/comercial-goldens.test.js` rodando os 16 cenários de `specs/009-modulo-comercial/contracts/goldens/` contra `shared/comercial/cost-model`. **Nunca regerar golden para fazer passar** — se falha, o defeito é do porte.  ↳ `FR-007` `FR-008` `SC-002`

**Checkpoint**: `npm run architecture:check` verde, card do módulo aparece no hub para quem tem papel, e os 16 goldens passam dígito a dígito.

---

## Phase 2: Foundational — banco, acesso e base visual `(E3 + base da E6)`

**Purpose**: pré-requisitos que bloqueiam todas as histórias. **Nenhuma história começa
antes desta fase fechar.**

### Banco e dois schemas `(E3)`

- [X] T015 Declarar `schemas = ["public", "comercial"]` no datasource de `backend/prisma/schema.prisma`.  ↳ `FR-039`
- [X] T016 Escrever `scripts/annotate-prisma-schemas.mjs` que insere `@@schema("public")` em todo model e enum de `backend/prisma/schema.prisma` sem anotação (~100 models, ~40 enums). Edição mecânica de alto volume — à mão introduz erro silencioso.
- [X] T017 Declarar os models novos com `@@schema("comercial")` conforme [data-model.md](./data-model.md): `CostEstimate`, `CostEstimateVersion`, `Proposal`, `ProposalDocument`, `SalesAttribution`, `ProposalAuditLog`.  ↳ `FR-039`
- [X] T018 Aplicar as conversões obrigatórias de tipo: dinheiro em `Decimal @db.Decimal(14,2)` e margem em `Decimal @db.Decimal(6,2)` — **nunca `Float`**, que produz centavo errado e aqui vira preço errado.
- [X] T019 Criar em `backend/prisma/schema.prisma` os índices de listagem: `(createdByUserId, createdAt)` em `CostEstimate` e `Proposal` — é a consulta da filtragem por autoria —, mais `(proposalCode, revisionNumber)` e `(status)`.
- [X] T020 Rodar `prisma migrate dev` e **revisar o SQL gerado**: deve conter `CREATE SCHEMA comercial` e `CREATE TABLE comercial.*`, e **nenhum `ALTER`** nas tabelas da operação. Se houver `ALTER`, parar e investigar.  ↳ `FR-040`

  > **Feita por outro caminho, e o desvio importa.** `prisma migrate dev` exigiu **reset do banco de desenvolvimento** por drift preexistente (duas migrations antigas alteradas depois de aplicadas). Reset destrói dado local, então o caminho foi `migrate diff` → revisão do SQL → `db execute` → `migrate resolve --applied`. A migration `20260803120000_add_comercial_models` foi conferida contra o critério da tarefa: **1** `CREATE SCHEMA`, **8** `CREATE TABLE` em `comercial`, **0** `ALTER` em tabela da operação, **0** `DROP`.
- [X] T021 Criar em `backend/prisma/migrations/` a sequence de numeração do schema `comercial`, semeada acima do maior número existente **no CRM Nectar e em `CommercialProposal`**. O valor de partida é levantado uma vez e fica registrado na migration.  ↳ `FR-035`

  > **A sequence nasce NÃO semeada, e a rota recusa até alguém semear.** O valor de
  > partida só existe no servidor de produção, então gravá-lo na migration não era
  > possível — a migration cria a sequence vazia e a linha
  > `comercial.ProposalNumberingState` com `seededAt = NULL`. `scripts/semear-numeracao-comercial.mjs`
  > faz a leitura e a semeadura, em modo relatório por padrão. **Só `CommercialProposal.codProp`
  > entra no piso**: `codNectar` parece número de proposta e é o id do registro no CRM —
  > neste banco 4.434 contra 292 milhões. Local semeado em **4435**.
- [X] T022 [P] Escrever `shared/schemas/comercial.js` com o contrato Zod do payload `Json` do levantamento, e teste em `backend/test/`. Campo `Json` sem contrato validado vira depósito sem forma.
- [X] T023 Rodar a suíte existente `backend/test/*.test.js` — prova de que a anotação em massa não mexeu na operação.

### Controle de acesso `(E4/E5, pré-requisito)`

- [X] T024 Implementar `backend/lib/comercial/access.js` com verificação de autoria em **duas** entidades — `CostEstimate` e `Proposal` — e o helper de **filtro de listagem por autoria**. Middleware de papel sabe o papel, não sabe a autoria do registro alcançado.  ↳ `FR-029`
- [X] T025 Implementar em `backend/lib/comercial/access.js` a **supressão de valores na origem** para `comercial:viewer`: `totalValue`, custo e margem **omitidos da serialização**, não ocultados no cliente. Valor que chega ao navegador não está restrito.  ↳ `FR-030`

### Base visual do módulo `(E6)`

- [X] T026 Criar `frontend/src/styles/comercial.css` com **todo** seletor escopado sob a raiz do módulo. Sem vazamento nos dois sentidos: nada escapa para o app, e `base.css` não afeta o interior (alínea (a) do Princípio VI).
- [X] T027 **(L6)** Declarar a paleta e as medidas em **um bloco único** de custom properties `--com-*`, nomeadas **por função** (`--com-superficie`, `--com-borda`, `--com-texto-fraco`) e nunca por cor. Hex solto espalhado pelos seletores **não atende** a alínea (b). Auditar cada regra contra o **bloco `:root` ativo** da referência — a duplicação do `globals.css` já produziu uma conclusão errada uma vez.
- [X] T028 [P] Criar o shell do módulo em `frontend/src/pages/comercial/`, com as rotas `/comercial`, `/comercial/custos`, `/comercial/propostas`, `/comercial/historico` e `/comercial/vendedores` em `frontend/src/App.tsx`.
- [X] T029 [P] Escrever as primitivas responsivas de base em `comercial.css`: **nunca** `min-width` em pixel de container, `min-width: 0` em filho de flex/grid, tabela larga já dentro do próprio `overflow-x: auto`, grade de cards com `minmax(min(100%, N), 1fr)`. **Sem esta disciplina a E8.5 vira reescrita de layout e custa o dobro.**
- [X] T030 [P] Generalizar o componente `Field` da referência (`app/page.tsx:1187` — o **único** `aria-invalid` do app de origem) para `frontend/src/pages/comercial/components/Field.tsx`, consumindo `.field-group` + `.field-invalid` + `.field-error` de `frontend/src/styles/base.css:4085-4102`. As classes `.field-*` são de **comportamento, não de identidade** — a exceção do Princípio VI não se aplica a elas.

**Checkpoint**: migration revisada e aplicada em dev, suíte existente verde, CSS escopado sem vazamento.

---

## Phase 3: US1 — Levantar custos e chegar a um preço confiável (P1) `(E4 + E7)`

**Goal**: o orçamentista percorre as 5 seções e obtém preço de venda confiável.

**Independent Test**: os 16 goldens batem dígito a dígito, e as 5 seções conferem
contra `CUSTO-CTL-001..465`. Entrega valor sozinha — precifica sem o assistente
existir.

### Backend `(E4)`

- [X] T031 [US1] Implementar `backend/lib/comercial/cost-estimates.js`: salvar, versionar com hash do payload, atribuições de venda, buscar por id e por `proposalCode`.
- [X] T032 [US1] Implementar as rotas `GET|POST /api/comercial/levantamentos` em `backend/src/routes/comercial/`, sob `requireComercialEstimator`, com validação Zod e **filtro de autoria na listagem** (T024). Contrato em [contracts/api-contracts.md](./contracts/api-contracts.md).  ↳ `FR-027`
- [X] T033 [US1] Implementar `GET|PUT /api/comercial/levantamentos/:id` com verificação de autoria: `comercial:seller` pedindo levantamento de outro autor recebe **403**, não `404` genérico nem tela vazia.  ↳ `FR-027a` `FR-030b`
- [X] T034 [US1] **Recalcular no servidor** com `calculateEstimate` no `POST`/`PUT`: os totais gravados são sempre os do servidor, nunca os enviados pelo cliente. É propriedade de segurança — impede forjar margem.
- [X] T035 [US1] Fazer o `422` devolver `issues: [{ path, message, severity }]` — **um item por pendência, com o endereço do campo**. `validateCostEstimate` já produz isso; a referência concatenava tudo numa string só e jogava o `path` fora.  ↳ `FR-009`
- [X] T036 [US1] [P] Escrever `backend/test/comercial-levantamentos.test.js`: fluxo salvar → versionar → reler; recálculo no servidor ignorando totais forjados; e a numeração (não regride, não colide).  ↳ `SC-010`

### Frontend — as 5 seções `(E7)`

- [X] T037 [US1] Criar o container `frontend/src/pages/comercial/custos/CustosPage.tsx` com a tira horizontal de 5 seções e o diálogo "Como deseja começar?" — cobre `CUSTO-CTL-001..027` e `CUSTO-H-001..017`. **As abas continuam livres**: a cadeia do rodapé guia, não prende.  ↳ `FR-001` `FR-002`
- [X] T038 [US1] [P] Implementar `custos/sections/PremissasSection.tsx` — `CUSTO-CTL-028..038`, com todos os rótulos, unidades, obrigatoriedades, valores padrão e máscaras do inventário.
- [X] T039 [US1] [P] Implementar `custos/sections/MaoDeObraSection.tsx` — `CUSTO-CTL-039..137` (99 controles).
- [X] T040 [US1] [P] Implementar `custos/sections/InsumosSection.tsx` — `CUSTO-CTL-138..228` (91 controles).
- [X] T041 [US1] [P] Implementar `custos/sections/LogisticaSection.tsx` — `CUSTO-CTL-229..394` (166 controles), incluindo o **espelhamento da desmobilização**.  ↳ `FR-003`
- [X] T042 [US1] [P] Implementar `custos/sections/ResumoQQPSection.tsx` — `CUSTO-CTL-395..465`, com a faixa de 7 indicadores.
- [ ] T043 [US1] Conferir os **541 textos** `CUSTO-TXT-001..541` item a item contra o inventário: erro, aviso, estado vazio e ajuda, sem reescrita.  ↳ `FR-004` `SC-011`

  > **ABERTA.** As cinco seções foram escritas *consultando* o inventário, mas a
  > conferência item a item dos 541 textos não foi feita. É o oráculo visual — sem ela
  > não há prova de paridade de texto, só impressão.

- [X] T044 [US1] Implementar `frontend/src/pages/comercial/custos/CustosFooter.tsx` — o **rodapé-guia** com a cadeia de prioridade fixa — mão de obra → materiais e insumos → mob./desmob. → comissões → "Salvar levantamento e criar proposta →" —, com o botão mudando de texto **e de destino**. É o comportamento que o mantenedor confirmou usar na prática.

  > **Arquivo diferente do previsto, de propósito.** A cadeia saiu em `custos/footerChain.ts` — módulo **puro**, sem React — e o rodapé é renderizado dentro do `CustosPage.tsx`. Assim a cadeia inteira é testável sem montar 465 controles: são 13 testes em `frontend/test/comercial-footer-chain.test.mjs`.
- [X] T045 [US1] Implementar `frontend/src/pages/comercial/custos/ConfirmarPropostaModal.tsx` — "Confirme a proposta", com as três saídas: confirmar o código, trocar para nova, informar outro número. **"Trocar para nova" é mantida** apesar de o mantenedor a considerar saída morta — remover quebraria a regra de aceite "se algo sumiu, é bug".

  > **Implementado dentro do `CustosPage.tsx`**, e com **duas correções da E0**: (1) o diálogo de modo tem **duas** opções, não três — "Levantar custos" é um *link*, não um modo, e o tipo da referência é `EstimateMode = "new" | "revision"`; (2) a terceira saída do modal de confirmação é **"Trocar para revisão"**, não "Informar outro número". O enum Prisma foi corrigido de `LEVANTAR` para `NOVA | REVISAO`.
- [X] T046 [US1] ~~Ligar os formulários de `frontend/src/pages/comercial/custos/sections/` a `react-hook-form` + `zodResolver` (T003)~~ — **fechada por decisão, não por implementação**: o desvio nº 11 foi aprovado em 12/08 e dispensa a conversão. A tarefa fica no lugar porque apagá-la esconderia que o Princípio III tem aqui uma exceção nomeada.

  > **A decisão, e o porquê.** As cinco seções foram implementadas com
  > estado controlado em `custos/useLevantamento.ts`, sem `react-hook-form`. Não foi
  > descuido: a tela recalcula **a cada tecla** sobre ~40 coleções aninhadas, e o
  > `react-hook-form` existe justamente para *evitar* re-render por tecla — adotá-lo
  > aqui significa assinar `watch()` no formulário inteiro, que é o modo dele de imitar
  > um componente controlado, com uma camada a mais no caminho. O Princípio III pede
  > RHF + `zodResolver`; o `@hookform/resolvers` está instalado (T003) e é usado no
  > resto do app. **Converter agora é reescrever cinco seções sem ganho visível para o
  > usuário.** Encaminhamento proposto: registrar como desvio nº 11 no `plan.md`,
  > restrito à tela de custos, mantendo RHF nas 7 etapas da proposta (T057–T063), que
  > são formulário de verdade. **APROVADO pelo mantenedor em 12/08**: a exceção
  > fica, e o desvio nº 11 deixa de ser pendência. Converter as cinco seções
  > seria reescrita sem ganho visível para quem usa a tela.


### L1 — validação por campo

- [X] T047 [US1] **(L1)** Escrever o resolvedor de `path` → id de campo em `frontend/src/pages/comercial/custos/fieldPath.ts`, ligando cada `issue.path` do `422` ao seu controle nas 5 seções.

  > **Resolvido antes, e mais simples do que a tarefa supunha.** Não foi preciso resolvedor: `validateCostEstimate` já devolve o **endereço real do campo** (`laborContexts[0].workCondition`), então o índice `caminho → mensagem` vive em `custos/useLevantamento.ts` (`errosPorCampo`) e a seção consulta com `erroDe(caminho)`. A L1 era "ligar o que já existe", não "descobrir endereços" — e há teste travando essa premissa.
- [X] T048 [US1] **(L1)** Destacar **cada** campo pendente em vermelho via `.field-group.field-invalid` + `.field-error`, com `aria-invalid` e mensagem visível. O **banner-resumo no topo permanece**, com a contagem — o destaque é acréscimo, não substituição.  ↳ `FR-010` `FR-012` `FR-014`

  > **Corrigido depois do relato de uso (03/08).** A primeira versão acendia o vermelho desde o primeiro render, porque a validação roda desde sempre. Um levantamento recém-aberto está legitimamente incompleto: quarenta campos vermelhos viram papel de parede. Agora há um portão único em `useLevantamento` (`erroDe` / `erroSe` / `errosVisiveis`) — **o erro só aparece depois que o usuário tenta avançar**, e daí em diante acende e apaga ao vivo. O botão do rodapé revela ao ser clicado; quando a cadeia chega em "Salvar" e ele fica **desabilitado por conteúdo**, a tela revela sozinha, porque aí não há mais em que clicar. `saveBlockedByContent` separa isso de "Salvando...", que não é falta de nada.
- [X] T049 [US1] **(L1)** Distinguir em `frontend/src/pages/comercial/components/Field.tsx` os **dois estados** da mensagem: vazio → "Campo obrigatório"; preenchido e inválido → "E-mail inválido" / "CNPJ inválido". Marcar sem distinguir resolve o *onde* e mantém o engano.  ↳ `FR-011`
- [X] T050 [US1] [P] Escrever `frontend/test/comercial-validacao.test.mjs`: salvar com campo vazio marca o campo certo; campo inválido recebe mensagem de inválido, não de vazio.  ↳ `SC-005`

  > **Saiu distribuído**, não num arquivo só: `comercial-field.test.mjs` (os dois estados da mensagem), `comercial-footer-chain.test.mjs` (quando o vermelho pode aparecer) e um teste por seção. São **144** testes no frontend.

**Checkpoint**: US1 entregável isolada — precifica de ponta a ponta, com os goldens verdes.

---

## Phase 4: US2 — Montar a proposta em 7 etapas (P1) `(E5 + E8)`

**Goal**: o orçamentista percorre as 7 etapas com trava por etapa e prévia ao lado.

**Independent Test**: percorrer as 7 etapas conferindo `PROP-CTL-001..137` e cada trava
contra a tabela de campos obrigatórios. Testável com levantamento semeado, sem depender
da finalização.

### Backend `(E5)`

- [X] T051 [US2] Implementar `backend/src/lib/comercial/proposals.js`: histórico, revisões e vínculo com o levantamento. O `totalValue` é **calculado no servidor** a partir dos itens de preço, com a mesma leitura de moeda do gerador do documento (`comercial/dinheiro.js`) — histórico e PDF não podem discordar. `proximaRevisao` está aqui, testada e exposta pela T053a.
- [X] T052 [US2] Implementar `GET|POST /api/comercial/propostas` e `GET|PUT /api/comercial/propostas/:id`, com autoria (T024) e **a resposta variando por papel** (T025): `viewer` recebe a listagem sem `totalValue` e sem link do documento comercial. Inclui `arquivar`/`desarquivar` (parte da T083a). **A listagem é a única rota de proposta sem `requireComercialEstimator`** — é a superfície inteira do papel de consulta.
- [X] T053 [US2] Implementar `GET /api/comercial/propostas/proximo-numero` consumindo a sequence do schema `comercial` (T021). **Não toca o Nectar** — cai a varredura de `next-number` da referência.  ↳ `FR-035`
- [X] T053a [US2] Implementar `GET /api/comercial/propostas/:codigo/revisao` em `backend/lib/comercial/proposals.js`, devolvendo `base_number`, `nextRevision`, o vínculo com o CRM e **`snapshotAvailable`** (FR-064, FR-065). O caminho **sem snapshot é normal, não erro** — proposta antiga não pode falhar.  ↳ `FR-064` `FR-065`

  > **Ligada nas duas entradas.** O diálogo Nova/Revisar da proposta carrega o
  > snapshot (inclusive fotos e tabelas); a tela de custos usa `costEstimateId`
  > para preservar a composição anterior. Base, revisão e origem vivem na URL e
  > são recompostos no F5. Sem snapshot, os campos indexados do histórico ainda
  > voltam e a resposta traz a mensagem distinta do FR-065.
- [X] T053b [US2] Reutilizar o **card existente do CRM** quando houver vínculo salvo (FR-066), informando qual card e em qual funil. Sem vínculo, funil e card ficam para a última etapa.  ↳ `FR-066`

  > O backend procura o vínculo mais recente para trás e copia card, id e nome
  > do funil para a nova `Proposal` — esses campos nunca são aceitos do cliente.
  > A etapa final e o cabeçalho dizem qual card/funil será reutilizado; sem vínculo,
  > deixam explícito que a escolha ocorrerá na finalização.
- [X] T054 [US2] [P] Escrever `backend/test/comercial-propostas.test.js` cobrindo criação, revisão e vínculo com levantamento. 40 testes, incluindo o caso em que o papel de consulta **alcança todas as propostas** (o contrário do levantamento), o do hidrojateamento e a herança do card/funil na revisão.
- [X] T054a [US2] **Ligar a tela às rotas** — tarefa que não existia no plano e apareceu quando o backend ficou pronto: as rotas existiam e ninguém as chamava. "Salvar e continuar" passa a **salvar de verdade** (`POST` na primeira etapa, `PUT` depois), o id da proposta vai para o **endereço** junto com a etapa e o modelo (L3), e reabrir com `?id=` recarrega o conteúdo do servidor — sem isso o `?id=` sobreviveria ao F5 com o formulário em branco, e o salvamento seguinte gravaria o vazio por cima. O número é reservado no **primeiro salvamento**, não na abertura da tela: ele consome, e abrir o assistente e desistir deixaria um buraco na numeração. Na última etapa o botão salva, **emite** e baixa conforme a escolha. O mapeamento formulário → API saiu para `proposta/salvamento.ts` com teste próprio — é a parte que erra em silêncio, gravando o campo errado sem quebrar nada.  ↳ `FR-018`

### Frontend — as 7 etapas `(E8)`

- [X] T055 [US2] Criar o container `frontend/src/pages/comercial/proposta/PropostaPage.tsx` com o stepper de 7 etapas — `PROP-CTL-001..010` e `PROP-H-001..003`. O stepper cabe em uma linha só (confirmado na baseline).  ↳ `FR-001` `FR-002`
- [X] T056 [US2] Implementar `frontend/src/pages/comercial/proposta/PropostaFooter.tsx` com o contador de pendências e a trava de avanço: "Preencha N campo(s) obrigatório(s)" com o botão desabilitado. **Não dá para pular etapa incompleta.**

  > **Uma divergência deliberada no rodapé.** Na referência o botão primário fica
  > **desabilitado** enquanto há pendência. Aqui ele continua clicável, e o clique é o
  > que revela a marcação em cada campo (L1) — desabilitar esconderia a resposta de
  > quem está perdido. O **texto** é o da referência: "Salvar e continuar →" e "Gerar
  > e salvar técnica + comercial", com a contagem "Preencha N campo(s) obrigatório(s)"
  > num aviso ao lado, não dentro do botão.
- [X] T057 [US2] [P] Implementar `proposta/steps/ClienteStep.tsx` — `PROP-CTL-011..025`. Trava: proposta, cliente, contato, **e-mail válido**, **CNPJ válido**, site, consultor de vendas, orçamentista.

  > **Portada, com uma exceção declarada.** `PROP-CTL-012..015` (busca de empresa no
  > Nectar) existem na tela, **desabilitados**, porque a integração é a T076. O controle
  > diz por que não responde em vez de tentar, falhar e parecer defeito. O CNPJ ficou
  > **mais estrito que a referência**: ela conferia só 14 dígitos, aqui os dígitos
  > verificadores são calculados — o CNPJ vai impresso no documento fiscal do cliente.
- [X] T058 [US2] [P] Implementar `proposta/steps/EscopoStep.tsx` — `PROP-CTL-026..033`. Trava: título, e **todo** item de escopo com título *e* descrição.
- [X] T058a [US2] Implementar `frontend/src/pages/comercial/proposta/steps/ScopeContentEditor.tsx` — o **editor de blocos de conteúdo** de cada item de escopo, cobrindo `PROP-CTL-113..128`: incluir tabela, incluir fotos, legenda, remover, e as setas ↑/↓ de ordenação. **Este subsistema quase se perdeu**: os controles caíam na faixa da prévia porque o componente é definido depois dela no fonte.  ↳ `FR-045`

  > **Completo — tabelas e fotos.** As fotos fecharam em 04/08 junto com a T058b
  > (otimização no cliente) e a T074a/b (gravação e cadeia de recusa no servidor).
  >
  > **Os limites são contados por PROPOSTA, não por item** (`allBlocks`). Oito tabelas
  > espalhadas em quatro serviços já esgotam a cota; contar por item deixaria passar
  > uma proposta com 32 tabelas, que o gerador de PDF não aguenta.
- [X] T058b [US2] Implementar em `frontend/src/pages/comercial/proposta/steps/scopePhoto.ts` a **otimização da imagem no cliente** (FR-048): recusar acima de 10 MB ou 24 megapixels; redimensionar para 1600 px no maior lado; achatar sobre fundo branco; recomprimir em qualidade 0,82 e, se ainda passar de 1,5 MB, em 0,64; recusar com o **nome do arquivo na mensagem** se ainda assim não couber.  ↳ `FR-047` `FR-048`
- [X] T058c [US2] Aplicar em `ScopeContentEditor.tsx` os limites da referência (FR-046): **8 fotos** e **8 tabelas** por item, tabela com **6 colunas**, **40 linhas** e **300 caracteres** por célula, legenda de **240**. Controle desabilitado ao atingir o limite, com mensagem que o nomeia.  ↳ `FR-046`
- [X] T058d [US2] Implementar em `ScopeContentEditor.tsx` o estado vazio e o texto de ajuda que anuncia os limites (FR-053), no texto da referência.  ↳ `FR-053`
- [X] T059 [US2] [P] Implementar `proposta/steps/ResponsabilidadesStep.tsx` — `PROP-CTL-034..042`. Trava: ao menos uma linha na matriz.

  > **Mais estrito que a referência.** Ela exigia só a *existência* da linha; aqui a
  > linha precisa ter o item preenchido. Linha em branco atravessa para o documento
  > como obrigação sem texto — pior que a ausência dela, porque parece que alguém quis
  > dizer algo e não disse.
- [X] T060 [US2] [P] Implementar `proposta/steps/PrazosStep.tsx` — `PROP-CTL-043..048`. Trava: mobilização, permanência, execução, atendimento, jornada.
- [X] T061 [US2] [P] Implementar `proposta/steps/TecnicaStep.tsx` — `PROP-CTL-049..057`, com os requisitos condicionais dos serviços técnicos selecionados.  ↳ `FR-003`
- [X] T062 [US2] [P] Implementar `proposta/steps/ComercialStep.tsx` — `PROP-CTL-058..071`. Trava: ao menos um preço com descrição + unidade + valor, condição de pagamento, validade.
- [X] T063 [US2] [P] Implementar `proposta/steps/RevisaoStep.tsx` — `PROP-CTL-072..085`, com funil do Nectar e escolha de card.

  > **Estrutura portada; funil e card do Nectar ficam desabilitados** até a T076,
  > dizendo por quê — mesmo critério da busca de empresa na etapa 1. O que já
  > funciona: o visto das etapas, o par de documentos com o nome de arquivo final, a
  > escolha de download, a pasta do OneDrive e os anexos.
- [X] T063a [US2] Implementar em `frontend/src/pages/comercial/proposta/steps/RevisaoStep.tsx` os controles `PROP-CTL-080` ("Pasta existente no OneDrive") e `PROP-CTL-081` ("Arquivos adicionais do cliente"), com o texto de ajuda da referência.  ↳ `FR-057` `FR-058`
- [X] T064 [US2] Implementar a prévia lateral `proposta/Preview.tsx` — `PROP-CTL-086..137` e `PROP-H-004..022` (fac-símile). Abas Comercial/Técnica, contador de páginas, "Imprimir prévia". **Presente nas 7 etapas** e com **Arial/Helvetica preservada** — o documento não muda de fonte (desvio nº 5), então não tem desculpa para divergir.

  > **Painel e primeiras páginas portados (04/08).** O fac-símile usa as artes oficiais
  > (`proposta-capa-comercial.jpg`, `proposta-capa-tecnica.jpg`, `proposta-pagina.jpg`),
  > copiadas para `backend/assets/Comercial/`. Índices na contagem da referência: **13
  > itens no comercial, 10 no técnico**. Completada em 04/08 com a T065: folhas de
  > tabelas e fotos do escopo, matriz separada por dono, valores, folhas de texto
  > técnico por serviço e fechamento técnico.
- [X] T065 [US2] Preservar em `frontend/src/pages/comercial/proposta/Preview.tsx` o índice dos documentos: **13 itens no comercial, 10 no técnico**, na mesma ordem.  ↳ `FR-005`

  > **A paginação virou módulo puro** (`proposta/previaPaginacao.ts`), com 13 testes.
  > Não é apresentação: uma tabela de 40 linhas não cabe numa folha A4, e onde ela
  > parte tem de ser **o mesmo lugar na prévia e no PDF**. Divergindo, a prévia deixa
  > de servir para o que existe — conferir antes de emitir. Quando a T072 portar o
  > gerador, ele consome estas mesmas funções.
- [ ] T066 [US2] Conferir os **330 textos** `PROP-TXT-001..330` item a item contra o inventário.  ↳ `FR-004` `SC-011`
- [ ] T067 [US2] **(L1)** Aplicar a validação por campo às 7 etapas de `frontend/src/pages/comercial/proposta/steps/`, com "E-mail inválido"/"CNPJ inválido" distintos de "Campo obrigatório". **É o ponto de travamento mais provável do app**: o contador acusa pendência num campo visivelmente preenchido.

### L2 — reordenação

- [ ] T068 [US2] **(L2)** Aplicar `frontend/src/utils/reorderDrag.ts` (auditado em T001) às **três** listas reordenáveis — itens de serviço do escopo, serviços técnicos e **blocos de conteúdo do `ScopeContentEditor` (T058a)** —, com alça dedicada, reordenação ao vivo, espaço indicando o destino, fantasma, cancelar restaurando a ordem inicial e persistência só ao soltar.  ↳ `FR-015` `FR-052`
- [ ] T069 [US2] **(L2)** Garantir o funcionamento em toque de `frontend/src/utils/reorderDrag.ts` nas três listas, via Pointer Events com `touch-action: none`.  ↳ `FR-016`
- [ ] T070 [US2] **(L2)** **Manter os botões ↑/↓** ao lado da alça em `frontend/src/pages/comercial/proposta/steps/EscopoStep.tsx` e `TecnicaStep.tsx`, com `aria-label`, como caminho de teclado — `PROP-CTL-029`, `PROP-CTL-030` e equivalentes. O desvio nº 6 é **acréscimo puro**: nenhum controle da referência é removido.  ↳ `FR-017`
- [ ] T071 [US2] [P] Escrever `frontend/test/comercial-reorder.test.mjs` cobrindo o padrão compartilhado e o cancelamento.

**Checkpoint**: US2 entregável — monta proposta completa, sem finalizar.

---

## Phase 5: US3 — Finalizar e não perder trabalho (P1) `(E5 + E8)`

**Goal**: gerar os dois documentos, salvar no histórico e integrar.

**Independent Test**: finalizar uma proposta completa e conferir os 4 estágios, os dois
documentos e o registro no histórico.

- [X] T071a [US3] Extrair para `shared/comercial/src/modelo-documento.ts` o **texto fixo dos `.docx`** de `Modelos/definitivos/Comercial/` — pagamento, impostos, observações, propriedade intelectual, jornada, matriz padrão e matriz de hidrojateamento. Onde divergir da referência, **o `.docx` vence** (desvio 12). Análise campo a campo em [contracts/modelos-word.md](./contracts/modelos-word.md).
- [X] T071b [US3] Acrescentar `categoria` ao tipo `Row` da matriz de responsabilidade e desenhar os subtítulos que ocupam a largura da tabela, como no Word. Trocar o `initialRows` herdado (17 linhas de **caldeiraria e solda**, que não aparecem em documento nenhum) pelas linhas dos `.docx`.  ↳ desvio 12
- [X] T071c [US3] Acrescentar o campo **prazo de integração** (`dias_treinamento`) ao passo Prazos. Hoje a linha sai impressa no documento sem ter de onde vir.  ↳ desvio 12
- [X] T071d [US3] Implementar o bloco **"Stand-by e Mobilização Adicional"**: quatro valores monetários (`valor_he`, `valor_standby`, `diaria_equipamento`, `valor_desmob_extra`) no passo Comercial e a tabela de três linhas no documento.  ↳ desvio 12
- [X] T071e [US3] Implementar a escolha **padrão / hidrojateamento** na criação da proposta (desvio 13), trocando descrição dos serviços, matriz, EPI e jornada. **A jornada de hidrojateamento tem dois turnos** — ONSHORE (seg–qui 9h, sex 8h) e OFFSHORE (seg–dom e feriados, 11h).
- [X] T071f [US3] Suportar **duas tabelas de preço** (ONSHORE e OFFSHORE), cada uma com seu TOTAL GERAL, quando o modelo for hidrojateamento. É o ponto que torna impossível resolver por catálogo: `renderPriceTable` desenha uma só.  ↳ desvio 13
- [X] T072 [US3] Implementar `backend/src/lib/comercial/proposta-docx.js` — preenche o modelo `.docx` de `Modelos/definitivos/Comercial/modelos/` e converte com o `convertDocxToPdf` dos relatórios. **Substituiu o porte para `pdf-lib`**, que chegou a existir e foi removido: o documento passou a ser editável por quem o escreve, sem programador e sem deploy. Os modelos saem de `scripts/comercial-gerar-modelos.mjs`.
- [X] T072a [US3] Escrever `backend/scripts/comercial-gerar-modelos.mjs` — converte os `.docx` preenchidos que o comercial entrega em **modelos com `{{marcador}}`**, prepara as linhas-modelo de matriz e preço, marca o escopo e padroniza a tipografia em Arial. Idempotente: rode de novo a cada documento novo.
- [X] T072b [US3] Extrair `backend/src/lib/docx/template.js` — as primitivas de preenchimento que os relatórios já usavam. A parte difícil é o marcador partido entre vários `w:t`, que o Word produz por qualquer motivo.
- [X] T072c [US3] Implementar `backend/src/lib/comercial/proposta-docx.js` — preenche o modelo (cabeçalho, matriz agrupada por categoria, preços com total, escopo) e converte com o `convertDocxToPdf` dos relatórios.
- [X] T072d [US3] Extrair `backend/src/lib/docx/imagem.js` e inserir **tabelas e fotos do escopo** no documento. São três lugares — `word/media`, a `Relationship` e o `[Content_Types].xml` — e esquecer um produz pacote que o Word recusa a abrir.
- [X] T072e [US3] Expor `POST /api/comercial/propostas/previa.pdf` e o botão **Baixar PDF**. É conferência, **não** emissão: nada é gravado, a proposta não é numerada e nenhuma integração é acionada.
- [X] T073 [US3] ~~`pdf-images.js` com `sharp`~~ — **superada**. Quem desenha o documento passou a ser o LibreOffice a partir do `.docx`, então não há imagem para preparar em memória. O que sobrou — embutir foto do escopo no pacote — virou `backend/src/lib/docx/imagem.js` (T072d).
- [X] T074 [US3] [P] Implementar `backend/src/lib/comercial/storage.js` — gravação e leitura em disco sob `COMERCIAL_DIR`. A variável nasceu aqui (`env.js`, `.env.example`), com **padrão igual ao caminho que as fotos de escopo já usavam** (`<REPORTS_DIR>/Comercial`), para que nada gravado se perca. `scope-assets.js` passou a tirar a raiz daqui — duas definições da mesma pasta divergiriam no dia em que a variável fosse apontada para outro lugar.
- [X] T074a [US3] Implementar `POST /api/comercial/escopo/fotos` em `backend/src/routes/comercial/`, com a **cadeia de recusa completa** de [contracts/api-contracts.md](./contracts/api-contracts.md): 2 MB por requisição, arquivo ausente, tipo fora de JPEG/PNG/WebP, 1,5 MB por foto, e **assinatura de bytes** que não bate com o tipo declarado. Cada caso com a sua mensagem.  ↳ `FR-049` `FR-050`
- [X] T074b [US3] Implementar em `backend/lib/comercial/scope-assets.js` a gravação sob `COMERCIAL_DIR` no padrão `escopo/AAAA/MM/<uuid>.<ext>`, guardando o nome original saneado, e o `GET /api/comercial/escopo/fotos/:id` com verificação de autoria. **As fotos sobrevivem às revisões** (FR-051).  ↳ `FR-051` `FR-067`
- [X] T074c [US3] [P] Escrever `backend/test/comercial-escopo-fotos.test.js` cobrindo a cadeia de recusa — em especial **arquivo renomeado para `.jpg` que não é imagem**, recusado pela assinatura de bytes e não pelo nome.  ↳ `FR-049`
- [X] T075 [US3] Implementar `POST /api/comercial/propostas/documentos`, gerando os dois PDFs e **gravando antes de qualquer tentativa de integração**.  ↳ `FR-033`

  > A regra mora em `backend/src/lib/comercial/documentos.js`, e o **gerador entra
  > por parâmetro**: quem desenha o PDF é o LibreOffice, que só existe dentro da
  > imagem do backend. Recebê-lo de fora deixa autoria, ordem, gravação e registro
  > testáveis em qualquer máquina — 20 testes em `comercial-documentos.test.js`,
  > incluindo a prova de que **o arquivo chega ao disco antes de o registro
  > existir**. Ao contrário da prévia, o conteúdo vem do **registro**, não do corpo:
  > o que se emite é o que está salvo. Reemitir antes de finalizar grava numa pasta
  > nova em vez de sobrescrever — nada é apagado, nem em disco.
- [X] T076 [US3] Implementar `backend/src/lib/comercial/jobs.js` — **Nectar feito; SharePoint é a fatia seguinte** — e `POST /api/comercial/propostas/finalizar`, atualizando o estado por destino depois.

  > **O Nectar não tem sandbox** — a API publica só a URL de produção. Por isso o
  > adaptador tem três modos (`off`, `fake`, `real`) e o padrão é `off`: ambiente
  > mal configurado não pode criar card no CRM da empresa. `NECTAR_PIPELINE_IDS` é
  > lista branca e **vazia recusa tudo**. O modo `fake` é o que torna a suíte
  > possível — sem ele não haveria como testar a finalização sem poluir o CRM.
- [X] T076a [US3] Implementar `backend/src/lib/comercial/cost-csv.js` — a **planilha de custos** anexada à finalização (FR-054): `Levantamento de Custos - {código}.csv`, **UTF-8 com BOM**, separador **ponto e vírgula**, células entre aspas com aspas internas duplicadas.  ↳ `FR-054`
- [X] T076b [US3] Implementar em `backend/src/lib/comercial/cost-csv.js` os **dois formatos por versão de esquema** (FR-055), escolhidos pelo `schemaVersion` do levantamento: esquema 2 em diante e legado. **Proposta antiga não pode quebrar a finalização.**  ↳ `FR-055`
- [X] T076c [US3] Enviar a planilha junto com os dois PDFs em `backend/src/lib/comercial/jobs.js` — são **três** arquivos ao destino, não dois.
- [X] T076d [US3] Implementar `POST /api/comercial/propostas/:id/anexos` em `backend/src/routes/comercial/` e o model `ProposalAttachment` — os **arquivos adicionais do cliente** (`PROP-CTL-081`), que vão para a mesma pasta dos documentos. Um por requisição.  ↳ `FR-057`
- [X] T076e [US3] Validar em `backend/src/lib/comercial/jobs.js` o **limite agregado** do envio (FR-059): dois PDFs + planilha + todos os anexos, somados. Validar cada um isoladamente deixa passar o conjunto.  ↳ `FR-059`
- [X] T076f [US3] Aceitar a **pasta existente no OneDrive** (`PROP-CTL-080`, opcional) em `backend/lib/comercial/jobs.js`: havendo valor, grava dentro dela em vez de criar pasta nova.  ↳ `FR-058`
- [X] T077 [US3] **Contrato de falha (FR-034)** em `backend/lib/comercial/jobs.js`: se a integração falhar depois dos documentos gravados, a resposta é erro **mas informa que eles continuam disponíveis para download**, com os links. É comportamento da referência e precisa sobreviver ao porte — o trabalho não se perde.  ↳ `FR-034`
- [X] T078 [US3] Implementar em `backend/src/lib/comercial/access.js` a permissão de finalização: o **autor** finaliza a sua, o **gestor** finaliza qualquer uma; `comercial:viewer` nunca.  ↳ `FR-028`
- [X] T079 [US3] Implementar `GET /api/comercial/documentos/:id` com a regra de papel: `viewer` pedindo `COMERCIAL` recebe **403 na rota** — não é botão escondido. Liberar o PDF comercial contornaria a restrição de valores por outra porta.  ↳ `FR-030a`

  > **As regras dos três papéis divergem, e por isso não dá para reusar `canRead`
  > para todos.** Para o orçamentista vale a **autoria**: vendedor pedindo documento
  > de proposta alheia leva 403. Para a consulta vale o **tipo**: ela alcança a
  > proposta de qualquer autor — a listagem é a superfície inteira dela — mas só a
  > técnica. Esta é a única rota de proposta com `requireComercialAccess`, junto
  > com a listagem. O teste do caso crítico está em `comercial-documentos.test.js`;
  > a matriz completa continua sendo a T110.
- [X] T079a [US3] Implementar a **exclusividade da finalização** (FR-069) em `backend/lib/comercial/proposals.js`: verificar o estado **antes de gerar qualquer coisa** e devolver **409** informando **quando e por quem** foi finalizada. Sem isso, dois cliques com segundos de diferença geram dois pares de documentos, duas oportunidades no CRM e duas pastas — e as duas requisições respondem sucesso.  ↳ `FR-069`
- [X] T079b [US3] Implementar o **aviso de escrita concorrente** (FR-070) em `backend/lib/comercial/access.js`: comparar o `updatedAt` carregado pelo cliente com o atual e devolver **409** nomeando quem alterou e quando. **Aviso, não trava** — o cliente decide recarregar ou prosseguir.  ↳ `FR-070`

  > **Feita em 13/08.** Os dois `PUT` exigem a versão carregada, a repetem no
  > `WHERE` atômico e gravam id + nome congelado da última pessoa que editou. O
  > `409` é estruturado; a proposta oferece recarregar ou prosseguir com
  > sobrescrita explícita. A finalização passou a registrar/exibir também o nome
  > congelado durante e depois da operação.
- [X] T080 [US3] Registrar `ProposalAuditLog` em `backend/lib/comercial/proposals.js` nas duas ações irreversíveis — finalização e envio externo —, no padrão de `ReportAuditLog`.
- [X] T081 [US3] Implementar na tela os **4 estágios** anunciados ao usuário, na ordem da referência, a partir de `shared/comercial/finalization.ts`.  ↳ `FR-032`
- [X] T082 [US3] Implementar em `frontend/src/pages/comercial/proposta/steps/RevisaoStep.tsx` as validações pré-finalização com **mensagem específica por problema**: e-mail, CNPJ de 14 dígitos, departamento, consultor + orçamentista, funil, empresa e contato do Nectar, escolha de card.  ↳ `FR-031`
- [X] T083 [US3] Implementar `frontend/src/pages/comercial/proposta/FinalizacaoPanel.tsx` com o download final: técnica + comercial juntas ou separadas.  ↳ `FR-033`

  > **Feitas em 13/08.** A tela chama a finalização real, carrega somente os funis
  > autorizados, persiste/remove anexos e mostra a sequência congelada. O `502` de
  > integração não é achatado pelo interceptor global: os dois documentos chegam
  > ao painel e continuam baixáveis, juntos ou separados. A validação cobre os oito
  > grupos da referência antes de gerar. Em proposta nova, empresa e contato ainda
  > dependem da busca da etapa Cliente (T121a); a pendência fica explícita em vez de
  > criar vínculo a partir de texto livre.
- [X] T083a [US3] Implementar `arquivar`/`desarquivar` para levantamento e proposta em `backend/lib/comercial/access.js` e nas rotas, com autoria (FR-061). **Nenhuma rota do módulo apaga levantamento nem proposta.** A exceção do anexo veio depois, na T128.  ↳ `FR-060` `FR-061` `FR-063`
- [X] T083b [US3] Adicionar `archivedAt`/`archivedByUserId` a `CostEstimate` e `Proposal` em `backend/prisma/schema.prisma`, e incluir o estado nos índices de listagem.  ↳ `FR-062`
- [X] T084 [US3] Implementar a tela de histórico `frontend/src/pages/comercial/historico/` — `HIST-CTL-001..007`, `HIST-H-001` e `HIST-TXT-001..033` —, com status de integração, valor, revisão e arquivos, **variando por papel** (viewer sem valor e sem link comercial).  ↳ `FR-068`

  > **Feita em 13/08.** A listagem projeta título, custos, integrações e somente o
  > documento mais recente de cada tipo, sem expor `payload` nem caminho de
  > armazenamento. O papel de consulta recebe o PDF técnico, mas valores e até o
  > identificador do PDF comercial são removidos no backend. A rota e o menu
  > também separam histórico (três papéis) de custos/gerador (só orçamentistas).
- [X] T085 [US3] [P] Escrever `backend/test/comercial-finalizacao.test.js`, incluindo o caso **integração falha depois dos PDFs prontos → documentos continuam baixáveis**.  ↳ `SC-009`

**Checkpoint**: MVP completo. US1 + US2 + US3 entregam o produto.

---

## Phase 6: US4 — Não perder o trabalho por um F5 (P2) `(L3, dentro de E7/E8)`

**Goal**: recarregar ou fechar a aba não apaga o trabalho.

**Independent Test**: preencher parcialmente, recarregar, e conferir que o estado volta
pela URL e que o não salvo é oferecido de volta.

- [X] T086 [US4] **(L3)** Levar modo, base da proposta e seção ativa para o endereço em `/comercial/custos`, limpando parâmetros incompatíveis na troca. Hoje o F5 **volta ao diálogo de modo e apaga o levantamento inteiro** — captura em `contracts/baseline/L3-f5-perde-levantamento.png`.  ↳ `FR-018`
- [X] T087 [US4] **(L3)** Levar a etapa ativa para o endereço em `/comercial/propostas`.  ↳ `FR-018`
- [X] T088 [US4] **(L3)** Fazer o diálogo "Como deseja começar?" de `frontend/src/pages/comercial/custos/CustosPage.tsx` **não reaparecer** quando o modo já vem no endereço (FR-044) — ele serve para escolher o modo, não para confirmá-lo. Os dois passos (menu → diálogo) coexistem, sem atalho.  ↳ `FR-043` `FR-044`
- [X] T089 [US4] **(L3)** Implementar o rascunho local em `frontend/src/pages/comercial/useLocalDraft.ts`: autossalvamento com *debounce*, chave por modo + código de proposta, **nas duas telas** — levantamento e proposta.  ↳ `FR-019`
- [X] T090 [US4] **(L3)** Oferecer em `frontend/src/pages/comercial/useLocalDraft.ts` a recuperação **explicitamente** ("recuperar rascunho não salvo?") em vez de restaurar em silêncio. Restaurar sem avisar é pior que perder, porque o usuário não sabe o que está vendo.  ↳ `FR-020`
- [X] T091 [US4] **(L3)** Descartar o rascunho de `frontend/src/pages/comercial/useLocalDraft.ts` ao salvar no servidor — não pode sobrar para reaparecer depois.  ↳ `FR-021`
- [X] T092 [US4] **(L3)** Implementar `beforeunload` em `frontend/src/pages/comercial/useLocalDraft.ts`, nas duas telas, quando houver alteração pendente. *"Fechar a página sem querer"* é explícito no requisito, não só recarregar.  ↳ `FR-022`
- [X] T093 [US4] [P] Escrever `frontend/test/comercial-rascunho.test.mjs`: estado volta pela URL, rascunho é oferecido e não aplicado sozinho, e é descartado ao salvar.  ↳ `SC-006`

---

## Phase 7: US5 — Encontrar o caminho no primeiro acesso (P2) `(E6 + E8)`

**Goal**: menu de entrada e tutorial permanente.

**Independent Test**: entrar com usuário que nunca abriu o módulo — tutorial aparece uma
vez, é dispensável e não volta sozinho.

- [X] T094 [US5] Implementar o menu de entrada `frontend/src/pages/comercial/ComercialPage.tsx` (**desvio nº 9**) com dois cartões — levantar custos e ver/criar propostas —, reusando a linguagem de cartões de `frontend/src/pages/HubPage.tsx`. **Sem baseline visual**: não existe na referência para ser fotografado.  ↳ `FR-023` `FR-043`
- [X] T095 [US5] Ocultar em `frontend/src/pages/hubModules.ts` o card do módulo no hub do filtroAPP para quem não tem nenhum dos três papéis.  ↳ `FR-024`

  > **Já estava feita, e sem teste — a combinação que mais engana.** A regra é
  > declarativa: `hub.roles` no registro do módulo lista os três papéis, e
  > `hubModulesForUser` filtra por eles. Por ser declarativa, ela **some sem quebrar
  > nada**: apagar a lista não dá erro de tipo nem de teste, só passa a mostrar o
  > Comercial para a empresa inteira. `frontend/test/comercial-hub.test.mjs` trava isso
  > em 14/08.
- [ ] T096 [US5] **(L4)** Implementar o **tutorial permanente de primeiro acesso** com `driver.js`, dispensável e rechamável, sem reaparecer sozinho. O marcador de "já viu" é **por usuário, persistido no servidor** (FR-025a) — não em `localStorage`, senão dois usuários da mesma máquina compartilham o marcador e o mesmo usuário vê o tutorial de novo em outro computador. **`localStorage` fica só para a campanha de novidade** (FR-025b): o tutorial acompanha a pessoa, a campanha acompanha o dispositivo. Módulo novo mantém onboarding permanente — a campanha de novidade de 10 dias é para função nova dentro de módulo existente, não se aplica.  ↳ `FR-025` `FR-025a` `FR-025b`
- [ ] T097 [US5] **(L4)** Escrever o roteiro do tutorial a partir de `contracts/baseline/roteiro.md`, cobrindo no mínimo: (a) a **cadeia de prioridade do rodapé** de `/comercial/custos`, que é o caminho que o mantenedor confirmou usar; (b) a **armadilha de e-mail/CNPJ inválido** da etapa 1.  ↳ `FR-026`
- [ ] T098 [US5] **(L5)** Corrigir `frontend/src/pages/LoginPage.tsx` do filtroAPP para usar `.field-group.field-invalid` + `.field-error` + `aria-invalid` em campo obrigatório vazio. **Hoje tem zero `aria-invalid`.** O módulo reusa este login, e o template exige que dívida na fonte seja corrigida **na fonte** — não contornada no módulo. Beneficia o app inteiro.  ↳ `FR-013`
- [ ] T098a [US5] Registrar em `specs/009-modulo-comercial/contracts/ui-inventory.md` que `LOGIN-CTL-001..007`, `LOGIN-H-001` e `LOGIN-TXT-001..012` **não são portados**, com o motivo: o módulo reusa o login do filtroAPP, premissa desde o início do projeto. Sem esse registro o `/speckit-analyze` os acusa como itens órfãos — e o silêncio deles não pode ser confundido com esquecimento.

---

## Phase 8: US6 — A lista de vendedores se mantém sozinha (P3) `(E4 + E8)`

**Goal**: a lista de consultores é derivada dos usuários, sem cadastro paralelo.

**Independent Test**: conceder `comercial:seller` a um usuário e conferir que ele passa
a aparecer na seleção da etapa Cliente para um gestor — sem passo de cadastro.

> **Decisão de 31/07 que revoga a decisão 4 da §12.5.** Não há model `Seller`, nem CRUD,
> nem tela de cadastro: todo consultor de vendas é um usuário com o papel
> `comercial:seller`. Um cadastro paralelo seria uma segunda verdade para alguém
> esquecer de atualizar.

- [X] T099 [US6] Implementar `GET /api/comercial/consultores` em `backend/lib/comercial/consultores.js`, derivando a lista dos **usuários ativos com o papel `comercial:seller`**. Sem `POST`, `PUT` nem `DELETE`.  ↳ `FR-041`
- [X] T100 [US6] Fazer a resposta de `backend/lib/comercial/consultores.js` **variar por papel** (FR-041b): `comercial:manager` recebe a lista completa; `comercial:seller` recebe **apenas ele mesmo**. Filtrar no cliente não serve — um vendedor não deve nem receber os nomes dos outros.  ↳ `FR-041b`
- [X] T101 [US6] Gravar `sellerUserId` **e** `sellerName` em `Proposal` (`backend/lib/comercial/proposals.js`): o nome é o do **momento da emissão**. Desativar ou renomear um usuário **não altera proposta já emitida** — o PDF já foi ao cliente com aquele nome.  ↳ `FR-041a`
- [X] T102 [US6] [P] Ligar o campo `PROP-CTL-016` em `frontend/src/pages/comercial/proposta/steps/ClienteStep.tsx` à rota derivada, **pré-selecionando** a única opção quando o usuário é `comercial:seller`. O controle continua o mesmo `SelectField` do inventário — muda o conjunto de opções, não o elemento. Espelha o que a referência já faz com o orçamentista (`PROP-CTL-018`, preenchido pelo login).  ↳ `FR-041b`

---

## Phase 9: Polish — mobile, testes e produção `(E8.5 + E9 + E10)`

### L7 — layout mobile `(E8.5)`

- [ ] T103 **(L7)** Escrever o layout mobile das 4 telas. A referência **não tem layout mobile** para portar — 39 regras de `min-width` em pixel, a pior `.preview{min-width:390px}`. **Em largura de celular não há paridade pixel-a-pixel a perseguir**; o desktop continua pixel-a-pixel.  ↳ `FR-036`
- [X] T104 **(L7)** Resolver em `frontend/src/styles/comercial.css` os dois estouros conhecidos: a **faixa de 7 indicadores de custo** e a **tira de 5 seções** — quebrar, rolar internamente por design, ou virar `select`/menu mobile, sem alargar a página.

  > **Feito, e antes da fase de mobile — mas não por rolagem: por refluxo de grade.**
  > Os 7 indicadores são `.com-kpis` (`FaixaIndicadores.tsx:43`), que sai de 7 colunas
  > para 3 em 1100 px, 2 em 760 px e 1 em 480 px. A tira de 5 seções é
  > `.com-workflow-nav` (`CustosPage.tsx:398`), que sai de 5 para 2 em 900 px e 1 em
  > 600 px. Nenhum dos dois rola: eles cabem.
  >
  > **A primeira redação desta nota citava `.com-tabs` e `.com-secoes`, e estava errada
  > duas vezes** — não são as classes desses dois blocos, e não são classe de coisa
  > nenhuma: nenhum `.tsx` do repositório as aplica. Eram CSS morto com um comentário
  > afirmando resolver justamente os dois estouros conhecidos, o que é a pior forma de
  > CSS morto: ele responde por escrito uma pergunta que ninguém mais vai refazer.
  > Removidas em 13/08.
- [ ] T105 **(L7)** Converter em `frontend/src/styles/comercial.css` as tabelas largas em cards empilhados em tela estreita, com valores monetários, status e ações quebrando ou truncando **sem alargar o card**.  ↳ `FR-037` `FR-038`
- [X] T106 **(L7)** Remover de `frontend/src/styles/comercial.css` a `min-width` em pixel da prévia lateral — é a regra que sozinha estoura qualquer viewport de 390 px.

  > **Feito.** A `.preview{min-width:390px}` da referência não existe mais. Restam 4 `min-width` em pixel no arquivo, todas em célula de tabela ou coluna dentro de contêiner com `overflow-x: auto` — nenhuma alarga a página. Marcada em 13/08.
- [ ] T107 [P] Escrever `frontend/test/comercial-mobile.test.mjs` verificando **zero rolagem horizontal de página** nas 4 telas em 390 px.  ↳ `SC-004`

### Testes e CI `(E9)`

- [ ] T108 Escrever `backend/test/comercial-permissoes.test.js` com a **matriz completa** de [contracts/api-contracts.md](./contracts/api-contracts.md): 3 papéis × 2 entidades × (criar, ler, editar, finalizar), mais documentos.  ↳ `FR-027b` `SC-008`
- [X] T109 Escrever em `backend/test/comercial-permissoes.test.js` o caso crítico da matriz: **`seller` A lendo a listagem enquanto existe registro de `seller` B**. Se a filtragem estiver só na rota de item e não no índice, este é o único teste que pega — e é o vazamento mais provável.  ↳ `SC-008a`

  > **Feito, em arquivo diferente do previsto**: `backend/test/comercial-access.test.js` — *"vendedor A não recebe registro do vendedor B pela listagem"*. O arquivo `comercial-permissoes.test.js` nunca foi criado; a matriz mora no `comercial-access.test.js` junto do próprio módulo de acesso. A T108 é que precisa fechar a matriz **completa**, e é lá que essa consolidação cabe.
- [X] T110 Escrever em `backend/test/comercial-permissoes.test.js` o caso `viewer` pedindo documento `COMERCIAL` → **403 na rota**, e `TECNICA` → 200.

  > **Feito** em `comercial-access.test.js` — *"consulta baixa a técnica e NÃO baixa a comercial"*.
- [X] T110a Escrever em `backend/test/comercial-concorrencia.test.js` os dois casos de concorrência: **finalizar proposta já finalizada → 409** com autor e data, e **salvar registro alterado por outro → 409** com aviso.

  > **Feita em 13/08.** O teste cobre ainda a corrida entre `SELECT` e `UPDATE` e
  > a segunda tentativa confirmada, para provar que o aviso não virou trava.
- [ ] T110b [P] Escrever em `backend/test/comercial-permissoes.test.js` a prova de que o **único `DELETE` do módulo é o de anexo** (`DELETE /propostas/:id/anexos/:anexoId`), e que ele **recusa depois de finalizada**. Reformulada em 13/08: a redação original — "não existe rota de exclusão" — nasceu antes da T128 e hoje falharia contra a exceção aprovada. Enumerar as rotas e afirmar a única permitida é mais forte do que afirmar nenhuma: pega tanto um `DELETE` novo de proposta quanto a perda do portão de "só antes de finalizar".
- [X] T111 [P] Escrever em `backend/test/comercial-permissoes.test.js` o teste de que a resposta para `viewer` **não contém** `totalValue`, custo nem margem — omissão na serialização, não ocultação na tela.

  > **Feito** em `comercial-access.test.js` — *"os campos de valor são removidos do objeto, não escondidos"* e *"serializeListForUser limpa a lista inteira"*. A distinção importa: o teste falha se alguém trocar remoção por ocultação na tela.
- [ ] T112 Rodar `npm run architecture:check`, `npm --prefix frontend run lint` e as duas suítes (`backend/test/*.test.js` e `frontend/test/*.test.mjs`).

### Aceite de paridade

- [ ] T113 Percorrer `contracts/baseline/roteiro.md` **lado a lado** — referência de um lado, módulo do outro —, classificando cada divergência como **defeito** ou como um dos **16 desvios aprovados**. Divergência não listada é defeito, não escolha.  ↳ `FR-006` `SC-003`
- [ ] T114 Comparar as capturas de `contracts/baseline/*-1440.png` com as mesmas telas no módulo. **Diferença esperada e aceita**: a fonte do chrome (desvio nº 5) e o reflow que ela causa.
- [ ] T115 Conferir os **616 controles e 916 textos** item a item contra `contracts/ui-inventory.md`, marcando o checklist de paridade. É item da Definição de Pronto, não conferência informal.  ↳ `SC-001`
- [ ] T116 Rodar `/speckit-analyze` e resolver **todo** item de inventário órfão.

### Produção `(E10)`

- [X] T117 Escrever `deploy/COMERCIAL.md` com o **roteiro para o operador**: migration, `GRANT USAGE ON SCHEMA comercial`, envs novas em `backend/.env.production` (`chmod 600`), `client_max_body_size` e o vhost `comercial.filtrovali.com.br` → `app.filtrovali.com.br/comercial`. **Princípio I: nenhum comando de servidor é executado por agente — o roteiro é escrito, não rodado.**
- [X] T117a Registrar o tratamento de dados do módulo no **ROPA** (FR-056), com a retenção indefinida do FR-042 e a base legal. **Antes do go-live** — é obrigação de LGPD, não documentação opcional.  ↳ `FR-042` `FR-056`
- [X] T118 [P] Incluir a pasta de `COMERCIAL_DIR` em `deploy/backup-prod.sh`, **incluindo as fotos de escopo**.
- [X] T119 Documentar em `deploy/COMERCIAL.md` a concessão de papéis: `comercial:manager` a Aliander e Erike, `comercial:seller` aos vendedores, `comercial:viewer` a quem só consulta.

---

## Depois do go-live `(E11)`

- [ ] T120 Substituir o import do Access em `backend/lib/comercial/proposals.js`: gravar `CommercialProposal` na mesma transação da proposta. É o que a decisão de manter os dois schemas no mesmo processo torna trivial.

---

## Dependências

```
Fase 1 (Setup) ──▶ Fase 2 (Foundational) ──┬──▶ Fase 3 (US1) ──▶ Fase 4 (US2) ──▶ Fase 5 (US3)
                                            │                                          │
                                            └──────────────────────────────────────────┴──▶ Fase 6 (US4)
                                                                                            Fase 7 (US5)
                                                                                            Fase 8 (US6)
                                                                                                 │
                                                                                                 ▼
                                                                                         Fase 9 (Polish)
```

- **T001 bloqueia T068** — a auditoria do `reorderDrag.ts` precede o uso.
- **T003 bloqueia T046 e T067** — sem `@hookform/resolvers` não há resolver Zod.
- **T024/T025 bloqueiam T032, T033, T052, T079** — acesso antes das rotas.
- **T029 bloqueia a Fase 9** — sem as primitivas responsivas certas, a E8.5 vira reescrita.
- **T030 bloqueia T048 e T067** — o `Field` generalizado é a base da L1.
- **Fase 3 → Fase 4 → Fase 5** é o caminho crítico. As fases 6, 7 e 8 podem correr em paralelo depois da 5.

## Paralelização

- **Fase 1**: T001, T003 e T009–T012 em paralelo.
- **Fase 2**: T022, T028, T029 e T030 em paralelo depois de T020.
- **Fase 3**: T038–T042 (as 5 seções) em paralelo — arquivos diferentes.
- **Fase 4**: T057–T063 (as 7 etapas) em paralelo — arquivos diferentes.
- **Fase 9**: T107, T111 e T118 em paralelo.

## Estratégia de entrega

**MVP = Fases 1 + 2 + 3.** A US1 entrega valor sozinha: um orçamentista precifica de
ponta a ponta, com os 16 goldens provando os números. Sem proposta, sem finalização.

**Incremento 2**: + Fase 4 (monta proposta) e Fase 5 (emite documentos). Aqui o módulo
substitui a ferramenta de origem.

**Incremento 3**: + Fases 6, 7 e 8 — continuidade, onboarding e cadastro.

**Fase 9 não é opcional.** Mobile e a matriz de permissão são condição de aceite; o
aceite de paridade é o que prova que o porte é fiel.

---

## Sugestões do comercial — 11/08/2026

Levantadas por um colaborador do comercial **testando o app de referência**, não
o módulo. Isso muda a natureza delas: são **requisitos**, não defeitos daqui — e
parte já está resolvida de outro jeito. Registradas para não se perderem.

- [X] T121 **Contato "outro"** — o caminho de digitar à mão **continua**, e agora
  é regra escrita, não acaso: a busca do CRM entrou como **auxílio**, e a empresa
  sem CNPJ **não é escondida** (a referência exigia 14 dígitos e a esconderia). Ver
  T121a para a tela.
- [ ] T121a **Ligar a busca na etapa Cliente.**  ↳ `FR-075`
  O backend está pronto —
  `GET /comercial/crm/empresas?busca=` e `/crm/empresas/:id`. A tela ainda tem o
  campo desabilitado com o aviso de "integração não ligada". Precisa também
  **mostrar o aviso** quando `porTrechoDisponivel` vier `false`.
- [X] T122 **Salvamento prévio** — **já feito nas duas camadas**: rascunho local
  com autossalvamento (T089) e gravação no servidor a cada "Salvar e continuar"
  (T054a). Falta autossalvar no servidor; hoje o automático é só local.
- [ ] T123 **Busca do CRM por trecho, não por início.**  ↳ `FR-075`

  > **Medido em 11/08, com o token real (só leitura).** O filtro `nome` do Nectar
  > casa **só por prefixo**: `nome=petro` devolve 9 contatos, entre eles
  > "PETROLEO BRASILEIRO S A PETROBRAS"; `nome=petrobras` e `nome=BRASILEIRO`
  > devolvem **zero**. A queixa do colaborador está certa, **não é defeito nosso,
  > e não tem conserto por parâmetro** — o conserto é do nosso lado.
  >
  > Duas descobertas que mudam o desenho: no Nectar **empresa é um `contato` com
  > CNPJ de 14 dígitos** (é assim que a referência distingue, e o endpoint
  > `/empresas` **não existe** — devolve 404 em HTML); e `/contatos` **pagina de
  > 100 em 100**, ignorando `displayLength` maior.
  >
  > **Tentei o índice em memória em 12/08 e NÃO FUNCIONA — está desligado no
  > código, e a resposta admite isso.** Medido: 1.500 contatos lidos em 15
  > páginas dão **53 empresas**, e a Petrobras **não está entre elas**. A base é
  > maior, as empresas são ~3,5% do cadastro e estão espalhadas (uma página
  > trouxe 42, sete trouxeram zero). E **não há como pedir só as empresas**:
  > `isEmpresa=true`, `tipo=empresa` e variantes são **ignorados** pela API.
  > Somando o limite de taxa — nove páginas rápidas levam a 429 —, varrer sob
  > demanda está fora.
  >
  > **Índice parcial é pior que índice nenhum**: responde "não achei" com a mesma
  > cara de "não existe". Por isso `INDICE_LIGADO = false` e
  > `porTrechoDisponivel` responde a verdade — a máquina do filtro está pronta e
  > testada, falta o que a alimente.
  >
  > O caminho é **espelho persistido**: tabela no nosso banco, sincronizada por
  > job (noturno, paginando devagar), e busca por trecho lá. Mesmo padrão do
  > import do Access. É migration + job — fatia própria.
- [X] T124 **Máscara de R$ nos campos de valor** da tela de custos. Decisão do
  mantenedor em 11/08: **centavos ao digitar**, igual à etapa Comercial da
  proposta (`formatarDinheiro`), para as duas telas não divergirem. **Desvio nº 14**,
  aprovado em 11/08 e registrado em `contracts/e0-8-desvios-e-estimativa.md`. O
  ponto a vigiar no aceite: a tela recalcula a cada tecla, e a máscara não pode
  atrapalhar o recálculo nem mover o cursor.
- [ ] T125 **Zero à esquerda em campo numérico** (o "070"). **Provavelmente não
  reproduz aqui**: nossos campos guardam número, não texto. Conferir no navegador
  antes de mexer — o defeito é da referência, que usa estado em texto.
- [X] T126 **Levantamento** das opções de cálculo automático de distâncias.  ↳ `FR-072` `FR-077`
  Ver [`contracts/distancias-automaticas.md`](./contracts/distancias-automaticas.md).
  **Decidido em 11/08: Google Routes API.** O tier gratuito de **10.000
  chamadas/mês por SKU** (Essentials) foi confirmado na fonte oficial e cobre o
  volume previsto com folga de uma ordem de grandeza — custo zero.
- [X] T126a **Implementar o cálculo de distância (backend)** com a **Routes API**, SKU
  `Compute Route Matrix Essentials` — **não** a Distance Matrix, que é legada.
  Quatro condições: adaptador de três modos com `off` por padrão; cache por
  endereço; o campo continua editável, com a origem do valor visível; e falha não
  trava o levantamento — cai no caminho de digitar. Mais duas que a franquia
  gratuita torna necessárias: **cota de segurança** por dia no adaptador, e
  **chave restrita** por API e por IP no console — defeito em laço passa dos
  10.000 sem ninguém notar, e chave sem restrição que vaze gasta a franquia da
  empresa.
- [ ] T127 **Reduzir a altura do cabeçalho** para sobrar área de trabalho.
  **Por último, e com prévia para aprovação** — condição do mantenedor. **Desvio
  nº 15**, aprovado em 11/08. Mexe no que a T114 compara pixel a pixel, então o
  registro é o que impede a validação final de acusá-lo como defeito de porte.

- [X] T128 **Remover anexo enviado por engano.**  ↳ `FR-078`
  Decidido pelo mantenedor em
  12/08: **exceção explícita ao FR-060**. `DELETE /propostas/:id/anexos/:anexoId`
  é o **único `DELETE` do módulo** — a regra de não apagar foi feita para
  levantamento e proposta, que são registro de negócio com história; anexo é
  arquivo que o vendedor acabou de juntar e pode ser o errado.

  > Só antes de finalizar: depois, o arquivo já foi ao CRM e ao SharePoint, e
  > apagar aqui deixaria o nosso registro dizendo uma coisa e o destino, outra.
  > A ordem é registro primeiro, arquivo depois — o inverso da gravação, e pelo
  > mesmo motivo: o que não pode sobrar é registro apontando para arquivo que não
  > existe.
- [X] T126b **Ligar o cálculo de distância na tela** de destinos da logística.  ↳ `FR-072`
  Tem botão de calcular ao lado do campo, o endereço encontrado exibido para
  conferência, e o aviso quando a confiança for `parcial` ou `regiao`. O campo
  continua editável, e a origem do valor — calculado ou informado — fica visível.
  ↳ `DistanciaDoDestino.tsx` na célula, e a decisão de aceitar ou pedir
  conferência isolada em `custos/distancia.ts` — é ela que erra em silêncio, e é
  ela que o teste cobre. Um caso que só apareceu ao escrever o teste: **`km: 0` é
  falsy**, e tratá-lo como "não achou" faria a tela recusar o resultado correto
  de uma obra na própria sede.

- [X] T129 **Produto obrigatório na oportunidade.**  ↳ `FR-075`
  Resolvido pela **opção (b)**,
  escolhida pelo mantenedor: *respeitar a lógica que o comercial já adotou* e
  mandar o produto. A regra do CRM **não foi alterada** — o desligamento que eu
  tinha feito no funil de testes foi **revertido**, e as 12 etapas voltaram ao
  estado original.

  > **A convenção é do comercial, lida dos cards reais**: um produto por card, que
  > é o serviço vendido, `quantidade: 1`, e o valor da proposta em
  > `valorUnitario` e `valorTotal`. A forma importa: mandar `produto: { id }` com
  > `valor` também é aceito, mas o Nectar **zera o `valorAvulso`** e a proposta
  > aparece como R$ 0 no funil. Com `refId`, o valor sobrevive — conferido nos
  > dois sentidos.
  >
  > **Oito dos onze serviços estão mapeados. Três recusam de propósito**, porque
  > o catálogo tem mais de um candidato e a escolha é do comercial: ↓ T129a

- [X] T129a **Três produtos confirmados pelo comercial em 12/08.** Todo serviço
  do módulo tem produto; nenhuma pendência sobrou.

  | Serviço | Produto | Como se decidiu |
  |---|---|---|
  | `filtragem_hidraulico_lubrificante` | **FV-01** filtragem absoluta | escolha do comercial |
  | `passagem_pig` | **FV-27** | o homônimo FV-08 está **`ativo: false`** no catálogo |
  | `desidratacao_oleo` / `desidratacao_oleo_diesel` | **FV-02** / **FV-14** | viraram **dois serviços** — desvio nº 16 |

- [X] T129b **A filtragem tinha o mesmo problema, e foi separada igual.**
  Confirmado pelo comercial em 12/08: também são serviços diferentes, porque o
  preço varia com o fluido. Entraram `filtragem_oleo_diesel` e
  `filtragem_oleo_tempera`, com os produtos que já existiam no Nectar.
- [X] T129c **Script de conferência do mapa de produtos** —
  `backend/scripts/comercial-conferir-produtos.mjs`. Existe porque o `codigo`
  FV-nn **se desloca** quando o catálogo é editado, e porque produto desativado
  ou renomeado passaria despercebido: a finalização mandaria a proposta para a
  categoria errada **sem erro nenhum**. Na primeira execução já achou duas
  legendas envelhecidas.

  > O funil **"Gestão Comercial" (47518) exige produto nas 10 etapas**, e o
  > "Funil de testes" (57063) exige na etapa 1. O módulo **nunca envia produto**,
  > e a referência também não — então a criação do card responde **409: "É
  > obrigatório adicionar produto na oportunidade nesta etapa"**.
  >
  > O funil "Licitações / Estudo de Viabilidade / Stand By" (55031) **não** exige,
  > e é provavelmente por isso que a referência funcionava.
  >
  > **Precisa de decisão do mantenedor, com o administrador do CRM.** Três
  > caminhos: (a) desligar `produtoObrigatorio` nas etapas onde a API cria;
  > (b) enviar um produto do catálogo (são 15; "Entrega técnica" e "Evento de
  > mobilização…" parecem candidatos), o que exige decidir **qual** e como o valor
  > se relaciona com o `valorAvulso`; (c) criar sempre no funil 55031.

- [X] T130 **`totalValue` do hidrojateamento passa a ser escolhido pelo vendedor.**  ↳ `FR-074`
  Decidido em 12/08. Hoje o servidor manda ao CRM **a maior** das duas tabelas
  (ONSHORE/OFFSHORE); o mantenedor apurou que **o mais comum é ONSHORE**, e que o
  certo é perguntar. Precisa de um campo na finalização — qual cenário vale — e de
  `calcularTotal` passar a respeitá-lo em vez de decidir sozinho.
  ↳ **Desvio do texto acima**: a escolha ficou na etapa **Comercial**, gravada em
  `payload.priceScenario`, e não num campo só da finalização. Motivo: `calcularTotal`
  roda em **todo salvamento** (`proposals.js:229` e `:303`), não só ao finalizar — um
  campo que só existisse na última etapa deixaria todo rascunho gravado com o total
  do critério antigo. A etapa Comercial é também onde as duas tabelas estão à vista.
  ONSHORE nasce pré-selecionado (`PADRAO_DE_CENARIO`), com as duas somas lado a lado.
  Sem `priceScenario` o servidor mantém a maior — é o caso das propostas **já
  gravadas**, que não têm o campo. O leitor de moeda foi para
  `shared/comercial/src/dinheiro.ts` porque a tela precisa somar **igual** ao servidor
  (o `dinheiroDigitado` do front diverge 100× em valor sem máscara).
- [X] T131 **Endereço da sede vira configuração do módulo**, editável por gestor.  ↳ `FR-071`
  Tem busca no Google Maps para localizá-lo. Hoje é `COMERCIAL_SEDE_ENDERECO` no
  `.env`, e **a variável deve sumir** — decisão do mantenedor em 12/08: dado de
  negócio não mora em arquivo de ambiente. É migration + rota + aba de configuração.
  ↳ `comercial.ComercialSettings` (linha única), `lib/comercial/configuracao.js`,
  `GET /comercial/configuracao` + `PUT /configuracao/sede` + `POST
  /configuracao/sede/localizar`, e a tela `/comercial/configuracoes` no grupo de
  acesso `manager`. A variável saiu do `env.js` e do `.env.example` **sem
  fallback** — duas fontes para o mesmo dado fariam o servidor calcular a partir
  de um endereço que a tela nega estar usando. Detalhes e as três armadilhas
  (geocodificar a origem, salvar com o Maps `off`, cache por sede) em
  [`contracts/distancias-automaticas.md`](./contracts/distancias-automaticas.md).
  ⚠ Precisa de `prisma migrate deploy` no servidor.
- [X] T132 **Corrigir os erros de digitação dos `.docx`** listados em
  [`contracts/modelos-word.md`](./contracts/modelos-word.md) — resina,
  Descarregamento, Instalações, hidrojateamento, RFA duplicado, e as linhas de
  mobilização/desmobilização da tabela ONSHORE. **E unificar PPRA → PGR**: o PPRA
  foi substituído pelo PGR na revisão da NR-1, então os modelos de hidrojateamento
  citam hoje um programa que não existe mais. Autorizado em 12/08.
  ↳ Feito por `scripts/comercial-corrigir-modelos.mjs` (palavras, 26 ocorrências) e
  `scripts/comercial-corrigir-estrutura.mjs` (RFA e tabela, 6 correções), nos
  modelos **e** nos originais. A nota da tabela estava errada na contagem: são
  duas tabelas e 4 linhas ao todo, não três — leitura confirmada pelo mantenedor e
  registrada no contrato.
- [X] T134 **Sugestões de endereço enquanto se digita**.  ↳ `FR-073` `FR-077`
  Pedidas pelo mantenedor
  em 12/08 depois de configurar a sede à mão: sem a lista, quem digita não sabe
  se escreveu de um jeito que o Google reconhece.
  ↳ `Places Autocomplete (New)` via `sugerirEnderecos` em `distancias.js`, rota
  `GET /comercial/enderecos/sugestoes` e o campo `EnderecoField` no front. **Sem
  token de sessão** — a escolha não termina em Place Details, então a sessão
  nunca fecharia e a cobrança reverteria para por-requisição de qualquer jeito.
  O consumo é segurado por piso de 4 caracteres, espera de 350 ms e **cota
  diária própria** (`GOOGLE_MAPS_MAX_DIA_SUGESTOES`, 300): uma sugestão é uma
  tecla digitada, não um clique. ⚠ Exige **Places API (New)** habilitada no
  console — não é a mesma da Geocoding nem a da Routes.
  ↳ Aplicado também aos **destinos do levantamento de custos**, a pedido do
  mantenedor: é lá que se digita endereço toda semana, a sede é digitada uma vez.
  O componente ganhou duas formas — `EnderecoInput` (combobox cru, para a célula
  da tabela) e `EnderecoField` (com rótulo, para o formulário). A lista é
  `position: fixed` **por causa disso**: dentro de `.com-table-wrap`, que tem
  `overflow-x: auto`, uma lista `absolute` sairia recortada. O `placeId` não é
  guardado no destino — o payload é normalizado campo a campo pelo motor
  compartilhado, e acrescentar campo lá mexe no que os goldens protegem; o texto
  escolhido já é o do Google, que é o que faz a distância resolver certo depois.
- [X] T135 **SharePoint com menor privilégio**.  ↳ `FR-076`
  Decisão do mantenedor em 12/08:
  `Sites.Selected` em vez de `Sites.ReadWrite.All`, que alcança todo site e todo
  OneDrive da empresa. `Sites.Selected` libera site a site e **restringe
  descoberta**, então o adaptador ganhou `SHAREPOINT_DRIVE_ID`: com ele, grava
  sem tocar em nenhuma URL de `/sites/`. As outras duas formas (`SITE_ID`,
  hostname + caminho) continuam, para quem já usa a permissão ampla.
  ↳ Achado no caminho: a busca do site **nunca poderia ter funcionado** — o `:`
  do template somava com o de `caminhoDeUrl` e a URL saía `sites/host::/sites/X:`.
  Latente porque o SharePoint fica `off` por padrão. Agora é uma requisição só,
  `sites/{host}:/{caminho}:/drive`.
- [X] T133 **Serviços novos no catálogo.** Textos recebidos do comercial em 13/08,
  na planilha `Servicos novos - descricao para o comercial.xlsx`. Entraram **dois**:
  **flushing com água** (RLF) e **boroscopia** (sem relatório). O comercial marcou
  "não" para análise físico-química, sopragem de tubulação, pintura externa e limpeza
  de gancheiras — e o teste trava isso: entrar sozinho é tão defeito quanto não entrar.
  ↳ `shared/comercial/src/technical-services.ts` (ids, `RLF`, os dois modelos),
  `proposal-visuals.ts` (o `Record<TechnicalServiceId, …>` obrigou, e foi o `tsc` que
  cobrou), `nectar-produtos.js` e `backend/test/comercial-servicos-novos.test.js`.

  > **`RLF` não é sigla nova para a empresa** — é o que o filtroAPP já emite
  > (`report-rlf.js`, `Modelos/definitivos/Modelo - RLF.docx`), e o cabeçalho desse
  > modelo diz "Serviço: Flushing / Método de limpeza: Circulação pressurizada",
  > exatamente o serviço descrito na planilha. A proposta passa a prometer o relatório
  > que o sistema entrega.
  >
  > **Divergência registrada com o `.docx`:** a `Proposta técnica - Preenchida.docx`
  > (07/01) chama esse relatório de **RFA — "relatório de flushing com água"**, junto
  > com RH (hidrojateamento) e RTPP (passagem de PIG). O desvio nº 12 diz que o `.docx`
  > vence, mas aqui vence a planilha, por três razões: ela é **do mesmo autor e mais
  > nova**, responde exatamente esta pergunta, e RFA **não existe** como relatório no
  > sistema — prometer RFA seria prometer documento que ninguém emite. A frase do RFA
  > está só no `.docx` **preenchido**, que é exemplo; o **modelo** tem marcador, então
  > não há contradição dentro do documento gerado.
  >
  > **O flushing com água tem dois produtos ativos no CRM** — FV-28 "Flushing com
  > água" (id 3033640) e FV-29 "Serviço especializado em flushing com água" (id
  > 3569930). Vale o FV-29: a regra do mais usado (4 contra 3, medida em 12/08) e a
  > planilha apontam o mesmo.

  > **Regra para ambiguidade de produto, decidida em 12/08: vale o MAIS USADO.**
  > Conferida contra o uso real das 230 oportunidades, ela confirma todas as
  > escolhas já feitas. Para o flushing com água, aponta o
  > "Serviço especializado em flushing com água" (4 usos) contra "Flushing com
  > água" (3).

- [X] T138 **Tirar dos `.docx` os relatórios que não existem, e acertar a sigla do
  flushing.** Decidido pelo mantenedor em 13/08, ao rever o item 8: `RH (relatório de
  hidrojateamento)` e `RTPP (relatório de passagem de PIG)` **saem** — não existem; e
  `RFA (relatório de flushing com água)` vira `RLF (relatório de flushing)`, que é o
  nome usado. ↳ `backend/scripts/comercial-corrigir-relatorios.mjs`, aplicado nos
  `modelos/` **e** nos `.docx` de origem.

  > **Mexer só no `modelos/` seria conserto que se desfaz sozinho**: a próxima rodada
  > do `comercial-gerar-modelos.mjs` traria os parágrafos de volta, e ninguém
  > desconfiaria, porque o documento continuaria bonito.
  >
  > A armadilha da T132 voltou, e desta vez me pegou: `RFA` cabia num `<w:t>` e trocou
  > na primeira tentativa, mas `relatório de flushing com água` estava partido em
  > `(relatório ` + `de flushing com água`, e o regex sobre a frase inteira **não achou
  > nada, em silêncio**. O script ganhou uma remoção que trabalha sobre o texto
  > concatenado do parágrafo e devolve o corte aos nós certos, preservando a formatação
  > de cada run.

- [X] T139 **O item 8 promete só os relatórios dos serviços contratados.** Decidido pelo
  mantenedor em 13/08. Até aqui o documento **emitido** listava todos, sempre, porque o
  item 8 é texto fixo do modelo — uma proposta só de limpeza química prometia contagem
  de partículas, teste de pressão e limpeza de reservatório que ninguém contratou. O RDO
  continua aparecendo sempre. ↳ `ajustarRelatorios` em `proposta-docx.js`,
  `technicalReportCodesFor` em `technical-services.ts`,
  `backend/test/comercial-relatorios-item8.test.js`.

  > **O defeito estava escondido pela prévia.** A tela já montava a lista a partir dos
  > serviços selecionados (`buildTechnicalReportsText`), e ela é usada **só pelo
  > frontend** — o gerador do `.docx` nunca a chamou. Então quem conferia na tela via o
  > certo, e o cliente recebia o errado. Achado ao remover RH/RTPP/RIB (T138), não por
  > teste: nenhum teste comparava os dois lados. Agora um compara.
  >
  > **Remove parágrafo em vez de escrever parágrafo.** Dava para trocar o bloco por um
  > marcador, como o escopo faz. Removendo, o que sobra é o parágrafo do documento, com
  > a fonte, o recuo e o espaçamento que o comercial escolheu — e o texto continua
  > morando no `.docx`, onde ele pode editar sem programador.
  >
  > **O `.docx` fala por RELATÓRIO, não por serviço**, e isso corrigiu um defeito que
  > ninguém tinha notado: "dos serviços de flushing e/ou filtragem absoluta" cobre sete
  > serviços numa frase. A montagem antiga interpolava o título do serviço, então uma
  > proposta com flushing primário **e** secundário imprimia o parágrafo do RCPU duas
  > vezes. Agora é um por código distinto, na ordem do documento. As frases do
  > `reportText()` foram substituídas pelas do `.docx` (desvio nº 12), e a função morreu.
  >
  > **Consequência para a T133, confirmada pelo mantenedor em 13/08** ("foi só erro
  > meu, pode alinhar com o que já estava no documento"): a frase do RLF é a do `.docx`
  > ("Após a conclusão **dos serviços de** flushing … da estrutura.") e não a da
  > planilha ("Após a conclusão **do** flushing … da estrutura **caso aplicado**."). O
  > que a planilha decidiu — a **sigla** RLF — está aplicado nos dois lados.
  >
  > **E a conferência caractere a caractere valeu na hora**: eu havia copiado a frase
  > do RDO terminando em ponto final, e no documento ela termina em **ponto e vírgula**,
  > como as outras do item 8. Um caractere. Um teste passou a comparar cada frase do
  > código contra o documento gerado, porque comparar por trecho ou por regex não veria
  > — e é assim que as duas verdades voltam a existir.

## Rastreabilidade que faltava — apontada pela revisão de 13/08

- [ ] T136 Escrever o teste de aceite do **SC-007** — "um orçamentista que nunca usou o
  módulo conclui um levantamento completo sem ajuda externa, apoiado apenas no tutorial
  e na cadeia do rodapé". Era o **único critério de sucesso sem tarefa**, e não é
  automatizável como os outros: é uma sessão observada com alguém que nunca viu a tela,
  cronometrada, com registro de cada vez que a pessoa **pergunta** em vez de achar. O
  roteiro sai de `contracts/baseline/roteiro.md`.

  > **Depende da T096–T097** (o tutorial permanente). Fazer a sessão antes é medir a
  > cadeia do rodapé sozinha — que é metade do critério, e a metade que já existe.
  > Registrar o resultado aqui, não só "passou": onde a pessoa travou é o que conserta
  > a tela.
- [ ] T137 Varrer o CSS morto de `frontend/src/styles/comercial.css`. Achado ao corrigir
  a nota da T104 em 13/08: `.com-secoes`, `.com-secao-aba` e `.com-secao-corpo` não são
  aplicadas por nenhum `.tsx` — a tira de seções que existe de verdade é
  `.com-workflow-nav`. **O problema não é o peso do arquivo, é o comentário**: regra
  morta comentada como se resolvesse um problema conhecido vira prova falsa na próxima
  auditoria, e foi exatamente o que aconteceu. Conferir cada classe contra o uso real
  antes de remover — parte do CSS é porte fiel e pode estar esperando a tela que falta
  (o histórico, T084).
