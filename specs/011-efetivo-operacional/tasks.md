---

description: "Tarefas de implementação — Efetivo Operacional (Produtividade + Férias)"
---

# Tasks: Efetivo Operacional — Produtividade e Improdutividade Real

**Input**: Documentos de projeto em `/specs/011-efetivo-operacional/`

**Prerequisites**: [plan.md](./plan.md) (obrigatório), [spec.md](./spec.md) (histórias), [research.md](./research.md)

**Tests**: Obrigatórios por constitution (Princípio V — lógica de negócio nova exige teste em
`backend/test`). As tarefas de teste abaixo **não são opcionais**.

**Organization**: Tarefas agrupadas por história de usuário, para permitir implementação e
validação independentes.

## Format: `[ID] [P?] [Story] Descrição`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1–US6, conforme `spec.md`
- Todo caminho de arquivo é explícito

## Path Conventions

Web app: `backend/src/`, `frontend/src/`, `shared/`, testes em `backend/test/` e `frontend/test/`.

---

## Phase 1: Setup (Infraestrutura compartilhada)

**Purpose**: criar a casca do módulo novo pelo caminho oficial do repositório

- [ ] T001 Rodar o scaffold do módulo com `npm run new:module -- efetivo --title "Efetivo Operacional"` e conferir o que ele gerou (registry, rota backend, service, página, testes iniciais, mount)
- [ ] T002 Ajustar a entrada do módulo em `shared/modules/registry.json`: id `efetivo`, badge, título "Efetivo Operacional", copy do card do hub, `pathPrefixes` `/efetivo`, rotas (`root: /efetivo`) e papéis `efetivo:manager` / `efetivo:viewer`
- [ ] T003 Rodar `npm run modules:generate` e confirmar que `frontend/src/modules/registry.generated.ts` ficou sincronizado com o registry
- [ ] T004 Adicionar `EFETIVO` ao enum `AppModule` e `EFETIVO_MANAGER`/`EFETIVO_VIEWER` ao enum `ModuleRoleCode` em `backend/prisma/schema.prisma`
- [ ] T005 [P] Conferir o mount da rota em `backend/src/routes/index.js` e a rota `/efetivo` em `frontend/src/modules/moduleRoutes.tsx` criados pelo scaffold

**Checkpoint**: módulo existe, aparece no hub para quem tem o papel, e a página abre vazia

---

## Phase 2: Foundational (Pré-requisitos bloqueantes)

**Purpose**: schema, permissão e parâmetros que todas as histórias usam

**⚠️ CRÍTICO**: nenhuma história começa antes desta fase terminar

- [ ] T006 Adicionar ao `backend/prisma/schema.prisma`: `JobRole.isOperational Boolean @default(true)` (D-4), `Collaborator.terminationDate DateTime?` (D-3), o enum `CollaboratorAbsenceType` (FERIAS, FOLGA, AFASTAMENTO, ASO, TREINAMENTO) e o model `CollaboratorAbsence` com índices `[collaboratorId, startDate]`, `[type, startDate]` e `[deletedAt]`, conforme `plan.md`
- [ ] T007 Gerar a migration Prisma única em `backend/prisma/migrations/` (nome sugerido `add_efetivo_operacional`) e **não executá-la** — entregar o comando ao operador como bloco "rode no servidor" (Princípio I)
- [ ] T008 [P] Criar `backend/src/lib/efetivo/access.js` com `requireEfetivoManager` e `requireEfetivoViewer` no padrão de `requireAcompanhamentoManager` (`backend/src/routes/resources/acompanhamento-custo.js`)
- [ ] T009 [P] Criar `backend/src/lib/efetivo/settings.js` com a referência mensal de HH produtivas (161) como parâmetro persistido — padrão de `backend/src/lib/acompanhamento/settings.js` — e nenhum literal 161 fora deste arquivo (FR-009)
- [ ] T010 [P] Criar `frontend/src/api/efetivo.ts` com o cliente HTTP e os tipos do módulo, no padrão de `frontend/src/api/acompanhamentoCusto.ts`
- [ ] T011 Criar `frontend/src/pages/efetivo/EfetivoPage.tsx` com `Shell` largo, `TopBar` e navegação por `?section=` (seções `produtividade` e `ausencias`), espelhando `frontend/src/pages/acompanhamento/AcompanhamentoPage.tsx` — incluindo a limpeza de params incompatíveis ao trocar de seção
- [ ] T012 [P] Criar `backend/src/routes/resources/efetivo.js` fino (validar com Zod, aplicar permissão, chamar service), sem regra de negócio, conforme `docs/PADRAO_MODULO.md`

