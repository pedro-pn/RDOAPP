# Tasks: Filtros de Período na Aba Sede do Acompanhamento

**Input**: Design documents from `/specs/004-sede-filtros-periodo/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/sede-api.md, quickstart.md

**Tests**: Incluídos — a constitution (Princípio V) exige testes em `backend/test` para regra de negócio nova; `buildSedeCostCards` é função pura já coberta por suíte existente.

**Organization**: Fases por user story: US1 (P1 — filtros fixos), US2 (P2 — período personalizado).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1/US2, mapeando as user stories da spec

## Path Conventions

Web app: `backend/src/`, `backend/test/`, `frontend/src/` (estrutura existente — sem projeto novo, sem migration).

---

## Phase 1: Setup

**Purpose**: Preparação mínima — mudança encaixada em 4 arquivos existentes + 1 helper novo.

- [X] T001 Criar branch `feat/004-sede-filtros-periodo` a partir de `main` (constitution: todo trabalho em branch de feature)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Recorte por intervalo no backend + contrato da API — base única para US1 e US2 (todo tipo de período vira `from`/`to`).

**⚠️ CRITICAL**: US1 e US2 dependem destas tarefas.

- [X] T002 Estender `backend/test/acompanhamento-sede-costs.test.js` (escrever antes e confirmar que falha): `buildSedeCostCards` com `range { fromMonth, toMonth }` restringe `summary`, `total/paidTotal/openTotal/count/lastPurchaseDate/monthly/topCategories` de cada card ao intervalo; lançamentos `'sem-data'` entram sem `range` e ficam fora com `range`; `availableMonths` retorna os meses do conjunto completo ordenados (mesmo com `range` ativo); sem `range` → resultado idêntico ao atual exceto `availableMonths` (SC-003); Σ `cards[].total` = `summary.total` com filtro (SC-001)
- [X] T003 Implementar em `backend/src/lib/acompanhamento/sede-costs.js`: opção `range` em `buildSedeCostCards` (descartar no loop de agregação as linhas com `monthKey(purchaseDate(row))` fora de `[fromMonth, toMonth]` ou `'sem-data'` quando houver `range`; comparação lexicográfica de `YYYY-MM`), campo `availableMonths` no retorno (Set dos monthKeys ≠ `'sem-data'` de todas as linhas, antes do filtro, ordenado) e repasse do `range` em `listSedeCosts({ range })`; rodar T002 até verde
- [X] T004 Estender `GET /sede` em `backend/src/routes/resources/acompanhamento-comercial.js` (~linha 159): schema Zod da query — `from`/`to` regex `^\d{4}-(0[1-9]|1[0-2])$`, par atômico (um sem o outro = 400), superRefine `from <= to` com mensagem "Período inválido: mês final anterior ao inicial."; converter para `range` e passar a `listSedeCosts`; sem params = chamada atual (contrato: `contracts/sede-api.md`)
- [X] T005 [P] Estender `frontend/src/api/acompanhamentoComercial.ts`: `availableMonths: string[]` em `SedeCostsResponse` e parâmetro opcional `{ from, to }` em `getSedeCosts` (montar query string apenas quando presente)

**Checkpoint**: API filtrável por intervalo, retrocompatível — UI pode começar.

---

## Phase 3: User Story 1 - Filtrar custos da Sede por período (Priority: P1) 🎯 MVP

**Goal**: Barra de filtros (Todo o período / Mês / Trimestre / Semestre / Ano) no padrão visual do módulo, recortando KPIs, cards e categorias.

**Independent Test**: Selecionar "Mês → Março/2026" e conferir KPIs/cards só com março (valores batendo com a linha do mês na visão sem filtro); "Todo o período" restaura os números atuais.

### Implementation for User Story 1

- [X] T006 [P] [US1] Criar helpers puros em `frontend/src/utils/sedePeriods.ts`: derivar de `availableMonths` as opções de mês/trimestre/semestre/ano (só períodos com dados — FR-004); converter seleção → `{ from, to }` (trimestres T1–T4 e semestres S1/S2 civis; ano = jan–dez); rótulos pt-BR ("Março/2026", "1º trimestre 2026", "1º semestre 2026", "2025") — FR-009
- [X] T007 [US1] Adicionar barra de filtros em `frontend/src/components/projects/SedeCostsBoard.tsx`: `page-card acp-filters` com dois `field-group` (select "Período" com os tipos; select contextual com os períodos do tipo, derivados de T006), copiando o padrão de `AcompanhamentoDashboard.tsx:129-165`; estado local `useState` (tipo + seleção); troca de tipo reseta para o período mais recente disponível; `useQuery({ queryKey: ['sede-costs', from ?? null, to ?? null] })` chamando `getSedeCosts` com o intervalo
- [X] T008 [US1] Ajustar exibição filtrada no `SedeCostsBoard.tsx`: 3º KPI mostra rótulo do período selecionado + `summary.total` quando há filtro (sem filtro, mês corrente como hoje — FR-005/SC-003); lista "Meses recentes" do card mostra os meses do período; estados vazios com as mensagens padrão existentes ("Sem custos lançados.", "Sem categorias.")
- [X] T009 [US1] Validar cenários US1 do `specs/004-sede-filtros-periodo/quickstart.md` (passos 1–6): paridade mês filtrado vs linha mensal (SC-002), Σ cards = KPI Total (SC-001), retorno a "Todo o período" idêntico ao atual

**Checkpoint**: MVP — filtros fixos funcionais de ponta a ponta.

---

## Phase 4: User Story 2 - Período personalizado (Priority: P2)

**Goal**: Tipo "Personalizado" com intervalo de meses (de/até), limitado aos meses com dados.

**Independent Test**: De = out/2025, até = fev/2026 → agregados dos 5 meses com rótulo "Out/2025 – Fev/2026"; até < de bloqueado com mensagem clara.

### Tests for User Story 2

- [X] T010 [P] [US2] Acrescentar em `backend/test/acompanhamento-sede-costs.test.js` (ou teste da rota, se houver padrão supertest) os casos de validação da query: `to < from` → 400 com mensagem pt-BR; `from` sem `to` → 400; mês inválido (`2026-13`) → 400 (valida o schema de T004)

### Implementation for User Story 2

- [X] T011 [US2] Adicionar tipo "Personalizado" em `frontend/src/components/projects/SedeCostsBoard.tsx` + helpers em `frontend/src/utils/sedePeriods.ts`: dois selects de mês (de/até) com opções de `availableMonths`, validação client-side `até >= de` (mensagem pt-BR, aplicar só com par válido), rótulo "Out/2025 – Fev/2026" no KPI

**Checkpoint**: Todos os tipos de período funcionais.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T012 Passada visual (constitution II/VI): filtros empilhando em ≤900px/≤600px sem scroll horizontal (grid `.acp-filters` de `frontend/src/styles/base.css:1735`), selects estilizados (não crus), nenhum hex/px novo fora dos tokens de `frontend/src/styles/variables.css`
- [X] T013 [P] Rodar suíte completa `cd backend && npm test` — zero regressão (atenção a `acompanhamento-sede-costs.test.js` e demais `acompanhamento-*`)
- [X] T014 Executar validação completa do `specs/004-sede-filtros-periodo/quickstart.md` (US1, US2 e regressões, incluindo comparação do JSON da API sem filtro antes/depois) e marcar os constitution gates no final do arquivo

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências
- **Foundational (Phase 2)**: depois de Setup; T002 antes de T003 (teste primeiro); T004 depois de T003; T005 em paralelo com T002–T004 (arquivo frontend)
- **US1 (Phase 3)**: depois de Foundational; T006 pode começar junto com T005 concluído (depende só do tipo `availableMonths`)
- **US2 (Phase 4)**: depende de US1 (estende a mesma barra de filtros e helpers); T010 depende só de T004
- **Polish (Phase 5)**: depois das stories

### User Story Dependencies

- **US1 (P1)**: só Foundational
- **US2 (P2)**: estende os componentes/helpers da US1; backend já pronto no Foundational

### Within Each User Story

- Teste antes da implementação onde há regra de negócio (T002→T003; T010 valida T004)
- Helpers puros (T006) antes da UI que os consome (T007–T008)

### Parallel Opportunities

- T005 (api client) em paralelo com T002–T004 (backend)
- T006 (helpers puros) em paralelo com T007 iniciando pelo esqueleto da barra
- T010 (testes de validação) em paralelo com T011 (frontend do personalizado)
- T013 em paralelo com T012

---

## Parallel Example: Foundational + US1

```bash
# Dev A (backend):  T002 → T003 → T004
# Dev B (frontend): T005 → T006 → T007 → T008
# Sincronização apenas no final da US1 (T009, validação de ponta a ponta)
```

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1–2 (Setup + Foundational)
2. Phase 3 (US1 — filtros fixos)
3. **PARAR e VALIDAR**: quickstart US1 (paridade SC-002, consistência SC-001, zero regressão SC-003)
4. Entregar (PR para `main`)

### Incremental Delivery

1. MVP (US1) → PR/deploy
2. US2 (personalizado) → teste independente → PR/deploy
3. Polish (T012–T014) no mínimo na última entrega

---

## Notes

- Nenhuma migration Prisma e nenhum comando de servidor nas tarefas (constitution I/IV)
- O shape da resposta é retrocompatível — se alguma tarefa parecer exigir remoção/renomeação de campo, revisar o plan (decisão explícita: campo aditivo `availableMonths` apenas)
- Commit por tarefa ou grupo lógico; parar em qualquer checkpoint para validar a story
