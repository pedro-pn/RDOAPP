# Tasks: Dados Operacionais no Upload Manual de Relatórios

**Input**: Design documents from `/specs/003-upload-dados-operacionais/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/manual-upload-api.md, quickstart.md

**Tests**: Incluídos — a constitution (Princípio V) exige testes em `backend/test` para regra de negócio nova.

**Organization**: Fases por user story, na ordem de prioridade da spec: US1 (P1), US3 (P1), US2 (P2), US4 (P3), mais um aditivo de mudança aprovado em 2026-07-13 para stand-by no RDO manual e edição inline de relatório manual.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1..US4, mapeando as user stories da spec; tarefas "Aditivo" refinam histórias já existentes sem criar nova user story

## Path Conventions

Web app: `backend/src/`, `backend/test/`, `frontend/src/` (estrutura existente — sem projeto novo, sem migration).

---

## Phase 1: Setup

**Purpose**: Preparação mínima — a feature se encaixa em módulos existentes.

- [X] T001 Criar branch `feat/003-upload-dados-operacionais` a partir de `main` (constitution: todo trabalho em branch de feature)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema de validação e conversão do bloco `operationalData` — usados pelo upload (US1/US2), pela edição (US4) e indiretamente pelo custo (US3).

**⚠️ CRITICAL**: US1, US2 e US4 dependem destas tarefas.

- [X] T002 Definir schema Zod `manualReportOperationalDataSchema` em `backend/src/routes/resources/reports.js` (junto aos schemas existentes ~linha 3650): campos `arrivalTime`/`departureTime` (`HH:MM`, par atômico via superRefine), `lunchBreak` (formatos do `parseBreak`), `collaboratorIds` (dedup), `noturno { enabled, inicio, termino, intervalo, collaboratorIds }` com `enabled=true` exigindo `inicio`+`termino`; bloco totalmente vazio tratado como ausente; mensagens de erro em pt-BR (contrato: `contracts/manual-upload-api.md`, regras: `data-model.md`)
- [X] T003 Criar helper `buildManualReportOperationalFields(project, reportDate, operationalData)` em `backend/src/routes/resources/reports.js`: monta `arrivalTime/departureTime/lunchBreak/daytimeCount` + minutos via `calculateReportOvertime` (`backend/src/lib/overtime.js`) + `collaborators.create[]` (validando ids existentes em `Collaborator`) + blocos `noturno`/`noturnoDetails` para `specialConditions` (snapshot via `enrichNightCollaboratorsInSpecialConditions`); sem dados → retorna os defaults zerados atuais
- [X] T004 [P] Tipos frontend em `frontend/src/api/reports.ts`: interface `ManualReportOperationalData` (espelho do schema) e campo opcional `operationalData` em `ManualReportUploadPayload`

**Checkpoint**: Schema + conversão prontos — user stories podem começar.

---

## Phase 3: User Story 1 - Informar dados operacionais no upload manual (Priority: P1) 🎯 MVP

**Goal**: Upload manual (RDO e somente serviço) aceita entrada/saída/almoço/colaboradores e grava horas calculadas + vínculos nas mesmas estruturas do fluxo normal.

**Independent Test**: Upload manual com entrada 07:00, saída 17:00, almoço 01:00 e 2 colaboradores → relatório salvo com 9h diurnas e colaboradores vinculados; upload sem dados → comportamento atual intacto.

### Tests for User Story 1

- [X] T005 [US1] Criar `backend/test/manual-report-upload.test.js` seguindo o padrão dos testes existentes (ex.: `derived-service-report-edit.test.js`): upload com dados → minutos idênticos a `calculateReportOvertime` (9h no cenário base, virada de dia 19:00→03:00), `daytimeCount` = nº colaboradores, vínculos criados; upload sem dados → relatório igual ao atual (horários `00:00`, zero vínculos); rejeições 400 (horário mal formatado, par entrada/saída incompleto, colaborador inexistente); tipo somente serviço (RTP) com dados → mesmas gravações + `serviceOnly`/`serviceData` preservados. **Escrever antes da implementação e confirmar que falha**

### Implementation for User Story 1

- [X] T006 [US1] Aplicar `operationalData` no `POST /reports/manual-upload` (`backend/src/routes/resources/reports.js:6004`): parse com o schema de T002, aplicar T003 no `tx.report.create` (minutos, `daytimeCount`, `collaborators.create`, `specialConditions` com noturno), mantendo intocado o caminho sem dados; rodar T005 até verde
- [X] T007 [P] [US1] Estender `ManualReportUploadFileState`, `ManualReportFormState` e `emptyManualReportForm` em `frontend/src/pages/gestor/GestorPage.tsx` (~linhas 203–306) com: `arrivalTime`, `departureTime`, `lunchBreak` (default `'01:00:00'`), `collaboratorIds`, `noturno`, `noturnoStart`, `noturnoEnd`, `noturnoInterval` (default `'01:00:00'`), `noturnoCollaboratorIds` — por arquivo do lote
- [X] T008 [US1] Criar componente `frontend/src/components/reports/ManualReportOperationalFields.tsx`: bloco recolhível "Dados operacionais (opcional)" com inputs de horário (estilo global de `base.css`), multiseleção de colaboradores no padrão existente do fluxo normal de RDO (copiar tela análoga de `frontend/src/pages/collaborator/NewReportPage.tsx`), tokens de `variables.css`, funcional em mobile (constitution II e VI); nesta fase, campos diurnos + colaboradores (noturno entra na US2)
- [X] T009 [US1] Integrar o bloco por arquivo no modal de upload manual do `GestorPage.tsx`, montar `operationalData` no submit (`uploadManualReport` em `frontend/src/api/reports.ts`) com validação client-side espelhada (par entrada/saída; mensagens pt-BR) e omissão do bloco quando vazio
- [X] T010 [US1] Conferir exibição: detalhe (`frontend/src/pages/ReportDetailPage.tsx`) e cards (`frontend/src/components/reports/ReportSummaryCard.tsx`) mostram colaboradores e horas de relatórios manuais como nos RDOs normais (FR-012) — ajustar apenas se algo estiver condicionado à origem manual

**Checkpoint**: Upload manual com dados funcional de ponta a ponta; sem dados = comportamento atual.

---

## Phase 4: User Story 3 - Custos de mão de obra refletem os relatórios manuais e de serviço (Priority: P1) 🎯 MVP

**Goal**: O labor-cost passa a considerar RDOs manuais (automático, via dados de US1) e relatórios somente serviço com horas — gravadas ou derivadas da união dos intervalos `startTime→endTime` dos serviços (cobre histórico sem backfill).

**Independent Test**: Com ponto vigente cobrindo o mês: RDO manual com colaboradores/horas → dia migra de "Sede" para o projeto; relatório de serviço do app com serviços 08:00–12:00 e 10:00–14:00 → 6h (união) para o projeto; dia com RDO + serviço → contado uma vez.

### Tests for User Story 3

- [X] T011 [US3] Estender `backend/test/acompanhamento-labor-cost.test.js`: (a) função pura de união de intervalos — casos: disjuntos (08–12 + 14–16 = 6h), sobrepostos (08–12 + 10–14 = 6h), virada de dia (22:00→02:00 = 4h), sem horários = 0; (b) `getRdoDataByCollaborator`/rateio — RDO manual com minutos entra no rateio; relatório de serviço com horas derivadas entra; precedência de minutos gravados sobre derivação; desempate no dia com RDO + serviço (prevalece mais horas, sem dupla contagem); relatório sem nenhuma fonte de horas fica fora; RDO com horas zeradas continua classificando dia (zero regressão). **Escrever antes da implementação e confirmar que falha**

### Implementation for User Story 3

- [X] T012 [P] [US3] Criar função pura exportada `serviceIntervalsWorkedMinutes(services)` em `backend/src/lib/acompanhamento/labor-cost.js`: parse `HH:MM` (reutilizar/espelhar `parseHm` de `overtime.js`), ordenar por início, mesclar sobreposições, término < início soma 24h; ignorar serviços sem `startTime`/`endTime` (research R6)
- [X] T013 [US3] Ajustar `getRdoDataByCollaborator` em `backend/src/lib/acompanhamento/labor-cost.js:117`: `where` com `OR: [{ reportType: 'RDO' }, { daytimeWorkedMinutes: { gt: 0 } }, { nighttimeWorkedMinutes: { gt: 0 } }, { services: { some: { startTime: { not: null }, endTime: { not: null } } } }]` (mantendo `deletedAt: null` e range), `select` incluindo `services: { select: { startTime: true, endTime: true } }`; horas efetivas = minutos gravados quando > 0, senão `serviceIntervalsWorkedMinutes` (como diurnas); nada mais muda no arquivo; rodar T011 até verde
- [ ] T014 [US3] Validação com dados reais (quickstart US3/US3b/US3c): comparar Acompanhamento antes/depois em ambiente dev — dias migrando de "Sede" para projetos correspondem aos relatórios manuais/de serviço; registrar o impacto retroativo observado para comunicar ao gestor (spec: nota de impacto retroativo)

**Checkpoint**: MVP completo — dados capturados (US1) + custo refletindo (US3), incluindo histórico de relatórios de serviço.

---

## Phase 5: User Story 2 - Turno noturno no upload manual (Priority: P2)

**Goal**: Upload manual permite habilitar turno noturno com início/término/intervalo/colaboradores próprios, com horas noturnas calculadas como no fluxo normal.

**Independent Test**: Upload com noturno 22:00→05:00, intervalo 01:00 e 1 colaborador noturno → 6h noturnas no relatório; noturno habilitado sem início/término → bloqueio com mensagem clara.

### Tests for User Story 2

- [X] T015 [US2] Estender `backend/test/manual-report-upload.test.js`: noturno com virada de dia (22:00→05:00, intervalo 01:00 = 6h em `nighttimeWorkedMinutes`); `noturnoDetails` gravado com snapshot de colaboradores (`enrichNightCollaboratorsInSpecialConditions`); 400 quando `enabled=true` sem `inicio`/`termino`; noturno desabilitado → nada gravado. **Escrever antes de ajustar a implementação e confirmar comportamento**

### Implementation for User Story 2

- [X] T016 [US2] Garantir caminho noturno no backend (T002/T003/T006 já o preveem — cobrir lacunas que T015 revelar) em `backend/src/routes/resources/reports.js`
- [X] T017 [US2] Adicionar seção de turno noturno ao `frontend/src/components/reports/ManualReportOperationalFields.tsx`: toggle + início/término/intervalo + multiseleção de colaboradores do noturno, mesmos componentes/padrões da US1; validação client-side (habilitado exige início+término) e exibição igual à do fluxo normal no detalhe

**Checkpoint**: US1 + US2 + US3 funcionais e independentes.

---

## Phase 6: User Story 4 - Edição de uploads manuais existentes (Priority: P3)

**Goal**: Editar dados operacionais de relatórios manuais já enviados, sem reenviar o PDF; troca de PDF preserva os dados. O fluxo inicial com ação "Completar dados" é substituído no aditivo T026–T034 por edição inline na própria página manual.

**Independent Test**: Abrir relatório manual antigo sem dados → editar dados operacionais e colaboradores → horas recalculadas, vínculos substituídos, PDF intacto, Acompanhamento reflete. No aditivo T029–T031, esse teste deve ser feito inline na página manual, sem botão "Completar dados".

### Tests for User Story 4

- [X] T018 [US4] Estender `backend/test/manual-report-upload.test.js` (ou arquivo dedicado `backend/test/manual-report-data-edit.test.js`): `PUT /reports/:id/manual-data` recalcula minutos e substitui vínculos; campos vazios limpam dados (volta ao zerado); carimbos `operationalDataUpdatedAt/UpdatedByUserId` em `__manualUpload`; 400 para relatório não-manual; 404 para inexistente; status/versões/assinatura intocados; `PUT /reports/:id/manual-pdf` preserva `noturnoDetails`, vínculos, horários e carimbos (FR-009). **Escrever antes da implementação e confirmar que falha**

### Implementation for User Story 4

- [X] T019 [US4] Criar `PUT /reports/:id/manual-data` em `backend/src/routes/resources/reports.js` (junto ao `manual-pdf`, ~linha 6123): guarda `requireRdoManager` + `manualReportUploadMeta(existing).uploadedAt`; reusar T002/T003; transação com `reportCollaborator.deleteMany` + create, merge não destrutivo de `specialConditions`, carimbos de edição (contrato: `contracts/manual-upload-api.md` §2)
- [X] T020 [US4] Garantir preservação no `PUT /reports/:id/manual-pdf` (`backend/src/routes/resources/reports.js:6123`): a reconstrução de `specialConditions` não pode descartar `noturno`/`noturnoDetails`/carimbos, e os vínculos/horários/minutos do relatório permanecem; rodar T018 até verde
- [X] T021 [P] [US4] Adicionar `updateManualReportData(reportId, payload)` em `frontend/src/api/reports.ts` (`PUT /reports/:id/manual-data`)
- [X] T022 [US4] Implementação inicial da ação "Completar dados" para relatórios manuais no frontend (`frontend/src/pages/ReportDetailPage.tsx` e/ou card no `GestorPage.tsx`), reutilizando `ManualReportOperationalFields` pré-preenchido com os dados atuais, submit via T021, invalidação react-query das listagens/detalhe/contagens. **Obsoleto pelo aditivo T029**: o botão/modal deve ser removido e substituído por edição inline na página manual.

**Checkpoint**: Todas as user stories funcionais.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T023 Passada de consistência visual (constitution VI): bloco operacional com selects/multiselects no padrão do app (nada de dropdown cru), tokens de `variables.css`, largura desktop adequada; mobile sem scroll horizontal, modal com rodapé fixo e corpo rolável (constitution II)
- [X] T024 [P] Rodar suíte completa `cd backend && npm test` — zero regressão nas suítes existentes (`acompanhamento-*`, relatórios, assinaturas)
- [ ] T025 Executar validação completa do `specs/003-upload-dados-operacionais/quickstart.md` (US1, US2, US3, US3b, US3c, US4 + regressões) e marcar os gates da constitution no final do arquivo

---

## Phase 8: Change Request — Stand-by e edição inline de relatório manual

**Purpose**: Incorporar a mudança de escopo de 2026-07-13: RDO manual pode registrar stand-by; relatório manual usa página de edição inline, sem botão "Completar dados", com colaboradores editáveis e sem observações/fotos/adicionar serviço.

**⚠️ CRITICAL**: Esta fase deve rodar antes de T025. T029 substitui a experiência entregue por T022.

### Tests for Change Request

- [X] T026 [US1/US4] Estender `backend/test/manual-report-upload.test.js`: upload manual de RDO com stand-by grava `specialConditions.standby = true` e `standbyDetails.total/motivo`; stand-by sem total/motivo retorna 400; stand-by em relatório somente serviço retorna 400; `PUT /reports/:id/manual-data` atualiza e limpa stand-by de RDO manual; `PUT /reports/:id/manual-pdf` preserva stand-by; edição manual não altera `dailyDescription` nem `specialConditions.generalUploads`.
- [X] T027 [US4] Adicionar/estender testes frontend para `ReportDetailPage.tsx` (ou teste manual documentado se não houver harness): relatório com `__manualUpload` não renderiza botão "Completar dados", renderiza campos inline de data/horários/noturno/colaboradores/stand-by quando RDO, oculta observação, anexos de fotos e adicionar serviço, e envia payload sem `dailyDescription`/`generalUploads`.

### Implementation for Change Request

- [X] T028 [US1/US4] Estender `manualReportOperationalDataSchema` e `buildManualReportOperationalFields` em `backend/src/routes/resources/reports.js`: aceitar `standby { enabled, total, motivo }`, validar apenas para `reportType: 'RDO'`, exigir total+motivo quando habilitado, gravar/limpar `specialConditions.standby` e `standbyDetails` no upload e no `manual-data`, preservando dados existentes quando o payload não tocar em stand-by.
- [X] T029 [P] [US1/US4] Estender tipos e UI compartilhada (`frontend/src/api/reports.ts`, `frontend/src/components/reports/ManualReportOperationalFields.tsx`, `frontend/src/pages/gestor/GestorPage.tsx`) com stand-by para RDO manual: toggle, tempo total, motivo, validação client-side pt-BR, omissão do bloco quando vazio e bloqueio visual para tipos somente serviço.
- [X] T030 [US4] Refatorar `frontend/src/pages/ReportDetailPage.tsx`: detectar `specialConditions.__manualUpload` e renderizar modo de edição manual inline; remover/ocultar a ação "Completar dados"; pré-preencher data, horários, noturno, colaboradores e stand-by quando RDO; salvar via `updateManualReportData`; invalidar detalhe/listagens/contagens.
- [X] T031 [US4] Garantir que a edição manual permita alterar colaboradores e substitua os vínculos anteriores, mas não renderize nem envie campos de observação (`dailyDescription` e observações de serviço), anexos de fotos (`specialConditions.generalUploads` e uploads de serviço) ou adicionar serviço; revisar também qualquer menu/atalho de edição que ainda abra o fluxo completo de RDO para relatório manual.
- [X] T032 [US4] Ajustar exibição pós-salvamento no detalhe/listagens/estatísticas, se necessário, para stand-by de RDO manual aparecer no mesmo formato do RDO do app sem tratar manual-upload como "não stand-by".
- [X] T033 [P] Atualizar/confirmar docs já alterados neste aditivo (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/manual-upload-api.md`, `quickstart.md`) antes da implementação final; nenhum artifact deve mencionar "Completar dados" como botão ativo.
- [ ] T034 Rodar validação técnica: `cd backend && npm test`, `cd frontend && npm run build`, `git diff --check`; depois executar os cenários novos do quickstart (US1b e US4 inline) e então T014/T025.

