# Data Model: Efetivo Operacional — Planejamento Completo

## Visão geral

O planejamento operacional complementa os cadastros canônicos existentes. `Project`, `Collaborator`, `JobRole`, `User`, `CollaboratorAbsence` e `EfetivoSetting` permanecem fontes de verdade. Um mesmo grafo relacional representa o plano oficial e cada cenário, evitando patches JSON com regras diferentes.

```text
EfetivoPlan
├── EfetivoMissionPlan
│   ├── EfetivoMissionDemand
│   └── EfetivoMissionAllocation
└── EfetivoPlannedHire
```

## Enums

### EfetivoPlanKind

- `OFFICIAL`
- `SCENARIO`

### EfetivoPlanStatus

- `ACTIVE`: oficial vigente.
- `DRAFT`: cenário editável.
- `APPLIED`: cenário aplicado; terminal e idempotente.
- `DISCARDED`: cenário descartado; terminal.
- `SUPERSEDED`: oficial antigo ou cenário cuja base não é mais vigente; somente leitura.

### EfetivoMissionScheduleStatus

- `DRAFT`: visível no planejamento, sem consumir capacidade oficial.
- `CONFIRMED`: consome capacidade e participa de calendário/alertas.
- `CANCELLED`: histórico preservado, sem consumir capacidade.

### EfetivoMissionStage

- `STANDBY`
- `MOBILIZATION`
- `EXECUTION`
- `FINAL_MEASUREMENT`
- `FINISHED`

Transições podem avançar ou voltar por decisão do gestor; toda transição é auditada. `FINISHED` permanece em leitura e não apaga a equipe histórica.

### EfetivoAllocationSource

- `MANUAL`
- `AUTOMATIC`
- `SCENARIO_COPY`

## Alterações em entidades existentes

### Collaborator

Novos atributos:

- `jobRoleId: String?` — vínculo estável com `JobRole`.
- `efetivoNote: String?` — observação operacional exibida no módulo.

Regras:

- Durante a transição, `role` continua sendo snapshot textual.
- Ao selecionar um cargo, `jobRoleId` e `role` são atualizados juntos.
- O backfill preenche apenas correspondências normalizadas inequívocas; ambiguidades permanecem nulas e são exibidas como pendência.

### JobRole

Novos atributos:

- `calendarColor: String` — hexadecimal válido, com cor neutra inicial.
- `continuousWorkLimitDays: Int?` — inteiro de 1 a 365; `null` usa fallback empresarial 90/60/30.

### CollaboratorAbsence

Sem nova entidade. A superfície libera `FERIAS`, `FOLGA` e `AFASTAMENTO`; `ASO` e `TREINAMENTO` continuam reservados. Adicionar índice `(collaboratorId, deletedAt, startDate, endDate)` para as consultas de conflito.

## Novas entidades

### EfetivoPlan

Contexto comum para o plano oficial e simulações.

| Campo | Tipo/regra |
|---|---|
| `id` | identificador |
| `kind` | `EfetivoPlanKind` |
| `status` | `EfetivoPlanStatus` |
| `name` | obrigatório para cenário; nome estável para oficial |
| `objective` | texto opcional |
| `revision` | inteiro monotônico; inicia em 1 |
| `basePlanId` | FK opcional para o oficial copiado |
| `baseOfficialRevision` | revisão capturada ao criar cenário |
| `appliedPlanId` | FK opcional para o oficial criado na aplicação |
| `createdByUserId` / `appliedByUserId` | autoria |
| `appliedAt` / `discardedAt` / `supersededAt` | estados terminais |
| `createdAt` / `updatedAt` | timestamps |

Garantias:

- Apenas um plano `OFFICIAL/ACTIVE`; impor por índice parcial SQL na migração e por lock transacional.
- Só `SCENARIO/DRAFT` pode ser editado ou aplicado.
- Toda mutação no oficial incrementa `revision` na mesma transação.
- Aplicação de cenário já `APPLIED` retorna `appliedPlanId`, sem duplicar efeitos/auditoria.

### EfetivoMissionPlan

Programação operacional de um projeto dentro de um plano.

| Campo | Tipo/regra |
|---|---|
| `id` | identificador |
| `planId` | FK para `EfetivoPlan` |
| `projectId` | FK para `Project` |
| `scheduleStatus` | `EfetivoMissionScheduleStatus`, default `DRAFT` |
| `stage` | `EfetivoMissionStage`, default `STANDBY` |
| `headquartersResponsibleName` | texto obrigatório |
| `headquartersResponsibleRole` | texto obrigatório |
| `headquartersResponsibleCollaboratorId` | FK opcional para `Collaborator` |

O formulário seleciona o responsável entre contas ativas de coordenador. Nome e cargo são persistidos como snapshots; quando a conta possui `collaboratorId`, o vínculo e o cargo vêm desse colaborador. Sem vínculo na conta, o usuário pode selecionar um líder ou informar o cargo livremente.
| `mobilizationDate` | data civil obrigatória |
| `executionStartDate` | data civil obrigatória |
| `executionEndDate` | data civil obrigatória |
| `returnDate` | data civil obrigatória |
| `version` | concorrência otimista, inicia em 1 |
| `kanbanOrder` | inteiro não negativo por etapa |
| `createdByUserId` / `updatedByUserId` | autoria |
| `deletedAt` | exclusão lógica |
| `createdAt` / `updatedAt` | timestamps |

Validações:

