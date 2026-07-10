# Data Model — Checklist de Equipamentos no Romaneio

**Feature**: 002-checklist-romaneio | **Date**: 2026-07-09 | **Updated**: 2026-07-10

Uma migration Prisma cobre a base da feature: campos de checklist em `EquipmentCategory`/`CompanyEquipment`, campos de assinatura e documento consolidado em `Romaneio`, e o model `RomaneioChecklist` como snapshot por item. A atualização de 2026-07-10 substitui o PDF por equipamento por um único PDF consolidado por romaneio.

## Alterações em models existentes

### EquipmentCategory (alterado)

| Campo | Tipo | Default | Descrição |
|---|---|---|---|
| `checklistEnabled` | `Boolean` | `false` | Toggle "Tem checklist" da categoria |
| `checklistItems` | `Json` | `"[]"` | Array ordenado de strings (pontos de checagem) |
| `checklistDisplayMode` | `String` | `"AUTO"` | Modo opcional para `<<nomeoutag>>`: `AUTO`, `TAG` ou `NAME` |

Regras:
- Desligar `checklistEnabled` NÃO limpa `checklistItems` (preservado para reativação).
- Normalização no backend (`equipment-checklist.js`): trim, remove vazios, mantém ordem, limita tamanho do item (ex. 300 chars) e da lista (ex. 100 itens).
- `checklistDisplayMode=AUTO`: equipamentos/itens por unidade usam tag/código; consumíveis/produtos usam nome. `TAG` e `NAME` forçam o comportamento quando a categoria for ambígua.

### CompanyEquipment (alterado)

| Campo | Tipo | Default | Descrição |
|---|---|---|---|
| `checklistItems` | `Json?` | `null` | `null` = herda da categoria; array = lista própria (override integral) |

Regras:
- **Lista efetiva** = `equipment.checklistItems ?? category.checklistItems` (somente se `category.checklistEnabled`); senão, sem checklist.
- "Restaurar padrão da categoria" grava `null`.
- Override `[]` (vazio) é permitido = equipamento sem checklist mesmo com categoria habilitada.

### Romaneio (alterado)

| Campo | Tipo | Default | Descrição |
|---|---|---|---|
| `checklistResponsibleName` | `String?` | `null` | Nome do responsável (usuário autenticado no envio) |
| `checklistSignatureImage` | `String?` | `null` | PNG data URL (desenhada/enviada no resumo ou copiada de `Collaborator.signatureImage`) |
| `checklistPdfUrl` | `String?` | `null` | URL pública do PDF consolidado de checklist do romaneio |
| `checklistProjectLabel` | `String?` | `null` | Texto estampado no `<<projeto>>` na última geração do PDF consolidado (`<código> - <nome>` ou só código); usado para regenerar o arquivo quando a missão ganha nome depois |

Preenchidos apenas quando o romaneio tem ao menos um checklist. `checklistPdfUrl` substitui o uso de um `pdfUrl` por checklist individual no fluxo novo.

## Novo model

### RomaneioChecklist

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `romaneioId` | `String` | FK → `Romaneio`, `onDelete: Cascade` |
| `catalogItemId` | `String?` | FK → `RomaneioCatalogItem`, `onDelete: SetNull` (rastreio; snapshot é autossuficiente) |
| `equipmentId` | `String?` | id do `CompanyEquipment` na época do envio (sem FK rígida — snapshot) |
| `equipmentCode` | `String` | ex. "UFP 001" (`<<tag>>`) |
| `equipmentName` | `String` | ex. "Unidade de Filtragem Portátil" (`<<equipamento>>`) |
| `categoryName` | `String?` | nome da categoria estampada em `<<categoria>>` |
| `displayNameOrTag` | `String` | valor já resolvido para `<<nomeoutag>>` (tag/código ou nome, conforme regra do item) |
| `displayMode` | `String` | modo aplicado ao snapshot: `AUTO`, `TAG` ou `NAME` |
| `items` | `Json` | `[{ "text": string, "status": "CONFORME" \| "NAO_CONFORME" \| "NAO_APLICAVEL", "checked": boolean }]` — snapshot no envio; `checked` é compatibilidade derivada de `status === "CONFORME"` |
| `projectLabel` | `String?` | legado do desenho "PDF por checklist"; no fluxo consolidado novo, usar `Romaneio.checklistProjectLabel` |
| `pdfUrl` | `String?` | legado do desenho "PDF por checklist"; no fluxo consolidado novo, usar `Romaneio.checklistPdfUrl` |
| `sortOrder` | `Int @default(0)` | ordem de exibição (segue ordem dos itens no romaneio) |
| `createdAt` / `updatedAt` | `DateTime` | |

Índices: `@@index([romaneioId])`, `@@unique([romaneioId, catalogItemId])` não é viável (catalogItemId nullable + equipamento pode ser recolocado) → usar `@@index([romaneioId, sortOrder])`.

Relações a adicionar: `Romaneio.checklists RomaneioChecklist[]`; `RomaneioCatalogItem.romaneioChecklists RomaneioChecklist[]`.

## Ciclo de vida / transições

```
Categoria: checklistEnabled=false ──toggle──▶ true (itens editáveis) ──toggle──▶ false (itens preservados)
Equipamento: checklistItems=null (herda) ──editar──▶ array (override) ──restaurar──▶ null
Romaneio OUTBOUND (envio): lista efetiva + statuses ──▶ RomaneioChecklist.items/categoryName/displayNameOrTag (snapshots) + PDF consolidado no Romaneio
Romaneio (edição): snapshots existentes + novos statuses ──▶ snapshots atualizados + PDF consolidado regenerado (antigo removido)
Download do PDF: checklistProjectLabel atual ≠ gravado (missão ganhou nome) ──▶ regenera PDF consolidado dos snapshots + atualiza checklistProjectLabel ──▶ serve
Romaneio (item removido na edição): RomaneioChecklist removido + PDF consolidado regenerado sem aquela tabela
```

## Validação (Zod, backend)

- `categorySchema` += `checklistEnabled: z.boolean().optional()`, `checklistItems: z.array(z.string().trim().min(1).max(300)).max(100).optional()`, `checklistDisplayMode: z.enum(['AUTO', 'TAG', 'NAME']).optional()`.
- `equipmentSchema` += `checklistItems: z.array(z.string().trim().min(1).max(300)).max(100).nullable().optional()` (null = restaurar herança).
- `createRomaneioSchema` += `checklists: z.array(z.object({ catalogItemId: z.string().min(1), statuses: z.array(z.object({ text: z.string().min(1), status: z.enum(['CONFORME', 'NAO_CONFORME', 'NAO_APLICAVEL']) })).optional(), checkedTexts: z.array(z.string()).optional() })).optional()` e `checklistSignatureImage: z.string().startsWith('data:image/').max(2_000_000).optional().nullable()`.
- Regra de negócio (fora do Zod): `checklists` ignorado em romaneios INBOUND; texto do documento sempre resolvido no servidor (lista efetiva no create, snapshot no update).
