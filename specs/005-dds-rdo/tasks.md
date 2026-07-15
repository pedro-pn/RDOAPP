# Tasks: DDS no RDO

**Input**: Design documents from `/specs/005-dds-rdo/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/dds-themes-api.md, quickstart.md

**Tests**: Incluídos — Constitution V exige teste em `backend/test` para a lógica nova (montagem dos campos DDS do DOCX).

**Organization**: Fases por user story: US2 (temas) precede US1 (registro) porque o formulário depende da lista; US3 (documento) por último.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Criar branch `feat/005-dds-rdo` a partir de `main`

## Phase 2: Foundational — lista de temas no backend (bloqueia US1 e US2)

- [X] T002 Adicionar model `DdsTheme` em `backend/prisma/schema.prisma` (clone de JobRole: `name @unique`, `order`, `isActive`, timestamps, `@@index([isActive, order])`) e gerar migração `add_dds_theme` (`npx prisma migrate dev`)
- [X] T003 Criar `backend/src/routes/resources/dds-themes.js` (clone de `job-roles.js`): GET `requireRdoInternal` com `?all=true`; POST/PATCH/DELETE `requireModuleRole('rdo:manager','rdo:coordinator')`; DELETE = soft delete
- [X] T004 Montar `/dds-themes` em `mountRdoRoutes` (`backend/src/routes/index.js`)

## Phase 3: US2 — Gerenciamento de temas (P1)

- [X] T005 [P] Criar `frontend/src/api/ddsThemes.ts` (clone de `jobRoles.ts`): `DdsTheme`, `listDdsThemes(all?)`, `createDdsTheme`, `updateDdsTheme`, `deactivateDdsTheme`
- [X] T006 Criar `frontend/src/components/reports/DdsThemeManager.tsx` (clone de `JobRoleManager.tsx`, textos "Temas de DDS")
- [X] T007 [P] GestorPage: sub-aba `dds` na aba equipe (union `equipeSubTab`, botão "Temas de DDS", render `<DdsThemeManager />`)
- [X] T008 [P] CoordinatorPage: tab `dds` (union, botão nav-tab, render em `renderTabContent()` dentro de `page-card`)

**Checkpoint**: coordenador e gestor cadastram temas (quickstart §1–3).

## Phase 4: US1 — Registro de DDS no RDO (P1)

- [X] T009 `frontend/src/store/rdoStore.ts`: 8 campos DDS + defaults + union do `setHeaderField` + actions `addDdsTheme`/`removeDdsTheme` + `hydrate`
- [X] T010 `NewReportPage.tsx`: bloco DDS diurno (toggle + horários + select/chips de temas) no cartão Condições especiais; bloco DDS noturno dentro da `noturno-section`; validação (início/término/≥1 tema quando ligado); fetch único `['dds-themes']`
- [X] T011 `NewReportPage.tsx` payload: bloco `dds` em `specialConditions` no `handleSubmit` (noturno gated por `noturno && ddsNight`) e em `buildDraftPayload` (+ deps)
- [X] T012 `HomePage.tsx` `handleResumeDraft`: restaurar campos DDS com defaults para drafts antigos
- [X] T013 Edição: estender `ManualReportOperationalFieldsValue` + props `ddsThemes`/`showDds` + UI em `ManualReportOperationalFields.tsx`; defaults/validação em `manualReportOperationalData.ts` (DDS fora do fluxo manual-data)
- [X] T014 `ReportDetailPage.tsx`: hidratar em `reportToForm`, gravar em `buildPayload` (sobrescrever `dds` no spread), repassar temas no `ManagerRdoEditor`, card DDS no `ReportSummaryView`

**Checkpoint**: quickstart §4–7.

## Phase 5: US3 — Documento (P2)

- [X] T015 `backend/src/lib/report-docx.js` `buildDocxData`: helper de nomes de temas + 6 campos `dds*` gated por `enabled`/`hasNight`
- [X] T016 Teste `backend/test/report-dds.test.js` (molde `report-collaborators.test.js`): sem `dds`; só diurno; ambos; noturno com `hasNight=false`; snapshot `{id,name}`
- [X] T017 Template `Modelos/definitivos/Modelo definitivo.docx`: tabela "DDS — DIÁLOGO DIÁRIO DE SEGURANÇA" (colunas Diurno|Noturno, placeholders `{{ddsday*}}`/`{{ddsnight*}}`) via script python-docx; **validação visual pelo usuário antes do commit**; atualizar `Mapa do modelo definitivo.txt`

**Checkpoint**: quickstart §8.

## Phase 6: Polish

- [X] T018 `cd backend && npm test`; `cd frontend && npm test && npm run build` (typecheck)
- [X] T019 Verificação visual mobile dos blocos DDS e das novas abas (Constitution II/VI)

## Ajustes pós-implementação (2026-07-15)

- [X] T020 UX: selects de colaboradores (diurno/noturno) e de temas de DDS no `NewReportPage` adicionam ao selecionar, sem botão "+ Add" (mesmo padrão do `renderPicker` de `ManualReportOperationalFields`)
- [X] T021 Novidade DDS: destaque único na primeira abertura do formulário de RDO (`RdoDdsNovelty`, driver.js, 2 passos: banner centralizado + highlight do toggle), persistido por usuário em `filtrovali:rdo-dds-novelty:v2:<userId>` (`moduleNavigation.ts`), com data-limite `RDO_DDS_NOVELTY_EXPIRES_AT` (25/07/2026) após a qual não aparece mais em nenhum navegador; correção de StrictMode/re-render (started marcado só quando o timer dispara; onSeen via ref)
- [X] T022 Asterisco vermelho no título "Temas abordados" dos blocos DDS (obrigatório)
- [X] T023 Temas livres (reversão da D8): input texto livre nos pickers de tema (criação + edição) grava snapshot `custom: true`; alerta no editor de revisão lista temas avulsos com botão "Cadastrar na lista" (gestor/coordenador) que cria o tema e revincula o snapshot; marcador "(novo)" em chips e visualização
