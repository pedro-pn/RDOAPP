---
description: "Task list — Módulo Comercial (porte fiel do gerador de propostas)"
---

# Tasks: Módulo Comercial — porte fiel do gerador de propostas

**Input**: Design documents from `/specs/009-modulo-comercial/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: **Obrigatórios.** Esta feature tem dois oráculos que só existem como teste — os
16 goldens e a matriz de permissão. Sem eles não há como provar paridade.

**Organization**: agrupadas por história de usuário, com a **etapa E1–E11** marcada em
cada tarefa para preservar a ordem de execução acordada na §6 do
`docs/PLANO_MODULO_COMERCIAL.md`.

## Format: `[ID] [P?] [Story] Descrição`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: US1 a US6, conforme o `spec.md`
- **`(EN)`**: a etapa do plano técnico a que a tarefa pertence

## Mapa fase × etapa

| Fase | Etapa do plano | Dias |
|---|---|---|
| 1 — Setup | E1 + E2 | 2,75 |
| 2 — Foundational | E3 + base da E6 | ~3 |
| 3 — US1 levantamento | E4 + E7 | 12,5–13,5 |
| 4 — US2 proposta | E5 + E8 (parcial) | ~8 |
| 5 — US3 finalização | E5 + E8 (parcial) | ~5 |
| 6 — US4 continuidade | L3, dentro de E7/E8 | 2,5 |
| 7 — US5 entrada e onboarding | E6 + E8 | ~2 |
| 8 — US6 lista de vendedores | E4 | ~0,25 |
| 9 — Polish | E8.5 + E9 + E10 | 7,5–8,5 |
| Depois | E11 | 3–5 |

**Caminho crítico: Fases 3 e 4 (E7 e E8).**

## Cobertura do inventário

Faixas de ID de `contracts/ui-inventory.md`. **Nenhuma faixa pode ficar sem tarefa** —
o `/speckit-analyze` acusa item órfão, e ausência de campo não gera erro: só some.

| Faixa | Onde é coberta |
|---|---|
| `CUSTO-CTL-001..027` (shell e modais) | T037, T045 |
| `CUSTO-CTL-028..038` (Premissas) | T038 |
| `CUSTO-CTL-039..137` (Mão de obra) | T039 |
| `CUSTO-CTL-138..228` (Insumos) | T040 |
| `CUSTO-CTL-229..394` (Mob./Desmob.) | T041 |
| `CUSTO-CTL-395..465` (Resumo e QQP) | T042 |
| `CUSTO-H-001..017`, `CUSTO-TXT-001..541` | T038–T042, T043 |
| `PROP-CTL-001..010` (shell e modo) | T055 |
| `PROP-CTL-011..025` (E1 Cliente) | T057, T102 |
| `PROP-CTL-026..033` (E2 Escopo) | T058 |
| `PROP-CTL-034..042` (E3 Responsabilidades) | T059 |
| `PROP-CTL-043..048` (E4 Prazos) | T060 |
| `PROP-CTL-049..057` (E5 Técnica) | T061 |
| `PROP-CTL-058..071` (E6 Comercial) | T062 |
| `PROP-CTL-072..085` (E7 Revisão) | T063 |
| `PROP-CTL-086..137` (prévia) | T064 |
| `PROP-H-001..003` (chrome), `PROP-H-004..022` (fac-símile) | T055, T064 |
| `PROP-TXT-001..330` | T057–T064 |
| `HIST-CTL-001..007`, `HIST-H-001`, `HIST-TXT-001..033` | T084 |
| `LOGIN-CTL-001..007`, `LOGIN-H-001`, `LOGIN-TXT-001..012` | **T098** — **não portados**, com motivo registrado |

> **Os IDs `LOGIN-*` não têm tela de destino.** O módulo não traz login próprio: reusa
> o do filtroAPP, o que era premissa desde o início ("mesmo nginx, mesmo login"). Isso
> **não é um décimo desvio** — é consequência de ser módulo, como o prefixo de rota.
> A T098 registra a não-portabilidade com motivo, para o `/speckit-analyze` não os
> acusar como órfãos, e corrige a **dívida da fonte** que o reuso expõe.

---

## Phase 1: Setup — scaffold e regra compartilhada `(E1 + E2)`

**Purpose**: módulo registrado, dependências resolvidas e o motor de custos disponível
nas duas pontas.

### Auditorias que precedem reuso

- [ ] T001 [P] Auditar `frontend/src/utils/reorderDrag.ts` contra a constitution (alça dedicada, reordenação ao vivo, placeholder com legenda de posição, fantasma, cancelar restaura, persistência só ao soltar, toque via Pointer Events com `touch-action: none`) e registrar o laudo em `specs/009-modulo-comercial/contracts/auditoria-reorder.md`. **Se reprovar, o conserto é na origem compartilhada (T002), não no módulo.**
- [ ] T002 Corrigir `frontend/src/utils/reorderDrag.ts` se T001 reprovar — beneficia `QualityNaturesTab.tsx`, `CategoryManager.tsx`, `TechnicalSchemaBuilder.tsx` e `GestorPage.tsx`, que já o usam. Pular se T001 aprovar.
- [ ] T003 [P] Instalar `@hookform/resolvers` em `frontend/package.json`. Não está no projeto e `zodResolver` não aparece em nenhum arquivo, apesar de o Princípio III exigir react-hook-form com resolver Zod.

### Scaffold `(E1)`

- [ ] T004 Rodar `npm run new:module -- comercial --title "Comercial"` e conferir a árvore gerada em `frontend/src/pages/comercial/` e `backend/src/routes/comercial/`.
- [ ] T005 Registrar o módulo em `shared/modules/registry.json`: badge `COM`, `pathPrefixes: ["/comercial"]`, `hub.path: "/comercial"`, rotas `index` (`/comercial`), `custos`, `propostas`, `historico`, e os **três** papéis — `comercial:manager` ("Comercial — Gestor"), `comercial:seller` ("Comercial — Vendedor"), `comercial:viewer` ("Comercial — Consulta").
- [ ] T006 Rodar `npm run modules:generate` e conferir `frontend/src/modules/registry.generated.ts`.
- [ ] T007 Criar migration dos enums `AppModule.COMERCIAL` e `ModuleRoleCode.COMERCIAL_MANAGER|COMERCIAL_SELLER|COMERCIAL_VIEWER` em `backend/prisma/migrations/`.
- [ ] T008 Implementar `requireComercialAccess`, `requireComercialEstimator` (gestor **ou** vendedor) e `requireComercialManager` em `backend/src/middleware/auth.js`, no padrão de `requireQualidadeAccess`.

### Regra de negócio compartilhada `(E2)`

- [ ] T009 [P] Copiar **sem alterar** `cost-model.ts` da referência para `shared/comercial/cost-model.ts`. É o arquivo que os 16 goldens verificam — qualquer edição aqui invalida a prova.
- [ ] T010 [P] Copiar sem alterar `technical-services.ts` e `scope-content.ts` para `shared/comercial/`.
- [ ] T011 [P] Copiar sem alterar `proposal-visuals.ts` e `nectar-pipelines.ts` para `shared/comercial/`.
- [ ] T012 [P] Copiar sem alterar `finalization.ts` para `shared/comercial/finalization.ts` — contém os 4 estágios anunciados ao usuário (FR-032).
- [ ] T013 Criar `shared/comercial/tsconfig.json` gerando `dist/` com `.js` + `.d.ts`, e ligar ao build do backend e do frontend.
- [ ] T014 Escrever `backend/test/comercial-goldens.test.js` rodando os 16 cenários de `specs/009-modulo-comercial/contracts/goldens/` contra `shared/comercial/cost-model`. **Nunca regerar golden para fazer passar** — se falha, o defeito é do porte.

**Checkpoint**: `npm run architecture:check` verde, card do módulo aparece no hub para quem tem papel, e os 16 goldens passam dígito a dígito.

---

## Phase 2: Foundational — banco, acesso e base visual `(E3 + base da E6)`

**Purpose**: pré-requisitos que bloqueiam todas as histórias. **Nenhuma história começa
antes desta fase fechar.**

### Banco e dois schemas `(E3)`

- [ ] T015 Declarar `schemas = ["public", "comercial"]` no datasource de `backend/prisma/schema.prisma`.
- [ ] T016 Escrever `scripts/annotate-prisma-schemas.mjs` que insere `@@schema("public")` em todo model e enum de `backend/prisma/schema.prisma` sem anotação (~100 models, ~40 enums). Edição mecânica de alto volume — à mão introduz erro silencioso.
- [ ] T017 Declarar os models novos com `@@schema("comercial")` conforme [data-model.md](./data-model.md): `CostEstimate`, `CostEstimateVersion`, `Proposal`, `ProposalDocument`, `SalesAttribution`, `ProposalAuditLog`.
- [ ] T018 Aplicar as conversões obrigatórias de tipo: dinheiro em `Decimal @db.Decimal(14,2)` e margem em `Decimal @db.Decimal(6,2)` — **nunca `Float`**, que produz centavo errado e aqui vira preço errado.
- [ ] T019 Criar em `backend/prisma/schema.prisma` os índices de listagem: `(createdByUserId, createdAt)` em `CostEstimate` e `Proposal` — é a consulta da filtragem por autoria —, mais `(proposalCode, revisionNumber)` e `(status)`.
- [ ] T020 Rodar `prisma migrate dev` e **revisar o SQL gerado**: deve conter `CREATE SCHEMA comercial` e `CREATE TABLE comercial.*`, e **nenhum `ALTER`** nas tabelas da operação. Se houver `ALTER`, parar e investigar.
- [ ] T021 Criar em `backend/prisma/migrations/` a sequence de numeração do schema `comercial`, semeada acima do maior número existente **no CRM Nectar e em `CommercialProposal`**. O valor de partida é levantado uma vez e fica registrado na migration.
- [ ] T022 [P] Escrever `shared/schemas/comercial.js` com o contrato Zod do payload `Json` do levantamento, e teste em `backend/test/`. Campo `Json` sem contrato validado vira depósito sem forma.
- [ ] T023 Rodar a suíte existente `backend/test/*.test.js` — prova de que a anotação em massa não mexeu na operação.

### Controle de acesso `(E4/E5, pré-requisito)`

- [ ] T024 Implementar `backend/lib/comercial/access.js` com verificação de autoria em **duas** entidades — `CostEstimate` e `Proposal` — e o helper de **filtro de listagem por autoria**. Middleware de papel sabe o papel, não sabe a autoria do registro alcançado.
- [ ] T025 Implementar em `backend/lib/comercial/access.js` a **supressão de valores na origem** para `comercial:viewer`: `totalValue`, custo e margem **omitidos da serialização**, não ocultados no cliente. Valor que chega ao navegador não está restrito.

### Base visual do módulo `(E6)`

- [ ] T026 Criar `frontend/src/styles/comercial.css` com **todo** seletor escopado sob a raiz do módulo. Sem vazamento nos dois sentidos: nada escapa para o app, e `base.css` não afeta o interior (alínea (a) do Princípio VI).
- [ ] T027 **(L6)** Declarar a paleta e as medidas em **um bloco único** de custom properties `--com-*`, nomeadas **por função** (`--com-superficie`, `--com-borda`, `--com-texto-fraco`) e nunca por cor. Hex solto espalhado pelos seletores **não atende** a alínea (b). Auditar cada regra contra o **bloco `:root` ativo** da referência — a duplicação do `globals.css` já produziu uma conclusão errada uma vez.
- [ ] T028 [P] Criar o shell do módulo em `frontend/src/pages/comercial/`, com as rotas `/comercial`, `/comercial/custos`, `/comercial/propostas`, `/comercial/historico` e `/comercial/vendedores` em `frontend/src/App.tsx`.
- [ ] T029 [P] Escrever as primitivas responsivas de base em `comercial.css`: **nunca** `min-width` em pixel de container, `min-width: 0` em filho de flex/grid, tabela larga já dentro do próprio `overflow-x: auto`, grade de cards com `minmax(min(100%, N), 1fr)`. **Sem esta disciplina a E8.5 vira reescrita de layout e custa o dobro.**
- [ ] T030 [P] Generalizar o componente `Field` da referência (`app/page.tsx:1187` — o **único** `aria-invalid` do app de origem) para `frontend/src/pages/comercial/components/Field.tsx`, consumindo `.field-group` + `.field-invalid` + `.field-error` de `frontend/src/styles/base.css:4085-4102`. As classes `.field-*` são de **comportamento, não de identidade** — a exceção do Princípio VI não se aplica a elas.

**Checkpoint**: migration revisada e aplicada em dev, suíte existente verde, CSS escopado sem vazamento.

---

## Phase 3: US1 — Levantar custos e chegar a um preço confiável (P1) `(E4 + E7)`

**Goal**: o orçamentista percorre as 5 seções e obtém preço de venda confiável.

**Independent Test**: os 16 goldens batem dígito a dígito, e as 5 seções conferem
contra `CUSTO-CTL-001..465`. Entrega valor sozinha — precifica sem o assistente
existir.

### Backend `(E4)`

- [ ] T031 [US1] Implementar `backend/lib/comercial/cost-estimates.js`: salvar, versionar com hash do payload, atribuições de venda, buscar por id e por `proposalCode`.
- [ ] T032 [US1] Implementar as rotas `GET|POST /api/comercial/levantamentos` em `backend/src/routes/comercial/`, sob `requireComercialEstimator`, com validação Zod e **filtro de autoria na listagem** (T024). Contrato em [contracts/api-contracts.md](./contracts/api-contracts.md).
- [ ] T033 [US1] Implementar `GET|PUT /api/comercial/levantamentos/:id` com verificação de autoria: `comercial:seller` pedindo levantamento de outro autor recebe **403**, não `404` genérico nem tela vazia.
- [ ] T034 [US1] **Recalcular no servidor** com `calculateEstimate` no `POST`/`PUT`: os totais gravados são sempre os do servidor, nunca os enviados pelo cliente. É propriedade de segurança — impede forjar margem.
- [ ] T035 [US1] Fazer o `422` devolver `issues: [{ path, message, severity }]` — **um item por pendência, com o endereço do campo**. `validateCostEstimate` já produz isso; a referência concatenava tudo numa string só e jogava o `path` fora.
- [ ] T036 [US1] [P] Escrever `backend/test/comercial-levantamentos.test.js`: fluxo salvar → versionar → reler; recálculo no servidor ignorando totais forjados; e a numeração (não regride, não colide).

### Frontend — as 5 seções `(E7)`

- [ ] T037 [US1] Criar o container `frontend/src/pages/comercial/custos/CustosPage.tsx` com a tira horizontal de 5 seções e o diálogo "Como deseja começar?" — cobre `CUSTO-CTL-001..027` e `CUSTO-H-001..017`. **As abas continuam livres**: a cadeia do rodapé guia, não prende.
- [ ] T038 [US1] [P] Implementar `custos/sections/PremissasSection.tsx` — `CUSTO-CTL-028..038`, com todos os rótulos, unidades, obrigatoriedades, valores padrão e máscaras do inventário.
- [ ] T039 [US1] [P] Implementar `custos/sections/MaoDeObraSection.tsx` — `CUSTO-CTL-039..137` (99 controles).
- [ ] T040 [US1] [P] Implementar `custos/sections/InsumosSection.tsx` — `CUSTO-CTL-138..228` (91 controles).
- [ ] T041 [US1] [P] Implementar `custos/sections/LogisticaSection.tsx` — `CUSTO-CTL-229..394` (166 controles), incluindo o **espelhamento da desmobilização**.
- [ ] T042 [US1] [P] Implementar `custos/sections/ResumoQQPSection.tsx` — `CUSTO-CTL-395..465`, com a faixa de 7 indicadores.
- [ ] T043 [US1] Conferir os **541 textos** `CUSTO-TXT-001..541` item a item contra o inventário: erro, aviso, estado vazio e ajuda, sem reescrita.
- [ ] T044 [US1] Implementar `frontend/src/pages/comercial/custos/CustosFooter.tsx` — o **rodapé-guia** com a cadeia de prioridade fixa — mão de obra → materiais e insumos → mob./desmob. → comissões → "Salvar levantamento e criar proposta →" —, com o botão mudando de texto **e de destino**. É o comportamento que o mantenedor confirmou usar na prática.
- [ ] T045 [US1] Implementar `frontend/src/pages/comercial/custos/ConfirmarPropostaModal.tsx` — "Confirme a proposta", com as três saídas: confirmar o código, trocar para nova, informar outro número. **"Trocar para nova" é mantida** apesar de o mantenedor a considerar saída morta — remover quebraria a regra de aceite "se algo sumiu, é bug".
- [ ] T046 [US1] Ligar os formulários de `frontend/src/pages/comercial/custos/sections/` a `react-hook-form` + `zodResolver` (T003), preservando o **recálculo ao vivo a cada tecla** — é calculadora, não CRUD, e está no Complexity Tracking.

### L1 — validação por campo

- [ ] T047 [US1] **(L1)** Escrever o resolvedor de `path` → id de campo em `frontend/src/pages/comercial/custos/fieldPath.ts`, ligando cada `issue.path` do `422` ao seu controle nas 5 seções.
- [ ] T048 [US1] **(L1)** Destacar **cada** campo pendente em vermelho via `.field-group.field-invalid` + `.field-error`, com `aria-invalid` e mensagem visível. O **banner-resumo no topo permanece**, com a contagem — o destaque é acréscimo, não substituição.
- [ ] T049 [US1] **(L1)** Distinguir em `frontend/src/pages/comercial/components/Field.tsx` os **dois estados** da mensagem: vazio → "Campo obrigatório"; preenchido e inválido → "E-mail inválido" / "CNPJ inválido". Marcar sem distinguir resolve o *onde* e mantém o engano.
- [ ] T050 [US1] [P] Escrever `frontend/test/comercial-validacao.test.mjs`: salvar com campo vazio marca o campo certo; campo inválido recebe mensagem de inválido, não de vazio.

**Checkpoint**: US1 entregável isolada — precifica de ponta a ponta, com os goldens verdes.

---

## Phase 4: US2 — Montar a proposta em 7 etapas (P1) `(E5 + E8)`

**Goal**: o orçamentista percorre as 7 etapas com trava por etapa e prévia ao lado.

**Independent Test**: percorrer as 7 etapas conferindo `PROP-CTL-001..137` e cada trava
contra a tabela de campos obrigatórios. Testável com levantamento semeado, sem depender
da finalização.

### Backend `(E5)`

- [ ] T051 [US2] Implementar `backend/lib/comercial/proposals.js`: histórico, revisões e vínculo com o levantamento.
- [ ] T052 [US2] Implementar `GET|POST /api/comercial/propostas` e `GET|PUT /api/comercial/propostas/:id`, com autoria (T024) e **a resposta variando por papel** (T025): `viewer` recebe a listagem sem `totalValue` e sem link do documento comercial.
- [ ] T053 [US2] Implementar `GET /api/comercial/propostas/proximo-numero` consumindo a sequence do schema `comercial` (T021). **Não toca o Nectar** — cai a varredura de `next-number` da referência.
- [ ] T054 [US2] [P] Escrever `backend/test/comercial-propostas.test.js` cobrindo criação, revisão e vínculo com levantamento.

### Frontend — as 7 etapas `(E8)`

- [ ] T055 [US2] Criar o container `frontend/src/pages/comercial/proposta/PropostaPage.tsx` com o stepper de 7 etapas — `PROP-CTL-001..010` e `PROP-H-001..003`. O stepper cabe em uma linha só (confirmado na baseline).
- [ ] T056 [US2] Implementar `frontend/src/pages/comercial/proposta/PropostaFooter.tsx` com o contador de pendências e a trava de avanço: "Preencha N campo(s) obrigatório(s)" com o botão desabilitado. **Não dá para pular etapa incompleta.**
- [ ] T057 [US2] [P] Implementar `proposta/steps/ClienteStep.tsx` — `PROP-CTL-011..025`. Trava: proposta, cliente, contato, **e-mail válido**, **CNPJ válido**, site, consultor de vendas, orçamentista.
- [ ] T058 [US2] [P] Implementar `proposta/steps/EscopoStep.tsx` — `PROP-CTL-026..033`. Trava: título, e **todo** item de escopo com título *e* descrição.
- [ ] T059 [US2] [P] Implementar `proposta/steps/ResponsabilidadesStep.tsx` — `PROP-CTL-034..042`. Trava: ao menos uma linha na matriz.
- [ ] T060 [US2] [P] Implementar `proposta/steps/PrazosStep.tsx` — `PROP-CTL-043..048`. Trava: mobilização, permanência, execução, atendimento, jornada.
- [ ] T061 [US2] [P] Implementar `proposta/steps/TecnicaStep.tsx` — `PROP-CTL-049..057`, com os requisitos condicionais dos serviços técnicos selecionados.
- [ ] T062 [US2] [P] Implementar `proposta/steps/ComercialStep.tsx` — `PROP-CTL-058..071`. Trava: ao menos um preço com descrição + unidade + valor, condição de pagamento, validade.
- [ ] T063 [US2] [P] Implementar `proposta/steps/RevisaoStep.tsx` — `PROP-CTL-072..085`, com funil do Nectar e escolha de card.
- [ ] T064 [US2] Implementar a prévia lateral `proposta/Preview.tsx` — `PROP-CTL-086..137` e `PROP-H-004..022` (fac-símile). Abas Comercial/Técnica, contador de páginas, "Imprimir prévia". **Presente nas 7 etapas** e com **Arial/Helvetica preservada** — o documento não muda de fonte (desvio nº 5), então não tem desculpa para divergir.
- [ ] T065 [US2] Preservar em `frontend/src/pages/comercial/proposta/Preview.tsx` o índice dos documentos: **13 itens no comercial, 10 no técnico**, na mesma ordem.
- [ ] T066 [US2] Conferir os **330 textos** `PROP-TXT-001..330` item a item contra o inventário.
- [ ] T067 [US2] **(L1)** Aplicar a validação por campo às 7 etapas de `frontend/src/pages/comercial/proposta/steps/`, com "E-mail inválido"/"CNPJ inválido" distintos de "Campo obrigatório". **É o ponto de travamento mais provável do app**: o contador acusa pendência num campo visivelmente preenchido.

### L2 — reordenação

- [ ] T068 [US2] **(L2)** Aplicar `frontend/src/utils/reorderDrag.ts` (auditado em T001) às **três** listas reordenáveis — itens de serviço do escopo, serviços técnicos e blocos de conteúdo —, com alça dedicada, reordenação ao vivo, espaço indicando o destino, fantasma, cancelar restaurando a ordem inicial e persistência só ao soltar.
- [ ] T069 [US2] **(L2)** Garantir o funcionamento em toque de `frontend/src/utils/reorderDrag.ts` nas três listas, via Pointer Events com `touch-action: none`.
- [ ] T070 [US2] **(L2)** **Manter os botões ↑/↓** ao lado da alça em `frontend/src/pages/comercial/proposta/steps/EscopoStep.tsx` e `TecnicaStep.tsx`, com `aria-label`, como caminho de teclado — `PROP-CTL-029`, `PROP-CTL-030` e equivalentes. O desvio nº 6 é **acréscimo puro**: nenhum controle da referência é removido.
- [ ] T071 [US2] [P] Escrever `frontend/test/comercial-reorder.test.mjs` cobrindo o padrão compartilhado e o cancelamento.

**Checkpoint**: US2 entregável — monta proposta completa, sem finalizar.

---

## Phase 5: US3 — Finalizar e não perder trabalho (P1) `(E5 + E8)`

**Goal**: gerar os dois documentos, salvar no histórico e integrar.

**Independent Test**: finalizar uma proposta completa e conferir os 4 estágios, os dois
documentos e o registro no histórico.

- [ ] T072 [US3] Implementar `backend/lib/comercial/proposal-pdf.js` — porte de `app/proposal-pdf.ts` para `pdf-lib`, com as primitivas traduzidas 1:1 e helper próprio de quebra de linha sobre `widthOfTextAtSize`.
- [ ] T073 [US3] [P] Implementar `backend/lib/comercial/pdf-images.js` com `sharp` para o preparo das imagens.
- [ ] T074 [US3] [P] Implementar `backend/lib/comercial/storage.js` — gravação e leitura em disco sob `COMERCIAL_DIR`.
- [ ] T075 [US3] Implementar `POST /api/comercial/propostas/documentos`, gerando os dois PDFs e **gravando antes de qualquer tentativa de integração**.
- [ ] T076 [US3] Implementar `backend/lib/comercial/jobs.js` — Nectar e SharePoint — e `POST /api/comercial/propostas/finalizar`, atualizando `integrationStatus` depois.
- [ ] T077 [US3] **Contrato de falha (FR-034)** em `backend/lib/comercial/jobs.js`: se a integração falhar depois dos documentos gravados, a resposta é erro **mas informa que eles continuam disponíveis para download**, com os links. É comportamento da referência e precisa sobreviver ao porte — o trabalho não se perde.
- [ ] T078 [US3] Implementar em `backend/lib/comercial/access.js` a permissão de finalização: o **autor** finaliza a sua, o **gestor** finaliza qualquer uma; `comercial:viewer` nunca.
- [ ] T079 [US3] Implementar `GET /api/comercial/documentos/:id` com a regra de papel: `viewer` pedindo `COMERCIAL` recebe **403 na rota** — não é botão escondido. Liberar o PDF comercial contornaria a restrição de valores por outra porta.
- [ ] T080 [US3] Registrar `ProposalAuditLog` em `backend/lib/comercial/proposals.js` nas duas ações irreversíveis — finalização e envio externo —, no padrão de `ReportAuditLog`.
- [ ] T081 [US3] Implementar na tela os **4 estágios** anunciados ao usuário, na ordem da referência, a partir de `shared/comercial/finalization.ts`.
- [ ] T082 [US3] Implementar em `frontend/src/pages/comercial/proposta/steps/RevisaoStep.tsx` as validações pré-finalização com **mensagem específica por problema**: e-mail, CNPJ de 14 dígitos, departamento, consultor + orçamentista, funil, empresa e contato do Nectar, escolha de card.
- [ ] T083 [US3] Implementar `frontend/src/pages/comercial/proposta/FinalizacaoPanel.tsx` com o download final: técnica + comercial juntas ou separadas.
- [ ] T084 [US3] Implementar a tela de histórico `frontend/src/pages/comercial/historico/` — `HIST-CTL-001..007`, `HIST-H-001` e `HIST-TXT-001..033` —, com status de integração, valor, revisão e arquivos, **variando por papel** (viewer sem valor e sem link comercial).
- [ ] T085 [US3] [P] Escrever `backend/test/comercial-finalizacao.test.js`, incluindo o caso **integração falha depois dos PDFs prontos → documentos continuam baixáveis**.

**Checkpoint**: MVP completo. US1 + US2 + US3 entregam o produto.

---

## Phase 6: US4 — Não perder o trabalho por um F5 (P2) `(L3, dentro de E7/E8)`

**Goal**: recarregar ou fechar a aba não apaga o trabalho.

**Independent Test**: preencher parcialmente, recarregar, e conferir que o estado volta
pela URL e que o não salvo é oferecido de volta.

- [ ] T086 [US4] **(L3)** Levar modo, base da proposta e seção ativa para o endereço em `/comercial/custos`, limpando parâmetros incompatíveis na troca. Hoje o F5 **volta ao diálogo de modo e apaga o levantamento inteiro** — captura em `contracts/baseline/L3-f5-perde-levantamento.png`.
- [ ] T087 [US4] **(L3)** Levar a etapa ativa para o endereço em `/comercial/propostas`.
- [ ] T088 [US4] **(L3)** Fazer o diálogo "Como deseja começar?" de `frontend/src/pages/comercial/custos/CustosPage.tsx` **não reaparecer** quando o modo já vem no endereço (FR-044) — ele serve para escolher o modo, não para confirmá-lo. Os dois passos (menu → diálogo) coexistem, sem atalho.
- [ ] T089 [US4] **(L3)** Implementar o rascunho local em `frontend/src/pages/comercial/useLocalDraft.ts`: autossalvamento com *debounce*, chave por modo + código de proposta, **nas duas telas** — levantamento e proposta.
- [ ] T090 [US4] **(L3)** Oferecer em `frontend/src/pages/comercial/useLocalDraft.ts` a recuperação **explicitamente** ("recuperar rascunho não salvo?") em vez de restaurar em silêncio. Restaurar sem avisar é pior que perder, porque o usuário não sabe o que está vendo.
- [ ] T091 [US4] **(L3)** Descartar o rascunho de `frontend/src/pages/comercial/useLocalDraft.ts` ao salvar no servidor — não pode sobrar para reaparecer depois.
- [ ] T092 [US4] **(L3)** Implementar `beforeunload` em `frontend/src/pages/comercial/useLocalDraft.ts`, nas duas telas, quando houver alteração pendente. *"Fechar a página sem querer"* é explícito no requisito, não só recarregar.
- [ ] T093 [US4] [P] Escrever `frontend/test/comercial-rascunho.test.mjs`: estado volta pela URL, rascunho é oferecido e não aplicado sozinho, e é descartado ao salvar.

---

## Phase 7: US5 — Encontrar o caminho no primeiro acesso (P2) `(E6 + E8)`

**Goal**: menu de entrada e tutorial permanente.

**Independent Test**: entrar com usuário que nunca abriu o módulo — tutorial aparece uma
vez, é dispensável e não volta sozinho.

- [ ] T094 [US5] Implementar o menu de entrada `frontend/src/pages/comercial/ComercialPage.tsx` (**desvio nº 9**) com dois cartões — levantar custos e ver/criar propostas —, reusando a linguagem de cartões de `frontend/src/pages/HubPage.tsx`. **Sem baseline visual**: não existe na referência para ser fotografado.
- [ ] T095 [US5] Ocultar em `frontend/src/pages/hubModules.ts` o card do módulo no hub do filtroAPP para quem não tem nenhum dos três papéis.
- [ ] T096 [US5] **(L4)** Implementar o **tutorial permanente de primeiro acesso** com `driver.js`, marcado por usuário, dispensável e rechamável, sem reaparecer sozinho. Módulo novo mantém onboarding permanente — a campanha de novidade de 10 dias é para função nova dentro de módulo existente, não se aplica.
- [ ] T097 [US5] **(L4)** Escrever o roteiro do tutorial a partir de `contracts/baseline/roteiro.md`, cobrindo no mínimo: (a) a **cadeia de prioridade do rodapé** de `/comercial/custos`, que é o caminho que o mantenedor confirmou usar; (b) a **armadilha de e-mail/CNPJ inválido** da etapa 1.
- [ ] T098 [US5] **(L5)** Corrigir `frontend/src/pages/LoginPage.tsx` do filtroAPP para usar `.field-group.field-invalid` + `.field-error` + `aria-invalid` em campo obrigatório vazio. **Hoje tem zero `aria-invalid`.** O módulo reusa este login, e o template exige que dívida na fonte seja corrigida **na fonte** — não contornada no módulo. Beneficia o app inteiro.
- [ ] T098a [US5] Registrar em `specs/009-modulo-comercial/contracts/ui-inventory.md` que `LOGIN-CTL-001..007`, `LOGIN-H-001` e `LOGIN-TXT-001..012` **não são portados**, com o motivo: o módulo reusa o login do filtroAPP, premissa desde o início do projeto. Sem esse registro o `/speckit-analyze` os acusa como itens órfãos — e o silêncio deles não pode ser confundido com esquecimento.

---

## Phase 8: US6 — A lista de vendedores se mantém sozinha (P3) `(E4 + E8)`

**Goal**: a lista de consultores é derivada dos usuários, sem cadastro paralelo.

**Independent Test**: conceder `comercial:seller` a um usuário e conferir que ele passa
a aparecer na seleção da etapa Cliente para um gestor — sem passo de cadastro.

> **Decisão de 31/07 que revoga a decisão 4 da §12.5.** Não há model `Seller`, nem CRUD,
> nem tela de cadastro: todo consultor de vendas é um usuário com o papel
> `comercial:seller`. Um cadastro paralelo seria uma segunda verdade para alguém
> esquecer de atualizar.

- [ ] T099 [US6] Implementar `GET /api/comercial/consultores` em `backend/lib/comercial/consultores.js`, derivando a lista dos **usuários ativos com o papel `comercial:seller`**. Sem `POST`, `PUT` nem `DELETE`.
- [ ] T100 [US6] Fazer a resposta de `backend/lib/comercial/consultores.js` **variar por papel** (FR-041b): `comercial:manager` recebe a lista completa; `comercial:seller` recebe **apenas ele mesmo**. Filtrar no cliente não serve — um vendedor não deve nem receber os nomes dos outros.
- [ ] T101 [US6] Gravar `sellerUserId` **e** `sellerName` em `Proposal` (`backend/lib/comercial/proposals.js`): o nome é o do **momento da emissão**. Desativar ou renomear um usuário **não altera proposta já emitida** — o PDF já foi ao cliente com aquele nome.
- [ ] T102 [US6] [P] Ligar o campo `PROP-CTL-016` em `frontend/src/pages/comercial/proposta/steps/ClienteStep.tsx` à rota derivada, **pré-selecionando** a única opção quando o usuário é `comercial:seller`. O controle continua o mesmo `SelectField` do inventário — muda o conjunto de opções, não o elemento. Espelha o que a referência já faz com o orçamentista (`PROP-CTL-018`, preenchido pelo login).

---

## Phase 9: Polish — mobile, testes e produção `(E8.5 + E9 + E10)`

### L7 — layout mobile `(E8.5)`

- [ ] T103 **(L7)** Escrever o layout mobile das 4 telas. A referência **não tem layout mobile** para portar — 39 regras de `min-width` em pixel, a pior `.preview{min-width:390px}`. **Em largura de celular não há paridade pixel-a-pixel a perseguir**; o desktop continua pixel-a-pixel.
- [ ] T104 **(L7)** Resolver em `frontend/src/styles/comercial.css` os dois estouros conhecidos: a **faixa de 7 indicadores de custo** e a **tira de 5 seções** — quebrar, rolar internamente por design, ou virar `select`/menu mobile, sem alargar a página.
- [ ] T105 **(L7)** Converter em `frontend/src/styles/comercial.css` as tabelas largas em cards empilhados em tela estreita, com valores monetários, status e ações quebrando ou truncando **sem alargar o card**.
- [ ] T106 **(L7)** Remover de `frontend/src/styles/comercial.css` a `min-width` em pixel da prévia lateral — é a regra que sozinha estoura qualquer viewport de 390 px.
- [ ] T107 [P] Escrever `frontend/test/comercial-mobile.test.mjs` verificando **zero rolagem horizontal de página** nas 4 telas em 390 px.

### Testes e CI `(E9)`

- [ ] T108 Escrever `backend/test/comercial-permissoes.test.js` com a **matriz completa** de [contracts/api-contracts.md](./contracts/api-contracts.md): 3 papéis × 2 entidades × (criar, ler, editar, finalizar), mais documentos.
- [ ] T109 Escrever em `backend/test/comercial-permissoes.test.js` o caso crítico da matriz: **`seller` A lendo a listagem enquanto existe registro de `seller` B**. Se a filtragem estiver só na rota de item e não no índice, este é o único teste que pega — e é o vazamento mais provável.
- [ ] T110 Escrever em `backend/test/comercial-permissoes.test.js` o caso `viewer` pedindo documento `COMERCIAL` → **403 na rota**, e `TECNICA` → 200.
- [ ] T111 [P] Escrever em `backend/test/comercial-permissoes.test.js` o teste de que a resposta para `viewer` **não contém** `totalValue`, custo nem margem — omissão na serialização, não ocultação na tela.
- [ ] T112 Rodar `npm run architecture:check`, `npm --prefix frontend run lint` e as duas suítes (`backend/test/*.test.js` e `frontend/test/*.test.mjs`).

### Aceite de paridade

- [ ] T113 Percorrer `contracts/baseline/roteiro.md` **lado a lado** — referência de um lado, módulo do outro —, classificando cada divergência como **defeito** ou como um dos **9 desvios aprovados**. Divergência não listada é defeito, não escolha.
- [ ] T114 Comparar as capturas de `contracts/baseline/*-1440.png` com as mesmas telas no módulo. **Diferença esperada e aceita**: a fonte do chrome (desvio nº 5) e o reflow que ela causa.
- [ ] T115 Conferir os **616 controles e 916 textos** item a item contra `contracts/ui-inventory.md`, marcando o checklist de paridade. É item da Definição de Pronto, não conferência informal.
- [ ] T116 Rodar `/speckit-analyze` e resolver **todo** item de inventário órfão.

### Produção `(E10)`

- [ ] T117 Escrever `deploy/COMERCIAL.md` com o **roteiro para o operador**: migration, `GRANT USAGE ON SCHEMA comercial`, envs novas em `backend/.env.production` (`chmod 600`), `client_max_body_size` e o vhost `comercial.filtrovali.com.br` → `app.filtrovali.com.br/comercial`. **Princípio I: nenhum comando de servidor é executado por agente — o roteiro é escrito, não rodado.**
- [ ] T118 [P] Incluir a pasta de `COMERCIAL_DIR` em `deploy/backup-prod.sh`.
- [ ] T119 Documentar em `deploy/COMERCIAL.md` a concessão de papéis: `comercial:manager` a Aliander e Erike, `comercial:seller` aos vendedores, `comercial:viewer` a quem só consulta.

---

## Depois do go-live `(E11)`

- [ ] T120 Substituir o import do Access em `backend/lib/comercial/proposals.js`: gravar `CommercialProposal` na mesma transação da proposta. É o que a decisão de manter os dois schemas no mesmo processo torna trivial.

---

## Dependências

```
Fase 1 (Setup) ──▶ Fase 2 (Foundational) ──┬──▶ Fase 3 (US1) ──▶ Fase 4 (US2) ──▶ Fase 5 (US3)
                                            │                                          │
                                            └──────────────────────────────────────────┴──▶ Fase 6 (US4)
                                                                                            Fase 7 (US5)
                                                                                            Fase 8 (US6)
                                                                                                 │
                                                                                                 ▼
                                                                                         Fase 9 (Polish)
```

- **T001 bloqueia T068** — a auditoria do `reorderDrag.ts` precede o uso.
- **T003 bloqueia T046 e T067** — sem `@hookform/resolvers` não há resolver Zod.
- **T024/T025 bloqueiam T032, T033, T052, T079** — acesso antes das rotas.
- **T029 bloqueia a Fase 9** — sem as primitivas responsivas certas, a E8.5 vira reescrita.
- **T030 bloqueia T048 e T067** — o `Field` generalizado é a base da L1.
- **Fase 3 → Fase 4 → Fase 5** é o caminho crítico. As fases 6, 7 e 8 podem correr em paralelo depois da 5.

## Paralelização

- **Fase 1**: T001, T003 e T009–T012 em paralelo.
- **Fase 2**: T022, T028, T029 e T030 em paralelo depois de T020.
- **Fase 3**: T038–T042 (as 5 seções) em paralelo — arquivos diferentes.
- **Fase 4**: T057–T063 (as 7 etapas) em paralelo — arquivos diferentes.
- **Fase 9**: T107, T111 e T118 em paralelo.

## Estratégia de entrega

**MVP = Fases 1 + 2 + 3.** A US1 entrega valor sozinha: um orçamentista precifica de
ponta a ponta, com os 16 goldens provando os números. Sem proposta, sem finalização.

**Incremento 2**: + Fase 4 (monta proposta) e Fase 5 (emite documentos). Aqui o módulo
substitui a ferramenta de origem.

**Incremento 3**: + Fases 6, 7 e 8 — continuidade, onboarding e cadastro.

**Fase 9 não é opcional.** Mobile e a matriz de permissão são condição de aceite; o
aceite de paridade é o que prova que o porte é fiel.