**Checkpoint**: Stand-by no RDO manual e edição inline manual completos; nenhuma tela manual expõe observações/fotos, adicionar serviço ou botão "Completar dados".

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências
- **Foundational (Phase 2)**: depois de Setup — bloqueia US1, US2 e US4 (T002/T003); T004 bloqueia os submits do frontend (T009, T022)
- **US1 (Phase 3)**: depois de Foundational
- **US3 (Phase 4)**: independente de US1 no código (labor-cost + derivação de serviços não dependem do upload), mas o teste ponta a ponta com RDO manual (T014) precisa de US1 entregue
- **US2 (Phase 5)**: depende de US1 (bloco de campos T008 e caminho backend T006)
- **US4 (Phase 6)**: depende de Foundational (T002/T003) e reusa o componente de US1 (T008)
- **Polish (Phase 7)**: depois das stories desejadas
- **Change Request (Phase 8)**: depois de US1/US2/US4 base; deve concluir antes de T025 e da entrega final

### User Story Dependencies

- **US1 (P1)**: só Foundational
- **US3 (P1)**: código independente; validação completa após US1
- **US2 (P2)**: estende US1 (mesmo componente e endpoint)
- **US4 (P3)**: reusa Foundational + componente da US1; T029–T031 substituem a UI de botão/modal por edição inline

