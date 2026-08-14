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
| `title` | `String` | obrigatório para promover a `SALVO`; rascunho usa rótulo provisório |
| `mode` | enum `CostEstimateMode` | `LEVANTAR` \| `NOVA` \| `REVISAR` |
| `payload` | `Json` | o levantamento inteiro; contrato validado |
| `totalCost` | `Decimal @db.Decimal(14,2)` | **recalculado no servidor** |
| `salePrice` | `Decimal @db.Decimal(14,2)` | idem |
| `marginPercent` | `Decimal @db.Decimal(6,2)` | idem |
| `status` | enum `CostEstimateStatus` | `RASCUNHO` \| `SALVO`, explícito |
| `archivedAt` / `archivedByUserId` | `DateTime?` / `String?` | arquivamento — **não há exclusão** |
| `createdByUserId` | `String` | **sustenta a regra de autoria** (FR-029); indexado |
| `updatedByUserId` / `updatedByLabel` | `String?` / `String?` | última edição; id + nome congelado sustentam o aviso de concorrência (FR-070) |
| `createdAt` / `updatedAt` | `DateTime` | |

**Índices**: `(createdByUserId, createdAt)` — é a consulta da listagem filtrada por
autoria (D14); `(proposalCode, revisionNumber)`.

**Regra de segurança**: os totais gravados são **sempre os do servidor**, nunca os
enviados pelo cliente. Recalcular com `calculateEstimate` no `POST` impede forjar
margem.

**Regra de continuidade**: `RASCUNHO` pertence ao autor, aceita payload incompleto e
não cria `CostEstimateVersion`. Apenas a promoção para `SALVO` executa a validação
completa e congela uma versão imutável.

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
| `sellerUserId` | `String` | FK → `public.User` (entre schemas) |
| `sellerName` | `String` | nome no momento da emissão — protege o histórico |
| `estimatorName` | `String` | preenchido pelo login |
| `payload` | `Json` | escopo, matriz, prazos, técnica, preços; contrato validado |
| `totalValue` | `Decimal @db.Decimal(14,2)` | **suprimido na origem** para `comercial:viewer` (FR-030) |
| `status` | enum `ProposalStatus` | inclui o estado de finalização — é o que torna a finalização **exclusiva** (FR-069) |
| `nectarOpportunityId` | `String?` | card do CRM; a revisão herda este vínculo no servidor (FR-066) |
| `nectarPipelineId` | `String?` | id do funil usado pelo card |
| `nectarPipelineName` | `String?` | nome congelado do funil no momento da emissão |
| `finalizedAt` / `finalizedByUserId` / `finalizedByLabel` | `DateTime?` / `String?` / `String?` | quem finalizou e quando; id + nome congelado entram na recusa da segunda tentativa |
| `archivedAt` / `archivedByUserId` | `DateTime?` / `String?` | arquivamento — **não há exclusão** |
| `createdByUserId` | `String` | **autoria**; indexado |
| `updatedByUserId` / `updatedByLabel` | `String?` / `String?` | última edição mutável; sustenta o 409 de concorrência (FR-070) |
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

### `ScopeAsset` — foto de item de escopo

Arquivo enviado para um item de serviço do escopo. **As tabelas não viram model** — vivem
no `payload` da `Proposal`, como blocos, junto com a referência à foto e sua ordem.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `storagePath` | `String` | caminho sob `COMERCIAL_DIR`, no padrão `escopo/AAAA/MM/<uuid>.<ext>` da referência |
| `contentType` | `String` | `image/jpeg` \| `image/png` \| `image/webp` |
| `originalName` | `String` | nome original saneado |
| `byteSize` | `Int` | máximo **1.500.000** |
| `createdByUserId` | `String` | |
| `createdAt` | `DateTime` | |

**Por que a foto é model e a tabela não.** A foto é um arquivo com ciclo de vida próprio:
é enviada antes de a proposta existir, precisa sobreviver a revisões (FR-051) e tem de
ser alcançável por caminho. A tabela é dado estruturado que só faz sentido dentro da
proposta.

**Validação de conteúdo (FR-049)**: a **assinatura de bytes** tem de bater com o
`contentType` declarado. Um `.jpg` que não é imagem é recusado pelo conteúdo, não pelo
nome — confiar no `Content-Type` do cliente é confiar em quem envia.

**Limites (FR-046, FR-047, FR-050)**, todos vindos da referência:

| Limite | Valor |
|---|---|
| Fotos por item de escopo | 8 |
| Tabelas por item de escopo | 8 |
| Colunas por tabela | 6 |
| Linhas por tabela | 40 |
| Caracteres por célula | 300 |
| Caracteres de legenda | 240 |
| Arquivo original | 10 MB e 24 megapixels |
| Arquivo após otimização | 1,5 MB |
| Requisição | 2 MB |

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

### Consultor de vendas — **não é model**

> **Decisão de 31/07 que revoga a decisão 4 da §12.5.** Não existe model `Seller`, nem
> CRUD, nem tela de cadastro. Todo consultor de vendas é um **usuário do app com o papel
> `comercial:seller`**, então a lista se mantém sozinha: quem entra no quadro aparece,
> quem sai some. Um cadastro paralelo seria uma segunda verdade para alguém esquecer de
> atualizar.

A lista da etapa Cliente é uma **consulta**, não uma tabela:

```
usuários ativos que têm o papel comercial:seller
```

**Papéis são aditivos**: um gestor que também vende carrega `comercial:seller` além de
`comercial:manager`, e por isso aparece na lista. Gestor sem esse papel não aparece —
ele escolhe entre vendedores, não se inclui por padrão.

Na `Proposal`, isso vira **dois campos, não um**:

