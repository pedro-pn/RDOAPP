# Tasks: Efetivo Operacional — Planejamento Completo

**Input**: Design documents from `/specs/012-planejamento-efetivo/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/efetivo-planning.openapi.yaml`, `quickstart.md`

**Tests**: regras de negócio e contratos são obrigatoriamente cobertos no backend; helpers interativos críticos recebem testes no frontend.

**Organization**: tarefas agrupadas por user story, em prioridade P1 antes de P2, mantendo cada incremento verificável pelos critérios da especificação.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: preparar contratos, scripts e estrutura sem alterar comportamento existente.

- [X] T001 Validar que `specs/012-planejamento-efetivo/contracts/efetivo-planning.openapi.yaml` cobre todos os endpoints e códigos de conflito da feature
- [X] T002 [P] Criar a estrutura vazia de serviços de planejamento em `backend/src/lib/efetivo/planning/`
- [X] T003 [P] Criar os barrels/tipos iniciais do cliente de planejamento em `frontend/src/api/efetivoPlanning.ts`
- [X] T004 Registrar os comandos e a matriz de validação local definitiva em `specs/012-planejamento-efetivo/quickstart.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: persistência, datas, transações, validação, permissão e cliente comum usados por todas as histórias.

**⚠️ CRITICAL**: nenhuma user story começa antes desta fase.

- [X] T005 Modelar `EfetivoPlan`, missão, demanda, alocação, contratação planejada, feriado e auditoria e estender `Collaborator`/`JobRole` em `backend/prisma/schema.prisma`
- [X] T006 Criar migration Prisma versionada com enums, tabelas, FKs, índices, índice parcial de oficial ativo e defaults em `backend/prisma/migrations/20260821180000_add_efetivo_planning/migration.sql`
- [X] T007 Implementar backfill idempotente e inequívoco de `Collaborator.jobRoleId` com modo dry-run/apply em `backend/scripts/backfill-efetivo-job-roles.js`
- [X] T008 [P] Implementar datas civis inclusivas, iteração UTC e sobreposição em `backend/src/lib/efetivo/planning/date-only.js`
- [X] T009 [P] Implementar schemas Zod de query, colaborador, ausência, missão, demanda, alocação, cenário, feriado e configuração em `backend/src/lib/efetivo/planning/schemas.js`
- [X] T010 [P] Implementar erros estruturados com pessoa, período, origem, IDs e caminho navegável em `backend/src/lib/efetivo/planning/errors.js`
- [X] T011 Implementar obtenção/criação do oficial, lock transacional, revisão monotônica e helper CAS em `backend/src/lib/efetivo/planning/plan-context.js`
- [X] T012 Implementar auditoria sanitizada no mesmo transaction client em `backend/src/lib/efetivo/planning/audit.js`
- [X] T013 [P] Ampliar autorização do Efetivo para leitura e gestão das rotas novas em `backend/src/lib/efetivo/access.js`
- [X] T014 Montar router fino `/api/efetivo/planning` com Zod e middlewares de viewer/manager em `backend/src/routes/efetivo-planning.js`
- [X] T015 Registrar o router de planejamento sem alterar contratos existentes em `backend/src/app.js`
- [X] T016 [P] Implementar tipos, normalização de erros e funções HTTP base no cliente `frontend/src/api/efetivoPlanning.ts`
- [X] T017 [P] Implementar `SearchCombobox` acessível com listbox, teclado, toque, loading, vazio, disabled e erro em `frontend/src/components/ui/SearchCombobox.tsx`
- [X] T018 [P] Cobrir datas, schemas e erro estruturado com `node:test` em `backend/test/efetivo-planning-foundation.test.js`
- [X] T019 Validar a migração e geração do Prisma sem aplicar em produção usando `backend/prisma/schema.prisma`

**Checkpoint**: foundation pronta; histórias podem usar o mesmo plano, contratos e regras de data.

---

## Phase 3: User Story 1 — Ver a capacidade operacional em uma data (Priority: P1) 🎯 MVP

**Goal**: entregar KPIs, capacidade/déficit por função, próximas mobilizações e utilização planejada em uma data.

**Independent Test**: montar colaboradores, missão confirmada e ausência e reproduzir os cinco totais e déficits mostrados.

### Tests for User Story 1

- [X] T020 [P] [US1] Escrever testes de dias úteis, feriados, vínculo parcial e conjuntos pessoa-dia em `backend/test/efetivo-capacity.test.js`
- [X] T021 [P] [US1] Escrever testes da janela inclusiva de 90 dias, deduplicação, 0/100% e denominador nulo em `backend/test/efetivo-utilization.test.js`
- [X] T022 [P] [US1] Escrever teste de contrato da visão geral e projetos mínimos em `backend/test/efetivo-planning-overview-routes.test.js`

### Implementation for User Story 1

- [X] T023 [US1] Implementar calendário útil por feriados globais em `backend/src/lib/efetivo/planning/business-days.js`
- [X] T024 [US1] Implementar projeção em lote de estado diário/capacidade/utilização em `backend/src/lib/efetivo/planning/capacity.js`
- [X] T025 [US1] Implementar leitura mínima de projetos e projeção de próximas mobilizações em `backend/src/lib/efetivo/planning/read-model.js`
- [X] T026 [US1] Expor `GET /projects` e `GET /overview` no router `backend/src/routes/efetivo-planning.js`
- [X] T027 [P] [US1] Implementar cliente/query keys da visão geral em `frontend/src/api/efetivoPlanning.ts`
- [X] T028 [US1] Construir `OverviewBoard` com KPIs, capacidade por função, mobilizações e estados loading/empty/error em `frontend/src/pages/efetivo/components/OverviewBoard.tsx`
- [X] T029 [US1] Integrar Visão geral, data/função em URL e shell largo em `frontend/src/pages/efetivo/EfetivoPage.tsx` e `frontend/src/pages/efetivo/efetivo.css`

**Checkpoint**: capacidade oficial é verificável sem depender das demais telas.

---

## Phase 4: User Story 2 — Planejar missões e alocar pessoas (Priority: P1)

**Goal**: criar programação, demanda e equipe por função sem conflitos, com autoalocação determinística.

**Independent Test**: criar missão com duas funções, confirmar, alocar elegíveis e observar déficit restante.

### Tests for User Story 2

- [X] T030 [P] [US2] Escrever testes de cronologia, demanda e confirmação de missão em `backend/test/efetivo-mission-validation.test.js`
- [X] T031 [P] [US2] Escrever testes de elegibilidade, ausência, dupla alocação, vínculo e função em `backend/test/efetivo-allocation-conflicts.test.js`
- [X] T032 [P] [US2] Escrever testes de autoalocação determinística, déficit parcial e idempotência em `backend/test/efetivo-auto-allocation.test.js`
- [X] T033 [P] [US2] Escrever teste concorrente em banco confirmando que apenas uma alocação conflitante vence em `backend/test/efetivo-allocation-concurrency.test.js` — escrito e ignorado por padrão; a execução exige banco descartável migrado (`EFETIVO_DB_TESTS=1`, ver quickstart)
- [X] T034 [P] [US2] Escrever testes dos contratos CRUD/equipe de missão em `backend/test/efetivo-missions-routes.test.js`

### Implementation for User Story 2

- [X] T035 [US2] Implementar serviço transacional de CRUD, cronologia, demanda e versão da missão em `backend/src/lib/efetivo/planning/mission-planning.js`
- [X] T036 [US2] Implementar lock por colaborador e detector único de ausência/missão/vínculo/função em `backend/src/lib/efetivo/planning/conflicts.js`
- [X] T037 [US2] Implementar elegíveis, alocação manual, remoção lógica e limite de demanda em `backend/src/lib/efetivo/planning/allocations.js`
- [X] T038 [US2] Implementar autoalocação estável por função, admissão e nome em `backend/src/lib/efetivo/planning/auto-allocation.js`
- [X] T039 [US2] Expor CRUD de missões, elegíveis, alocações e autoalocação em `backend/src/routes/efetivo-planning.js`
- [X] T040 [P] [US2] Implementar cliente e tipos de missão/equipe em `frontend/src/api/efetivoPlanning.ts`
- [X] T041 [P] [US2] Construir lista/cards de missões com busca, filtros, demanda e déficit em `frontend/src/pages/efetivo/components/MissionsBoard.tsx`
- [X] T042 [US2] Construir formulário RHF/Zod com `Modal`, `SearchCombobox`, `.field-invalid` e rodapé fixo em `frontend/src/pages/efetivo/components/MissionFormModal.tsx`
- [X] T043 [US2] Construir alocação manual/automática e conflitos navegáveis em `frontend/src/pages/efetivo/components/MissionAllocationModal.tsx`
- [X] T044 [US2] Persistir missão/filtros na URL e limpar parâmetros incompatíveis em `frontend/src/pages/efetivo/EfetivoPage.tsx`
- [X] T045 [US2] Adicionar layouts shrink-safe de lista, demanda, equipe e modais em `frontend/src/pages/efetivo/efetivo.css`

**Checkpoint**: programação e equipe funcionam por API/UI e alimentam a capacidade.

---

## Phase 5: User Story 3 — Consultar o calendário integrado (Priority: P1)

**Goal**: combinar missão, férias, folga e afastamento em dia/semana/mês, filtrável por função.

**Independent Test**: cadastrar uma missão e uma ausência e localizá-las nas três visões após refresh.

### Tests for User Story 3

- [X] T046 [P] [US3] Escrever testes de projeção de eventos, filtro e detalhes do dia em `backend/test/efetivo-calendar.test.js`
- [X] T047 [P] [US3] Escrever testes de grade civil mensal/semanal sem deriva de fuso em `frontend/test/efetivo-calendar-grid.test.mjs`

### Implementation for User Story 3

- [X] T048 [US3] Implementar projeção em lote de eventos/conflitos do intervalo em `backend/src/lib/efetivo/planning/calendar.js`
- [X] T049 [US3] Expor `GET /calendar` com limite de intervalo e filtro por função em `backend/src/routes/efetivo-planning.js`
- [X] T050 [P] [US3] Implementar helpers de grade mensal/semanal e rótulos pt-BR em `frontend/src/utils/calendarGrid.ts`
- [X] T051 [P] [US3] Implementar cliente/query do calendário em `frontend/src/api/efetivoPlanning.ts`
- [X] T052 [US3] Construir dia/semana/mês, legenda, Hoje e navegação em `frontend/src/pages/efetivo/components/OperationalCalendar.tsx`
- [X] T053 [US3] Construir detalhe do dia com pessoas, vagas e links de conflito em `frontend/src/pages/efetivo/components/CalendarDayDetail.tsx`
- [X] T054 [US3] Integrar query params e agenda mobile sem grade horizontal em `frontend/src/pages/efetivo/EfetivoPage.tsx` e `frontend/src/pages/efetivo/efetivo.css`

**Checkpoint**: calendário integrado é consultável de forma independente em três visões.

---

## Phase 6: User Story 4 — Gerir colaboradores e indisponibilidades (Priority: P1)

**Goal**: manter campos operacionais do colaborador canônico e programar três tipos de indisponibilidade.

**Independent Test**: editar colaborador, criar afastamento e conferir situação/calendário/capacidade.

### Tests for User Story 4

- [X] T055 [P] [US4] Escrever testes de serviço cadastral, sincronização cargo/texto e vínculo em `backend/test/efetivo-collaborators.test.js`
- [X] T056 [P] [US4] Ampliar testes de ausências para FERIAS/FOLGA/AFASTAMENTO e conflito com missão em `backend/test/efetivo-absences-planning.test.js`
- [X] T057 [P] [US4] Escrever testes de contratos e mínimo privilégio das rotas de colaborador em `backend/test/efetivo-collaborator-routes.test.js`

### Implementation for User Story 4

- [X] T058 [US4] Implementar serviço restrito aos campos operacionais do cadastro canônico em `backend/src/lib/efetivo/planning/collaborators.js`
- [X] T059 [US4] Generalizar o serviço transacional de indisponibilidade e auditoria para três tipos em `backend/src/lib/efetivo/planning/collaborators.js`
- [X] T060 [US4] Expor lista/criação/edição de colaborador e CRUD de ausência em `backend/src/routes/efetivo-planning.js`
- [X] T061 [P] [US4] Implementar cliente/query/mutations de colaboradores e ausências em `frontend/src/api/efetivoPlanning.ts`
- [X] T062 [US4] Construir busca, filtro, data, situação, utilização e alertas em `frontend/src/pages/efetivo/components/CollaboratorsBoard.tsx`
- [X] T063 [US4] Construir modal operacional RHF/Zod com campos permitidos em `frontend/src/pages/efetivo/components/OperationalCollaboratorModal.tsx`
- [X] T064 [US4] Ampliar `AbsenceFormModal` para tipos liberados, conflito navegável e validação visual em `frontend/src/pages/efetivo/components/AbsenceFormModal.tsx`
- [X] T065 [US4] Implementar tabela→cards, ações empilhadas e URL de colaborador/filtros em `frontend/src/pages/efetivo/efetivo.css` e `frontend/src/pages/efetivo/EfetivoPage.tsx`

**Checkpoint**: base operacional pode ser mantida sem acesso RDO e afeta todas as projeções.

---

## Phase 7: User Story 5 — Acompanhar a evolução das missões (Priority: P2)

**Goal**: mover e ordenar missões nas cinco etapas com histórico, toque e alternativa acessível.

**Independent Test**: mover uma missão por arraste/menu, cancelar um arraste e recarregar a etapa/ordem final.

### Tests for User Story 5

- [X] T066 [P] [US5] Escrever testes transacionais de etapa, ordem, versão e auditoria em `backend/test/efetivo-mission-kanban.test.js`
- [X] T067 [P] [US5] Escrever testes do reducer cross-column, rollback e ordem final em `frontend/test/mission-kanban.test.mjs`

### Implementation for User Story 5

- [X] T068 [US5] Implementar mudança/reordenação atômica de etapa com versão em `backend/src/lib/efetivo/planning/mission-planning.js`
- [X] T069 [US5] Expor `PATCH /missions/:id/stage` em `backend/src/routes/efetivo-planning.js`
- [X] T070 [P] [US5] Implementar reducer puro cross-column e snapshot de rollback em `frontend/src/utils/missionKanban.ts`
- [X] T071 [US5] Construir Kanban desktop com handle, live reorder, placeholder/legenda, ghost e persistência no drop em `frontend/src/pages/efetivo/components/MissionKanban.tsx`
- [X] T072 [US5] Adicionar Pointer Events, `touch-action:none`, Escape/cancel e scroll de borda usando `frontend/src/utils/reorderDrag.ts`
- [X] T073 [US5] Adicionar seletor/menu acessível equivalente para teclado e mobile em `frontend/src/pages/efetivo/components/MissionKanban.tsx`
- [X] T074 [US5] Persistir missão selecionada e etapa visível em URL em `frontend/src/pages/efetivo/EfetivoPage.tsx`
- [X] T075 [US5] Implementar colunas desktop e seletor+lista mobile sem scroll de página em `frontend/src/pages/efetivo/efetivo.css`

**Checkpoint**: ciclo das missões é persistente, auditado e acessível sem depender de mouse.

---

## Phase 8: User Story 6 — Simular capacidade antes de alterar o oficial (Priority: P2)

**Goal**: criar cenário materializado, comparar e aplicar/descartar atomicamente.

**Independent Test**: editar cenário e contratação, confirmar isolamento, comparar, descartar; depois aplicar outro uma única vez.

### Tests for User Story 6

- [X] T076 [P] [US6] Escrever testes de clonagem materializada e isolamento do oficial em `backend/test/efetivo-scenarios-isolation.test.js`
- [X] T077 [P] [US6] Escrever testes de comparação com contratação planejada separada do efetivo ativo em `backend/test/efetivo-scenarios-comparison.test.js`
- [X] T078 [P] [US6] Escrever testes de rollback total, revisão obsoleta, retry e aplicação concorrente em `backend/test/efetivo-scenarios-apply.test.js`
- [X] T079 [P] [US6] Escrever testes dos contratos de cenário e estados terminais em `backend/test/efetivo-scenarios-routes.test.js`

### Implementation for User Story 6

- [X] T080 [US6] Implementar clonagem relacional de oficial para cenário e CRUD terminal em `backend/src/lib/efetivo/planning/scenarios.js`
- [X] T081 [US6] Implementar comparação oficial×cenário pela projeção comum em `backend/src/lib/efetivo/planning/scenarios.js`
- [X] T082 [US6] Implementar aplicação transacional/CAS/idempotente criando novo oficial em `backend/src/lib/efetivo/planning/scenarios.js`
- [X] T083 [US6] Expor listar/criar/comparar/contratar/aplicar/descartar em `backend/src/routes/efetivo-planning.js`
- [X] T084 [P] [US6] Implementar cliente/query/mutations de cenários em `frontend/src/api/efetivoPlanning.ts`
- [X] T085 [US6] Construir lista/criação/estado de cenários em `frontend/src/pages/efetivo/components/ScenariosBoard.tsx` e `frontend/src/pages/efetivo/components/ScenarioFormModal.tsx`
- [X] T086 [US6] Construir comparação total/por função e confirmação explícita em `frontend/src/pages/efetivo/components/ScenarioComparison.tsx`
- [X] T087 [US6] Persistir cenário em URL e empilhar comparativos no mobile em `frontend/src/pages/efetivo/EfetivoPage.tsx` e `frontend/src/pages/efetivo/efetivo.css`

**Checkpoint**: simulações não alteram oficial até aplicação integral e repetição não duplica efeitos.

---

## Phase 9: User Story 7 — Administrar regras e rastrear alterações (Priority: P2)

**Goal**: configurar função, meta e feriado e consultar atividade recente conforme permissão.

**Independent Test**: alterar cor/prazo/meta, cadastrar feriado e conferir efeito e auditoria.

### Tests for User Story 7

- [X] T088 [P] [US7] Escrever testes de validação/configuração de função e meta em `backend/test/efetivo-admin-settings.test.js`
- [X] T089 [P] [US7] Escrever testes de CRUD/restauração de feriado e efeito em dia útil em `backend/test/efetivo-holidays.test.js`
- [X] T090 [P] [US7] Escrever testes de auditoria, sanitização, paginação e permissão viewer/manager em `backend/test/efetivo-audit.test.js`

### Implementation for User Story 7

- [X] T091 [US7] Implementar leitura/patch limitado de funções e meta com revisão/auditoria em `backend/src/lib/efetivo/planning/administration.js`
- [X] T092 [US7] Implementar CRUD/restauração de feriados e atividade paginada em `backend/src/lib/efetivo/planning/administration.js`
- [X] T093 [US7] Expor rotas admin de funções, feriados, settings e atividade em `backend/src/routes/efetivo-planning.js`
- [X] T094 [P] [US7] Implementar cliente/query/mutations de Administração em `frontend/src/api/efetivoPlanning.ts`
- [X] T095 [US7] Construir configuração de funções/meta e estados somente leitura em `frontend/src/pages/efetivo/components/AdministrationBoard.tsx`
- [X] T096 [US7] Construir CRUD de feriados com RHF/Zod/Modal e erro visual em `frontend/src/pages/efetivo/components/HolidayManager.tsx`
- [X] T097 [US7] Construir lista de atividade com ator/data/tipo/alvo e paginação em `frontend/src/pages/efetivo/components/EfetivoActivityList.tsx`
- [X] T098 [US7] Integrar subnavegação admin em URL e cards mobile em `frontend/src/pages/efetivo/EfetivoPage.tsx` e `frontend/src/pages/efetivo/efetivo.css`

**Checkpoint**: parâmetros são explícitos e toda mutação relevante deixa trilha consultável.

---

## Phase 10: User Story 8 — Alertas de férias e permanência em obra (Priority: P2)

**Goal**: exibir folgas a programar e férias a programar/vencidas com datas reproduzíveis.

**Independent Test**: criar sequência acima do limite e período concessivo sem férias e conferir pessoa, dias e prazos.

### Tests for User Story 8

- [X] T099 [P] [US8] Escrever testes de intervalos sobrepostos/adjacentes, lacuna, FOLGA e limites em `backend/test/efetivo-continuous-stay.test.js`
- [X] T100 [P] [US8] Escrever testes de períodos aquisitivos, janela concessiva, 120 dias e ano bissexto em `backend/test/efetivo-vacation-alerts.test.js`

### Implementation for User Story 8

- [X] T101 [US8] Implementar permanência contínua por dias corridos e limites de função em `backend/src/lib/efetivo/planning/continuous-stay.js`
- [X] T102 [US8] Implementar alertas operacionais de férias por admissão/ausências em `backend/src/lib/efetivo/planning/vacation-alerts.js`
- [X] T103 [US8] Incorporar alertas em overview e colaboradores sem N+1 em `backend/src/lib/efetivo/planning/read-model.js`
- [X] T104 [P] [US8] Tipar alertas e seus caminhos no cliente em `frontend/src/api/efetivoPlanning.ts`
- [X] T105 [US8] Exibir alertas de permanência com missão/dias/prazo em `frontend/src/pages/efetivo/components/OverviewBoard.tsx`
- [X] T106 [US8] Exibir férias vencidas/programar férias com aviso não jurídico em `frontend/src/pages/efetivo/components/CollaboratorsBoard.tsx`

**Checkpoint**: alertas são derivados, reproduzíveis e não alegam substituir folha/jurídico.

---

## Phase 11: User Story 9 — Manter Produtividade realizada separada (Priority: P1)

**Goal**: preservar integralmente a feature 011 e impedir que planejamento alimente HH realizadas.

**Independent Test**: mesma base Ponto Mais produz os mesmos resultados antes/depois, sem ação manual de HH.

### Tests for User Story 9

- [X] T107 [P] [US9] Fixar regressão das fórmulas/fonte Ponto Mais com planejamento presente em `backend/test/efetivo-produtividade.test.js`
- [X] T108 [P] [US9] Testar que o cliente e navegação não expõem mutation de lançamento de HH em `frontend/test/efetivo-navigation.test.mjs`

### Implementation for User Story 9

- [X] T109 [US9] Revisar e isolar importações para que `backend/src/lib/efetivo/productivity.js` não dependa de modelos de planejamento
- [X] T110 [US9] Manter a seção e filtros de Produtividade ao ampliar `frontend/src/pages/efetivo/EfetivoPage.tsx`
- [X] T111 [US9] Remover qualquer texto/ação de HH manual das novas superfícies em `frontend/src/pages/efetivo/`

**Checkpoint**: produtividade realizada permanece fonte Ponto Mais, funcional e semanticamente separada.

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: integrar as oito seções, cumprir constituição visual e fechar evidência técnica.

- [X] T112 [P] Atualizar a campanha de novidade com expiração global em 2026-08-31 e marcador por usuário/browser em `frontend/src/pages/efetivo/EfetivoPlanningNovelty.tsx`
- [X] T113 Atualizar tutorial temporário para os controles reais e preservar onboarding existente em `frontend/src/pages/efetivo/EfetivoTutorial.tsx`
- [X] T114 Implementar/validar navegação das oito seções e limpeza atômica de query params em `frontend/src/pages/efetivo/EfetivoPage.tsx` e `frontend/src/utils/planningNavigation.ts`
- [X] T115 Auditar formulários: labels, `field-group.field-invalid`, `aria-invalid`, `.field-error`, dropdowns e rodapés fixos em `frontend/src/pages/efetivo/components/`
- [X] T116 Auditar DnD: handle, placeholder/legenda, ghost, live reorder, cancel, drop único, touch e teclado em `frontend/src/pages/efetivo/components/MissionKanban.tsx`
- [X] T117 Auditar 1440, 768 e 390 px e corrigir grids/cards/tabelas/abas/textos sem overflow em `frontend/src/pages/efetivo/efetivo.css`
- [X] T118 [P] Adicionar índices/ajustes das projeções após medir o volume de 500 colaboradores/100 missões em `backend/src/lib/efetivo/planning/capacity.js`
- [X] T119 Rodar testes completos, lint, build e validação de arquitetura conforme `specs/012-planejamento-efetivo/quickstart.md`
- [X] T120 Registrar evidência de critérios, comandos/resultados e pendências operacionais em `specs/012-planejamento-efetivo/quickstart.md`
- [X] T121 Marcar somente tarefas realmente concluídas e conferir formato/contagem em `specs/012-planejamento-efetivo/tasks.md`

---

## Phase 13: Ajuste pós-uso — missões vindas dos projetos e kanban legível

**Purpose**: eliminar o cadastro manual de missão, expor pendências vindas dos projetos cadastrados (FR-046..FR-049) e corrigir a leitura/arraste do kanban (FR-050).

- [X] T122 [P] [US2] Escrever testes de pendência, ordem de rota e contrato em `backend/test/efetivo-missions-pending.test.js`
- [X] T123 [P] [US2] Escrever testes do utilitário de pendências e das regras de UI em `frontend/test/efetivo-missions-pending.test.mjs`
- [X] T124 [US2] Implementar `listPendingMissionProjects` (projetos ativos sem programação, sem criar plano na leitura) em `backend/src/lib/efetivo/planning/read-model.js`
- [X] T125 [US2] Expor `GET /missions/pending` antes da rota por id em `backend/src/routes/efetivo-planning.js` e documentar em `specs/012-planejamento-efetivo/contracts/efetivo-planning.openapi.yaml`
- [X] T126 [P] [US2] Adicionar `PendingMissionProject`/`listPendingMissionProjects` em `frontend/src/api/efetivoPlanning.ts` e `frontend/src/utils/missionPendencies.ts`
- [X] T127 [US2] Substituir "Nova missão" por cards pendentes em amarelo com o que falta e aviso de pendências em `frontend/src/pages/efetivo/components/MissionsBoard.tsx`
- [X] T128 [US2] Travar o projeto no formulário e sugerir datas do projeto em `frontend/src/pages/efetivo/components/MissionFormModal.tsx`
- [X] T129 [US2] Notificar a contagem de pendências na navegação do módulo em `frontend/src/pages/efetivo/EfetivoPage.tsx`
- [X] T130 [US5] Arrastar o card inteiro, encerrar o estado de arraste sem recarregar e manter alternativa acessível em `frontend/src/pages/efetivo/components/MissionKanban.tsx`
- [X] T131 [US5] Marcar a etapa com bolinha colorida ao lado do nome, manter colunas/cards na cor única, remover bordas escuras e estilizar pendências em `frontend/src/pages/efetivo/efetivo.css`

---

## Phase 14: Paridade campo a campo com o exemplo de referência

**Purpose**: fechar as lacunas de campo levantadas na conferência contra o protótipo (FR-051..FR-054) e registrar as divergências deliberadas.

- [X] T132 [P] [US6] Escrever teste de criação de cenário com contratação hipotética inicial em `backend/test/efetivo-scenario-initial-hire.test.js`
- [X] T133 [US6] Aceitar `initialHire` em `scenarioInputSchema` e gravá-lo na mesma transação em `backend/src/lib/efetivo/planning/schemas.js` e `backend/src/lib/efetivo/planning/scenarios.js`, documentando em `specs/012-planejamento-efetivo/contracts/efetivo-planning.openapi.yaml`
- [X] T134 [US6] Reconstruir o diálogo com nome, objetivo e bloco "Contratação hipotética" em `frontend/src/pages/efetivo/components/ScenarioFormModal.tsx` e `frontend/src/pages/efetivo/components/ScenariosBoard.tsx`
- [X] T135 [US2] Adicionar resumo de posições, cor da função na demanda, situação da equipe e "Alocar disponíveis" em `frontend/src/pages/efetivo/components/MissionsBoard.tsx` e `frontend/src/pages/efetivo/components/MissionFormModal.tsx`
- [X] T136 [US5] Adicionar resumo do fluxo, descrição de etapa, estado vazio e detalhe de responsável/equipe em `frontend/src/pages/efetivo/components/MissionKanban.tsx` e `frontend/src/utils/missionKanban.ts`
- [X] T137 [US1] [US3] Exibir dias da semana no calendário mensal e detalhar déficit/permanência na visão geral em `frontend/src/pages/efetivo/components/OperationalCalendar.tsx` e `frontend/src/pages/efetivo/components/OverviewBoard.tsx`
- [X] T138 [P] Registrar divergências deliberadas do protótipo em `specs/012-planejamento-efetivo/spec.md`
- [X] T140 [P] [US3] Escrever testes de conflito do calendário (ausência sobre missão e dupla alocação) em `backend/test/efetivo-calendar.test.js`
- [X] T141 [US3] Calcular os conflitos do recorte em `backend/src/lib/efetivo/planning/calendar.js` e exibir pessoas, vagas em aberto e conflitos do dia em `frontend/src/pages/efetivo/components/CalendarDayDetail.tsx` e `frontend/src/pages/efetivo/components/OperationalCalendar.tsx` (FR-010, FR-055)
- [X] T142 [US4] Honrar `colaborador`, `ausencia` e `ano` na seção Colaboradores em `frontend/src/utils/planningNavigation.ts`, `frontend/src/pages/efetivo/EfetivoPage.tsx`, `CollaboratorsBoard.tsx` e `AbsencesBoard.tsx` (FR-039, FR-056)
- [X] T143 [US8] Identificar as missões que geraram o alerta de permanência em `backend/src/lib/efetivo/planning/read-model.js` e `frontend/src/pages/efetivo/components/OverviewBoard.tsx` (FR-034)
- [X] T144 [US9] Expor a situação da competência por colaborador em `backend/src/lib/efetivo/productivity.js`, `frontend/src/api/efetivo.ts` e `frontend/src/pages/efetivo/components/ProductivityBoard.tsx` (FR-057)
- [X] T145 [US1] Adicionar atalhos de navegação entre os painéis da visão geral em `frontend/src/pages/efetivo/EfetivoPage.tsx` e `frontend/src/pages/efetivo/components/OverviewBoard.tsx` (FR-058)
- [X] T139 [US5] Corrigir o cartão esmaecido após soltar em outra etapa: prévia ao vivo só dentro da coluna, destaque `drop-target` entre colunas e encerramento do arraste no próprio `drop`, com `resolveKanbanDrop`/`missionStage` cobertos em `frontend/test/mission-kanban.test.mjs`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: começa imediatamente.
- **Foundational (Phase 2)**: depende de Setup e bloqueia todas as histórias.
- **US1/US2/US4 (P1)**: começam após Foundation; US1 fica demonstrável primeiro, US2 fornece missões e US4 fornece manutenção de pessoas.
- **US3 (P1)**: depende das projeções de US1 e entidades de US2/US4.
- **US9 (P1)**: pode ser validada em paralelo após Foundation, mas deve ser reexecutada no fechamento.
- **US5 (P2)**: depende de missões de US2.
- **US6 (P2)**: depende de projeção de US1 e regras completas de US2/US4.
- **US7 (P2)**: pode avançar após Foundation; feriados alimentam US1/US3.
- **US8 (P2)**: depende de alocações de US2 e ausências de US4.
- **Polish**: depende de todas as histórias incluídas na entrega.

### User Story Completion Order

```text
Foundation
├── US1 Capacidade ─┬── US3 Calendário
│                  ├── US6 Simulações
│                  └── US8 Alertas
├── US2 Missões ───┼── US3 Calendário
│                  ├── US5 Kanban
│                  ├── US6 Simulações
│                  └── US8 Alertas
├── US4 Pessoas ───┼── US3 Calendário
│                  ├── US6 Simulações
│                  └── US8 Alertas
├── US7 Administração ── US1/US3 (feriados/configuração)
└── US9 Regressão de Produtividade (paralela + fechamento)
```

### Within Each User Story

- Testes de regra/contrato primeiro e inicialmente falhando.
- Serviço puro antes de orquestração transacional.
- Serviço antes de rota; contrato antes do cliente; cliente antes da UI.
- Persistência final apenas após revalidação dentro da transação.
- Checkpoint da história antes de avançar para dependentes.

## Parallel Opportunities

- T008–T010, T013, T016–T018 são independentes por arquivo após schema definido.
- Em US1, os três testes podem ser escritos juntos; cliente pode avançar enquanto o serviço é implementado.
- Em US2, validação, conflitos, autoalocação e contrato têm arquivos de teste independentes.
- Em US3, helper de grade frontend pode avançar junto da projeção backend.
- US7 e US9 podem avançar paralelamente ao núcleo de missões após Foundation.
- CSS/integração final deve permanecer serial para evitar edições concorrentes no mesmo arquivo.

## Parallel Examples

```text
US2:
- backend/test/efetivo-mission-validation.test.js
- backend/test/efetivo-allocation-conflicts.test.js
- backend/test/efetivo-auto-allocation.test.js
- frontend/src/pages/efetivo/components/MissionsBoard.tsx

