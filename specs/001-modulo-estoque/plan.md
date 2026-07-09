# Implementation Plan: Módulo Estoque (filtros e produtos químicos)

**Branch**: `001-modulo-estoque` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-modulo-estoque/spec.md`

## Summary

Novo módulo "Estoque" para controle de filtros (unidade) e produtos químicos (kg ou L, definido por item): cadastro de itens, movimentações de entrada (NF obrigatória; lote/validade obrigatórios p/ químico, opcionais p/ filtro), saída para projeto com sugestão FEFO, devolução de obra, ajuste de inventário e estorno. Saldo controlado **por lote** e sempre **derivado das movimentações** (transação com bloqueio de saldo negativo). UI com três abas (Resumo, Movimentações, Itens) seguindo o padrão do módulo Equipamentos. Sem alertas por e-mail, custos calculados ou integrações nesta entrega (modelados para não bloquear fases futuras).

## Technical Context

**Language/Version**: Node.js (ES modules) no backend; TypeScript + React 18 no frontend — stack fixa da constitution.

**Primary Dependencies**: Express, Prisma, Zod (backend); Vite, @tanstack/react-query, zustand, react-hook-form + resolver Zod (frontend).

**Storage**: PostgreSQL via Prisma (migrations versionadas). 3 modelos novos (`StockItem`, `StockBatch`, `StockMovement`) + 3 enums; extensão dos enums `AppModule` e `ModuleRoleCode`.

**Testing**: `node --test` em `backend/test/*.test.js` (padrão existente, `npm test`).

**Target Platform**: Web app existente (servidor Linux + navegador, uso majoritário mobile em campo).

**Project Type**: Web application (backend + frontend no mesmo monorepo).

**Performance Goals**: Padrões do app; resumo agrega dezenas/centenas de itens e milhares de movimentações/ano — agregação SQL com índices por `(itemId, date)` e `(batchId)` é suficiente, sem cache.

**Constraints**: Saldo nunca negativo mesmo com registros concorrentes (transação + revalidação de saldo dentro da transação); movimentações imutáveis (correção só por estorno); quantidades `Decimal(12,3)` — inteiros para filtro validados na aplicação.

**Scale/Scope**: 1 módulo novo, ~6 endpoints, 3 abas de UI, 2 papéis; sem dados legados (sem backfill).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Status |
|---|---|---|
| I — Operação de servidor é sagrada | Plano só gera código + migration; comandos de deploy documentados como blocos "rode no servidor" no quickstart. Nenhum comando de infra executado por agente. | ✅ |
| II — UI pt-BR e mobile-first | Todas as telas em pt-BR; Resumo/Histórico com padrão tabela→cards em telas estreitas; modais com rodapé fixo e corpo rolável (kit existente já implementa). | ✅ |
| III — Zod nas duas pontas | Schemas Zod das movimentações e itens em `shared/schemas/estoque.js`, importados pelo backend (validação de rota) e pelo frontend (resolver do react-hook-form). Discriminated union por tipo de movimentação. | ✅ |
| IV — Banco só via Prisma | Uma migration nova (modelos + enums). Sem backfill (módulo novo, sem dados legados). | ✅ |
| V — Testes de lógica de negócio | Testes em `backend/test/estoque-*.test.js`: cálculo de saldo, bloqueio de negativo, obrigatoriedade condicional NF/lote/validade, FEFO, estorno, ajuste, permissões. | ✅ |
| VI — Consistência visual | Página nova copia a estrutura da `EquipamentosPage` (barra de abas, cards, modais do kit `components/ui/`, tokens de `variables.css`, campos de `base.css`). | ✅ |
| Stack fixa | Nenhuma dependência nova. | ✅ |
| Workflow | Feature grande via spec-kit (este fluxo); implementação em branch `feat/modulo-estoque`. | ✅ |

**Re-check pós-design (Phase 1)**: nenhuma violação introduzida pelos artefatos de design. Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
specs/001-modulo-estoque/
├── spec.md              # Especificação (feita)
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões técnicas
├── data-model.md        # Phase 1 — modelos e regras
├── quickstart.md        # Phase 1 — guia de validação
├── contracts/
│   └── estoque-api.md   # Phase 1 — contrato dos endpoints
├── checklists/
│   └── requirements.md  # Checklist de qualidade da spec (aprovado)
└── tasks.md             # Phase 2 (/speckit-tasks — ainda não criado)
```

### Source Code (repository root)

```text
shared/
├── modules/registry.json            # + módulo "estoque" (papéis, hub, rotas)
└── schemas/estoque.js               # NOVO — schemas Zod compartilhados (item + movimentação)

backend/
├── prisma/
│   ├── schema.prisma                # + StockItem, StockBatch, StockMovement, 3 enums, AppModule/ModuleRoleCode
│   └── migrations/2026XXXX_estoque_module/
├── src/
│   ├── middleware/auth.js           # + requireEstoqueAccess / requireEstoqueManager
│   ├── routes/
│   │   ├── index.js                 # monta '/estoque'
│   │   └── resources/estoque.js     # NOVO — itens, resumo, movimentações
│   ├── lib/estoque/
│   │   ├── stock-balance.js         # NOVO — agregação de saldo por item/lote
│   │   ├── stock-movements.js       # NOVO — criação transacional, FEFO, estorno, regras por tipo
│   │   └── stock-attachments.js     # NOVO — FISPQ/NF por token (padrão equipment-attachments)
│   └── app.js                       # + GET /api/estoque-anexos/:token (download público por token)
└── test/
    ├── estoque-balance.test.js      # NOVO
    ├── estoque-movements.test.js    # NOVO
    └── estoque-access.test.js       # NOVO

frontend/src/
├── modules/
│   ├── registry.generated.ts        # regenerado via scripts/generate-module-registry.mjs
│   └── moduleRoutes.tsx             # + rota /estoque
├── api/estoque.ts                   # NOVO — client HTTP + tipos
├── pages/estoque/
│   ├── EstoquePage.tsx              # NOVO — casca com abas (padrão EquipamentosPage)
│   ├── StockSummaryTab.tsx          # NOVO — resumo com saldos/lotes/alertas + botão movimentar
│   ├── StockMovementsTab.tsx        # NOVO — histórico com filtros
│   ├── StockItemsTab.tsx            # NOVO — lista/cadastro de itens
│   ├── StockItemFormModal.tsx       # NOVO — form condicional por tipo
│   └── StockMovementFormModal.tsx   # NOVO — form condicional por tipo de movimentação
└── pages/hubModules.ts              # hub já é dirigido pelo registry (sem mudança manual)
```

**Structure Decision**: web app existente (Option 2 do template, já é a estrutura do repo). O módulo replica 1:1 o layout do Equipamentos: registro central em `shared/modules/registry.json` (gera `registry.generated.ts` via `node scripts/generate-module-registry.mjs`), rota Express em `routes/resources/`, lógica de negócio em `lib/estoque/`, página com abas em `pages/estoque/`.

## Complexity Tracking

Sem violações da constitution — tabela não aplicável.
