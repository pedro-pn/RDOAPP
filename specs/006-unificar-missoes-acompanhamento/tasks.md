# Tasks: Unificar Missões no Acompanhamento

**Input**: Design documents from `/specs/006-unificar-missoes-acompanhamento/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Incluídos para backend porque a constitution exige testes para lógica de negócio e o plano/quickstart definem cenários de agregação, validação e desmesclagem.

**Organization**: Tarefas agrupadas por user story para permitir implementação e validação incremental.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo com outras tarefas da mesma fase quando não toca o mesmo arquivo nem depende de tarefa incompleta.
- **[Story]**: identifica a história do spec (`US1`, `US2`, `US3`).
- Todas as tarefas citam caminhos concretos do repositório.
- Tarefas de UI citam as classes/componentes compartilhados exigidos pelo contrato visual.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Criar os arquivos-base planejados sem ainda implementar comportamento de user story.

- [X] T001 Create backend mission group module files in `backend/src/lib/acompanhamento/mission-groups.js`, `backend/src/lib/acompanhamento/project-card-groups.js`, and `backend/src/lib/acompanhamento/dashboard-groups.js`
- [X] T002 [P] Create backend test placeholders in `backend/test/acompanhamento-mission-groups.test.js`, `backend/test/acompanhamento-project-card-groups.test.js`, and `backend/test/acompanhamento-dashboard-groups.test.js`
- [X] T003 [P] Add frontend `PROJECT`/`GROUP` union type placeholders for dashboard and project cards in `frontend/src/api/acompanhamentoComercial.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Persistência, contratos base e helpers compartilhados que bloqueiam todas as histórias.

**CRITICAL**: Nenhuma user story deve começar antes desta fase estar completa.

- [X] T004 Add `AcompanhamentoMissionGroupStatus`, `AcompanhamentoMissionGroup`, and `AcompanhamentoMissionGroupMember` models plus `Project`/`User` relations in `backend/prisma/schema.prisma`
- [X] T005 Add Prisma migration for mission groups and active membership uniqueness in `backend/prisma/migrations/20260716000000_acompanhamento_mission_groups/migration.sql`
- [X] T006 [P] Add shared numeric aggregation helpers for sums, ratios, weighted progress, status precedence, date min/max, and alert union in `backend/src/lib/acompanhamento/project-card-groups.js`
- [X] T007 [P] Add dashboard aggregation helper shells for grouping dashboard rows and omitting grouped children in `backend/src/lib/acompanhamento/dashboard-groups.js`
- [X] T008 Add Zod schemas for mission group list/create/rename requests in `backend/src/routes/resources/acompanhamento-comercial.js`
- [X] T009 Add mission group response serializer and active group loader in `backend/src/lib/acompanhamento/mission-groups.js`
- [X] T010 Update frontend API contracts for `MissionGroupResponse`, `CreateMissionGroupRequest`, `DashboardGroupRow`, and `MissionGroupCard` in `frontend/src/api/acompanhamentoComercial.ts`

**Checkpoint**: Banco, contratos e helpers compartilhados prontos para implementar histórias.

---

## Phase 3: User Story 1 - Unificar missões selecionadas (Priority: P1) MVP

**Goal**: Gestor seleciona duas ou mais missões na aba Projetos, cria um agrupamento persistente, vê um card consolidado e os cards individuais ficam ocultos. O Dashboard também passa a exibir o grupo no lugar dos filhos.

**Independent Test**: Com três missões visíveis, selecionar duas, acionar "Unificar selecionadas", confirmar que aparece um card consolidado com os dois códigos, que os cards individuais somem, que a terceira missão permanece separada e que o Dashboard não duplica grupo + filhos.

### Tests for User Story 1

> Escrever estes testes antes da implementação da história e confirmar que falham.

