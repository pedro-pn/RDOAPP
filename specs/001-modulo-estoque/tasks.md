# Tasks: Módulo Estoque (filtros e produtos químicos)

**Input**: Design documents from `/specs/001-modulo-estoque/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/estoque-api.md, quickstart.md

**Tests**: INCLUÍDOS — a constitution (Princípio V) exige testes de lógica de negócio em `backend/test` (`node --test`, `npm test`).

**Organization**: Tarefas agrupadas por user story da spec, em ordem de prioridade. Trabalhar em branch `feat/modulo-estoque`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1–US6 conforme spec.md

---

## Phase 1: Setup (registro do módulo e schema)

**Purpose**: módulo existir de ponta a ponta (papéis, banco, validação compartilhada) antes de qualquer história.

- [X] T001 Adicionar módulo `estoque` em `shared/modules/registry.json` (id, `prismaModule: "ESTOQUE"`, badge "STQ", título/copy, hub `/estoque` com roles `estoque:manager`/`estoque:viewer`, `pathPrefixes`, `routes.index`, `routeGroups.default` p/ ADMIN+INTERNAL, roles `ESTOQUE_MANAGER`/`ESTOQUE_VIEWER` — espelhar o bloco `equipamentos`) e rodar `node scripts/generate-module-registry.mjs` para regenerar `frontend/src/modules/registry.generated.ts`
- [X] T002 Adicionar ao `backend/prisma/schema.prisma`: enums `StockItemType`, `StockMovementType`, `StockMovementReason`; modelos `StockItem`, `StockBatch`, `StockMovement` (campos, uniques e índices conforme `data-model.md`, incl. `@@unique([itemId, lotNumber])` e `reversalOfId @unique`); valores `ESTOQUE` em `AppModule` e `ESTOQUE_MANAGER`/`ESTOQUE_VIEWER` em `ModuleRoleCode`; relações inversas em `Project` e `User`. Criar migration `estoque_module` via `npm run prisma:migrate` (dev local) e rodar `npm run prisma:generate`
- [X] T003 [P] Criar `shared/schemas/estoque.js` com schemas Zod compartilhados: item (discriminated union por `type`, `unitLabel` ∈ {kg, L} só p/ químico, campos por tipo mutuamente exclusivos) e movimentação (discriminated union por `reason` com regras da tabela do contrato: `quantity > 0`, inteira p/ filtro via refinamento parametrizado, campos obrigatórios por motivo)
- [X] T004 [P] Adicionar `requireEstoqueAccess` e `requireEstoqueManager` em `backend/src/middleware/auth.js` (copiar padrão de `requireEquipamentosAccess`/`requireEquipamentosManager`, linhas ~138–152; acesso só por papel do módulo, sem bypass de admin — research R7)

---

## Phase 2: Foundational (esqueleto de rota, saldo e casca da página)

**Purpose**: infraestrutura que TODAS as histórias usam.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase terminar.

- [X] T005 Criar `backend/src/lib/estoque/stock-balance.js`: agregação de saldo por `itemId` e por `batchId` (SUM condicional por `type`, Prisma `groupBy`), helpers `getItemBalances(prismaOrTx, itemIds?)` e `getBatchBalances(prismaOrTx, itemId)` reutilizáveis dentro de transação
- [X] T006 Criar `backend/src/routes/resources/estoque.js` (Router com `requireAuth` + `requireEstoqueAccess`, esqueleto dos grupos itens/resumo/movimentações/lotes) e montar `router.use('/estoque', estoqueRouter)` em `backend/src/routes/index.js`
- [X] T007 [P] Criar casca do frontend: `frontend/src/pages/estoque/EstoquePage.tsx` com barra de abas Resumo/Movimentações/Itens (copiar estrutura e navegação da `frontend/src/pages/equipamentos/EquipamentosPage.tsx`, kit `components/ui/`, tokens de `styles/variables.css`) e registrar a rota em `frontend/src/modules/moduleRoutes.tsx` (padrão `moduleRoutePath('estoque', 'index')` + `moduleRouteAccess('estoque')`)
- [X] T008 [P] Criar `frontend/src/api/estoque.ts`: client HTTP tipado (itens, resumo, movimentações, lotes, estorno) + tipos TS derivados do contrato, no padrão dos clients existentes em `frontend/src/api/`

**Checkpoint**: `/estoque` abre com 3 abas vazias para quem tem papel; API responde 403 sem papel.

---

## Phase 3: User Story 1 — Cadastrar itens de estoque (Priority: P1) 🎯 MVP

**Goal**: CRUD de filtros e produtos químicos com FISPQ anexável, código único e inativação.

**Independent Test**: criar/editar/inativar um filtro e um químico via UI; código duplicado rejeitado; FISPQ baixável por link; item inativado some das opções de movimentação futura.

### Tests for User Story 1

- [X] T009 [P] [US1] Criar `backend/test/estoque-items.test.js`: validação Zod por tipo (campos exclusivos, unitLabel), código único (409), unitLabel imutável com movimentações, DELETE bloqueado com movimentações (409) e permitido sem, PATCH ativo/inativo

### Implementation for User Story 1

- [X] T010 [US1] Implementar em `backend/src/routes/resources/estoque.js` os endpoints de itens do contrato: `GET /itens` (filtros type/search/includeInactive), `POST /itens`, `PUT /itens/:id`, `PATCH /itens/:id/ativo`, `DELETE /itens/:id` — escrita com `requireEstoqueManager`, validação com `shared/schemas/estoque.js`, serialização com `fispqUrl` e `hasMovements`
- [X] T011 [US1] Criar `backend/src/lib/estoque/stock-attachments.js` (armazenar/remover PDF da FISPQ por token, padrão de `backend/src/lib/equipment-attachments.js`) e adicionar `GET /api/estoque-anexos/:token` em `backend/src/app.js` (padrão da rota `equipamentos-anexos`, `app.js:95`)
- [X] T012 [P] [US1] Criar `frontend/src/pages/estoque/StockItemsTab.tsx`: lista de itens com busca, filtro por tipo, badge inativo, ações editar/inativar/excluir (ConfirmDialog do kit); react-query sobre `api/estoque.ts`
- [X] T013 [US1] Criar `frontend/src/pages/estoque/StockItemFormModal.tsx`: react-hook-form + resolver Zod de `shared/schemas/estoque.js`, campos condicionais por tipo (filtro: modelo/tipo/micragem; químico: unidade kg/L, nº ONU, nº CAS, upload FISPQ em PDF), Modal do kit com rodapé fixo

**Checkpoint**: US1 completa — cadastro funcional de ponta a ponta, testes verdes.

---

## Phase 4: User Story 2 — Registrar entrada de material (Priority: P1)

**Goal**: entrada por COMPRA criando/somando lotes, com NF obrigatória e lote/validade condicionais por tipo.

**Independent Test**: entrada de químico com NF/lote/validade atualiza saldo; sem lote → bloqueio; mesmo lote → soma; filtro sem lote → lote avulso.

### Tests for User Story 2

- [X] T014 [P] [US2] Criar `backend/test/estoque-movements-entrada.test.js`: COMPRA exige NF sempre; lote+validade obrigatórios p/ químico e opcionais p/ filtro; lote avulso (`lotNumber: ""`) criado sob demanda; reentrada do mesmo lote soma (sem duplicar) e valida `expiryDate` divergente (400); `unitCost`/`supplier` opcionais persistidos; item inativo rejeitado

### Implementation for User Story 2

- [X] T015 [US2] Criar `backend/src/lib/estoque/stock-movements.js` com `createMovement()` transacional: resolução/criação de lote (avulso incluso), validações por `reason` (COMPRA nesta fase), invariantes de quantidade (inteira p/ filtro, ≤3 casas p/ químico), gravação com `createdById`; retorno com saldos pós-movimentação via `stock-balance.js`
- [X] T016 [US2] Implementar `POST /movimentacoes` (reason COMPRA) e `GET /lotes?itemId=` (ordenação FEFO: `expiryDate asc nulls last, createdAt asc`, só saldo > 0) em `backend/src/routes/resources/estoque.js`
- [X] T017 [US2] Criar `frontend/src/pages/estoque/StockMovementFormModal.tsx` com o fluxo de **entrada por compra**: seleção de item (ativos), quantidade com step/validação por tipo, data, NF, lote/validade (obrigatórios só p/ químico — hint visual), fornecedor e custo unitário opcionais; resolver Zod compartilhado

**Checkpoint**: US1+US2 — estoque ganha saldo por entradas; testes verdes.

---

## Phase 5: User Story 3 — Registrar saída para projeto (Priority: P1)

**Goal**: saída USO_EM_PROJETO com FEFO sugerido, projeto de destino e bloqueio de saldo negativo (inclusive concorrente).

**Independent Test**: saída reduz saldo do lote pré-selecionado por FEFO; saída > saldo bloqueada com mensagem do disponível; quantidade fracionada de filtro rejeitada.

### Tests for User Story 3

- [X] T018 [P] [US3] Criar `backend/test/estoque-movements-saida.test.js`: saldo insuficiente → 409 com disponível na mensagem; saldo exato zera (permitido); concorrência — duas saídas simultâneas no mesmo lote não deixam saldo negativo (Promise.all contra o service); projeto obrigatório/soft-deleted rejeitado; lote vencido exige `confirmExpired` (422 com `requiresConfirmation`); FEFO do `GET /lotes` (validade asc, empate por createdAt)

### Implementation for User Story 3

- [X] T019 [US3] Estender `backend/src/lib/estoque/stock-movements.js`: SAIDA/USO_EM_PROJETO com serialização por lote dentro de `prisma.$transaction` (lock do registro do lote + revalidação de saldo — research R2), regra `confirmExpired` para lote vencido, validação de projeto ativo
- [X] T020 [US3] Implementar `POST /movimentacoes` (reason USO_EM_PROJETO) em `backend/src/routes/resources/estoque.js`, incluindo o contrato de erro 409 (saldo) e 422 (`requiresConfirmation`)
- [X] T021 [US3] Estender `StockMovementFormModal.tsx` com o fluxo de **saída**: seletor de lote pré-preenchido via `GET /lotes` (FEFO, mostrando validade e saldo de cada lote), projeto de destino (projetos ativos), solicitante e observações; diálogo de confirmação quando o lote está vencido

**Checkpoint**: ciclo entrada→saída completo — MVP operacional de verdade.

---

## Phase 6: User Story 4 — Consultar resumo do estoque (Priority: P2)

**Goal**: aba Resumo com saldo por item, detalhe por lote, alertas visuais e botão "Registrar movimentação".

**Independent Test**: saldos exibidos = soma das movimentações; item abaixo do mínimo e lote vencendo destacados; viewer não vê ações de escrita.

### Tests for User Story 4

- [X] T022 [P] [US4] Criar `backend/test/estoque-resumo.test.js`: agregação correta item/lote; lotes zerados omitidos; item inativo com saldo aparece e some ao zerar; flags `belowMin`, `expiringSoon` (janela 30 dias) e `expired` corretas
- [X] T023 [P] [US4] Criar `backend/test/estoque-access.test.js`: matriz de papéis do contrato — viewer lê tudo e recebe 403 em qualquer escrita; sem papel → 403 geral; manager → tudo

### Implementation for User Story 4

- [X] T024 [US4] Implementar `GET /resumo` em `backend/src/routes/resources/estoque.js` usando `stock-balance.js` + join de lotes, calculando flags no backend (regra única, reutilizável pelos alertas da Fase 2 — research R8)
- [X] T025 [US4] Criar `frontend/src/pages/estoque/StockSummaryTab.tsx`: lista de itens com saldo/unidade/badges de alerta, expansão por lote (validade, NF), botão "Registrar movimentação" abrindo o `StockMovementFormModal`; ações de escrita ocultas para viewer (checar papel via user do auth store); mobile: cards empilhados

**Checkpoint**: tela principal do módulo completa.

---

## Phase 7: User Story 5 — Consultar histórico de movimentações (Priority: P2)

**Goal**: aba Movimentações com filtros por período/item/tipo/projeto e paginação.

**Independent Test**: filtros combinados retornam exatamente as movimentações esperadas; cada linha mostra autor e dados do contrato.

### Tests for User Story 5

- [X] T026 [P] [US5] Criar `backend/test/estoque-movimentacoes-list.test.js`: filtros (itemId, type, reason, projectId, from/to) isolados e combinados; paginação (total, page, pageSize máx 200); ordenação `date desc, createdAt desc`

### Implementation for User Story 5

- [X] T027 [US5] Implementar `GET /movimentacoes` em `backend/src/routes/resources/estoque.js` conforme contrato (includes de item/batch/project/createdBy serializados enxutos)
- [X] T028 [US5] Criar `frontend/src/pages/estoque/StockMovementsTab.tsx`: filtros (período, item, tipo, projeto), tabela→cards no mobile, paginação, badges por tipo/motivo em pt-BR

**Checkpoint**: as três abas funcionais; US1–US5 entregues.

---

## Phase 8: User Story 6 — Corrigir erros e acertar inventário (Priority: P3)

**Goal**: estorno vinculado, devolução de obra e ajuste de inventário (decisão Q3: tudo na Fase 1 do rollout).

**Independent Test**: estorno restaura saldo e vincula as duas movimentações; devolução aumenta saldo sem NF; ajuste sem justificativa bloqueado.

### Tests for User Story 6

- [X] T029 [P] [US6] Criar `backend/test/estoque-estorno-ajustes.test.js`: estorno inverte tipo e replica item/lote/quantidade; estorno de estorno → 409; segundo estorno da mesma movimentação → 409 (unique `reversalOfId`); estorno que deixaria saldo negativo → 409; DEVOLUCAO_OBRA exige projeto+lote existente e dispensa NF; INVENTARIO (entrada e saída) e PERDA/DESCARTE_VALIDADE exigem `notes`

### Implementation for User Story 6

- [X] T030 [US6] Estender `backend/src/lib/estoque/stock-movements.js` com `reverseMovement()` (ESTORNO com `reversalOfId`, travas de research R3) e os reasons DEVOLUCAO_OBRA, INVENTARIO, PERDA, DESCARTE_VALIDADE; implementar `POST /movimentacoes/:id/estorno` e os novos reasons no `POST /movimentacoes` em `backend/src/routes/resources/estoque.js`
- [X] T031 [US6] Frontend: botão "Estornar" (ConfirmDialog) nas linhas do histórico em `StockMovementsTab.tsx` com indicação visual de movimentação estornada/estorno vinculado; adicionar fluxos "Devolução de obra", "Ajuste de inventário" e "Perda/Descarte" ao `StockMovementFormModal.tsx` (campos condicionais por motivo, justificativa obrigatória onde o contrato exige)

**Checkpoint**: todas as user stories completas.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T032 Rodar suíte completa `cd backend && npm test` e `cd frontend && npx tsc --noEmit` — tudo verde, sem regressão nos módulos existentes
- [ ] T033 Passada de conformidade visual/mobile (Princípios II e VI): viewport de celular nas 3 abas e nos 2 modais — tabelas viram cards, rodapé de modal fixo, sem scroll horizontal, só componentes do kit e tokens
- [ ] T034 [P] Executar o roteiro manual completo de `specs/001-modulo-estoque/quickstart.md` (14 passos) e registrar resultado no próprio arquivo
- [X] T035 [P] Atualizar `PLANO_MODULO_ESTOQUE.md` (status Fase 1 implementada) e revisar textos pt-BR de erros/labels (mensagens do contrato)

## Phase 10: Convergence — Integração Romaneio x Estoque

- [X] T036 [US7] Adicionar fonte gerenciada `STOCK` ao catálogo de Romaneio em `backend/prisma/schema.prisma` e criar migration para `RomaneioCatalogSource`.
- [X] T037 [US7] Sincronizar itens ativos de `StockItem` para `RomaneioCatalogItem` em `backend/src/lib/romaneio-catalog.js`, com filtros como unidade e produtos químicos kg como peso, desativando órfãos `STOCK`.
- [X] T038 [US7] Vincular `StockMovement` a `Romaneio` e implementar movimentações automáticas por FEFO em `backend/src/lib/estoque/stock-movements.js`.
- [X] T039 [US7] Integrar criação/edição de romaneios em `backend/src/routes/resources/romaneios.js`, gerando saídas `USO_EM_PROJETO`, entradas `DEVOLUCAO_OBRA` e estornos ao editar romaneios com estoque.
- [X] T040 [P] [US7] Atualizar tipos/rótulos de catálogo `STOCK` no frontend em `frontend/src/api/romaneio.ts`, `frontend/src/pages/romaneio/NewRomaneioPage.tsx` e `frontend/src/pages/romaneio/RomaneioPage.tsx`.
- [X] T041 [P] [US7] Cobrir integração com testes backend em `backend/test/romaneio-stock-integration.test.js` e atualizar testes existentes de fontes gerenciadas.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: sem dependências. T001, T002 primeiro (T003, T004 em paralelo entre si; T004 depende de T001 para os códigos de papel)
- **Phase 2 (Foundational)**: depende da Phase 1. T005 e T006 sequenciais no backend (T006 usa guards de T004); T007/T008 em paralelo no frontend
- **US1 (Phase 3)**: depende da Phase 2 — sem dependência de outras histórias
- **US2 (Phase 4)**: depende da Phase 2 + itens existirem (US1 T010) para testar de verdade
- **US3 (Phase 5)**: depende de US2 (precisa de saldo/lotes) — T019 estende arquivo criado em T015
- **US4 (Phase 6)**: depende de US2 (saldos); integra o modal de US2/US3 no botão
- **US5 (Phase 7)**: depende da Phase 2; dados reais vêm de US2/US3
- **US6 (Phase 8)**: depende de US3 (estorna saídas) e US5 (botão no histórico)
- **Phase 9 (Polish)**: depende de tudo

### Within Each User Story

- Teste da história antes/junto da implementação (deve falhar antes do código)
- Lib (`lib/estoque/*`) antes da rota; rota antes da UI

### Parallel Opportunities

- Phase 1: T003 ∥ T004 (após T001/T002)
- Phase 2: T007 ∥ T008 ∥ (T005→T006)
- Em cada história: teste [P] ∥ início da lib; frontend [P] com backend quando o contrato já está fixo (contracts/estoque-api.md é a referência)
- US4 e US5 são paralelizáveis entre si após US2/US3

---

## Parallel Example: User Story 2

```text
# Após Phase 2 + T010:
Task A: T014 backend/test/estoque-movements-entrada.test.js (teste primeiro, falhando)
Task B: T017 frontend StockMovementFormModal.tsx (contrato fixo em contracts/estoque-api.md)
# Em seguida, sequencial no backend: T015 → T016 (mesmo par de arquivos lib/rota)
```

---

## Implementation Strategy

### MVP First

1. Phases 1–2 (fundação) → 3 abas vazias acessíveis por papel
2. Phase 3 (US1 cadastro) → validar independente
3. Phases 4–5 (US2 entrada + US3 saída) → **MVP real**: ciclo completo de estoque com FEFO e trava de saldo
4. Parar e validar com o quickstart (passos 1–7)

### Incremental Delivery

- Cada checkpoint é um estado demonstrável; commits por tarefa ou grupo lógico na branch `feat/modulo-estoque`
- Deploy único ao final da Fase 1 do rollout (migration + generate no servidor — bloco do quickstart, **rode no servidor**)

### Notas

- Zod compartilhado (`shared/schemas/estoque.js`) é o contrato vivo entre T003 e todos os formulários — mudanças nele exigem revisar backend e frontend
- Nenhuma tarefa altera módulos existentes além dos pontos listados (registry, auth.js, routes/index.js, app.js, moduleRoutes.tsx) — blast radius contido
