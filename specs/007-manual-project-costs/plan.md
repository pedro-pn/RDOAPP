# Implementation Plan: Custos manuais no Acompanhamento

**Branch**: `feature/acompanhamento-manual-project-cost` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-manual-project-costs/spec.md`

## Summary

Adicionar lançamentos manuais de custo no dashboard de projeto do Acompanhamento. A solução cria uma entidade persistida via Prisma, expõe endpoints restritos a gestores, soma o total manual aos indicadores já existentes sem alterar o valor Omie separado, exibe/lista os lançamentos no detalhe do projeto e inclui campanha Driver.js de novidade por 10 dias.

## Technical Context

**Language/Version**: Node.js + Express no backend; React + Vite + TypeScript no frontend

**Primary Dependencies**: Prisma, PostgreSQL, Zod, @tanstack/react-query, react-hook-form, driver.js

**Storage**: PostgreSQL via Prisma migration versionada

**Testing**: `node --test` no backend e frontend; `eslint`; `tsc -b`; `vite build`; `scripts/architecture-check.mjs`

**Target Platform**: Aplicação web NewRDO/FiltroAPP

**Project Type**: Web app com backend API e frontend React

**Performance Goals**: Buscar custos manuais em lote por projeto junto do dashboard para evitar consulta N+1; atualização local deve refletir após invalidar queries.

**Constraints**: Sem comandos de deploy/servidor; sem SQL manual direto no banco; UI pt-BR; sem scroll horizontal mobile; permissão restrita a gestor do Acompanhamento para mutações.

**Scale/Scope**: Lançamentos manuais raros por projeto, primeira versão sem paginação dedicada.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Server operations/deploy commands are not executed by the agent; any such command is
  documented for the human operator to run on the server. **PASS**: sem deploy, Docker de servidor ou manutenção de produção/staging.
- UI is pt-BR and mobile-first: wide tables have mobile alternatives, modals have fixed
  action footers and no page-level horizontal scroll. Card grids must fit the useful
  mobile width (e.g., `minmax(min(100%, ...), 1fr)` or equivalent), flex/grid children
  must be allowed to shrink (`min-width: 0`), and long values/badges/actions must not
  widen the viewport. Tabs, segmented controls and tab-like filters must wrap, use a
  responsive grid, scroll internally by design, or switch to a mobile select/menu
  without widening the page. **PASS**: textos em pt-BR; lista e formulário empilham no mobile; grid/flex recebem `min-width: 0`.
- Forms and APIs use Zod-compatible validation on frontend and backend. **PASS**: rota usa Zod; formulário usa `react-hook-form` com resolver Zod.
- Schema changes are represented by Prisma migrations and never by ad hoc database edits. **PASS**: `backend/prisma/migrations/20260721133000_add_project_manual_costs/migration.sql`.
- Backend business logic has tests in `backend/test` when the feature adds or changes
  rules. **PASS**: testes de normalização, agregação, rotas HTTP, permissões e integração com totais.
- Visual consistency uses `frontend/src/components/ui/` and design tokens. Native
  `select` fields, custom dropdowns/comboboxes and multiselects must match the app
  standard states (default, focus, disabled, error, mobile), and desktop modules with
  dashboards/tables/forms must use the wide module shell pattern. **PASS**: usa classes e componentes existentes do dashboard; nenhum dropdown novo; formulário recolhido por padrão para reduzir poluição visual.
- New user-facing functions include the temporary novelty campaign when applicable:
  Driver.js-style centered novelty card, localStorage seen marker per user/browser,
  global expiration exactly 10 days after implementation date, and a guided tutorial
  for the first access to the new function during that same window. New modules keep
  permanent first-access module onboarding; functions inside existing modules do not. **PASS**: `ProjectManualCostNovelty` e chaves em `moduleNavigation.ts` expiram em 2026-07-31.
- Module-internal navigation persists across refresh: tabs, side sections, tab-like
  filters and detail views that replace a list are represented by URL/query params
  whenever the state is shareable and non-sensitive, with incompatible params cleaned
  when changing sections. **PASS**: sem navegação interna nova; o detalhe usa o fluxo existente.

**Required visual evidence when frontend changes are present:**

| Surface | Existing reference audited | Shared component/classes | Field/dropdown states covered | Navigation persistence | Novelty/tutorial plan | Mobile/desktop overflow evidence |
|---------|----------------------------|--------------------------|-------------------------------|------------------------|------------------------|----------------------------------|
| Custos manuais no dashboard do projeto | `ProjectDetailDashboard.tsx`, `ProjectProgressHistoryNovelty.tsx`, formulários do Estoque com RHF/Zod | `mini-btn`, `field-group`, `form-error`, `.page-card`, tokens `--br`, `--rs`, `--bg`, `--mu` | default, required, disabled em submit/delete, erro por campo, empty state, máscara monetária `R$ 1.234,56`, formulário recolhido por padrão, descrição full, valor/data meio a meio, observação full | N/A, sem navegação nova | Driver.js com localStorage por usuário/browser e expiração 2026-07-31, apontando o botão de adicionar | Lista empilha em 1 coluna; formulário em 1 coluna até 860px; valores/textos/botões usam `overflow-wrap`/`min-width: 0` |

## Project Structure

### Documentation (this feature)

```text
specs/007-manual-project-costs/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── acompanhamento-manual-costs-api.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── prisma/
│   ├── schema.prisma
│   └── migrations/20260721133000_add_project_manual_costs/
├── src/
│   ├── lib/acompanhamento/
│   └── routes/resources/acompanhamento-comercial.js
└── test/

frontend/
├── src/
│   ├── api/acompanhamentoComercial.ts
│   ├── auth/moduleNavigation.ts
│   ├── components/projects/
│   └── styles/base.css
└── test/
```

**Structure Decision**: Reusar o módulo Acompanhamento existente, mantendo regra de negócio em `backend/src/lib/acompanhamento/`, rotas finas em `backend/src/routes/resources/` e UI no dashboard de projeto já existente.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |
