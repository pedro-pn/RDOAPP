# Data Model: Filtros de Período na Aba Sede

**Feature**: 004-sede-filtros-periodo | **Date**: 2026-07-13

**Sem migration Prisma** — o filtro opera sobre `OmiePurchase` existente; nenhuma escrita.

## Conceitos

### Período selecionado (frontend — não persiste)

| Campo | Valores | Regra |
|-------|---------|-------|
| `periodType` | `all` \| `month` \| `quarter` \| `semester` \| `year` \| `custom` | default `all` |
| `month` | `YYYY-MM` | quando `periodType = month` |
| `quarter` | ano + T1..T4 (jan–mar, abr–jun, jul–set, out–dez) | → `from`/`to` de 3 meses |
| `semester` | ano + S1/S2 (jan–jun, jul–dez) | → `from`/`to` de 6 meses |
| `year` | `YYYY` | → `YYYY-01`..`YYYY-12` |
| `custom` | `from` + `to` (`YYYY-MM`) | `from <= to`, limitado por `availableMonths` |

Toda seleção reduz-se a `{ from: 'YYYY-MM', to: 'YYYY-MM' }`; `all` = sem parâmetros.

Rótulos pt-BR (gerados no cliente): `Março/2026`, `1º trimestre 2026`, `1º semestre 2026`,
`2025`, `Out/2025 – Fev/2026`, `Todo o período`.

### Query da rota (Zod — backend)

| Param | Regra |
|-------|-------|
| `from` | `^\d{4}-\d{2}$`, mês 01–12; obrigatório se `to` presente |
| `to` | idem; obrigatório se `from` presente; `from <= to` (superRefine) |
| (ausentes) | comportamento atual intacto |

Erros 400 com mensagem pt-BR (ex.: "Período inválido: mês final anterior ao inicial.").

### `buildSedeCostCards(purchases, { centers, now, monthsLimit, range })`

- `range` (novo, opcional): `{ fromMonth: 'YYYY-MM', toMonth: 'YYYY-MM' }`.
- Com `range`: linha entra na agregação somente se `monthKey(purchaseDate(row))` ∈ [fromMonth,
  toMonth] (comparação lexicográfica de `YYYY-MM` é ordem cronológica); `'sem-data'` é descartado.
- Sem `range`: comportamento atual (inclui `'sem-data'`).
- `availableMonths` (novo no retorno): `Set` dos `monthKey` ≠ `'sem-data'` de **todas** as linhas
  recebidas (antes do filtro), ordenado ascendente.

## Resposta da rota (shape — retrocompatível)

```jsonc
{
  "codes": ["..."],
  "currentMonth": "2026-07",
  "currentMonthLabel": "jul 2026",
  "availableMonths": ["2025-01", "2025-02", "..."],   // NOVO
  "summary": { "total": 0, "paidTotal": 0, "openTotal": 0, "currentMonthTotal": 0, "count": 0 },
  "cards": [ { /* shape atual inalterado: total, paidTotal, openTotal, currentMonthTotal,
                 count, lastPurchaseDate, monthly[], topCategories[] */ } ]
}
```

Invariantes:

- Sem `from`/`to`: resposta idêntica à atual, exceto pelo campo aditivo `availableMonths` (SC-003).
- Com filtro: `summary.total` = Σ `cards[].total` (SC-001); todos os agregados restritos ao
  intervalo; `monthly` contém apenas meses do intervalo.

## Consumidores

- `SedeCostsBoard.tsx`: único consumidor da rota; ganha a barra de filtros e o KPI dinâmico.
- Nenhum outro código lê `listSedeCosts`/`buildSedeCostCards` além da rota `/sede` e dos testes.
