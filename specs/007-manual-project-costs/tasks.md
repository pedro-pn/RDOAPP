# Tasks: Custos manuais no Acompanhamento

**Input**: Design documents from `specs/007-manual-project-costs/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Inclui testes porque a feature altera persistência, permissão, API e cálculos financeiros.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar o contrato persistido e os tipos compartilhados.

- [X] T001 Create Prisma model `ProjectManualCost` in `backend/prisma/schema.prisma`
- [X] T002 Create migration `backend/prisma/migrations/20260721133000_add_project_manual_costs/migration.sql`
- [X] T003 [P] Extend frontend API types in `frontend/src/api/acompanhamentoComercial.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implementar serviço de domínio e validação reutilizável antes das histórias.

- [X] T004 Implement manual cost normalization and summarization in `backend/src/lib/acompanhamento/manual-costs.js`
- [X] T005 [P] Add backend unit tests in `backend/test/acompanhamento-manual-costs.test.js`
- [X] T006 Wire manual cost totals into dashboard rows in `backend/src/lib/acompanhamento/access-import.js`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Lançar custo manual em um projeto (Priority: P1) MVP

**Goal**: Gestor cria custo manual a partir de uma missão individual.

**Independent Test**: POST válido cria registro com projeto, valor normalizado e criador; usuário sem permissão recebe 403.

- [X] T007 [US1] Add `POST /projetos/:projectId/custos-manuais` in `backend/src/routes/resources/acompanhamento-comercial.js`
- [X] T008 [US1] Add Zod validation for manual cost payload in `backend/src/routes/resources/acompanhamento-comercial.js`
- [X] T009 [P] [US1] Add HTTP route tests for create and permission in `backend/test/acompanhamento-manual-costs.test.js`
- [X] T010 [US1] Add frontend create API helper in `frontend/src/api/acompanhamentoComercial.ts`
- [X] T011 [US1] Add RHF/Zod form in `frontend/src/components/projects/ProjectDetailDashboard.tsx`

**Checkpoint**: User Story 1 functional and independently testable.

---

## Phase 4: User Story 2 - Considerar custo manual nos totais (Priority: P1)

**Goal**: Totais de cards, dashboard, detalhe e agrupamentos refletem custos manuais ativos.

**Independent Test**: Agregações somam manual ao realizado e preservam Omie separado.

- [X] T012 [US2] Add manual cost total to project cards in `backend/src/lib/acompanhamento/project-cards.js`
- [X] T013 [US2] Add manual cost total and categories to project detail in `backend/src/lib/acompanhamento/project-detail.js`
- [X] T014 [US2] Add grouped manual cost aggregation in `backend/src/lib/acompanhamento/dashboard-groups.js`
- [X] T015 [US2] Add grouped manual cost aggregation in `backend/src/lib/acompanhamento/project-card-groups.js`
- [X] T016 [US2] Add grouped manual cost detail list in `backend/src/lib/acompanhamento/project-detail-groups.js`
- [X] T017 [P] [US2] Add aggregation tests in `backend/test/acompanhamento-access-import.test.js`
- [X] T018 [P] [US2] Add grouping tests in `backend/test/acompanhamento-dashboard-groups.test.js`
- [X] T019 [P] [US2] Add project card grouping tests in `backend/test/acompanhamento-project-card-groups.test.js`
- [X] T020 [P] [US2] Add project detail grouping tests in `backend/test/acompanhamento-project-detail-groups.test.js`

**Checkpoint**: User Story 2 functional and independently testable.

---

## Phase 5: User Story 3 - Remover lançamento incorreto (Priority: P2)

**Goal**: Gestor remove custo manual por soft delete.

**Independent Test**: DELETE marca `deletedAt` e retorna `{ ok: true, id }`; custo removido deixa de aparecer nos totais.

- [X] T021 [US3] Add `DELETE /projetos/:projectId/custos-manuais/:costId` in `backend/src/routes/resources/acompanhamento-comercial.js`
- [X] T022 [P] [US3] Add soft delete route test in `backend/test/acompanhamento-manual-costs.test.js`
- [X] T023 [US3] Add frontend delete API helper in `frontend/src/api/acompanhamentoComercial.ts`
- [X] T024 [US3] Add delete action and query invalidation in `frontend/src/components/projects/ProjectDetailDashboard.tsx`

**Checkpoint**: User Story 3 functional and independently testable.

---

## Phase 6: User Story 4 - Descobrir o novo recurso (Priority: P3)

**Goal**: Gestores recebem campanha temporária de novidade do novo recurso.

**Independent Test**: Antes de 2026-07-31, aviso aparece uma vez por usuário/browser; após a data, não aparece.

- [X] T025 [US4] Add novelty storage helpers and expiration in `frontend/src/auth/moduleNavigation.ts`
- [X] T026 [US4] Add Driver.js novelty component in `frontend/src/components/projects/ProjectManualCostNovelty.tsx`
- [X] T027 [US4] Attach tutorial target to manual cost block in `frontend/src/components/projects/ProjectDetailDashboard.tsx`
- [X] T028 [P] [US4] Add novelty expiration test in `frontend/test/route-access.test.mjs`

**Checkpoint**: User Story 4 functional and independently testable.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T029 [P] Add responsive/mobile overflow styles in `frontend/src/styles/base.css`
- [X] T030 [P] Run `npm run prisma:generate` in `backend/`
- [X] T031 [P] Run `npm test` in `backend/`
- [X] T032 [P] Run `npm test`, `npm run lint`, and `npm run build` in `frontend/`
- [X] T033 Run `npm run architecture:check`
- [X] T034 Run `git diff --check`
- [X] T035 Verify `.specify/memory/constitution.md` and document compliance in `specs/007-manual-project-costs/plan.md`
- [X] T036 Add collapsed manual cost form toggle in `frontend/src/components/projects/ProjectDetailDashboard.tsx`
- [X] T037 Add BRL currency mask for manual cost amount in `frontend/src/components/projects/ProjectDetailDashboard.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup completion.
- **User Stories (Phase 3-6)**: Depend on Foundation; US2 depends on manual cost aggregation from T004/T006.
- **Polish (Phase 7)**: Depends on all implemented user stories.

### Parallel Opportunities

- T003 can run alongside backend schema work after model shape is known.
- T017-T020 can run in parallel because they touch separate test files.
- T025-T028 can run after UI target exists.

## Implementation Strategy

### MVP First

1. Persist `ProjectManualCost`.
2. Add create endpoint and service validation.
3. Add UI form in the project dashboard.
4. Validate with focused tests.

### Incremental Delivery

1. Add totals in cards/dashboard/detail.
2. Add delete/soft delete.
3. Add novelty campaign and mobile polish.
4. Run full backend/frontend/architecture checks.