- Restrição única `(planId, projectId)`.
- Projeto não excluído.
- `mobilizationDate ≤ executionStartDate ≤ executionEndDate ≤ returnDate`.
- `CONFIRMED` exige ao menos uma demanda positiva.
- Mudança de datas/demanda revalida todas as alocações.

Índices: `(planId, scheduleStatus, mobilizationDate, returnDate)`, `(planId, stage, kanbanOrder)`, `(planId, deletedAt)`.

### EfetivoMissionDemand

| Campo | Tipo/regra |
|---|---|
| `missionId` | FK para programação |
| `jobRoleId` | FK para função operacional |
| `requiredCount` | inteiro positivo |
| `createdAt` / `updatedAt` | timestamps |

Restrição única `(missionId, jobRoleId)`. Demanda zero remove a linha.

### EfetivoMissionAllocation

| Campo | Tipo/regra |
|---|---|
| `id` | identificador |
| `missionId` | FK para programação |
| `collaboratorId` | FK para colaborador |
| `jobRoleId` | função/vaga ocupada |
| `jobRoleNameSnapshot` | nome histórico da função |
| `source` | `EfetivoAllocationSource` |
| `createdByUserId` | autoria |
| `deletedAt` | exclusão lógica |
| `createdAt` / `updatedAt` | timestamps |

Restrições:

- Única por `(missionId, collaboratorId)`; restauração atualiza a linha excluída.
- Função precisa existir na demanda e não ultrapassar `requiredCount`, salvo atualização explícita conjunta.
- Colaborador ativo no intervalo, da função correta e sem missão confirmada/ausência sobreposta.

Índices: `(collaboratorId, deletedAt)`, `(missionId, jobRoleId, deletedAt)`.

### EfetivoPlannedHire

Necessidade de contratação dentro de um plano; não cria colaborador fictício.

| Campo | Tipo/regra |
|---|---|
| `id` | identificador |
| `planId` | FK para plano |
| `jobRoleId` | FK para função |
| `quantity` | inteiro positivo |
| `availableFrom` | data civil |
| `createdAt` / `updatedAt` | timestamps |

Restrição única `(planId, jobRoleId, availableFrom)`. Em cenários entra na capacidade simulada; após aplicação permanece como necessidade planejada separada do KPI de colaboradores ativos.

### EfetivoHoliday

| Campo | Tipo/regra |
|---|---|
| `id` | identificador |
| `holidayDate` | data civil única |
| `name` | texto obrigatório |
| `createdByUserId` / `updatedByUserId` | autoria |
| `deletedAt` | exclusão lógica |
| `createdAt` / `updatedAt` | timestamps |

Recriar a mesma data restaura/atualiza o registro excluído. O calendário administrável do Efetivo não altera silenciosamente os feriados hardcoded usados por hora extra.

### EfetivoSetting (extensão)

Adicionar a chave `plannedUtilizationTarget` com default `80`, validada entre 0 e 100. Mudanças incrementam a revisão oficial e são auditadas.

### EfetivoAuditEvent

| Campo | Tipo/regra |
|---|---|
| `id` | identificador |
| `planId` | FK opcional para plano |
| `actorUserId` | FK opcional para usuário |
| `action` | ação estável (`MISSION_CREATE`, `ALLOCATION_ADD`, etc.) |
| `entityType` | tipo do alvo |
| `entityId` | id do alvo |
| `summary` | descrição curta em pt-BR |
| `beforeData` / `afterData` | snapshots JSON opcionais e minimizados |
| `ipAddress` / `userAgent` | evidência opcional da requisição |
| `createdAt` | timestamp |

Índices: `(createdAt)`, `(entityType, entityId, createdAt)`, `(actorUserId, createdAt)`, `(planId, createdAt)`.

Dados sensíveis ou segredos nunca entram nos snapshots.

## Regras derivadas (sem persistência duplicada)

### Situação na data

1. Fora do vínculo ativo: não compõe o efetivo.
2. Ausência ativa: `INDISPONIVEL`.
3. Alocação em missão confirmada: `ALOCADO`.
4. Caso contrário: `LIVRE`.

### Déficit por função

`max(0, demanda confirmada − alocações válidas)` para a data, agrupado por `jobRoleId`.

### Utilização de 90 dias

- Janela inclusiva `[data, data + 89 dias]`.
- Denominador: dias úteis do vínculo operacional, removendo feriados e ausências.
- Numerador: pares pessoa/dia distintos ocupados por missão confirmada.
- Resultado: `numerador ÷ denominador`; sem denominador retorna `null`.
- Contratações planejadas aparecem em projeção separada e nunca aumentam efetivo ativo.

### Permanência contínua

- Unir intervalos confirmados sobrepostos ou adjacentes por pessoa.
- Uma lacuna de ao menos um dia civil inteiro ou `FOLGA` explícita quebra a sequência.
- Contar dias corridos inclusivos; férias e afastamentos não viram dias de permanência.

### Aplicação de cenário

1. Bloquear cenário e plano oficial em uma única transação.
2. Se `APPLIED`, retornar `appliedPlanId` existente.
3. Confirmar `DRAFT` e comparar `baseOfficialRevision` com a revisão ativa.
4. Revalidar cronologia, demanda, vínculo, função, ausências e sobreposições do cenário materializado.
5. Clonar o cenário validado como novo `OFFICIAL/ACTIVE`, marcar o oficial anterior `SUPERSEDED` e o cenário `APPLIED`.
6. Gravar auditoria e vínculos de aplicação na mesma transação.
7. Se a base divergir, não alterar o oficial e marcar o cenário `SUPERSEDED`, retornando conflito 409.
