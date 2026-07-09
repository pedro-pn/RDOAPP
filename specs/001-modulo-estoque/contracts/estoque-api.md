# API Contract — Módulo Estoque

**Base**: `/api/estoque` (montado em `backend/src/routes/index.js`). Todas as rotas exigem `requireAuth` + `requireEstoqueAccess`; escritas exigem `requireEstoqueManager`. Validação de entrada com Zod de `shared/schemas/estoque.js` (mesmos schemas usados no frontend). Erros seguem o padrão do app: `4xx` com `{ error: "mensagem em pt-BR" }`.

## Itens

### GET /api/estoque/itens
Lista itens (ativos e inativos; filtro por query).

Query: `type?` (`FILTRO|PRODUTO_QUIMICO`), `search?` (código/nome/ONU/CAS), `includeInactive?` (bool, default false).

200:
```json
{ "items": [ {
  "id": "…", "type": "PRODUTO_QUIMICO", "code": "PQ-001", "name": "Inibidor X",
  "manufacturer": "…", "description": "…", "unitLabel": "kg",
  "minQuantity": "50", "location": "Prateleira A2",
  "filterModel": null, "filterKind": null, "filterMicron": null,
  "unNumber": "1760", "casNumber": "67-56-1",
  "fispqUrl": "/api/estoque-anexos/<token>",
  "isActive": true, "hasMovements": true,
  "createdAt": "…", "updatedAt": "…"
} ] }
```

### POST /api/estoque/itens  · manager
Body (Zod, discriminated union por `type`):
```json
{ "type": "FILTRO", "code": "FL-010", "name": "Elemento 10µ",
  "manufacturer": "…", "description": "…", "minQuantity": 20, "location": "…",
  "filterModel": "ABC-123", "filterKind": "elemento", "filterMicron": "10" }
```
```json
{ "type": "PRODUTO_QUIMICO", "code": "PQ-001", "name": "Inibidor X",
  "unitLabel": "kg", "unNumber": "1760", "casNumber": "67-56-1",
  "fispq": { "fileName": "fispq.pdf", "dataUrl": "data:application/pdf;base64,…" } }
```
Regras: `code` único (409 se duplicado); `unitLabel` obrigatório e ∈ {kg, L} só para químico (filtro é sempre `un`); `unNumber` e `casNumber` são opcionais e exclusivos de químico; campos do outro tipo rejeitados.

201: item serializado (formato do GET).

### PUT /api/estoque/itens/:id  · manager
Mesmo body do POST menos `type` (imutável). `unitLabel` imutável se `hasMovements` (400). `fispq: null` remove o anexo.

### PATCH /api/estoque/itens/:id/ativo  · manager
Body `{ "isActive": false }`. Inativa/reativa. Item nunca é deletado após ter movimentações; DELETE físico só permitido sem movimentações:

### DELETE /api/estoque/itens/:id  · manager
204 se o item não tem movimentações; 409 caso contrário ("Item possui movimentações — inative-o.").

## Resumo

### GET /api/estoque/resumo
Saldo agregado por item + lotes, com flags de alerta (regras no backend; janela de validade: 30 dias).

200:
```json
{ "summary": [ {
  "item": { "id": "…", "code": "PQ-001", "name": "Inibidor X",
            "type": "PRODUTO_QUIMICO", "unitLabel": "kg",
            "minQuantity": "50", "isActive": true },
  "balance": "35.500",
  "belowMin": true,
  "batches": [ {
    "id": "…", "lotNumber": "L-2026-07", "expiryDate": "2026-09-30",
    "nfNumber": "12345", "supplier": "…",
    "balance": "35.500", "expired": false, "expiringSoon": true
  } ]
} ] }
```
Itens inativos aparecem enquanto `balance > 0`. Lotes com saldo zero são omitidos.

## Movimentações

### GET /api/estoque/movimentacoes
Query: `itemId?`, `type?`, `reason?`, `projectId?`, `from?`, `to?` (datas ISO), `page?`, `pageSize?` (default 50, máx 200).