| Campo | Tipo | Por quê |
|---|---|---|
| `sellerUserId` | `String` | vínculo com o usuário — **referência entre schemas** (`comercial.Proposal` → `public.User`), suportada pelo `multiSchema` do Prisma |
| `sellerName` | `String` | **o nome no momento da emissão** |

**Por que os dois.** O vínculo permite filtrar e saber quem é. O nome desnormalizado
protege o histórico: desativar ou renomear um usuário **não pode** alterar proposta já
emitida (FR-041a) — o documento é registro histórico, e o PDF já foi ao cliente com
aquele nome. Guardar só a FK faria propostas antigas mudarem de conteúdo quando alguém
casa e troca de sobrenome.

**Comportamento por papel no campo `PROP-CTL-016`** (FR-041b), decidido **no servidor**:

| Papel | Opções recebidas |
|---|---|
| `comercial:seller` | **apenas o próprio nome**, já pré-selecionado |
| `comercial:manager` | a lista completa |

O controle continua sendo o mesmo `SelectField` do inventário — muda o conjunto de
opções, não o elemento. Isso espelha o que a referência **já faz** com o orçamentista
(`PROP-CTL-018`, `readOnly`, preenchido pelo login): o app já tinha o padrão de campo de
pessoa preenchido pela sessão.

---

### `ProposalAttachment` — arquivo adicional do cliente

Anexos que o usuário junta na etapa de revisão (`PROP-CTL-081`) e que vão **para a mesma
pasta dos dois documentos** no destino externo. ART, folha de dados, especificação que o
cliente mandou.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `proposalId` | `String` | FK → `Proposal` |
| `storagePath` | `String` | sob `COMERCIAL_DIR` |
| `originalName` | `String` | saneado |
| `byteSize` | `Int` | conta no limite **agregado** do envio (FR-059) |
| `createdByUserId` | `String` | |

**Distinto de `ScopeAsset`**: o anexo é do cliente e vai ao destino externo; a foto de
escopo é conteúdo do documento e é renderizada dentro do PDF.

**Exclusão**: este é o **único** model do módulo com `DELETE` (FR-078, T128), e só
antes de a proposta ser finalizada.

---

### `ComercialSettings` — configuração do módulo *(acrescentado em 12/08, T131)*

Linha **única** (`id @default("singleton")`). Existe para tirar o endereço da sede da
variável de ambiente: é dado de negócio, muda sem deploy, e quem muda é o gestor.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default("singleton")` | linha única — não há segunda configuração |
| `sedeAddress` | `String @default("")` | o que o gestor digitou |
| `sedeFormattedAddress` | `String?` | o que o Google devolveu — o que a tela mostra |
| `sedePlaceId` | `String?` | veio de sugestão escolhida; dispensa geocodificar a origem |
| `updatedAt` | `DateTime @updatedAt` | |
| `updatedByUserId` / `updatedByLabel` | `String?` | quem mudou a origem de todo cálculo |

**Sem fallback para `.env`.** `COMERCIAL_SEDE_ENDERECO` foi removida do `env.js` e do
`.env.example`: com duas fontes, o servidor calcularia a partir de um endereço que a
tela nega estar usando, e ninguém descobriria — a distância sai plausível de qualquer
jeito.

**A armadilha do cache**: a chave do cache de distâncias é **composta**
(`sede > destino`), não só o destino. Com chave simples, trocar a sede continuaria
servindo as distâncias da sede antiga até o processo reiniciar.

---

### Arquivamento — `archivedAt` em `CostEstimate` e `Proposal`

> **Decisão do mantenedor, 31/07**: só arquivar, **sem exclusão definitiva**.

| Campo | Tipo | Notas |
|---|---|---|
| `archivedAt` | `DateTime?` | nulo = ativo |
| `archivedByUserId` | `String?` | quem arquivou |

**Não há `DELETE` em nenhuma rota do módulo.** Arquivar esconde da listagem padrão e
mantém tudo — documentos, fotos e histórico — alcançável por filtro explícito
(FR-062, FR-063). Desarquivar limpa os dois campos.

Os índices de listagem passam a considerar o estado: `(createdByUserId, archivedAt, createdAt)`.

---

### Tutorial visto — marcador **por usuário, no servidor**

> **Decisão do mantenedor, 31/07**: *"tutorial inicial sempre por usuário; por local
> apenas campanhas de novas funcionalidades"*.

O marcador de "já viu o tutorial do módulo" é persistido **por usuário**, não em
`localStorage`. Isso resolve o conflito registrado no `checklists/ux.md` (CHK019): no
navegador, dois usuários da mesma máquina compartilhariam o marcador, e o mesmo usuário
veria o tutorial de novo em outro computador.

**A campanha de novidade de 10 dias continua no navegador**, como a constitution
descreve. São dois mecanismos com propósitos diferentes: **o tutorial acompanha a
pessoa, a campanha acompanha o dispositivo.**

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
| Lista de consultores | completa | **só o próprio nome** | ✗ |
| Custo, margem, valor | ✔ | os seus | **✗** |
| `ScopeAsset` — enviar | ✔ | nas suas propostas | ✗ |
| `ProposalAttachment` — enviar | ✔ | nas suas propostas | ✗ |
| Arquivar / desarquivar | qualquer | só os seus | ✗ |
| **Excluir definitivamente** | **✗** | **✗** | **✗** |

Esta matriz é o oráculo dos testes de permissão da E9: **3 papéis × 2 entidades ×
(criar, ler, editar, finalizar)**, mais o caso de leitura cruzada entre dois
`comercial:seller` distintos, que é onde o vazamento por listagem apareceria.
