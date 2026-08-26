# Implementation Plan: Planejamento Completo do Efetivo Operacional

**Branch**: `feat/efetivo-operacional` | **Date**: 2026-08-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-planejamento-efetivo/spec.md`

## Summary

Expandir o módulo Efetivo Operacional para cobrir visão geral por data, calendário, cadastro operacional de colaboradores, programação e alocação de missões, evolução em Kanban, simulações comparáveis/aplicáveis e administração de cargos, feriados e auditoria. A programação de missão seleciona diretamente colaboradores do APP com seus cargos; demanda por função e alocações são sincronizadas atomicamente e derivadas da equipe. A solução preserva `Project`, `Collaborator` e `JobRole` como cadastros canônicos, usa intervalos civis inclusivos e protege alterações concorrentes com transação, lock e revisão monotônica. Produtividade continua derivada exclusivamente do Ponto Mais; não haverá lançamento manual de HH.

## Technical Context

**Language/Version**: Node.js ESM/JavaScript no backend; TypeScript 5.8.3 e React 19 no frontend
**Primary Dependencies**: Express 5.2, Zod 4.4, Prisma 7.9; React Query, React Hook Form, React Router e Driver.js
**Storage**: PostgreSQL 16 por Prisma; datas civis em `@db.Date`; auditoria relacional
**Testing**: `node:test` no backend e frontend, ESLint, TypeScript/Vite build e Playwright para fluxos visuais
**Target Platform**: navegador moderno responsivo e servidor Linux em containers existentes
**Project Type**: aplicação web full-stack em `backend/` e `frontend/`
**Performance Goals**: consultas de dashboard/calendário em até 2 s no volume de referência; interações locais do Kanban e filtros sem espera perceptível
**Constraints**: sem dependência nova para calendário ou DnD; sem scroll horizontal de página; transações atômicas para mutações oficiais; nenhuma HH manual
**Scale/Scope**: até 500 colaboradores ativos, 100 missões por plano, horizonte principal de 90 dias e oito seções do módulo

## Constitution Check

*GATE: aprovado antes da pesquisa e revalidado após o desenho.*

- Operação de servidor/deploy: **PASS** — o plano limita-se a código, migração versionada e comandos locais de validação; aplicação em produção fica documentada para o operador.
- UI pt-BR e mobile-first: **PASS** — tabelas viram cards/agenda, Kanban vira lista com seletor de etapa e grades usam `minmax(min(100%, ...), 1fr)`/`min-width: 0`.
- Validação Zod: **PASS** — contratos compartilhados por schemas equivalentes no frontend/backend e mensagens por campo.
- Prisma migrations: **PASS** — todos os modelos, enums, FKs, índices e backfill inequívoco entram em migração versionada.
- Testes de negócio: **PASS** — datas, capacidade, conflitos, autoalocação, permanência, férias e cenários terão testes em `backend/test`.
- Sistema visual: **PASS** — componentes compartilhados, tokens e shell largo existentes; nenhum port de identidade visual será usado.
- Drag-and-drop: **PASS** — padrão compartilhado com handle, live reorder, placeholder, ghost, cancelamento, Pointer Events e alternativa acessível.
- Novidade/onboarding: **PASS** — campanha de 10 dias a partir de 2026-08-21 e tutorial permanente de primeiro acesso ao módulo expandido.
- Navegação em URL: **PASS** — `section`, data, visão, filtros e seleção compartilháveis usam query params com limpeza dos incompatíveis.

**Required visual evidence when frontend changes are present:**

| Surface | Existing reference audited | Shared component/classes | Field/dropdown states covered | Reorder drag/drop pattern | Navigation persistence | Novelty/tutorial plan | Mobile/desktop overflow evidence |
|---------|----------------------------|--------------------------|-------------------------------|---------------------------|------------------------|------------------------|----------------------------------|
| Visão geral e calendário | `ProductivityBoard`, `AcompanhamentoDashboard`, `SedeCostsBoard` e layouts `equip-*` | `Card`, `Button`, `SearchBar`, `field-group`, `efetivo-kpis` | filtros default/focus/disabled/empty | N/A | `section`, `date`, `view`, `role` | novidade 10 dias + etapas do tutorial | grade mensal vira agenda; cards encolhem sem overflow |
| Colaboradores e ausências | `AbsenceFormModal` e tabela responsiva do Efetivo | `Modal`, `Button`, `SearchBar`, novo `SearchCombobox`, `field-invalid`, `field-error` | default/focus/disabled/error/required-empty | N/A | filtros e colaborador em query params | etapa específica no tutorial | tabela vira cards em até 640 px; rodapé fixo no modal |
| Missões e alocação | `ProjectCardsBoard`, `AbsenceFormModal` | `Modal`, `Button`, busca, checkboxes acessíveis, badges e cards | colaboradores pesquisáveis por nome/cargo, loading, empty, disabled, selected e error | N/A | filtros, missão e modal em query params | etapa específica no tutorial | lista de equipe rolável e resumo empilhado no mobile; sem select largo |
| Evolução das missões | `QualityNaturesTab` e `utils/reorderDrag.ts` | handles/ghost/placeholders compartilhados e `Button` | seletor alternativo default/focus/disabled/error | handle + live placeholder/ghost + Pointer Events + cancel | etapa e missão selecionada em query params | etapa específica no tutorial | colunas no desktop; seletor + lista no mobile |
| Simulações e administração | `AcompanhamentoDashboard`, formulários admin e atividade existente | `Modal`, `Button`, `SearchCombobox`, `admin-form-grid`, `field-group` | default/focus/disabled/error/required-empty | N/A | cenário/filtros em query params | etapas específicas no tutorial | comparação em cards; formulários e auditoria quebram texto |

As referências serão reutilizadas somente onde atendem à constituição atual. O novo combobox nasce compartilhado porque o repositório não contém um controle pesquisável compatível com centenas de opções.

## Project Structure

### Documentation (this feature)

```text
specs/012-planejamento-efetivo/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── efetivo-planning.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── prisma/
│   ├── schema.prisma
│   └── migrations/<timestamp>_add_efetivo_planning/
├── src/
│   ├── lib/efetivo/
│   │   ├── access.js
│   │   ├── service.js
│   │   ├── date-only.js
│   │   ├── capacity.js
│   │   ├── mission-planning.js
│   │   ├── continuous-stay.js
│   │   ├── vacation-alerts.js
│   │   ├── scenarios.js
│   │   ├── planning-service.js
│   │   └── audit.js
│   └── routes/
│       └── efetivo-planning.js
└── test/
    ├── efetivo-planning-*.test.js
    └── efetivo-scenarios-*.test.js