200:
```json
{ "movements": [ {
  "id": "…", "type": "SAIDA", "reason": "USO_EM_PROJETO",
  "item": { "id": "…", "code": "PQ-001", "name": "Inibidor X", "unitLabel": "kg" },
  "batch": { "id": "…", "lotNumber": "L-2026-07", "expiryDate": "2026-09-30" },
  "quantity": "12.000", "date": "2026-07-05",
  "project": { "id": "…", "code": "P-123", "name": "Obra Y" },
  "nfNumber": null, "supplier": null, "unitCost": null,
  "requestedBy": "João (encarregado)", "notes": null,
  "reversalOfId": null, "reversedById": null,
  "createdBy": { "id": "…", "name": "Pedro" }, "createdAt": "…"
} ], "total": 132, "page": 1, "pageSize": 50 }
```
Ordenação: `date desc, createdAt desc`.

### POST /api/estoque/movimentacoes  · manager
Body (Zod discriminated union por `reason`; `quantity` sempre > 0):

Na UI, a quantidade é acompanhada por um dropdown de unidade preenchido pela unidade do item (`un`, `kg` ou `L`). A unidade não é enviada como fonte de verdade da movimentação; o backend usa sempre `StockItem.unitLabel`.

| reason | type | campos obrigatórios além de `itemId`, `quantity`, `date` | opcionais |
|---|---|---|---|
| COMPRA | ENTRADA | `nfNumber`; `lotNumber` + `expiryDate` se item químico | `lotNumber`/`expiryDate` (filtro), `supplier`, `unitCost`, `notes` |
| DEVOLUCAO_OBRA | ENTRADA | `projectId` (origem), `batchId` (lote existente) | `notes` |
| USO_EM_PROJETO | SAIDA | `projectId` (destino), `batchId` | `requestedBy`, `notes` |
| PERDA / DESCARTE_VALIDADE | SAIDA | `batchId`, `notes` | |
| INVENTARIO | ENTRADA ou SAIDA (`type` no body) | `batchId`, `notes` | |

Regras de negócio (400/409 com mensagem):
- saída que deixaria saldo do lote negativo → 409 `"Saldo insuficiente no lote (disponível: X kg)."`;
- item inativo ou projeto inexistente/soft-deleted → 400;
- quantidade fracionada para filtro → 400;
- COMPRA de filtro sem `lotNumber` → entra no lote avulso do item (criado sob demanda);
- COMPRA com `lotNumber` já existente no item → soma no lote (valida `expiryDate` igual; divergência → 400);
- saída de lote vencido com `reason: USO_EM_PROJETO` → exige `confirmExpired: true` no body (senão 422 com flag `requiresConfirmation`).

201: movimentação serializada + `"balances": { "item": "23.500", "batch": "23.500" }`.

### POST /api/estoque/movimentacoes/:id/estorno  · manager
Body: `{ "notes": "motivo" }` (opcional).
Cria movimentação inversa vinculada (`reason: ESTORNO`, `reversalOfId: :id`).
409 se: já estornada, é um estorno, ou o estorno deixaria saldo negativo.
201: movimentação de estorno serializada.

### GET /api/estoque/lotes?itemId=…
Lotes com saldo > 0 do item, ordenados por FEFO (validade asc, nulls last; empate: createdAt asc) — usado pelo formulário de saída para pré-selecionar o primeiro.

200: `{ "batches": [ { "id", "lotNumber", "expiryDate", "balance", "expired" } ] }`

## Anexos

### GET /api/estoque-anexos/:token  · público por token (fora do prefixo /estoque, em app.js)
Download da FISPQ (Fase 1) e futuros anexos de NF (Fase 2). Mesmo comportamento de `/api/equipamentos-anexos/:token` (`backend/src/app.js:95`): token opaco, 404 se inválido.

## Papéis

| Ação | estoque:manager | estoque:viewer |
|---|---|---|
| GET itens/resumo/movimentações/lotes | ✅ | ✅ |
| POST/PUT/PATCH/DELETE itens | ✅ | 403 |
| POST movimentações / estorno | ✅ | 403 |