**Checkpoint**: schema pronto, permissão aplicada, página do módulo com as duas abas navegáveis e vazias

---

## Phase 3: User Story 1 — Taxa Geral e resultado por colaborador (P1) 🎯 MVP

**Goal**: entregar a Improdutividade Real por colaborador e a Taxa Geral do efetivo operacional.

**Independent Test**: abrir a seção Produtividade e conferir que a taxa geral é a média simples das
taxas individuais listadas, e que cada taxa reproduz `max(0, (161 − média) ÷ 161)`.

### Tests for User Story 1

- [ ] T013 [P] [US1] Criar `backend/test/efetivo-produtividade.test.js` cobrindo `computeIndividualRate` (piso 0% quando média > 161; valor exato para média 154) e `computeGeneralRate` (média simples, não ponderada) — FR-006, FR-007
- [ ] T014 [P] [US1] Em `backend/test/efetivo-produtividade.test.js`, cobrir `buildMonthlyProductiveHours`: HE70/HE100/extras genéricas fora do numerador e adicional noturno sem efeito — FR-003, FR-004
- [ ] T015 [P] [US1] Em `backend/test/efetivo-produtividade.test.js`, cobrir `selectAnalyzedMonths`: pró-rata só em admissão e desligamento, mês corrente fora, férias sem reduzir o denominador — FR-019, FR-020, FR-021
- [ ] T016 [P] [US1] Criar `backend/test/efetivo-permissao.test.js` verificando que `efetivo:viewer` lê o indicador e não acessa as rotas de escrita, e que quem não tem papel do módulo recebe 403 — FR-015

### Implementation for User Story 1

- [ ] T017 [US1] Criar `backend/src/lib/efetivo/productivity.js` com funções puras (sem Prisma): `buildMonthlyProductiveHours`, `selectAnalyzedMonths`, `computeIndividualRate`, `computeGeneralRate`, `buildProductivityReport`
- [ ] T018 [US1] Criar `backend/src/lib/efetivo/service.js` lendo `PontoPeriodSummary` via `mergePontoPeriods` e `filterIgnoredPontoPeriods` de `backend/src/lib/acompanhamento/labor-cost.js`, colaboradores ativos e `JobRole` operacionais — **sem** usar `computeCollaboratorRates` (FR-016)
- [ ] T019 [US1] Implementar `GET /api/efetivo/produtividade` em `backend/src/routes/resources/efetivo.js` com validação Zod de `ano` e `ateMes`, permissão de leitura do módulo e o payload descrito em `plan.md`
- [ ] T020 [US1] Expor a data da última sincronização do ponto no payload, lendo `PontoSyncState` (`lastDailySyncDate`, `historyStart`, `historyThrough`) — FR-014
- [ ] T021 [P] [US1] Criar `frontend/src/pages/efetivo/components/ProductivityBoard.tsx` com os KPIs (HH acumuladas, média mensal da equipe, Taxa Geral, pendências) usando cards no padrão de `frontend/src/components/projects/SedeCostsBoard.tsx` e tokens de `frontend/src/styles/variables.css`
- [ ] T022 [US1] Implementar a evolução mensal (média de HH por mês contra a referência) dentro de `ProductivityBoard.tsx`, sem biblioteca nova de gráfico
- [ ] T023 [US1] Implementar a tabela por colaborador (colaborador, cargo, HH acumuladas, média mensal, HE excluídas, meses analisados, improdutividade) em `ProductivityBoard.tsx`, com alternativa empilhada em cards no mobile (Princípio II)
- [ ] T024 [US1] Exibir na tela a referência de 161 HH/mês, a origem `176 × 11 ÷ 12`, o aviso de que HE não entram e a data da última sincronização — FR-008, FR-014

**Checkpoint**: o indicador existe, é auditável na própria tela e não depende de perfil de custo

---

## Phase 4: User Story 2 — Escolher o período analisado (P1)

