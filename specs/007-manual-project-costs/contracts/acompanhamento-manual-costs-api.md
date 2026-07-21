# API Contract: Custos manuais do Acompanhamento

Base path: `/api/acompanhamento/comercial`

## POST `/projetos/:projectId/custos-manuais`

Cria um custo manual para uma missão individual.

**Auth**: usuário autenticado com permissão de gestor do Acompanhamento.

**Request body**

```json
{
  "description": "Frete pago pelo cliente",
  "amount": 250.75,
  "costDate": "2026-07-20",
  "note": "Descontar do cliente"
}
```

**Validation**

- `description`: string obrigatória, trim, 1 a 120 caracteres.
- `amount`: número obrigatório, maior que zero, até 999999999.99.
- `costDate`: string opcional/nula com data válida.
- `note`: string opcional/nula, trim, até 500 caracteres.

**201 Response**

```json
{
  "id": "manual-cost-1",
  "projectId": "project-1",
  "projectCode": "1001",
  "description": "Frete pago pelo cliente",
  "amount": 250.75,
  "costDate": "2026-07-20T00:00:00.000Z",
  "note": "Descontar do cliente",
  "createdAt": "2026-07-21T12:00:00.000Z",
  "createdBy": {
    "id": "manager-1",
    "name": "Gestor Acompanhamento"
  }
}
```

**Errors**

- `400`: payload inválido ou projeto inexistente/inativo.
- `403`: usuário sem permissão de gestor.

## DELETE `/projetos/:projectId/custos-manuais/:costId`

Remove um custo manual por soft delete.

**Auth**: usuário autenticado com permissão de gestor do Acompanhamento.

**200 Response**

```json
{
  "ok": true,
  "id": "manual-cost-1"
}
```

**Errors**

- `403`: usuário sem permissão de gestor.
- `404`: custo inexistente, removido ou pertencente a outro projeto.
