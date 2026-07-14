# Research: Filtros de Período na Aba Sede

**Feature**: 004-sede-filtros-periodo | **Date**: 2026-07-13

Nenhum NEEDS CLARIFICATION restou na spec; decisões consolidadas a partir do código existente.

## R1. Como a aba Sede agrega custos hoje

**Investigação** (`backend/src/lib/acompanhamento/sede-costs.js`,
`backend/src/routes/resources/acompanhamento-comercial.js:159-167`,
`frontend/src/components/projects/SedeCostsBoard.tsx`):

- Rota `GET /acompanhamento/comercial/sede` (sem parâmetros) → `listSedeCosts()` → busca
  `OmiePurchase` dos centros da Sede (`SEDE_OMIE_CODES`) + `buildSedeCostCards(purchases,
  { monthsLimit: 12 })`.
- `buildSedeCostCards` é **função pura** (recebe as compras, devolve summary + cards) — já coberta
  por `backend/test/acompanhamento-sede-costs.test.js`.
- Data de referência do lançamento: `purchaseDate(row)` = `dataPrevisao ?? dataVencimento ??
  dataEmissao ?? syncedAt` (sede-costs.js:17-19); sem nenhuma → bucket `'sem-data'`.
- Agregados por card: `total`, `paidTotal`, `openTotal`, `currentMonthTotal`, `count`,
  `lastPurchaseDate`, `monthly[]` (12 meses, label pt-BR), `topCategories[]` (top 5).
- Frontend: KPIs (Centros, Total, mês corrente, Em aberto) + grid de cards; sem nenhum filtro;
  `useQuery({ queryKey: ['sede-costs'] })`.

**Decision**: Introduzir o recorte dentro de `buildSedeCostCards` via opção `range` (novo
parâmetro `{ fromMonth, toMonth }` em chaves `YYYY-MM`): linhas cujo `monthKey(purchaseDate)` cai
fora do intervalo (ou é `'sem-data'`) são ignoradas quando `range` está presente.
**Rationale**: A função é pura e testada — o filtro entra no único ponto por onde todas as somas
passam (loop de agregação), garantindo SC-001 (consistência interna) por construção.
**Alternatives considered**: Filtrar na consulta Prisma por data (rejeitado: `purchaseDate` é um
fallback em cascata de 4 colunas — reproduzi-lo em SQL/Prisma duplicaria a regra e poderia
divergir; o volume de lançamentos da Sede é pequeno, filtrar em memória é trivial); filtrar no
frontend (rejeitado: o cliente só recebe agregados — categorias e pago/aberto por período não são
reconstruíveis a partir do payload atual).

## R2. Contrato da API: tipos de período vs intervalo de meses

**Decision**: A rota aceita apenas `from` e `to` (`YYYY-MM`, ambos obrigatórios quando um vier;
`from <= to`), validados com Zod. O frontend traduz o tipo de período escolhido (mês, trimestre,
semestre, ano, personalizado) para o intervalo correspondente e monta os rótulos pt-BR.
**Rationale**: API mínima e estável — trimestre/semestre/ano são açúcar de UI sobre um intervalo
de meses; um tipo novo de período no futuro não muda o contrato. Validação de negócio
(`from <= to`, formato) fica num único schema Zod (Constituição III).
**Alternatives considered**: Enviar `periodType` + `period` (ex.: `quarter=2026-Q1`) e traduzir no
backend (rejeitado: duplica no servidor uma lógica puramente de apresentação e engorda o schema);
granularidade de dia (rejeitado: custos administrativos são mensais; a spec assume mês).

## R3. Opções de período ofertadas ao usuário (FR-004)

**Decision**: A resposta ganha `availableMonths: string[]` (chaves `YYYY-MM` distintas com
lançamento, ordenadas, calculadas **sempre sobre o conjunto completo** — antes de aplicar o
`range`). O frontend deriva daí: meses (diretos), trimestres/semestres/anos (conjuntos dos meses
presentes) e os limites do personalizado.
**Rationale**: Evita ofertar períodos vazios ou esconder períodos com dados; um único campo
serve a todos os tipos; custo de cálculo desprezível (um `Set` no mesmo passe).
**Alternatives considered**: Endpoint separado de metadados (rejeitado: segunda chamada para um
dado que sai de graça no mesmo passe); gerar períodos fixos dos últimos N anos no cliente
(rejeitado: violaria FR-004 — períodos sem dados apareceriam).

## R4. Comportamento dos agregados sob filtro

**Decision**:
- `summary` e cada card (total/pago/aberto/contagem/categorias/monthly/lastPurchaseDate) contam
  apenas lançamentos do intervalo.
- `currentMonthTotal`/`currentMonth*` continuam calculados (o mês corrente pode ou não estar no
  intervalo); o frontend é quem decide o rótulo do 3º KPI: sem filtro → mês corrente (como hoje);
  com filtro → rótulo do período com `summary.total`.
- `monthly` mostra os meses do intervalo (o `monthsLimit` atual continua o teto de exibição;
  ano = 12 meses cabe no limite).
- Lançamentos `'sem-data'`: só entram sem filtro (FR-006) — com filtro são descartados no loop.
**Rationale**: Mantém o shape da resposta 100% retrocompatível (SC-003): nenhum campo removido,
apenas `availableMonths` adicionado; o cliente atual sem parâmetros recebe resposta idêntica.
**Alternatives considered**: Remover `currentMonthTotal` quando filtrado (rejeitado: quebra de
shape sem ganho); campo novo `periodTotal` (rejeitado: `summary.total` já é o total do período
quando há filtro).

## R5. UI: padrão de filtros e responsividade (FR-008, Constituição II/VI)

**Investigação**: O dashboard do Acompanhamento usa `page-card acp-filters` com `field-group`
(label + `select`/`input` nativos herdando o estilo global) —
`AcompanhamentoDashboard.tsx:129-165`; `.acp-filters` é grid que vira 2 colunas ≤900px e 1 coluna
no breakpoint menor (`base.css:1735-1741`, `:1863`). A aba Sede (`SedeCostsBoard`) renderiza
dentro do mesmo shell `acp-dash`.

**Decision**: Barra de filtros no topo da aba Sede com o mesmo padrão: `page-card acp-filters` e
dois `field-group` ("Período" = tipo; segundo select contextual com o período específico; no
personalizado, dois selects de mês de/até). Selects nativos, sem componente novo. KPI do período
reaproveita as classes `acp-kpi*` existentes.
**Rationale**: Consistência visual é requisito explícito do pedido e da Constituição VI — copiar
a tela análoga do próprio módulo é o caminho previsto; responsividade vem de graça das classes.
**Alternatives considered**: Chips/botões de período (rejeitado: padrão inexistente no app —
criaria variante visual nova, vetada pela Constituição VI); date-range picker custom (rejeitado:
biblioteca nova fora da stack fixa e granularidade de dia desnecessária).

## R6. Estado do filtro e cache

**Decision**: Estado local no `SedeCostsBoard` (`useState` para tipo + seleção), requisição via
`useQuery({ queryKey: ['sede-costs', from, to] })`; troca de tipo reseta a seleção para o período
mais recente disponível do novo tipo. Sem persistência do filtro entre visitas.
**Rationale**: A aba é autocontida (o componente já possui sua própria query); react-query cacheia
por período visitado. Persistência/estado global (zustand/URL) só se houver demanda futura.
**Alternatives considered**: Filtro na URL (rejeitado: as outras abas do Acompanhamento não fazem
isso — consistência de comportamento); zustand (rejeitado: estado não é compartilhado com nada).