**Goal**: recorte por ano e mês de corte, persistido na URL.

**Independent Test**: trocar ano e mês de corte, ver os números mudarem de forma coerente e o
filtro sobreviver ao refresh.

- [ ] T025 [P] [US2] Criar `frontend/src/pages/efetivo/utils/productivityPeriods.ts` com as opções de ano e de mês de corte e a serialização para query params, reaproveitando o vocabulário de `frontend/src/utils/sedePeriods.ts`
- [ ] T026 [US2] Ligar os filtros de ano e mês de corte em `ProductivityBoard.tsx` a `?ano=` e `?ateMes=`, mantendo `keepPreviousData` na consulta react-query
- [ ] T027 [US2] Garantir no backend que `ateMes` recorta os meses analisados e que o mês corrente permanece fora mesmo quando o corte o incluiria (FR-021), com teste em `backend/test/efetivo-produtividade.test.js`
- [ ] T028 [US2] Verificar que os filtros cabem no mobile (quebra, grid responsivo ou `select`) sem scroll horizontal de página

**Checkpoint**: comparação entre períodos funciona e é compartilhável por link

---

## Phase 5: User Story 3 — Quem entra e quem não entra (P1)

**Goal**: tornar visível toda pessoa que ficou fora do indicador, com motivo.

**Independent Test**: com um registro de ponto sem vínculo e um cargo não operacional, conferir que
ambos aparecem identificados e que nenhum altera a taxa oficial.

- [ ] T029 [P] [US3] Cobrir em `backend/test/efetivo-produtividade.test.js` os três motivos de pendência: ponto sem `collaboratorId`, colaborador operacional sem meses analisados e colaborador com `role` sem `JobRole` correspondente — FR-013
- [ ] T030 [US3] Implementar a coleta de pendências em `backend/src/lib/efetivo/service.js`, incluindo a exclusão das pessoas ignoradas (`PontoExternalEmployee.ignoredAt`), e devolvê-las no payload
- [ ] T031 [US3] Criar `frontend/src/pages/efetivo/components/ProductivityPendingList.tsx` listando as pendências com motivo e link para a tela onde o vínculo é resolvido (aba de ponto do Acompanhamento)
- [ ] T032 [US3] Exibir "sem dados no período" para o colaborador operacional sem meses analisados, sem que ele entre na média geral

**Checkpoint**: o indicador não esconde ninguém

---

## Phase 6: User Story 4 — Marcar funções operacionais (P2)

**Goal**: dar ao gestor o controle do denominador do indicador.

**Independent Test**: desmarcar um cargo como operacional e ver as pessoas daquele cargo saírem da
taxa geral, sem perda de dado.

- [ ] T033 [P] [US4] Aceitar `isOperational` no `PATCH /api/job-roles/:id` em `backend/src/routes/resources/job-roles.js`, com validação Zod, e devolver o campo no `GET`
- [ ] T034 [P] [US4] Adicionar o campo ao tipo e ao cliente em `frontend/src/api/jobRoles.ts`
- [ ] T035 [US4] Adicionar o controle "função operacional" em `frontend/src/components/projects/JobRoleManager.tsx`, usando os componentes do kit e os estados de foco/disabled do app
- [ ] T036 [US4] Cobrir em `backend/test/efetivo-produtividade.test.js` que cargo não operacional sai da taxa geral e que o default `true` mantém o cálculo funcionando sem configuração prévia (FR-024)

**Checkpoint**: o recorte do efetivo operacional é gerenciável sem deploy

---

## Phase 7: User Story 5 — Cadastrar férias e ausências (P2)

**Goal**: o APP passa a saber quando alguém esteve de férias; os meses afetados ficam sinalizados na
Produtividade sem alterar a taxa oficial.

**Independent Test**: cadastrar um período de férias, ver o período listado, o mês sinalizado na
Produtividade e a taxa oficial do colaborador inalterada.

### Tests for User Story 5

- [ ] T037 [P] [US5] Criar `backend/test/efetivo-ausencias.test.js` cobrindo período invertido (fim antes do início), sobreposição com período existente do mesmo colaborador e soft delete preservando a trilha — FR-022
- [ ] T038 [P] [US5] Cobrir em `backend/test/efetivo-produtividade.test.js` que férias cadastradas **não** reduzem os meses analisados e que o mês afetado vem marcado no payload — FR-020, D-8

