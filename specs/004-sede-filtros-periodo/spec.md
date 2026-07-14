# Feature Specification: Filtros de Período na Aba Sede do Acompanhamento

**Feature Branch**: `004-sede-filtros-periodo`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "Na aba SEDE do módulo de acompanhamento, filtros para mostrar custos de meses, semestres, trimestres, anos, etc. Mantenha consistência visual."

## Contexto

A aba Sede do Acompanhamento mostra os custos administrativos dos centros de custo da Sede (lançamentos do Omie): KPIs no topo (centros ativos, total, mês atual, em aberto) e um card por centro com total, pago, em aberto, últimos meses e principais categorias. Hoje **não há filtro de período**: os totais são de todo o histórico e o único recorte temporal é o KPI fixo do mês corrente e a lista dos últimos 12 meses dentro de cada card.

Esta feature adiciona um filtro de período — mês, trimestre, semestre, ano, intervalo personalizado ou todo o período — que recorta **todos** os números da aba (KPIs, cards, categorias) para o período escolhido, seguindo o padrão visual de filtros já usado no dashboard do Acompanhamento.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Filtrar custos da Sede por período (Priority: P1)

O gestor abre a aba Sede e escolhe um tipo de período (mês, trimestre, semestre ou ano) e o período específico (ex.: "Março/2026", "1º trimestre 2026", "1º semestre 2026", "2025"). Todos os números da aba — KPIs, total/pago/em aberto de cada centro, contagem de lançamentos e principais categorias — passam a refletir somente os lançamentos daquele período. Limpar o filtro volta à visão de todo o período (comportamento atual).

**Why this priority**: É a feature em si — sem o recorte por período aplicado a todos os números, nada muda para o usuário.

**Independent Test**: Com lançamentos em meses distintos, selecionar "Mês → Março/2026" e conferir que KPIs e cards mostram apenas os valores de março; selecionar "Todo o período" e conferir que os números voltam aos atuais.

**Acceptance Scenarios**:

1. **Given** a aba Sede com lançamentos em vários meses, **When** o gestor seleciona tipo "Mês" e um mês específico, **Then** KPIs, totais dos cards, pago/em aberto, contagens e categorias principais consideram apenas lançamentos daquele mês.
2. **Given** um filtro de trimestre/semestre/ano selecionado, **When** os dados são exibidos, **Then** o recorte cobre exatamente os meses do período (trimestre = 3 meses, semestre = 6, ano = 12) e a lista de meses dentro de cada card mostra os meses do período.
3. **Given** qualquer filtro ativo, **When** o gestor seleciona "Todo o período", **Then** a aba volta a exibir exatamente o que exibe hoje (mesmos números, mesmo layout).
4. **Given** um período sem nenhum lançamento, **When** o filtro é aplicado, **Then** os cards exibem zeros/vazio com as mensagens padrão ("Sem custos lançados", "Sem categorias"), sem erro.
5. **Given** um filtro de período ativo, **When** o gestor observa o KPI que hoje mostra o mês corrente, **Then** ele passa a identificar o período selecionado (rótulo do período) com o total correspondente.

---

### User Story 2 - Período personalizado (Priority: P2)

O gestor escolhe "Personalizado" e informa um intervalo de meses (de/até) para análises que não se encaixam nos períodos fixos (ex.: um projeto interno que durou 4 meses, ou comparar out/2025–fev/2026).

**Why this priority**: Cobre o "etc." do pedido; é útil, mas os períodos fixos resolvem a maior parte dos casos.

**Independent Test**: Selecionar "Personalizado" com de = outubro/2025 e até = fevereiro/2026 e conferir que os números refletem exatamente esses 5 meses.

**Acceptance Scenarios**:

1. **Given** tipo "Personalizado" selecionado, **When** o gestor informa mês inicial e mês final, **Then** o recorte cobre do primeiro dia do mês inicial ao último dia do mês final.
2. **Given** mês final anterior ao mês inicial, **When** o gestor tenta aplicar, **Then** o sistema impede com mensagem clara em português.

---

### Edge Cases