- [X] T011 [P] [US1] Add mission group creation tests for minimum members, generated name, missing projects, duplicate project IDs, and already grouped project rejection in `backend/test/acompanhamento-mission-groups.test.js`
- [X] T012 [P] [US1] Add project card grouping tests for hiding child cards, member listing, monetary sums, ratio recalculation, category precedence, weighted progress, and alert union in `backend/test/acompanhamento-project-card-groups.test.js`
- [X] T013 [P] [US1] Add dashboard grouping tests for hiding child rows, grouped member search fields, component sums, expected margin recalculation, and category-filtered inputs in `backend/test/acompanhamento-dashboard-groups.test.js`

### Implementation for User Story 1

- [X] T014 [US1] Implement `createMissionGroup`, `listMissionGroups`, generated naming, project existence checks, active membership checks, and transaction boundaries in `backend/src/lib/acompanhamento/mission-groups.js`
- [X] T015 [US1] Implement `groupProjectCards` to produce `MissionGroupCard` items and omit child project cards in `backend/src/lib/acompanhamento/project-card-groups.js`
- [X] T016 [US1] Implement `groupDashboardRows` to produce `DashboardGroupRow` items and omit child dashboard rows in `backend/src/lib/acompanhamento/dashboard-groups.js`
- [X] T017 [US1] Wire `GET /grupos-missoes`, `POST /grupos-missoes`, grouped `GET /projetos-cards`, and grouped `GET /dashboard` in `backend/src/routes/resources/acompanhamento-comercial.js`
- [X] T018 [US1] Add frontend API functions `listMissionGroups`, `createMissionGroup`, updated `getProjectCards`, and updated `getCommercialDashboard` return types in `frontend/src/api/acompanhamentoComercial.ts`
- [X] T019 [US1] Add selection mode, selected-card state, disabled state for fewer than two selected cards, and query invalidation after creation in `frontend/src/components/projects/ProjectCardsBoard.tsx` using `page-card acp-filters`, `field-group`, `acp-seg`, and `acp-pcard`
- [X] T020 [US1] Render `MissionGroupCard` with group name, member mission list, consolidated metrics, member progress values, and grouped-detail open action in `frontend/src/components/projects/ProjectCardsBoard.tsx` using existing `.acp-pcard-*` metric classes
- [X] T021 [US1] Update dashboard filtering, KPIs, chart rows, table rows, and search text to support `DashboardGroupRow` without duplicating child rows in `frontend/src/components/projects/AcompanhamentoDashboard.tsx`
- [X] T022 [US1] Add selected card and group card styles using existing tokens in `frontend/src/styles/base.css`
- [X] T023 [US1] Ensure user-facing labels, empty states, and validation messages for group creation are pt-BR in `frontend/src/components/projects/ProjectCardsBoard.tsx`

**Checkpoint**: US1 funcional e testável de forma independente.

---

## Phase 4: User Story 2 - Desmesclar missões agrupadas (Priority: P1)

**Goal**: Gestor desfaz um agrupamento ativo pelo card consolidado; o grupo deixa de afetar as visualizações e as missões voltam como cards/linhas individuais.

**Independent Test**: Com um agrupamento ativo, acionar "Desmesclar", confirmar a ação, recarregar a listagem e verificar que o card consolidado sumiu e os cards/linhas individuais retornaram com os mesmos indicadores.

### Tests for User Story 2

> Escrever estes testes antes da implementação da história e confirmar que falham.

- [X] T024 [P] [US2] Add dissolve tests for clearing `activeProjectId`, preserving historical members, rejecting already dissolved groups, and allowing regroup after dissolve in `backend/test/acompanhamento-mission-groups.test.js`
- [X] T025 [P] [US2] Add grouped card regression test proving dissolved groups no longer hide child project cards in `backend/test/acompanhamento-project-card-groups.test.js`
- [X] T026 [P] [US2] Add grouped dashboard regression test proving dissolved groups no longer hide child dashboard rows in `backend/test/acompanhamento-dashboard-groups.test.js`

### Implementation for User Story 2