frontend/
├── src/
│   ├── api/
│   │   └── efetivoPlanning.ts
│   ├── components/ui/
│   │   └── SearchCombobox.tsx
│   ├── pages/efetivo/
│   │   ├── EfetivoPage.tsx
│   │   ├── EfetivoTutorial.tsx
│   │   ├── EfetivoPlanningNovelty.tsx
│   │   ├── components/
│   │   │   ├── OverviewBoard.tsx
│   │   │   ├── OperationalCalendar.tsx
│   │   │   ├── CalendarDayDetail.tsx
│   │   │   ├── CollaboratorsBoard.tsx
│   │   │   ├── OperationalCollaboratorModal.tsx
│   │   │   ├── MissionsBoard.tsx
│   │   │   ├── MissionFormModal.tsx
│   │   │   ├── MissionAllocationModal.tsx
│   │   │   ├── MissionKanban.tsx
│   │   │   ├── ScenariosBoard.tsx
│   │   │   ├── ScenarioFormModal.tsx
│   │   │   ├── ScenarioComparison.tsx
│   │   │   ├── AdministrationBoard.tsx
│   │   │   ├── HolidayManager.tsx
│   │   │   └── EfetivoActivityList.tsx
│   │   └── efetivo.css
│   └── utils/
│       ├── planningNavigation.ts
│       ├── calendarGrid.ts
│       └── missionKanban.ts
└── test/
    ├── efetivo-planning-*.test.ts
    └── mission-kanban-*.test.ts