- Lançamentos sem data (hoje agrupados como "Sem data"): aparecem apenas em "Todo o período"; em qualquer filtro de período ficam de fora (não têm como pertencer a um período).
- Períodos disponíveis para seleção devem derivar dos dados existentes (do mês do lançamento mais antigo ao mais recente) — não oferecer períodos vazios infinitos nem esconder períodos com dados.
- Filtro selecionado em um tipo (ex.: ano 2025) e troca de tipo (ex.: para mês): a seleção deve se ajustar sem quebrar (voltar ao período mais recente do novo tipo ou a "Todo o período").
- Centro de custo sem lançamentos no período: card permanece visível com zeros (consistente com o comportamento atual de centros vazios).
- Mobile: a barra de filtros segue o padrão responsivo dos filtros do Acompanhamento (empilha em telas estreitas, sem scroll horizontal).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A aba Sede DEVE oferecer um filtro de período com os tipos: Todo o período (padrão), Mês, Trimestre, Semestre, Ano e Personalizado (intervalo de meses).
- **FR-002**: Com um período selecionado, TODOS os números da aba DEVEM refletir apenas os lançamentos do período: KPIs do topo, total/pago/em aberto/contagem por centro, lista de meses do card e principais categorias.
- **FR-003**: O tipo "Todo o período" DEVE reproduzir exatamente o comportamento atual da aba (padrão ao abrir).
- **FR-004**: As opções de período específico (quais meses/trimestres/semestres/anos aparecem para escolha) DEVEM derivar do intervalo de datas dos lançamentos existentes.
- **FR-005**: O KPI de recorte temporal do topo DEVE exibir o rótulo do período selecionado (ex.: "1º trim. 2026") com o total do período; sem filtro, permanece o mês corrente como hoje.
- **FR-006**: Lançamentos sem data DEVEM ser incluídos apenas em "Todo o período" e excluídos de qualquer recorte.
- **FR-007**: O recorte DEVE ser validado no backend (parâmetros de período validados com schema antes de tocar em consulta), não apenas no cliente.
- **FR-008**: A barra de filtros DEVE seguir o padrão visual dos filtros existentes do Acompanhamento (mesmo cartão, mesmos campos/labels/selects estilizados) e funcionar em mobile (empilhada, sem scroll horizontal).
- **FR-009**: Rótulos de período em português (ex.: "Março/2026", "1º trimestre 2026", "1º semestre 2026", "2025").

### Key Entities

- **Lançamento de custo da Sede (existente)**: compra do Omie atribuída a um centro de custo da Sede, com valor, status (pago/em aberto), categoria e data de referência; o período do lançamento deriva dessa data.
- **Período selecionado**: recorte temporal escolhido pelo usuário (tipo + identificação do período), traduzido para um intervalo de meses fechado.
- **Agregado da Sede (existente)**: KPIs + cards por centro; passa a ser calculável para um intervalo de meses.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Para qualquer período selecionado, a soma dos totais dos cards é igual ao KPI de total do período (consistência interna em 100% dos casos).
- **SC-002**: Selecionar um mês específico reproduz, para aquele mês, os mesmos valores que a lista mensal do card já exibe hoje para o mesmo mês (paridade com os dados existentes).
- **SC-003**: Sem filtro aplicado, a aba é indistinguível da versão atual (zero regressão visual e numérica).
- **SC-004**: O gestor consegue responder "quanto a Sede gastou no trimestre X" em até 3 interações (tipo → período → leitura).

## Assumptions

- O filtro é por data de referência do lançamento (mesma data já usada hoje para agrupar meses no card: previsão → vencimento → emissão → sincronização, na ordem de fallback existente).
- Trimestres e semestres são do calendário civil (T1 = jan–mar, S1 = jan–jun).
- Período personalizado tem granularidade de mês (de mês/ano até mês/ano) — granularidade de dia não é necessária para custos administrativos mensais.
- O recorte é calculado no backend (a aba só recebe agregados; os lançamentos individuais não trafegam para o cliente hoje e isso não muda).
- Nenhuma mudança de schema de banco: o filtro é sobre dados já existentes.
- A ordenação e o limite de categorias principais (top 5) e de meses exibidos no card permanecem os atuais, aplicados dentro do período.