- [X] T027 [US2] Implement `dissolveMissionGroup` and `renameMissionGroup` with active-status validation and audit fields in `backend/src/lib/acompanhamento/mission-groups.js`
- [X] T028 [US2] Wire `PATCH /grupos-missoes/:groupId` and `POST /grupos-missoes/:groupId/desmesclar` with `requireAcompanhamentoManager` in `backend/src/routes/resources/acompanhamento-comercial.js`
- [X] T029 [US2] Add frontend API functions `renameMissionGroup` and `dissolveMissionGroup` in `frontend/src/api/acompanhamentoComercial.ts`
- [X] T030 [US2] Add "Desmesclar" action, shared confirmation dialog, loading state, error state, and query invalidation to grouped cards in `frontend/src/components/projects/ProjectCardsBoard.tsx` using `ConfirmDialog`/shared modal patterns from `frontend/src/components/ui/`
- [X] T031 [US2] Prevent grouped cards from entering selection mode and clear stale selected IDs after create/desmesclar in `frontend/src/components/projects/ProjectCardsBoard.tsx`
- [X] T032 [US2] Add pt-BR success/error copy for desmesclar and renamed-group failures in `frontend/src/components/projects/ProjectCardsBoard.tsx`

**Checkpoint**: US1 e US2 funcionam juntas; a operação é reversível.

---

## Phase 5: User Story 3 - Preservar independência dos cálculos e demais módulos (Priority: P2)

**Goal**: Agrupamentos afetam somente Acompanhamento; missões continuam acessíveis e calculadas individualmente, sem alterar relatórios, RDOs, Omie ou detalhes individuais.

**Independent Test**: Com um agrupamento ativo, abrir detalhe individual de uma missão integrante e verificar que identidade, relatórios/RDOs e dados individuais continuam iguais; o card consolidado deve refletir atualizações ao recompor a partir dos dados individuais atuais.

### Tests for User Story 3

> Escrever estes testes antes da implementação da história e confirmar que falham.

- [X] T033 [P] [US3] Add purity tests proving card grouping does not mutate original individual card objects and preserves member `projectId` references in `backend/test/acompanhamento-project-card-groups.test.js`
- [X] T034 [P] [US3] Add purity tests proving dashboard grouping does not mutate original dashboard rows and preserves member `projectId` references in `backend/test/acompanhamento-dashboard-groups.test.js`
- [X] T035 [P] [US3] Add service regression tests proving create/desmesclar never changes `Project`, `Report`, `OmiePurchase`, or `OmieReceivable` data in `backend/test/acompanhamento-mission-groups.test.js`

### Implementation for User Story 3

- [X] T036 [US3] Ensure `groupProjectCards` exposes member metadata and member-open targets without replacing individual project IDs in `backend/src/lib/acompanhamento/project-card-groups.js`
- [X] T037 [US3] Ensure `groupDashboardRows` marks grouped rows with `kind: 'GROUP'` and never assigns a child `projectId` as the row identity in `backend/src/lib/acompanhamento/dashboard-groups.js`
- [X] T038 [US3] Update group card click handling so the group opens a consolidated `ProjectDetailDashboard` by `groupId` in `frontend/src/components/projects/ProjectCardsBoard.tsx`
- [X] T039 [US3] Update grouped dashboard rows so clicking a group does not open the cronograma modal for a child project and member context remains visible in `frontend/src/components/projects/AcompanhamentoDashboard.tsx`
- [X] T040 [US3] Review Acompanhamento route changes to confirm no grouping logic was added to project detail, progress, planned scope, report, RDO, Omie import, or Sede endpoints in `backend/src/routes/resources/acompanhamento-comercial.js`

**Checkpoint**: Todos os fluxos preservam a independência dos dados individuais.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validação final, acabamento visual e documentação operacional.