### Implementation for User Story 5

- [ ] T039 [US5] Criar `backend/src/lib/efetivo/absences.js` com as regras puras de período: validação, detecção de sobreposição e mapeamento de um período para os meses `YYYY-MM` afetados
- [ ] T040 [US5] Implementar `GET/POST/PATCH/DELETE /api/efetivo/ausencias` em `backend/src/routes/resources/efetivo.js` com Zod, permissão de gestão do módulo, `createdByUserId` e soft delete via `deletedAt`
- [ ] T041 [US5] Expor apenas o tipo `FERIAS` na API desta entrega, mantendo os demais valores do enum reservados e sem opção na UI
- [ ] T042 [US5] Marcar no payload de produtividade os meses de cada colaborador que contêm férias, sem alterar denominador nem taxa (D-8)
- [ ] T043 [P] [US5] Criar `frontend/src/pages/efetivo/components/AbsencesBoard.tsx` com a listagem por colaborador e filtro por ano, seguindo a estrutura visual de `SedeCostsBoard.tsx`
- [ ] T044 [US5] Criar `frontend/src/pages/efetivo/components/AbsenceFormModal.tsx` usando `frontend/src/components/ui/Modal.tsx`, `Button.tsx`, react-hook-form + resolver Zod, rodapé de ações fixo e corpo rolável
- [ ] T045 [US5] Aplicar o estado visual de erro do app no formulário: `.field-group.field-invalid`, `.field-error` abaixo do controle e `aria-invalid`, sem depender da validação nativa do navegador
- [ ] T046 [US5] Usar `frontend/src/components/ui/ConfirmDialog.tsx` na remoção de um período e `Toast` no sucesso/erro
- [ ] T047 [US5] Sinalizar em `ProductivityBoard.tsx` os meses com férias (na evolução mensal e na linha do colaborador), com legenda explicando que a referência 161 já é anualizada e que as férias não são descontadas de novo
- [ ] T048 [US5] Expor `terminationDate` no `PUT /api/collaborators/:id` (`backend/src/routes/resources/collaborators.js`) com Zod e no tipo de `frontend/src/api/collaborators.ts` — FR-023
- [ ] T049 [US5] Adicionar o campo "data de desligamento" ao formulário de colaborador em `frontend/src/pages/gestor/GestorPage.tsx` **respeitando o budget de 4581 linhas** do `architecture:check` (arquivo está com 4567): se o acréscimo estourar, extrair o formulário de colaborador para `frontend/src/pages/gestor/CollaboratorForm.tsx` no mesmo PR e reduzir o budget

**Checkpoint**: férias cadastradas, meses sinalizados, taxa oficial intocada

---

## Phase 8: User Story 6 — Detalhe mensal do colaborador (P3)

**Goal**: explicar de onde vem a taxa individual.

**Independent Test**: abrir um colaborador e conferir que a soma dos meses exibidos bate com as HH
acumuladas da tabela.

- [ ] T050 [P] [US6] Implementar `GET /api/efetivo/produtividade/:collaboratorId` em `backend/src/routes/resources/efetivo.js` devolvendo o mês a mês (HH normais, HE excluídas, distância para a referência, marcação de férias e de mês instável)
- [ ] T051 [US6] Criar `frontend/src/pages/efetivo/components/ProductivityCollaboratorDetail.tsx` aberto por `?colaborador=`, com fechamento limpando o param
- [ ] T052 [US6] Cobrir em `backend/test/efetivo-produtividade.test.js` que a soma dos meses do detalhe é igual ao acumulado exibido na lista

**Checkpoint**: o número é explicável pessoa a pessoa

---

## Phase 9: Polish & Cross-Cutting

