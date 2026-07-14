# API Contract: Custos da Sede com Filtro de Período

**Feature**: 004-sede-filtros-periodo | **Date**: 2026-07-13

## `GET /acompanhamento/comercial/sede` (estendido)

Auth: `requireAuth + requireAcompanhamentoAccess` (inalterado).

### Query params (novos, opcionais)

| Param | Formato | Regra |
|-------|---------|-------|
| `from` | `YYYY-MM` | par atômico com `to`; mês inicial (inclusivo) |
| `to` | `YYYY-MM` | par atômico com `from`; mês final (inclusivo); `from <= to` |

Exemplos:

- `GET /sede` — todo o período (comportamento atual)
- `GET /sede?from=2026-03&to=2026-03` — mês de março/2026
- `GET /sede?from=2026-01&to=2026-03` — 1º trimestre 2026
- `GET /sede?from=2026-01&to=2026-06` — 1º semestre 2026
- `GET /sede?from=2025-01&to=2025-12` — ano 2025
- `GET /sede?from=2025-10&to=2026-02` — personalizado

### Respostas

| Código | Caso |
|--------|------|
| 200 | Shape atual + campo aditivo `availableMonths: string[]` (meses `YYYY-MM` com lançamento, ordenados). Com filtro, todos os agregados (summary, cards, monthly, topCategories, counts, lastPurchaseDate) restritos ao intervalo; lançamentos sem data excluídos. Sem filtro, resposta atual + `availableMonths` (sem-data incluído nos agregados como hoje) |
| 400 | Zod: formato inválido, só um dos dois params, `to < from` — mensagens pt-BR |

## Frontend (`frontend/src/api/acompanhamentoComercial.ts`)

- `getSedeCosts(params?: { from: string; to: string })` — monta a query string quando presente.
- `SedeCostsResponse` ganha `availableMonths: string[]`.
- Tradução período→intervalo e rótulos pt-BR: helpers puros no frontend (testáveis por tipo:
  mês, trimestre T1–T4, semestre S1/S2, ano, personalizado).
- Cache: `useQuery({ queryKey: ['sede-costs', from ?? null, to ?? null] })`.
