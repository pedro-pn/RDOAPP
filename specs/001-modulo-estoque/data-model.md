# Data Model — Módulo Estoque (Phase 1)

**Date**: 2026-07-07 · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md)

## Enums

```prisma
enum StockItemType {
  FILTRO
  PRODUTO_QUIMICO
}

enum StockMovementType {
  ENTRADA   // soma no saldo
  SAIDA     // subtrai do saldo
}

enum StockMovementReason {
  COMPRA             // ENTRADA — exige NF; lote/validade obrigatórios p/ químico
  DEVOLUCAO_OBRA     // ENTRADA — exige projeto de origem; sem NF
  INVENTARIO         // ENTRADA ou SAIDA — ajuste de contagem; exige notes
  USO_EM_PROJETO     // SAIDA — exige projeto de destino
  PERDA              // SAIDA — exige notes
  DESCARTE_VALIDADE  // SAIDA — exige notes
  ESTORNO            // ENTRADA ou SAIDA — exige reversalOfId
}
```

> Não existe tipo `AJUSTE` persistido: "ajuste de inventário" é o par (`ENTRADA|SAIDA`, `INVENTARIO`) — ver research R5. `quantity` é sempre positiva; o efeito no saldo vem de `type`.

Combinações válidas `type × reason` (validadas por Zod discriminated union e revalidadas no service):

| reason | ENTRADA | SAIDA |
|---|---|---|
| COMPRA | ✅ | — |
| DEVOLUCAO_OBRA | ✅ | — |
| USO_EM_PROJETO | — | ✅ |
| PERDA | — | ✅ |
| DESCARTE_VALIDADE | — | ✅ |
| INVENTARIO | ✅ | ✅ |
| ESTORNO | ✅ | ✅ |

## Modelos

### StockItem — item de estoque

| Campo | Tipo | Regras |
|---|---|---|
| id | String cuid PK | |
| type | StockItemType | imutável após criação |
| code | String @unique | SKU interno; obrigatório, trim, não vazio |
| name | String | obrigatório |
| manufacturer | String? | |
| description | String? | |
| unitLabel | String | `"un"` (filtro, fixo) · `"kg"`/`"L"` (químico, escolhido no cadastro); **imutável após a primeira movimentação** |
| minQuantity | Decimal(12,3)? | ≥ 0; alerta `belowMin` no resumo |
| location | String? | almoxarifado/prateleira |
| filterModel | String? | só filtro |
| filterKind | String? | só filtro (elemento, bag, cartucho…) |
| filterMicron | String? | só filtro |
| unNumber | String? | só químico |
| casNumber | String? | só químico |
| fispqToken | String? | só químico; token de anexo PDF (padrão equipamentos-anexos) |
| isActive | Boolean @default(true) | inativo: fora de novas movimentações; permanece em resumo (até zerar) e histórico |
| createdAt / updatedAt | DateTime | |

Relações: `batches StockBatch[]`, `movements StockMovement[]`.

**Validações de aplicação**: campos de filtro proibidos em químico e vice-versa; `unitLabel` ∈ {kg, L} exigido quando `type = PRODUTO_QUIMICO`; `unNumber` e `casNumber` são opcionais e exclusivos de químico.

### StockBatch — lote

| Campo | Tipo | Regras |
|---|---|---|
| id | String cuid PK | |
| itemId | String FK → StockItem | |
| lotNumber | String | `""` = lote avulso do item (filtros sem lote — Q1) |
| expiryDate | DateTime? | obrigatório na criação via COMPRA de químico |
| nfNumber | String? | NF da entrada que criou o lote |
| supplier | String? | |
| createdAt | DateTime | |

Constraints: `@@unique([itemId, lotNumber])` (reentrada do mesmo lote soma no existente), `@@index([expiryDate])`.

Relações: `item StockItem`, `movements StockMovement[]`.

**Regras**: lote é criado apenas por movimentação de ENTRADA/COMPRA (ou avulso implícito); nunca deletado; saldo do lote = agregação das movimentações do lote.

### StockMovement — movimentação (imutável)