- [ ] T053 [P] Criar o tutorial permanente de primeiro acesso do módulo em `frontend/src/pages/efetivo/EfetivoTutorial.tsx`, no padrão de `frontend/src/components/AcompanhamentoTutorial.tsx` (obrigatório para módulo novo)
- [ ] T054 [P] Criar a campanha de novidade de 10 dias do hub em `frontend/src/components/EfetivoHubNovelty.tsx`, no padrão de `AcompanhamentoHubNovelty.tsx`, com data-limite global exatamente 10 dias após a data de implementação registrada no código
- [ ] T055 Continuidade de navegação: verificar que `?section=`, `?ano=`, `?ateMes=` e `?colaborador=` sobrevivem ao refresh e que trocar de seção limpa os params incompatíveis
- [ ] T056 Auditoria de overflow no mobile: KPIs, tabela/cards, abas e badges em 390px sem scroll horizontal de página; grids com `minmax(min(100%, ...), 1fr)` e filhos com `min-width: 0`
- [ ] T057 Passada de consistência visual: componentes de `frontend/src/components/ui/`, tokens de `variables.css`, `select` com borda/foco/disabled/erro, shell largo no desktop; **a exceção de identidade portada não se aplica** a este módulo
- [ ] T058 [P] Criar `frontend/test/efetivo.test.mjs` cobrindo `productivityPeriods.ts` (serialização dos filtros e recorte por mês de corte)
- [ ] T059 Revisar `LGPD_ROPA.md` e registrar o tratamento de produtividade individual (dado pessoal) com a base legal e o papel de acesso do módulo
- [ ] T060 Rodar `npm run architecture:check`, `npm test` (backend), `npm run lint`, `npm test` e `npm run build` (frontend) e corrigir o que falhar
- [ ] T061 Escrever `specs/011-efetivo-operacional/quickstart.md` com o roteiro de validação manual do módulo (indicador, filtros, pendências, cadastro de férias)
- [ ] T062 Entregar ao operador, como bloco "rode no servidor", os comandos de migration e deploy — sem executá-los (Princípio I)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências
- **Foundational (Phase 2)**: depende da Phase 1 — **bloqueia todas as histórias**
- **US1 (Phase 3)**: depende da Phase 2 — é o MVP
- **US2 (Phase 4)**: depende de US1 (usa o payload e o board)
- **US3 (Phase 5)**: depende de US1 (mesmo service e payload)
- **US4 (Phase 6)**: depende da Phase 2; independente de US2/US3
- **US5 (Phase 7)**: depende da Phase 2; a sinalização (T042, T047) depende de US1
- **US6 (Phase 8)**: depende de US1
- **Polish (Phase 9)**: depois das histórias desejadas

### Within Each User Story

- Testes antes da implementação (Princípio V)
- Funções puras → service → rota → tela
- Backend antes do frontend correspondente

### Parallel Opportunities

- T008, T009, T010, T012 em paralelo na fundação
- T013–T016 em paralelo (arquivos de teste distintos)
- T033/T034 em paralelo com o trabalho de US5
- US4 e US5 podem ser tocadas por pessoas diferentes após a fundação
- T053, T054 e T058 em paralelo no polish

---

## Parallel Example: User Story 1

```bash
# Testes da US1 juntos:
Task: "computeIndividualRate/computeGeneralRate em backend/test/efetivo-produtividade.test.js"
Task: "buildMonthlyProductiveHours (HE fora, noturno neutro) no mesmo arquivo"
Task: "selectAnalyzedMonths (pró-rata, mês corrente, férias) no mesmo arquivo"
Task: "permissão do módulo em backend/test/efetivo-permissao.test.js"
```

---

## Implementation Strategy

### MVP (US1)

1. Phase 1 — Setup
2. Phase 2 — Foundational (bloqueante)
3. Phase 3 — US1
4. **PARAR e VALIDAR**: taxa geral reproduzível à mão a partir da tabela
5. Demonstrar

### Entrega incremental

1. Setup + Foundational → fundação pronta
2. + US1 → indicador no ar (MVP)
3. + US2 → comparação entre períodos
4. + US3 → transparência de quem ficou fora
5. + US4 → recorte do efetivo gerenciável
6. + US5 → cadastro de férias e sinalização
7. + US6 → explicabilidade por pessoa

### Observações

- Uma única migration (T007) cobre as três mudanças de schema; não fatiar
- Nenhuma tarefa executa comando de servidor — migrations e deploy vão como bloco "rode no servidor"
- `161` só existe em `backend/src/lib/efetivo/settings.js`
- O módulo importa de `lib/acompanhamento/labor-cost.js` apenas `mergePontoPeriods` e
  `filterIgnoredPontoPeriods`; se essa fronteira incomodar, extrair para `backend/src/lib/ponto/`