- [X] T041 [P] Update implementation notes and any changed validation details in `specs/006-unificar-missoes-acompanhamento/quickstart.md`
- [X] T042 Run backend tests for mission grouping and existing acompanhamento coverage with `npm test` from `backend/package.json`
- [X] T043 Run frontend production build validation with `npm run build` from `frontend/package.json`
- [X] T044 Verify `ProjectCardsBoard` selection/group/desmesclar UI at desktop and mobile widths, checking no horizontal page scroll and shared `acp-filters`/`acp-pcard` styles in `frontend/src/components/projects/ProjectCardsBoard.tsx`
- [X] T045 Verify grouped dashboard UI at desktop and mobile widths, checking table/card responsiveness and no invalid cronograma modal for grouped rows in `frontend/src/components/projects/AcompanhamentoDashboard.tsx`
- [X] T046 [P] Remove stale comments, unused types, and duplicated aggregation helpers from `backend/src/lib/acompanhamento/mission-groups.js`, `backend/src/lib/acompanhamento/project-card-groups.js`, and `backend/src/lib/acompanhamento/dashboard-groups.js`
- [X] T047 Confirm Prisma schema and generated client expectations remain consistent for local validation in `backend/prisma/schema.prisma`

---

## Phase 7: Feedback Finalization

**Purpose**: Fechar ajustes observados em uso real após a primeira implementação.

- [X] T048 Compare grouped client identity by CNPJ before client name across mission group creation, dashboard grouping, card grouping, and grouped detail in `backend/src/lib/acompanhamento/client-identity.js`, `backend/src/lib/acompanhamento/mission-groups.js`, `backend/src/lib/acompanhamento/dashboard-groups.js`, `backend/src/lib/acompanhamento/project-card-groups.js`, and `backend/src/lib/acompanhamento/project-detail-groups.js`
- [X] T049 Keep individual project schedules editable from grouped detail by adding per-member "Cronograma" actions in `frontend/src/components/projects/ProjectDetailDashboard.tsx`
- [X] T050 Recalculate grouped progress from aggregated physical scope breakdown when available, with weighted fallback, in `backend/src/lib/acompanhamento/progress-groups.js`, `backend/src/lib/acompanhamento/access-import.js`, and `backend/src/lib/acompanhamento/project-detail-groups.js`
- [X] T051 Propagate `clientCnpj`, grouped progress method, and progress weight through backend responses and frontend API types in `frontend/src/api/acompanhamentoComercial.ts`
- [X] T052 Validate final feedback changes with focused grouping tests, full backend test suite, frontend build, and whitespace check

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências.
- **Foundational (Phase 2)**: Depende de Setup e bloqueia todas as user stories.
- **US1 (Phase 3)**: Depende da Foundational; entrega o MVP de criação e visualização consolidada.
- **US2 (Phase 4)**: Depende da Foundational e pode ser testada com fixture de grupo ativo; para demo de produto, executar depois de US1.
- **US3 (Phase 5)**: Depende da Foundational; valida e fecha a garantia de independência dos dados, integrando com UI de US1.
- **Polish (Phase 6)**: Depende das histórias desejadas completas.

### User Story Dependencies

- **US1 (P1)**: Pode começar após Phase 2; não depende de US2/US3.
- **US2 (P1)**: Pode começar após Phase 2 usando fixtures, mas depende de um grupo ativo para teste manual.
- **US3 (P2)**: Pode começar após Phase 2 com fixtures, mas parte da UI depende do card consolidado de US1.

### Within Each User Story

- Testes backend primeiro, falhando antes da implementação.
- Serviços/agregadores backend antes de rotas.
- Rotas/API frontend antes da UI.
- UI base antes de acabamento CSS.
- Validar checkpoint antes de avançar para a próxima prioridade.

### Parallel Opportunities

- T002 e T003 podem rodar em paralelo após T001.
- T006 e T007 podem rodar em paralelo após T001.
- Testes T011, T012 e T013 podem ser escritos em paralelo.
- Agregadores T015 e T016 podem ser implementados em paralelo após T014 definir o shape dos grupos.
- Testes T024, T025 e T026 podem ser escritos em paralelo.
- Testes T033, T034 e T035 podem ser escritos em paralelo.
- Polish T041 e T046 podem rodar em paralelo com validações T042/T043 se a implementação já estiver estável.