### Within Each User Story

- Teste escrito e falhando antes da implementação (T005→T006, T011→T012/T013, T015→T016, T018→T019/T020)
- Backend antes do frontend que o consome
- No aditivo: T026/T027 antes de T028–T032; T034 por último

### Parallel Opportunities

- T004 (tipos frontend) em paralelo com T002/T003 (backend)
- Depois do Foundational: **US3 (T011–T013) em paralelo com US1 (T005–T010)** — arquivos disjuntos (labor-cost vs reports.js/GestorPage)
- Dentro da US1: T007 (estado do form) em paralelo com T005/T006 (backend)
- T012 (função pura) em paralelo com T005/T006
- T021 (api client) em paralelo com T019/T020
- T026 (backend tests) em paralelo com T027 (frontend/manual test plan)
- T029 (upload UI stand-by) em paralelo com T030/T031 (detail manual inline), depois de T028 definir o contrato backend

---

## Parallel Example: MVP (US1 + US3)

```bash
# Após Foundational, dois fluxos independentes:
# Dev A (backend upload):    T005 → T006
# Dev B (labor-cost):        T011 → T012 → T013
# Dev A (frontend upload):   T007 → T008 → T009 → T010
# Juntos ao final:           T014 (validação com dados reais)
```

---

## Implementation Strategy

