# Data Model: Custos manuais no Acompanhamento

## ProjectManualCost

Representa um custo gerencial lançado manualmente para um projeto.

| Field | Type | Rules |
|-------|------|-------|
| `id` | string | Identificador único |
| `projectId` | string | Obrigatório; referencia projeto ativo |
| `description` | string | Obrigatória; trim; máximo 120 caracteres |
| `amount` | decimal | Obrigatório; maior que zero; máximo 999999999.99; 2 casas decimais |
| `costDate` | date/time nullable | Opcional; quando ausente usa criação como referência visual |
| `note` | string nullable | Opcional; trim; máximo 500 caracteres |
| `createdByUserId` | string nullable | Usuário gestor que criou; preserva custo se usuário for removido |
| `deletedAt` | date/time nullable | Null para ativo; preenchido no soft delete |
| `createdAt` | date/time | Data de criação |
| `updatedAt` | date/time | Data de atualização |

## Relationships

- `ProjectManualCost` pertence a `Project`.
- `ProjectManualCost` pode ter um `User` criador.
- `Project` possui vários `ProjectManualCost`.

## State Transitions

| From | Event | To | Effect |
|------|-------|----|--------|
| Active | Gestor exclui lançamento | Deleted | `deletedAt` preenchido; deixa de compor cálculos |
| Deleted | Consulta de totais | Deleted | Registro é ignorado |

## Aggregations

- Total manual por projeto = soma de `amount` onde `deletedAt` é null.
- Custo realizado gerencial = Omie sem salários + estoque + total manual.
- Agrupamentos somam totais manuais dos projetos membros visíveis.