US6:
- backend/test/efetivo-scenarios-isolation.test.js
- backend/test/efetivo-scenarios-comparison.test.js
- backend/test/efetivo-scenarios-apply.test.js
- frontend/src/api/efetivoPlanning.ts
```

## Implementation Strategy

### MVP First

1. Completar Setup + Foundation.
2. Entregar US1 com leitura da capacidade oficial.
3. Validar totais e desempenho de forma independente.
4. Acrescentar US2/US4 para tornar a base editável.
5. Acrescentar US3 e revalidar o MVP integrado.

### Incremental Delivery

1. Foundation → persistência/versionamento/permissão.
2. US1 → decisão diária.
3. US2 + US4 → manutenção da fonte planejada.
4. US3 → visão temporal integrada.
5. US7 → governança, feriados e parâmetros.
6. US5 + US8 → operação contínua e alertas.
7. US6 → simulações aplicáveis.
8. US9 + Polish → regressão, onboarding, responsividade e evidência.

## Notes

- `[P]` indica arquivos independentes, nunca mutações concorrentes no mesmo arquivo.
- Rotas compartilham um arquivo e devem ser integradas serialmente.
- Nenhuma tarefa autoriza deploy, restart, Docker ou migração em produção.
- Alterações em `package-lock.json` só entram se uma dependência for deliberadamente adicionada; esta feature não prevê nova dependência.

## Phase 15: Convergence

**Purpose**: Fechar lacunas encontradas na verificação cruzada entre especificação, plano, tarefas, implementação e evidências de validação.

- [X] T146 [US2] Ajustar `backend/src/lib/efetivo/planning/mission-planning.js` para restaurar ou reutilizar com segurança a programação excluída do mesmo projeto, preservando histórico/auditoria e a restrição de unicidade, e adicionar regressão do fluxo excluir → pendente → reprogramar conforme FR-049.
- [X] T147 [US6] Invalidar e recarregar a comparação e os metadados do cenário em `frontend/src/pages/efetivo/components/MissionsBoard.tsx` e `frontend/src/pages/efetivo/components/ScenariosBoard.tsx` após mutações de missão/alocação no plano de cenário, com teste de cache/integração para FR-028 e US6/AC2.
- [ ] T148 [P] Executar `backend/test/efetivo-allocation-concurrency.test.js` contra PostgreSQL explicitamente descartável e migrado, registrar a evidência de concorrência real e confirmar SC-004/T033 sem acessar banco de produção.
- [X] T149 [P] Coordenar a abertura do onboarding em `frontend/src/pages/efetivo/EfetivoTutorial.tsx` e `frontend/src/pages/efetivo/EfetivoPlanningNovelty.tsx` para impedir drivers simultâneos no primeiro acesso, com teste de componente ou navegador conforme o Princípio VI.
- [X] T150 [P] Remover o limite silencioso de 200 projetos pendentes em `backend/src/lib/efetivo/planning/read-model.js`, adotando paginação completa ou agregação equivalente para a lista e o contador de navegação, com teste cobrindo mais de 200 projetos conforme FR-046.
- [X] T151 Tornar a resolução normalizada de função em `backend/src/lib/efetivo/planning/capacity.js` consciente de ambiguidades, mantendo colaboradores sem `jobRoleId` canônico como pendentes, e adicionar regressão de totais/listagem conforme o modelo de dados e SC-002.
- [X] T152 [P] Tornar `headquartersResponsibleUserId` obrigatório em `MissionInput` de `frontend/src/api/efetivoPlanning.ts` e adicionar verificação de compatibilidade entre tipo TypeScript, OpenAPI e schema Zod conforme FR-016.
- [X] T153 [P] Corrigir os comandos de lint/build e atualizar as contagens de testes/evidências em `specs/012-planejamento-efetivo/quickstart.md` para refletir a execução a partir da raiz ou de `frontend/`.
