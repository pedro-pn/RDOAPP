# Phase 1 — Modelo de dados: Módulo Comercial

**Feature**: `specs/009-modulo-comercial` · **Data**: 2026-07-31 · **Schema**: `comercial`

Deriva das entidades do `spec.md` e da §4 do `docs/PLANO_MODULO_COMERCIAL.md`. Todos
os models vivem em `@@schema("comercial")`; os ~100 models e ~40 enums existentes
recebem `@@schema("public")` por script (D1, D2 do `research.md`).

## Regras que valem para todos os models

Do `docs/PADRAO_MODULO.md`:

- `createdAt`, `updatedAt`, `createdByUserId`
- status explícito (nunca inferido por presença de campo)
- índices de listagem nos campos por que se filtra e ordena
- soft delete onde exclusão física for arriscada
- auditoria para finalização e envio externo

## Conversões obrigatórias vindas do SQLite da referência

| Origem (SQLite) | Destino (Postgres/Prisma) | Por quê |
|---|---|---|
| `real` (dinheiro) | `Decimal @db.Decimal(14,2)` | **Nunca `Float`.** Segue `ProjectBudget`. Float em dinheiro produz centavo errado, que aqui vira preço errado |
| `real` (margem) | `Decimal @db.Decimal(6,2)` | idem |
| `integer` `*_cents` / `*_bps` | `Int` | já são inteiros — manter |
| `integer` booleano | `Boolean` | |
| `text` ISO de data | `DateTime` | |
| `text` JSON (`payload`, `snapshot`) | `Json` | contrato validado — ver abaixo |
| `id integer autoincrement` | `String @id @default(cuid())` | padrão do repositório |

> **Campo `Json` exige contrato validado** pelo padrão de módulo. O payload do
> levantamento é validado por `shared/schemas/comercial.js` **e** por
> `normalizeCostEstimatePayload` do cost-model, com teste. Sem isso o `Json` vira
> depósito sem forma.

---

## Entidades

### `CostEstimate` — levantamento de custos

O cálculo completo de um serviço. **É ele que carimba o código** que os documentos
vão usar.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `proposalCode` | `String` | o código carimbado; indexado |
| `revisionNumber` | `Int` | |
| `title` | `String` | obrigatório para salvar |
| `mode` | enum `CostEstimateMode` | `LEVANTAR` \| `NOVA` \| `REVISAR` |
| `payload` | `Json` | o levantamento inteiro; contrato validado |
| `totalCost` | `Decimal @db.Decimal(14,2)` | **recalculado no servidor** |
| `salePrice` | `Decimal @db.Decimal(14,2)` | idem |
| `marginPercent` | `Decimal @db.Decimal(6,2)` | idem |
| `status` | enum `CostEstimateStatus` | explícito |
| `createdByUserId` | `String` | **sustenta a regra de autoria** (FR-029); indexado |
| `createdAt` / `updatedAt` | `DateTime` | |

**Índices**: `(createdByUserId, createdAt)` — é a consulta da listagem filtrada por
autoria (D14); `(proposalCode, revisionNumber)`.

**Regra de segurança**: os totais gravados são **sempre os do servidor**, nunca os
enviados pelo cliente. Recalcular com `calculateEstimate` no `POST` impede forjar
margem.

**Acesso**: `comercial:manager` alcança todos; `comercial:seller` apenas onde
`createdByUserId` for o seu; `comercial:viewer` **nenhum**.

---

### `CostEstimateVersion` — versão imutável

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `costEstimateId` | `String` | FK → `CostEstimate` |
| `payloadHash` | `String` | hash do payload; é o que torna a versão verificável |
| `snapshot` | `Json` | cópia congelada |
| `createdAt` | `DateTime` | |

**Nunca sofre update.** Versão que muda não é versão.

---

### `Proposal` — proposta gerada pelo app

> **Nome distinto de `CommercialProposal`, que já existe** e é o staging do import do
> Access. Confundir os dois é erro de escrita fácil de cometer e caro de descobrir.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `proposalCode` | `String` | ↔ `Project.commercialProposalCode` (ligação da E11) |
| `revisionNumber` | `Int` | |
| `costEstimateId` | `String?` | vínculo com o levantamento que lhe deu origem |
| `clientName`, `cnpj`, `contact`, `email`, `site` | `String` | etapa Cliente |
| `sellerId` | `String` | FK → `Seller` |
| `estimatorName` | `String` | preenchido pelo login |
| `payload` | `Json` | escopo, matriz, prazos, técnica, preços; contrato validado |
| `totalValue` | `Decimal @db.Decimal(14,2)` | **suprimido na origem** para `comercial:viewer` (FR-030) |
| `status` | enum `ProposalStatus` | inclui o estado de finalização |
| `createdByUserId` | `String` | **autoria**; indexado |
| `createdAt` / `updatedAt` | `DateTime` | |

