# Tasks: Checklist de Equipamentos no Romaneio

**Input**: Design documents from `/specs/002-checklist-romaneio/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Incluídos (obrigatórios pela constitution — Princípio V: lógica de negócio no backend exige testes em `backend/test`).

**Organization**: Tarefas agrupadas por user story para permitir implementação e teste independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1..US6 conforme spec.md

## Path Conventions

Web app: `backend/src/`, `backend/prisma/`, `backend/scripts/`, `backend/test/`, `frontend/src/`.

---

## Phase 1: Setup

**Purpose**: Insumos externos e pré-condições

- [x] T001 Obter do usuário o modelo `Modelos/definitivos/Checklist.docx` e validar os placeholders. **FEITO 2026-07-09**: modelo fornecido e validado — 3 tabelas (cabeçalho com `<<projeto>>`/`<<equipamento>>`/`<<tag>>`/`<<data>>`; CHECKLIST com linha-template `<<item>>`/`<<status>>`; RESPONSÁVEL com `<<assinatura>>`/`<<responsavel>>`). **ATUALIZADO 2026-07-10**: modelo/mapa passaram a exigir PDF consolidado por romaneio, tabela CHECKLIST repetível com `<<categoria>>` e `<<nomeoutag>>`, e anexo único. Data do nome do arquivo confirmada pelo usuário: dd-mm-yyyy (hífens).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema e lógica de herança compartilhados por todas as stories

**⚠️ CRITICAL**: Nenhuma user story pode começar antes desta fase

- [X] T002 Alterar `backend/prisma/schema.prisma`: `EquipmentCategory.checklistEnabled Boolean @default(false)` + `checklistItems Json @default("[]")`; `CompanyEquipment.checklistItems Json?`; `Romaneio.checklistResponsibleName String?` + `checklistSignatureImage String?` + relação `checklists`; novo model `RomaneioChecklist` (campos e índices conforme data-model.md); relação em `RomaneioCatalogItem`. Gerar migration com `npx prisma migrate dev --name romaneio_checklist` (dev local apenas — produção é do operador).
- [X] T003 [P] Criar `backend/src/lib/equipment-checklist.js`: `normalizeChecklistItems(value)` (trim, remove vazios, max 300 chars/item, max 100 itens, preserva ordem) e `resolveEffectiveChecklist(equipment, category)` (`equipment.checklistItems ?? category.checklistItems`, somente se `category.checklistEnabled`; retorna `[]` caso contrário).
- [X] T004 [P] Criar `backend/test/romaneio-checklist.test.js` com testes de `normalizeChecklistItems` e `resolveEffectiveChecklist` (herança, override, override vazio, categoria desabilitada), seguindo o padrão dos testes existentes.

**Checkpoint**: Schema migrado + lib de herança testada — stories podem começar

---

## Phase 3: User Story 1 - Marcar checklist ao montar romaneio de saída (Priority: P1) 🎯 MVP

**Goal**: Etapa de checklist no romaneio de saída, snapshot persistido, PDF por equipamento, download no card e anexos no e-mail. **Observação**: este objetivo descreve o desenho original já implementado; a Phase 10 substitui a parte de PDF/download/anexo por documento consolidado.

**Independent Test**: Com itens cadastrados direto no banco (ou via US3), criar romaneio de saída com equipamento com checklist, marcar parte dos pontos, enviar e conferir PDF no card e anexos no e-mail (cenário 3 do quickstart).

### Implementation for User Story 1

- [X] T005 [US1] Backend: endpoint `GET /checklist-map` em `backend/src/routes/resources/romaneios.js` — itens ativos do catálogo `sourceType='EQUIPAMENTOS'` com lista efetiva não-vazia (usa `resolveEffectiveChecklist`), shape do contrato (`map` + `hasSavedSignature`; `hasSavedSignature` pode retornar `false` fixo até US2).
- [X] T006 [US1] Backend: criar `backend/src/lib/romaneio-checklist-docx.js` — carrega `Modelos/definitivos/Checklist.docx`, substitui `<<projeto>>` (`buildChecklistProjectLabel`: `<código> - <nome>`, só código se missão sem nome), `<<equipamento>>`/`<<tag>>`/`<<data>>`, clona linha-template `<<item>>`/`<<status>>` por ponto, aplica cor no run do status (`w:rPr/w:color` `00B050`/`FF0000`), `buildChecklistFileName(romaneio, checklist)` (`Checklist - Missão <código> - <tag> <nome> - <dd-mm-yyyy>.pdf`, com `safePath`), salva DOCX temporário na pasta da missão/ROMANEIO, converte via `convertDocxToPdf` e remove o DOCX. Padrões: `romaneio-docx.js` (tokens/clonagem).
- [X] T007 [US1] Backend: integrar ao `POST /` em `backend/src/routes/resources/romaneios.js` — Zod `checklists: [{ catalogItemId, statuses: [{ text, status }] }]` com compatibilidade `checkedTexts` (ignorado em INBOUND); resolver snapshot server-side (lista efetiva + status); gerar PDFs junto aos arquivos do romaneio (gravando `projectLabel` estampado); criar `RomaneioChecklist` na mesma transação; incluir `checklists` em `selectedFields()`; estender `cleanupFailedRomaneioCreate`/`removeGeneratedRomaneioFiles` para os arquivos de checklist; anexar PDFs de checklist em `notifyRecipients` (mesmo e-mail).
- [X] T008 [P] [US1] Backend: rota de download `GET /:id/checklists/:checklistId/pdf` em `backend/src/routes/resources/romaneios.js` (padrão de `GET /:id/pdf`, respeitando `visibleRomaneioWhere`) com atualização sob demanda (FR-019/D10): se o rótulo atual do projeto divergir do `projectLabel` gravado (missão pendente ganhou nome), regenera o PDF do snapshot, sobrescreve o arquivo, atualiza `projectLabel` e serve; se a regeneração falhar, serve o arquivo existente com log.
- [X] T009 [US1] Backend: testes em `backend/test/romaneio-checklist.test.js` — montagem de snapshot a partir de `statuses` e legado `checkedTexts` (conforme/não conforme/não aplicável/texto desconhecido ignorado), `buildChecklistFileName` (sanitização e data com hífens), `buildChecklistProjectLabel` (com/sem nome de missão) e decisão de regeneração no download (label divergente), INBOUND sem checklist, e listagem incluindo `checklists`.
- [X] T010 [P] [US1] Frontend: `frontend/src/api/romaneio.ts` — tipos `RomaneioChecklistInfo`/`RomaneioChecklist`, `fetchRomaneioChecklistMap()`, campos `checklists`/`checklistSignatureImage` no payload de create/update e `checklists` no tipo `Romaneio`.
- [X] T011 [P] [US1] Frontend: criar `frontend/src/pages/romaneio/RomaneioChecklistModal.tsx` — `Modal` do kit (corpo rolável, rodapé fixo), lista de pontos com controles "Conforme", "Não conforme" e "Não aplicável", contador por status, mobile-first, pt-BR.
- [X] T012 [US1] Frontend: integrar em `frontend/src/pages/romaneio/NewRomaneioPage.tsx` — carregar `checklist-map` (OUTBOUND); abrir modal ao adicionar item com checklist; estado dos status por `catalogItemId`; badge/botão no item selecionado para reabrir; descartar status ao remover item; persistir/restaurar status no rascunho (payload do draft); enviar `checklists` no submit.
- [X] T013 [P] [US1] Frontend: `frontend/src/pages/romaneio/RomaneioPage.tsx` — botões de download dos PDFs de checklist no card (rótulo `Checklist — <tag>`), junto a PDF/DOCX.

**Checkpoint**: Romaneio de saída gera checklists ponta a ponta (sem assinatura ainda)

---

## Phase 4: User Story 2 - Assinatura do responsável no resumo (Priority: P1)

**Goal**: Captura/omissão da assinatura no resumo de envio e impressão de assinatura + nome do responsável nos PDFs.

**Independent Test**: Cenário 3 passo 4 do quickstart — conta com e sem assinatura cadastrada.

### Implementation for User Story 2

- [X] T014 [US2] Backend: em `romaneios.js` + `romaneio-checklist-docx.js` — Zod `checklistSignatureImage` (data URL, limite de tamanho); resolução assinatura = payload ?? assinatura existente em edição ?? `Collaborator.signatureImage` do colaborador vinculado a `req.auth.user`; bloquear envio com checklist se nenhuma assinatura for resolvida; `checklistResponsibleName` = nome do usuário autenticado; gravar nos campos do `Romaneio`; embutir PNG no DOCX (media + relationship + `w:drawing`, padrão `epi-docx.js`) no `<<assinatura>>` e substituir `<<responsavel>>`; `hasSavedSignature` real no `GET /checklist-map`. Nunca alterar o cadastro do colaborador (FR-009).
- [X] T015 [US2] Frontend: em `NewRomaneioPage.tsx` (modal de resumo) — quando houver checklist e `hasSavedSignature=false`, seção de assinatura ao final do resumo (desenho + upload, reutilizando o padrão do `SignatureDialog` de `frontend/src/components/reports/SignatureDialog.tsx`); enviar data URL no payload; confirmação bloqueada sem assinatura; nada aparece quando não há checklist.
- [X] T016 [P] [US2] Backend: testes em `backend/test/romaneio-checklist.test.js` — fallback da assinatura (payload > existente em edição > cadastrada), bloqueio sem assinatura resolvida, `hasSavedSignature`, e não-mutação do colaborador.

**Checkpoint**: PDFs saem assinados; fluxo sem checklist inalterado

---

## Phase 5: User Story 3 - Cadastrar pontos por categoria (Priority: P2)

**Goal**: Toggle "Tem checklist" + editor de pontos no cadastro da categoria (gestor do módulo Equipamentos).

**Independent Test**: Cenário 1 do quickstart.

### Implementation for User Story 3

- [X] T017 [US3] Backend: em `backend/src/routes/resources/equipamentos.js` — `categorySchema` += `checklistEnabled`/`checklistItems`; persistir com `normalizeChecklistItems` em `POST /categories` e `PUT /categories/:id`; desligar toggle preserva itens.
- [X] T018 [US3] Frontend: `frontend/src/pages/equipamentos/CategoryFormModal.tsx` — toggle "Tem checklist" e editor de lista (adicionar/editar/remover/reordenar) seguindo o padrão visual do builder de campos existente; visível/editável só para gestor (padrão atual da tela); `frontend/src/api/equipamentos.ts` com os campos novos.
- [X] T019 [P] [US3] Backend: testes em `backend/test/romaneio-checklist.test.js` — normalização na rota de categoria, preservação de itens ao desligar toggle, permissão (`requireEquipamentosManager`).

**Checkpoint**: Categorias alimentam o fluxo do romaneio sem tocar no banco

---

## Phase 6: User Story 4 - Override por equipamento + restaurar (Priority: P2)

**Goal**: Lista própria por equipamento substituindo a da categoria, com "Restaurar padrão da categoria".

**Independent Test**: Cenário 2 do quickstart.

### Implementation for User Story 4

- [X] T020 [US4] Backend: em `equipamentos.js` — `equipmentSchema` += `checklistItems` (array = override normalizado; `null` = restaurar herança; ausente = não mexe) em `POST /` e `PUT /:id`.
- [X] T021 [US4] Frontend: `frontend/src/pages/equipamentos/EquipmentFormModal.tsx` — seção de checklist mostrando lista efetiva com indicação "herdado da categoria" vs "lista própria"; edição cria override; botão "Restaurar padrão da categoria" com `ConfirmDialog` (desabilitado sem override).
- [X] T022 [P] [US4] Backend: testes — override vale só para o equipamento, categoria alterada não afeta override, restaurar (`null`) volta a herdar.

**Checkpoint**: Modelo de herança completo (pré-requisito lógico do UTH 008 no backfill)

---

## Phase 7: User Story 5 - Pré-cadastro (backfill) (Priority: P3)

**Goal**: Itens do `Mapa checklist.txt` cadastrados por script idempotente com dry-run.

**Independent Test**: Cenário 5 do quickstart (dry-run → apply → apply de novo sem mudanças).

### Implementation for User Story 5

- [X] T023 [US5] Backend: criar `backend/scripts/backfill-checklist-items.js` — mapa embutido (UFI, UTH, UTO, UBP, ULQ, UFP, TRO conforme `Modelos/definitivos/Mapa checklist.txt`); dry-run default + `--apply`; resolução de categoria por prefixo de código dos equipamentos com fallback nome/systemKey; liga `checklistEnabled` e grava itens apenas se lista vazia; UTH sem os 2 itens "apenas UTH 008"; override no equipamento `UTH 008` (itens UTH + "Verificação da correia" + "Verificação das polias") apenas se sem override; reporta não-encontrados sem abortar. Exportar funções puras (resolução/decisão) para teste.
- [X] T024 [P] [US5] Backend: testes das funções puras do backfill — mapeamento por prefixo, não sobrescrever lista existente, composição do override UTH 008, relatório de não-encontrados.

**Checkpoint**: Produção pode ser populada sem digitação manual (execução pelo operador — quickstart)

---

## Phase 8: User Story 6 - Editar checklist de romaneio existente (Priority: P3)

**Goal**: Edição de marcações por gerente/coordenador com regeneração dos PDFs a partir do snapshot.

**Independent Test**: Cenário 4 do quickstart.

### Implementation for User Story 6

- [X] T025 [US6] Backend: integrar ao `PUT /:id` em `romaneios.js` — base do snapshot = `RomaneioChecklist` existente por `catalogItemId` (textos preservados mesmo se a lista viva mudou); equipamento novo usa lista efetiva atual; removido → apaga linha e arquivo PDF; regenerar PDFs e remover antigos (padrão docx/pdf atual); assinatura mantida se não reenviada.
- [X] T026 [US6] Frontend: em `NewRomaneioPage.tsx` (modo edição) — carregar marcações de `romaneio.checklists` (snapshot) em vez do `checklist-map`; permitir reabrir/editar cada checklist; assinatura existente não é exigida de novo.
- [X] T027 [P] [US6] Backend: testes — snapshot preservado na edição após mudança da lista da categoria (FR-014/SC-004), equipamento adicionado/removido na edição, regeneração de URLs.

**Checkpoint**: Paridade com a edição atual de romaneios

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T028 Passada de consistência visual (constitution VI): componentes do kit e tokens; selects/dropdowns padronizados; largura desktop adequada; mobile sem scroll horizontal nas telas alteradas (CategoryFormModal, EquipmentFormModal, RomaneioChecklistModal, resumo do romaneio, card do romaneio).
- [X] T029 [P] Rodar `npm test` (backend) e lint/typecheck do frontend; corrigir regressões.
- [ ] T030 Executar validação completa do `specs/002-checklist-romaneio/quickstart.md` em dev (cenários 1–5, já atualizados para PDF consolidado) e registrar pendências.

---

## Phase 10: Alteração 2026-07-10 — PDF consolidado por romaneio

**Purpose**: Substituir o fluxo "1 PDF por equipamento" por "1 PDF consolidado por romaneio", usando o modelo/mapa atualizados com `<<categoria>>` e `<<nomeoutag>>`.

**⚠️ CRITICAL**: Esta fase supersede a parte de mapa/geração/download/anexo por checklist individual das tarefas T005–T008, T010, T013, T025–T027. Não remover snapshots por item; eles continuam necessários para edição e regeneração.

- [X] T031 [US1] Backend/schema: alterar `backend/prisma/schema.prisma` e criar migration Prisma para `Romaneio.checklistPdfUrl`, `Romaneio.checklistProjectLabel`; adicionar no snapshot `RomaneioChecklist.categoryName`, `displayNameOrTag`, `displayMode`; adicionar `EquipmentCategory.checklistDisplayMode` (`AUTO`/`TAG`/`NAME`, default `AUTO`). Manter `RomaneioChecklist.pdfUrl`/`projectLabel` apenas como legado ou migrar dados se já existirem.
- [X] T032 [US1] Backend/lib: atualizar `backend/src/lib/equipment-checklist.js` com `resolveChecklistDisplayName`/`resolveChecklistCategoryName`, aplicando `AUTO` (tag/código para equipamentos/itens por unidade; nome para consumíveis/produtos) e overrides `TAG`/`NAME`.
- [X] T033 [US1] Backend/docx: atualizar `backend/src/lib/romaneio-checklist-docx.js` para gerar 1 DOCX/PDF consolidado por romaneio; localizar e clonar a tabela com `<<categoria>>`, `<<nomeoutag>>`, `<<item>>`, `<<status>>` para cada snapshot; clonar a linha-template de pontos dentro de cada tabela; manter status colorido e assinatura final única.
- [X] T034 [US1] Backend/rotas: alterar `backend/src/routes/resources/romaneios.js` no `POST /`, `PUT /:id`, limpeza de falhas, remoção de arquivos e `notifyRecipients` para criar/regenerar/anexar apenas `Romaneio.checklistPdfUrl`; substituir downloads por `GET /:id/checklist/pdf` com regeneração por `checklistProjectLabel`; manter `GET /:id/checklists/:checklistId/pdf` só como compatibilidade temporária sem gerar PDFs individuais novos.
- [X] T035 [P] [US1] Backend/testes: ampliar `backend/test/romaneio-checklist.test.js` cobrindo romaneio com UFP+ULQ gerando 1 arquivo, duplicação de tabelas no DOCX, `<<categoria>>`, `<<nomeoutag>>` por tag, `<<nomeoutag>>` por nome em consumível/produto, nome do arquivo consolidado, anexos do e-mail e regeneração por projeto renomeado.
- [X] T036 [US3] Backend+Frontend Equipamentos: incluir `checklistDisplayMode` nos contratos de categoria (`backend/src/routes/resources/equipamentos.js`, `frontend/src/api/equipamentos.ts`) e no `CategoryFormModal.tsx` como controle "Identificação no checklist" (Automático, Tag/Código, Nome), visível junto ao toggle "Tem checklist".
- [X] T037 [US1] Frontend Romaneio: atualizar `frontend/src/api/romaneio.ts` e `frontend/src/pages/romaneio/RomaneioPage.tsx` para `checklistPdfUrl` e um único botão de download do checklist consolidado; remover rótulos/botões por checklist individual; manter modal de marcação por item e exibir categoria/tag-nome conforme `checklist-map`.
- [X] T038 [US6] Edição: garantir que edição de romaneio use snapshots existentes para cada tabela, regenere um único PDF consolidado ao alterar marcações/adicionar/remover item, e remova arquivos individuais antigos quando existirem.
- [ ] T039 [P] Validação: atualizar/rodar testes backend (`npm test`) e lint/typecheck frontend; executar manualmente o quickstart com 2 itens com checklist no mesmo romaneio e confirmar um único anexo no e-mail. **Automático concluído**: Prisma generate, backend `npm test`, frontend `npm run build` e `npm run lint` passaram em 2026-07-10; pendente validação manual do quickstart/e-mail.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)**: T001 concluída (modelo fornecido e validado em 2026-07-09) — nada mais bloqueado.
- **Foundational (P2)**: T002 → (T003, T004). Bloqueia todas as stories.
- **US1 (P3)**: precisa de T002/T003. T006 depende de T001. T007 depende de T005+T006. Frontend T012 depende de T010+T011.
- **US2 (P4)**: depende de US1 (T006/T007/T012).
- **US3 (P5)** e **US4 (P6)**: dependem só da Foundational — podem rodar em paralelo com US1/US2.
- **US5 (P7)**: depende de T002 e da semântica de override (US4 backend, T020) para o UTH 008.
- **US6 (P8)**: depende de US1 (snapshot/PDF) e do modo edição existente.
- **Polish (P9)**: depende das stories desejadas.
- **PDF consolidado (P10)**: depende da implementação base de snapshots/checklist (T002–T027). T031 bloqueia T032–T038. T033 e T034 dependem de T032. T037 depende do contrato/rota de T034. T039 fecha a fase.

### Parallel Opportunities

- Após Foundational: US1 (dev A) em paralelo com US3+US4 (dev B).
- Dentro de US1: T008, T010, T011, T013 em paralelo entre si (após T005–T007 para os de backend).
- T004, T009, T016, T019, T022, T024, T027 são arquivos de teste incrementais no mesmo arquivo `romaneio-checklist.test.js` — paralelos entre stories diferentes apenas se coordenados (mesmo arquivo!); dentro da própria story podem andar junto com a implementação.
- Na Phase 10: T036 e T037 podem avançar em paralelo depois que o shape do contrato de T031/T034 estiver definido; T035 deve acompanhar T032–T034 por tocar o mesmo arquivo de testes.

---

## Implementation Strategy

### MVP First

1. Phase 2 (Foundational) → Phase 3 (US1, usando itens inseridos direto no banco para teste) → **validar cenário 3 do quickstart**.
2. Phase 4 (US2 assinatura) completa o P1 da spec.
3. US3+US4 destravam a gestão pela UI; US5 popula produção; US6 fecha paridade de edição.
4. Antes de nova implementação em cima desta branch, executar Phase 10 para alinhar a feature ao modelo/mapa atualizados: documento consolidado por romaneio, `<<categoria>>`, `<<nomeoutag>>` e anexo único.

### Observações

- Migration e backfill em produção são SEMPRE executados pelo operador humano ("rode no servidor" — quickstart, Princípio I).
