# Implementation Plan: Unificar Missões no Acompanhamento

**Branch**: `006-unificar-missoes-acompanhamento` | **Date**: 2026-07-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-unificar-missoes-acompanhamento/spec.md`

## Summary

Permitir que gestores do Acompanhamento agrupem duas ou mais missões para que Dashboard/Projetos exibam um único card/linha consolidado, ocultando as missões individuais nas visualizações do módulo e permitindo desmesclar depois. A abordagem preserva os cálculos individuais: o backend continua calculando cada missão pelo fluxo atual (`listCommercialDashboard` e `listProjectCards`) e aplica uma camada de agrupamento por cima, persistida em novas tabelas Prisma específicas do Acompanhamento. A UI adiciona modo de seleção na aba Projetos, ações de unificar/desmesclar e tratamento de itens consolidados nas visões de cards e dashboard.

## Technical Context

**Language/Version**: Node.js + Express ESM no backend; React + Vite + TypeScript no frontend

**Primary Dependencies**: Prisma + PostgreSQL, Zod, @tanstack/react-query, react-hook-form + Zod quando houver formulário de nome do grupo

**Storage**: Nova migration Prisma com tabelas de agrupamento do Acompanhamento; nenhuma alteração em Project, Report, OmiePurchase, OmieReceivable ou dados operacionais existentes

**Testing**: `backend/test/*.test.js` via `node --test`; foco em testes de serviço/agregação e validação de rotas. Frontend validado por `npm run build` e checagem visual/responsiva manual/Playwright na implementação.

**Target Platform**: Aplicação web do módulo Acompanhamento, desktop e mobile

**Project Type**: Web application com backend Express + frontend React

**Performance Goals**: Manter a listagem do acompanhamento em uma única composição por requisição; aplicar agrupamentos em O(n + g + m), onde n = missões retornadas, g = grupos ativos, m = membros; evitar consultas por card

**Constraints**: Agrupamento afeta somente Acompanhamento; mutações restritas a gestor do Acompanhamento; validação Zod antes de regra/banco; schema apenas via Prisma migration; UI pt-BR mobile-first; cards/linhas individuais ocultos somente quando o agrupamento está ativo

**Scale/Scope**: 1 migration Prisma, 1 novo módulo de serviço para grupos, ajustes em 1 rota Express existente, 2 agregadores puros, tipos/API frontend e 2 componentes principais (`ProjectCardsBoard`, `AcompanhamentoDashboard`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação |
|-----------|-----------|
| I. Operação de servidor | PASS — planejamento não executa servidor/deploy; quickstart documenta comandos locais de validação, sem produção/staging |
| II. UI pt-BR e mobile-first | PASS — textos em pt-BR; seleção, ações e card consolidado seguem grid/filtros responsivos do Acompanhamento |
| III. Zod nas duas pontas | PASS — contratos novos usam schemas Zod no backend; formulário de nome/seleção no frontend deve validar antes de mutar |
| IV. Banco só via Prisma | PASS — persistência exige migration Prisma versionada; sem SQL manual nem alteração direta de dados |
| V. Testes de lógica de negócio | PASS — agregação, validações e desmesclagem entram em `backend/test` |
| VI. Consistência visual | PASS — reaproveita `ProjectCardsBoard`, `AcompanhamentoDashboard`, `acp-filters`, `acp-seg`, `acp-pcard`, `acp-table` e componentes compartilhados de confirmação |

**Required visual evidence when frontend changes are present:**

| Surface | Existing reference audited | Shared component/classes | Field/dropdown states covered | Mobile/desktop evidence |
|---------|----------------------------|--------------------------|-------------------------------|-------------------------|
| Seleção na aba Projetos | `frontend/src/components/projects/ProjectCardsBoard.tsx`; `frontend/src/styles/base.css:1735`, `:1744`, `:2087` | `page-card acp-filters`, `field-group`, `acp-seg`, `acp-pcards-grid`, `acp-pcard`; novos botões no padrão compartilhado | default, hover/focus, disabled para menos de 2 selecionadas, vazio sem cards | Grid atual desktop; filtros empilham em mobile por `.acp-filters` |
| Card consolidado | `ProjectCardsBoard.tsx` card atual; `base.css` métricas `.acp-pcard-*` | Reuso de `acp-pcard`, `acp-pcard-metric`, barras existentes, badges/alertas atuais | Estado normal, agrupamento sem nome manual, grupo com membros arquivados/ocultos | Lista de membros quebra linha; sem largura fixa nova |
| Desmesclar/confirmar | `frontend/src/components/ui/` conforme constitution | `ConfirmDialog`/Modal e botões compartilhados | cancelar, confirmar, loading, erro | Modal com corpo rolável e ações acessíveis em mobile |
| Dashboard consolidado | `frontend/src/components/projects/AcompanhamentoDashboard.tsx`; tabela responsiva existente | `acp-kpis`, `acp-table`, `acp-table-wrap`, filtros existentes | linhas de grupo sem abrir cronograma direto; membros listados/visíveis | Mantém alternativa responsiva existente da tabela |

**Resultado pré-design**: PASS — sem violações.

## Project Structure

### Documentation (this feature)

```text
specs/006-unificar-missoes-acompanhamento/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── acompanhamento-mission-groups-api.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
backend/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│       └── <timestamp>_acompanhamento_mission_groups/
│           └── migration.sql
├── src/
│   ├── lib/acompanhamento/
│   │   ├── mission-groups.js          # CRUD/validação/persistência dos grupos
│   │   ├── project-card-groups.js     # agregação pura dos cards da aba Projetos
│   │   └── dashboard-groups.js        # agregação pura das linhas do Dashboard
│   └── routes/resources/
│       └── acompanhamento-comercial.js # endpoints de grupos + respostas agrupadas
└── test/
    ├── acompanhamento-mission-groups.test.js
    ├── acompanhamento-project-card-groups.test.js
    └── acompanhamento-dashboard-groups.test.js

frontend/
└── src/
    ├── api/
    │   └── acompanhamentoComercial.ts
    └── components/projects/
        ├── ProjectCardsBoard.tsx
        └── AcompanhamentoDashboard.tsx
```

**Structure Decision**: Web application existente. A feature fica dentro do módulo Acompanhamento, sem novo app/pacote e sem tocar módulos de relatórios/RDO/Omie fora da leitura dos indicadores já existentes.

## Design Decisions (resumo)

1. **Persistência própria do Acompanhamento** — grupos ficam em novas tabelas `AcompanhamentoMissionGroup` e `AcompanhamentoMissionGroupMember`, com desmesclagem auditável. Isso torna o agrupamento compartilhado entre sessões sem alterar projetos ou relatórios.
2. **Overlay sobre cálculos individuais** — `listCommercialDashboard` e o cálculo individual de `listProjectCards` continuam sendo a fonte. Helpers puros consolidam linhas/cards depois, ocultando filhos nas respostas agrupadas.
3. **Unicidade ativa por missão** — cada membro ativo guarda `activeProjectId`; o banco impede que a mesma missão esteja em dois grupos ativos, e desmesclar limpa esse campo mantendo histórico.
4. **API mínima e validada** — rotas sob `/api/acompanhamento/comercial/grupos-missoes` criam/listam/renomeiam/desmesclam grupos. Leitura exige acesso ao Acompanhamento; mutações exigem gestor.
5. **Agregação previsível** — somas para dinheiro/contagens, percentuais recalculados por numerador/denominador, progresso ponderado por custo planejado com fallback documentado, colaboradores únicos por ID quando disponível.
6. **UI sem novo padrão visual** — seleção entra na barra `acp-filters`; cards consolidados reutilizam `acp-pcard`; confirmação usa componente compartilhado. `AcompanhamentoDashboard` recebe itens agrupados e evita abrir cronograma em linha de grupo.

Detalhes e alternativas: [research.md](./research.md).

## Post-Design Constitution Check

| Princípio | Reavaliação |
|-----------|-------------|
| I. Operação de servidor | PASS — sem comandos de produção/staging |
| II. UI pt-BR e mobile-first | PASS — contratos e quickstart exigem validação mobile |
| III. Zod nas duas pontas | PASS — contratos especificam schemas de entrada |
| IV. Banco só via Prisma | PASS — migration Prisma é parte do escopo |
| V. Testes backend | PASS — quickstart e estrutura incluem testes de agregação/validação |
| VI. Consistência visual | PASS — nenhuma superfície nova fora dos padrões do módulo |

**Resultado pós-design**: PASS — Complexity Tracking vazio.

## Complexity Tracking

Sem violações — tabela não aplicável.