**Índices**: `(createdByUserId, createdAt)`, `(proposalCode, revisionNumber)`,
`(status)`.

**Acesso**: manager alcança todas; seller apenas as suas; viewer somente leitura, e
**sem `totalValue`** na resposta.

---

### `ProposalDocument` — documento gerado

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `proposalId` | `String` | FK → `Proposal` |
| `kind` | enum `ProposalDocumentKind` | `COMERCIAL` \| `TECNICA` |
| `storagePath` | `String` | caminho sob `COMERCIAL_DIR` (D10) |
| `createdAt` | `DateTime` | |

**Regra de acesso por papel**: `comercial:viewer` recebe o link apenas de
`kind = TECNICA`. O documento `COMERCIAL` **não aparece na resposta** — não é
ocultado na tela (FR-030a, D13).

**Regra de robustez**: os documentos são gravados **antes** da tentativa de
integração. Se a integração falhar depois, eles continuam baixáveis (FR-034) — é
comportamento da referência e precisa sobreviver ao porte.

---

### `SalesAttribution` — representantes e indicações

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `costEstimateId` | `String` | FK |
| `kind` | enum | representante externo \| indicação interna |
| `beneficiary` | `String` | |
| `commissionBps` | `Int` | pontos-base — já inteiro na origem |

---

### `Seller` — cadastro de vendedores *(novo, §12.5 decisão 4)*

Substitui a lista fixa de `page.tsx:93`.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `name` | `String` | |
| `active` | `Boolean @default(true)` | **desativar não altera proposta já emitida** (FR-041) |
| `sortOrder` | `Int` | |
| `createdByUserId` | `String` | |

**Semeado** com os 6 nomes da referência. Escrita restrita a `comercial:manager`.

---

### `ProposalAuditLog` — auditoria

No padrão de `ReportAuditLog`. Registra finalização e envio externo — as duas ações
irreversíveis do módulo.

| Campo | Tipo |
|---|---|
| `id` | `String @id @default(cuid())` |
| `proposalId` | `String` |
| `action` | enum |
| `actorUserId` | `String` |
| `detail` | `Json` |
| `createdAt` | `DateTime` |

---

### Numeração — sequence no schema `comercial`

Não é model: é sequence Postgres. **Semeada na migration acima do maior número
existente no CRM Nectar e em `CommercialProposal`** (D5). O valor de partida é
levantado uma vez, na E4, e fica registrado na migration.

Teste obrigatório: não regride e não colide.

---

### `ComercialDraft` — rascunho local *(não é banco)*

Vive no `localStorage` do navegador, não no Postgres. Registrado aqui porque é
entidade do domínio e tem ciclo de vida próprio (FR-019 a FR-022).

| Aspecto | Regra |
|---|---|
| Chave | modo + código da proposta |
| Escrita | automática, com *debounce* |
| Leitura | **oferecida ao usuário**, nunca aplicada em silêncio |
| Descarte | ao salvar no servidor |
| Alcance | levantamento **e** proposta |
| Saída da página | `beforeunload` quando houver alteração pendente |

---

## Matriz de acesso

| | `comercial:manager` | `comercial:seller` | `comercial:viewer` |
|---|---|---|---|
| `CostEstimate` — criar | ✔ | ✔ | ✗ |
| `CostEstimate` — ler | todos | só os seus | ✗ |
| `CostEstimate` — editar | qualquer | só os seus | ✗ |
| `Proposal` — criar | ✔ | ✔ | ✗ |
| `Proposal` — ler | todas | só as suas | **listagem, sem valores** |
| `Proposal` — editar | qualquer | só as suas | ✗ |
| `Proposal` — finalizar | qualquer | só as suas | ✗ |
| `ProposalDocument` — técnica | ✔ | as suas | ✔ |
| `ProposalDocument` — comercial | ✔ | as suas | **✗** |
| `Seller` — escrever | ✔ | ✗ | ✗ |
| Custo, margem, valor | ✔ | os seus | **✗** |

Esta matriz é o oráculo dos testes de permissão da E9: **3 papéis × 2 entidades ×
(criar, ler, editar, finalizar)**, mais o caso de leitura cruzada entre dois
`comercial:seller` distintos, que é onde o vazamento por listagem apareceria.