### MVP First (US1 + US3)

1. Phase 1–2 (Setup + Foundational)
2. Phase 3 (US1) e Phase 4 (US3) — podem andar em paralelo
3. **PARAR e VALIDAR**: quickstart US1 + US3/US3b/US3c, incluindo a conferência do impacto retroativo dos relatórios de serviço históricos com o gestor
4. Entregar (PR para `main`)

### Incremental Delivery

1. MVP (US1 + US3) → PR/deploy
2. US2 (noturno) → teste independente → PR/deploy
3. US4 (completar dados antigos) → teste independente → PR/deploy
4. Aditivo 2026-07-13 (T026–T034): stand-by em RDO manual + edição inline sem "Completar dados", observações, fotos ou adicionar serviço
5. Polish a cada entrega (T023–T025 no mínimo na última)

---

## Notes

- Nenhuma migration Prisma — se alguma tarefa parecer exigir schema novo, revisar o plan antes (decisão explícita: estruturas existentes)
- Nenhum comando de servidor/deploy nas tarefas — deploy é do operador humano (constitution I)
- Impacto retroativo do US3 nos números históricos do Acompanhamento é esperado e deve ser comunicado (T014)
- Stand-by usa o shape existente `specialConditions.standby/standbyDetails` e só se aplica a RDO manual
- Relatório manual pode seguir a organização visual do RDO comum, mas sem observação, sem anexos de fotos, sem adicionar serviço e sem botão "Completar dados"
- Commit por tarefa ou grupo lógico; parar em qualquer checkpoint para validar a story de forma independente