---

## Parallel Example: User Story 1

```text
Task: "Add mission group creation tests for minimum members, generated name, missing projects, duplicate project IDs, and already grouped project rejection in backend/test/acompanhamento-mission-groups.test.js"
Task: "Add project card grouping tests for hiding child cards, member listing, monetary sums, ratio recalculation, category precedence, weighted progress, and alert union in backend/test/acompanhamento-project-card-groups.test.js"
Task: "Add dashboard grouping tests for hiding child rows, grouped member search fields, component sums, expected margin recalculation, and category-filtered inputs in backend/test/acompanhamento-dashboard-groups.test.js"
```

```text
Task: "Implement groupProjectCards to produce MissionGroupCard items and omit child project cards in backend/src/lib/acompanhamento/project-card-groups.js"
Task: "Implement groupDashboardRows to produce DashboardGroupRow items and omit child dashboard rows in backend/src/lib/acompanhamento/dashboard-groups.js"
```

## Parallel Example: User Story 2

```text
Task: "Add dissolve tests for clearing activeProjectId, preserving historical members, rejecting already dissolved groups, and allowing regroup after dissolve in backend/test/acompanhamento-mission-groups.test.js"
Task: "Add grouped card regression test proving dissolved groups no longer hide child project cards in backend/test/acompanhamento-project-card-groups.test.js"
Task: "Add grouped dashboard regression test proving dissolved groups no longer hide child dashboard rows in backend/test/acompanhamento-dashboard-groups.test.js"
```

## Parallel Example: User Story 3

```text
Task: "Add purity tests proving card grouping does not mutate original individual card objects and preserves member projectId references in backend/test/acompanhamento-project-card-groups.test.js"
Task: "Add purity tests proving dashboard grouping does not mutate original dashboard rows and preserves member projectId references in backend/test/acompanhamento-dashboard-groups.test.js"
Task: "Add service regression tests proving create/desmesclar never changes Project, Report, OmiePurchase, or OmieReceivable data in backend/test/acompanhamento-mission-groups.test.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: US1.
4. Stop and validate: create a group from selected cards, verify consolidated card and grouped dashboard row.

### Production-Safe First Slice

Because reversibility is also P1, the first production-ready slice should include:

1. Phase 1 + Phase 2.
2. US1: create and display grouped missions.
3. US2: desmesclar grouped missions.
4. Backend tests and frontend build from Phase 6.

### Incremental Delivery

1. Setup + Foundational -> persistence and contracts ready.
2. US1 -> grouping appears and hides child cards/rows.
3. US2 -> grouping becomes reversible.
4. US3 -> independence guarantees and detail navigation finalized.
5. Polish -> visual/responsive and validation pass.

### Parallel Team Strategy

With multiple developers after Phase 2:

1. Developer A: US1 backend creation + card/dashboard aggregation.
2. Developer B: US2 dissolve/rename service and confirmation UI.
3. Developer C: US3 purity/regression tests and detail/dashboard guardrails.

---

## Notes

- `[P]` tasks touch different files or can be done after their stated prerequisites without file conflicts.
- `[US1]`, `[US2]`, `[US3]` labels map directly to the spec user stories.
- Keep grouping as an Acompanhamento overlay; do not alter `Project`, `Report`, `OmiePurchase`, `OmieReceivable`, RDO, or report-generation behavior.
- Use `requireAcompanhamentoAccess` for reads and `requireAcompanhamentoManager` for create/rename/desmesclar.
- Use shared UI patterns: `page-card acp-filters`, `field-group`, `acp-seg`, `acp-pcards-grid`, `acp-pcard`, `.acp-pcard-*`, and shared confirmation dialog/modal components from `frontend/src/components/ui/`.
