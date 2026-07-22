# Research: DDS no RDO

## Decisões e racional

### D1 — Persistência do registro de DDS: `specialConditions.dds` (Json), sem migração

- **Decisão**: bloco `dds` dentro de `Report.specialConditions`, espelhando `noturnoDetails`.
- **Racional**: `specialConditions Json?` (`schema.prisma:472`) já é o lar de standby, turno noturno, uploads e overtime; o turno noturno inteiro (horários + colaboradores) vive lá. DDS não precisa de consulta relacional/estatística no banco hoje.
- **Alternativa rejeitada**: tabela `ReportDds` relacional — só se um dia houver relatórios gerenciais por tema; migrável depois a partir do JSON.

### D2 — Lista de temas: model dedicado `DdsTheme` clonando `JobRole`

- **Decisão**: model + rota CRUD próprios, clone de `job-roles.js` (54 linhas, GET interno / escrita restrita / soft delete).
- **Racional**: é o padrão canônico do repo para listas configuráveis (job-roles, units, manometers, inhibition-options); frontend ganha clone do `JobRoleManager.tsx` já mobile e consistente (Constitution VI).
- **Alternativa rejeitada**: lista hardcoded ou em tabela genérica de settings — não atende gestão por coordenador nem soft delete com histórico.

### D3 — Snapshot `{id, name}` dos temas no relatório

- **Decisão**: gravar id **e** nome no bloco `dds`.
- **Racional**: o DOCX é regerado em aprovação/assinatura, às vezes meses depois; tema renomeado/desativado não pode alterar documento histórico. Precedente: `noturnoDetails.colaboradores` guarda nomes.

### D4 — Escrita de temas: `requireModuleRole('rdo:manager', 'rdo:coordinator')`

- **Decisão**: divergir do clone (`job-roles` usa `requireManager` = ADMIN + rdo:manager) para incluir coordenador.
- **Racional**: requisito explícito do usuário ("modificável pelos gestores e coordenadores"). `requireModuleRole` (`middleware/auth.js:129`) já existe para isso.

### D5 — UI de gestão: sub-aba no GestorPage + aba no CoordinatorPage

- **Decisão**: gestor gerencia na sub-aba "Temas de DDS" dentro da aba Equipe (ao lado de "Cargos"/JobRoleManager); coordenador ganha aba própria no CoordinatorPage (que não tem acesso ao GestorPage).
- **Racional**: precedente direto do JobRoleManager; CoordinatorPage já é tab-based, custo mínimo.

### D6 — Documento: seção própria, placeholders escalares, temas em string única

- **Decisão do usuário**: seção dedicada "DDS — DIÁLOGO DIÁRIO DE SEGURANÇA" (não linhas na tabela Jornada).
- **Racional técnico**: placeholders escalares passam pelo `replacePlaceholders` existente sem tocar no pipeline; `clearRemainingPlaceholders` (`report-docx.js:826`) já apaga tokens quando não há DDS. Temas com join `", "` evita nova lógica de expansão de linhas (`expandCollaborators`-like). Se lista longa virar problema visual, trocar por `setPlaceholderCellParagraphs` com `\n` (já existe, l.844).

### D7 — Fluxo manual-data (feature 003) fica fora

- **Decisão**: DDS não entra no `PUT /:id/manual-data` nem no `buildManualReportOperationalData`.
- **Racional**: RDOs enviados por upload de PDF não têm registro digital de DDS; os campos no componente compartilhado ficam atrás da prop `showDds` (default false), ligada só no editor de RDO.

### D8 — Temas somente da lista (sem texto livre) — **REVERTIDA em 2026-07-15**

- Decisão original: select da lista pré-cadastrada apenas.
- **Revisão (pedido do usuário)**: além do select, há input de texto livre ("Tema fora da lista? Digite aqui...", padrão `inline-add-row` do `EtapasSection`). Tema avulso é gravado no snapshot com `custom: true` (`{ id: 'custom-...', name, custom: true }`); se o texto digitado bater com um tema oficial (case-insensitive), vincula ao oficial. No editor de revisão, um alerta (`project-registration-alert`) lista os temas avulsos e gestor/coordenador podem cadastrá-los na lista oficial com um clique ("Cadastrar na lista" → `createDdsTheme` + relink do snapshot); chips e visualização marcam temas avulsos com "(novo)". O DOCX imprime apenas o nome (sem marcador).
