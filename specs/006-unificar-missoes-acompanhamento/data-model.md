# Data Model: Unificar Missões no Acompanhamento

## Entity: AcompanhamentoMissionGroup

Representa um agrupamento visual de missões no módulo Acompanhamento.

**Fields**

- `id`: identificador único.
- `name`: nome exibido no card/linha consolidada. Pode ser informado pelo gestor ou gerado pelo sistema.
- `status`: `ACTIVE` ou `DISSOLVED`.
- `createdByUserId`: usuário que criou o agrupamento, opcional para preservar histórico em caso de usuário removido.
- `dissolvedByUserId`: usuário que desmesclou o agrupamento, opcional.
- `createdAt`: data de criação.
- `updatedAt`: data da última alteração de nome/status.
- `dissolvedAt`: data de desmesclagem, nula enquanto ativo.
- `members`: lista de missões integrantes.

**Relationships**

- 1:N com `AcompanhamentoMissionGroupMember`.
- N:1 opcional com `User` para criação/desmesclagem.

**Validation Rules**

- `name` deve ter texto após trim e limite operacional de 120 caracteres.
- Grupo ativo deve ter pelo menos 2 membros ativos.
- Apenas grupos `ACTIVE` afetam Dashboard/Projetos.
- Grupo `DISSOLVED` é histórico e não oculta cards individuais.

**State Transitions**

- Criado como `ACTIVE`.
- `ACTIVE` -> `DISSOLVED` ao desmesclar.
- `DISSOLVED` não volta para `ACTIVE`; para reagrupar, cria-se um novo grupo.

## Entity: AcompanhamentoMissionGroupMember

Representa a participação de uma missão/projeto em um agrupamento.

**Fields**

- `id`: identificador único.
- `groupId`: referência ao agrupamento.
- `projectId`: referência à missão/projeto existente.
- `activeProjectId`: igual a `projectId` enquanto o agrupamento está ativo; `null` após desmesclar.
- `order`: ordem de exibição da missão dentro do card consolidado.
- `createdAt`: data de inclusão no grupo.

**Relationships**

- N:1 com `AcompanhamentoMissionGroup`.
- N:1 com `Project`.

**Validation Rules**

- `projectId` deve existir e não estar deletado.
- `@@unique([groupId, projectId])` evita duplicidade dentro do mesmo grupo.
- `activeProjectId` único evita que a mesma missão participe de mais de um grupo ativo.
- Ao desmesclar, todos os membros do grupo recebem `activeProjectId = null`.

## Entity: ConsolidatedProjectCard

Item derivado para a aba Projetos. Não é persistido; é calculado por requisição.

**Fields**

- `kind`: `GROUP`.
- `groupId`: id do agrupamento.
- `name`: nome do agrupamento.
- `code`: código sintético exibível, derivado dos códigos das missões.
- `clientName`: cliente predominante/compartilhado; se houver clientes diferentes, exibe rótulo misto.
- `members`: lista compacta de missões integrantes (`projectId`, `code`, `name`, `clientName`, `category`, `progressPct`).
- Métricas consolidadas equivalentes ao card individual: custos, faturamento, impostos, dias, horas, colaboradores, estoque, equipamentos, alertas, datas e progresso.

**Aggregation Rules**

- `plannedCost`, `realizedCost`, `stockCost`, `laborCost`, `laborCostBase`, `invoicedRevenue`, impostos monetários: soma dos membros com valor.
- `invoiceCount`, `workedDays`, `totalDays`, contagens de equipamentos quando não há identidade única: soma ou união conforme identidade disponível.
- `collaboratorsCount`: união de colaboradores por ID quando disponível; fallback para soma quando só houver contagem.
- `costConsumedPct`: `sum(realizedCost) / sum(plannedCost)`.
- `daysConsumedPct`: `sum(workedDays) / sum(totalDays)`.
- `workedHours`: soma horas normais/extras/planejadas; percentuais recalculados.
- `progressPct`: média ponderada por `plannedCost` dos membros com progresso; se não houver custo planejado, média dos membros com progresso; se nenhum membro tem progresso, `null`.
- `category`: `ANDAMENTO` se qualquer membro estiver em andamento; senão `FUTURO` se qualquer membro estiver futuro; senão `ARQUIVADO`.
- `lastDay`: data mais recente entre membros; em empate, `PARADO` prevalece sobre `TRABALHADO`, que prevalece sobre `SEM_RDO`.
- `alerts`: união por código/label; severidade mais alta prevalece.
- `startDate`: menor data de início conhecida.
- `expectedEndDate`: maior previsão de término conhecida.

## Entity: ConsolidatedDashboardRow

Item derivado para o Dashboard. Não é persistido; é calculado por requisição.

**Fields**

- `kind`: `GROUP`.
- `groupId`, `name`, `code`, `clientName`, `members`.
- Campos compatíveis com a linha individual existente sempre que possível: venda, custo previsto, realizado, faturamento, impostos, componentes, dias, RDOs, avanço e margem.

**Aggregation Rules**

- Valores monetários e componentes: soma.
- `expectedProfit`: soma quando disponível.
- `expectedMargin`: recalculada como `sum(expectedProfit) / sum(salePrice)`.
- `progressPct`: mesma regra ponderada do card consolidado.
- `rdoCount`, `plannedDays`, `workedDays`: soma.
- Linhas individuais de membros ativos são removidas da resposta agrupada.

## Validation and Error States

- `PROJECT_NOT_FOUND`: algum `projectId` não existe ou está deletado.
- `MIN_MEMBERS`: menos de 2 missões distintas.
- `PROJECT_ALREADY_GROUPED`: alguma missão já possui `activeProjectId` em outro grupo ativo.
- `GROUP_NOT_FOUND`: grupo inexistente.
- `GROUP_NOT_ACTIVE`: tentativa de renomear/desmesclar grupo já dissolvido.
- `FORBIDDEN`: usuário sem permissão de gestor tenta mutar.

## Non-Persisted UI State

- Seleção atual de cards antes de confirmar unificação.
- Estado de loading/erro das mutações.
- Confirmação de desmesclagem.
- Busca/filtro corrente do usuário.
