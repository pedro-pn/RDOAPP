# Implementation Plan: Filtros de Período na Aba Sede do Acompanhamento

**Branch**: `004-sede-filtros-periodo` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-sede-filtros-periodo/spec.md`

## Summary

Adicionar à aba Sede um filtro de período (Todo o período / Mês / Trimestre / Semestre / Ano / Personalizado por intervalo de meses) que recorta todos os agregados da aba. Abordagem: o recorte é feito **no backend** — `GET /acompanhamento/comercial/sede` passa a aceitar `from`/`to` (meses `YYYY-MM`, validados com Zod), `buildSedeCostCards` (função pura já testada) ganha um parâmetro de intervalo que filtra os lançamentos pela mesma data de referência usada hoje (`purchaseDate`: previsão → vencimento → emissão → sync), e a resposta ganha `availableMonths` (união dos meses com lançamento) para o frontend montar as opções de período. No frontend, `SedeCostsBoard.tsx` ganha uma barra de filtros no padrão existente do módulo (`page-card acp-filters` + `field-group` com selects nativos estilizados, como em `AcompanhamentoDashboard.tsx:129-165`), com react-query re-consultando por período. Sem filtro, requisição e resposta são idênticas às atuais (zero regressão).

## Technical Context

**Language/Version**: Node.js + Express (backend, ESM), React + Vite + TypeScript (frontend)

**Primary Dependencies**: Prisma + PostgreSQL (leitura de `OmiePurchase`), Zod (validação da query), @tanstack/react-query

**Storage**: Sem mudança de schema — filtro sobre dados existentes de `OmiePurchase`

**Testing**: `backend/test/acompanhamento-sede-costs.test.js` (existente — estender; `buildSedeCostCards` é pura e testável)

**Target Platform**: Web (mobile-first)

**Project Type**: Web application (backend + frontend)

**Performance Goals**: Sem novos requisitos — a consulta atual já traz os lançamentos da Sede; o filtro reduz o conjunto agregado

**Constraints**: "Todo o período" = comportamento atual byte a byte; períodos ofertados derivam dos dados (`availableMonths`); lançamentos sem data só em "Todo o período"

**Scale/Scope**: 1 rota estendida (query params), 1 função pura ajustada, 1 componente frontend estendido + tipos; ~2 arquivos backend, ~2 frontend

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação |
|-----------|-----------|
| I. Operação de servidor | ✅ Nenhum comando de servidor; feature só de aplicação |
| II. UI pt-BR e mobile-first | ✅ Filtros no padrão `acp-filters`, que já empilha em telas estreitas (`base.css:1735-1741` + media queries existentes); rótulos pt-BR (FR-009) |
| III. Zod nas duas pontas | ✅ Query `from`/`to` validada com Zod no backend; no cliente os selects só oferecem opções válidas derivadas de `availableMonths` |
| IV. Banco só via Prisma | ✅ Sem mudança de schema; leitura via Prisma existente |
| V. Testes de lógica de negócio | ✅ `buildSedeCostCards` com intervalo + `availableMonths` testados em `backend/test/acompanhamento-sede-costs.test.js` |
| VI. Consistência visual | ✅ Reuso literal do padrão de filtros do dashboard (`page-card acp-filters` + `field-group` + selects herdando o estilo global de `base.css`); nenhum componente novo fora do kit; a aba já usa o shell largo do Acompanhamento |

**Resultado**: PASS — sem violações (Complexity Tracking vazio).

*Re-check pós-Phase 1*: PASS — design não introduziu schema novo nem componente visual fora do padrão.

## Project Structure

### Documentation (this feature)

```text
specs/004-sede-filtros-periodo/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões e racional
├── data-model.md        # Phase 1 — shapes e regras
├── quickstart.md        # Phase 1 — guia de validação
├── contracts/
│   └── sede-api.md      # Phase 1 — contrato do endpoint
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── lib/acompanhamento/sede-costs.js       # buildSedeCostCards ganha { range } +
│   │                                          # availableMonths; listSedeCosts repassa
│   └── routes/resources/acompanhamento-comercial.js  # GET /sede: query Zod from/to
└── test/
    └── acompanhamento-sede-costs.test.js      # estender: recorte, sem-data, availableMonths

frontend/
└── src/
    ├── api/acompanhamentoComercial.ts         # getSedeCosts(params?) + tipos (availableMonths)
    └── components/projects/SedeCostsBoard.tsx # barra acp-filters + estado do período +
                                               # queryKey ['sede-costs', from, to] + KPI dinâmico
```

**Structure Decision**: Web application existente; mudança encaixada nos 4 arquivos acima, sem módulos novos.

## Design Decisions (resumo)

1. **Recorte no backend, granularidade de mês** — todos os tipos de período (mês, trimestre, semestre, ano, personalizado) reduzem-se a um intervalo `from`/`to` em `YYYY-MM`; a rota traduz para intervalo de datas fechado e `buildSedeCostCards` descarta lançamentos fora dele (e os "sem data", quando há filtro). O frontend continua recebendo só agregados.
2. **Tradução período→intervalo no frontend** — o cliente converte "1º trimestre 2026" em `from=2026-01&to=2026-03` e envia só o intervalo; o backend não conhece tipos de período (API mínima; tipos novos no futuro não mudam o contrato). Rótulos pt-BR gerados no cliente.
3. **`availableMonths` na resposta** — união ordenada dos meses com lançamento (sempre do conjunto completo, ignorando o filtro ativo), para montar as opções de mês/trimestre/semestre/ano com dados reais (FR-004). Calculado no mesmo passe de agregação.
4. **Sem filtro = código atual** — `range` ausente mantém exatamente o fluxo de hoje, incluindo o bucket "sem-data" e o KPI do mês corrente (SC-003).
5. **KPI dinâmico** — com filtro ativo, o terceiro KPI troca "mês atual" pelo rótulo do período selecionado com o total do recorte; a lista de meses do card mostra os meses do período (limites de exibição atuais mantidos).
6. **Estado do filtro local ao componente** (useState em `SedeCostsBoard`) com `queryKey ['sede-costs', from, to]` — sem estado global; trocar o tipo de período reseta a seleção para o período mais recente disponível do novo tipo.

Detalhes e alternativas em [research.md](./research.md).

## Complexity Tracking

Sem violações — tabela não aplicável.