| Campo | Tipo | Regras |
|---|---|---|
| id | String cuid PK | |
| itemId | String FK → StockItem | |
| batchId | String FK → StockBatch | sempre presente (avulso quando não informado) |
| romaneioId | String? FK → Romaneio | preenchido para movimentações automáticas originadas por romaneio |
| type | StockMovementType | |
| reason | StockMovementReason | combinação válida com type (tabela acima) |
| quantity | Decimal(12,3) | > 0 sempre; inteira quando item é filtro |
| date | DateTime | data informada da movimentação (não é createdAt) |
| projectId | String? FK → Project | obrigatório em USO_EM_PROJETO (destino) e DEVOLUCAO_OBRA (origem) |
| nfNumber | String? | obrigatório em COMPRA |
| supplier | String? | opcional em COMPRA |
| unitCost | Decimal(12,2)? | opcional em COMPRA (sem relatórios nesta fase) |
| requestedBy | String? | solicitante (saída) |
| notes | String? | obrigatório em INVENTARIO, PERDA, DESCARTE_VALIDADE |
| nfAttachmentToken | String? | reservado p/ Fase 2 (sempre null nesta entrega) |
| reversalOfId | String? FK → StockMovement @unique | presente ⇔ reason = ESTORNO; alvo não pode ser estorno |
| createdById | String FK → User | automático (usuário autenticado) |
| createdAt | DateTime | automático |

Constraints/índices: `@@index([itemId, date])`, `@@index([batchId])`, `@@index([projectId])`, `@@index([romaneioId])`, `@@index([type])`, `@@unique` implícito de `reversalOfId` (1 estorno por movimentação).

Relações: `item`, `batch`, `project?`, `romaneio?`, `createdBy`, `reversalOf?`/`reversedBy?` (auto-relação 1:1).

## Saldo (derivado — nunca persistido)

```
saldo(item)  = Σ quantity [type=ENTRADA] − Σ quantity [type=SAIDA]   (por itemId)
saldo(lote)  = idem, por batchId
```

Invariantes garantidos pelo service (`lib/estoque/stock-movements.js`), dentro de `prisma.$transaction` com serialização por lote (research R2):

1. Nenhuma movimentação pode deixar `saldo(lote) < 0` (nem `saldo(item)`, por consequência).
2. `quantity > 0`; inteira para filtro; ≤ 3 casas decimais para químico.
3. Estorno replica item/lote/quantidade da original com type invertido, `reason: ESTORNO`, `reversalOfId` preenchido; sujeito ao invariante 1 (estorno de entrada já consumida falha com mensagem clara).
4. Item inativo ou projeto soft-deleted (`deletedAt`) não aceitam novas movimentações (histórico preservado).
5. Movimentações automáticas de romaneio usam FEFO sem seleção manual de lote; edição de romaneio estorna lançamentos vinculados e cria novos lançamentos.

## Transições de estado

- **StockItem**: `ativo ⇄ inativo` (sem exclusão física após primeira movimentação; exclusão física permitida só sem movimentações).
- **StockMovement**: `registrada → estornada` (única transição; efetivada pela existência de `reversedBy`).
- **StockBatch**: sem estados; "vencido"/"vencendo" são derivados de `expiryDate` no momento da consulta.

## Alterações em modelos existentes

- `enum AppModule`: + `ESTOQUE`.
- `enum ModuleRoleCode`: + `ESTOQUE_MANAGER`, `ESTOQUE_VIEWER`.
- `Project`: + relação inversa `stockMovements StockMovement[]` (sem coluna nova).
- `User`: + relação inversa `stockMovements StockMovement[]` (sem coluna nova).
- `RomaneioCatalogSource`: + `STOCK` para itens gerenciados pelo módulo Estoque.
- `Romaneio`: + relação inversa `stockMovements StockMovement[]` (sem coluna nova).

Base do módulo em `estoque_module`; integração de romaneio em migration incremental `romaneio_stock_integration`. Sem backfill obrigatório — o catálogo do Romaneio é sincronizado a partir dos itens ativos do Estoque.