```

**Structure Decision**: manter a arquitetura web existente e expandir o bounded context `efetivo`. Regras puras ficam em `backend/src/lib/efetivo`, orquestração transacional em `planning-service.js`/`scenarios.js`, rotas sob `/api/efetivo` e componentes por seção dentro da página existente. Cadastros compartilhados continuam em seus modelos canônicos, mas as permissões e DTOs do Efetivo expõem apenas os campos operacionais.

## Design and Delivery Strategy

### Persistence and transactions

- Criar `EfetivoPlan` com um único oficial ativo, revisão monotônica e cenários materializados.
- Serializar mutações oficiais bloqueando a linha do plano dentro de `$transaction`; aplicar cenários por compare-and-swap de `baseOfficialRevision`.
- Bloquear por colaborador e revalidar sobreposições antes de gravar ausência, alocação ou confirmação de missão.
- Na criação/edição da missão, adquirir locks dos colaboradores em ordem estável, derivar `EfetivoMissionDemand` pelos cargos canônicos selecionados e sincronizar `EfetivoMissionAllocation` dentro da mesma transação.
- Gravar `EfetivoAuditEvent` na mesma transação, com snapshots sanitizados antes/depois.
- Fazer backfill de `Collaborator.jobRoleId` apenas quando o nome normalizado resolver para exatamente um cargo; manter o texto legado.
- Nenhuma coluna ou dado existente será removido nesta entrega.

### Query and projection strategy

- Carregar projetos, missões, demandas, alocações, ausências, feriados, cargos e vínculos em consultas em lote por horizonte.
- Projetar capacidade, utilização e calendário por conjuntos `collaboratorId|date` para deduplicar dias e impedir taxas acima de 100%.
- Reutilizar a mesma projeção pura na visão geral, calendário e comparação de cenário.
- Produtividade permanece no endpoint e modelos existentes do Ponto Mais.

### API and compatibility

- Expor projetos mínimos e cargos operacionais pelo escopo `efetivo:viewer`, sem conceder acesso RDO.
- Restringir mutações cadastrais do Efetivo a nome, função, admissão/desligamento e observação; campos de identidade externa continuam sob seus donos atuais.
- Erros de conflito retornam código estável, pessoa, origem, período e IDs navegáveis.
- `MissionInput` passa a receber `collaboratorIds`; a resposta continua expondo demandas derivadas e alocações para capacidade, calendário, cenários e clientes de leitura.

### Validation and tests

- Datas: ano bissexto, data impossível, limites inclusivos, DST e intervalos invertidos.
- Capacidade: fins de semana, feriados, vínculo parcial, ausência, denominador zero e deduplicação.
- Conflitos: ausência × ausência, ausência × missão, missão × missão, função/vínculo e corrida concorrente.
- Missões: cronologia, seleção direta da equipe, derivação de demanda, sincronização atômica, autoalocação legada, déficit parcial e idempotência.
- Permanência/férias: intervalos adjacentes, lacunas, FOLGA, limites e janelas aquisitiva/concessiva.
- Cenários: comparação isolada, rollback integral, revisão obsoleta, retry e aplicação concorrente.
- Frontend: navegação por URL, calendário, cards mobile, formulários inválidos, Kanban com cancelamento/toque e alternativa acessível.

## Operational Handoff

A implementação produzirá migração Prisma e comandos locais de validação. Não serão executados deploy, migração em produção nem reinício de serviços nesta fase. O quickstart separa explicitamente os comandos de desenvolvimento dos passos que o operador deverá executar no ambiente de destino.

## Complexity Tracking

Não há violações constitucionais a justificar. A separação entre plano, missão, demanda, alocação e cenário é a menor modelagem relacional que preserva integridade temporal, simulação isolada e auditoria transacional sem alterar o significado dos modelos existentes.
