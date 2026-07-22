# Feature Specification: DDS no RDO

**Feature Branch**: `005-dds-rdo`

**Created**: 2026-07-15

**Status**: Approved

**Input**: User description: "Incrementar um campo nos RDOs referente ao DDS para melhor controle. No fluxo do formulário de RDO, adicionar um toggle de que houve DDS para cada turno; ao marcar que sim, aparece o horário de início e término do DDS e a lista com vários temas que podem ser abordados para o colaborador ir adicionando (semelhante a como é adicionado os colaboradores). A lista deve ser modificável por gestores e coordenadores. Haverá um campo no documento do RDO específico para o DDS com o horário e os tópicos abordados."

## Contexto

Hoje o RDO não registra o DDS (Diálogo Diário de Segurança), dificultando o controle e a comprovação das práticas de segurança do trabalho. Esta feature adiciona o registro do DDS por turno (diurno e noturno) no formulário de RDO, uma lista de temas de DDS pré-cadastrada e gerenciável por gestores e coordenadores, e uma seção dedicada ao DDS no documento DOCX/PDF gerado.

Decisões do usuário na fase de planejamento:

- O documento ganha **seção própria** "DDS — Diálogo Diário de Segurança" (não linhas na tabela Jornada de Trabalho).
- Temas podem ser escolhidos da lista pré-cadastrada ou digitados como tema livre; temas livres são gravados como snapshot `custom: true` e podem ser cadastrados na lista oficial pelo gestor/coordenador durante a revisão.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar DDS por turno no RDO (Priority: P1)

O colaborador, ao preencher o RDO, liga o toggle "Houve DDS?" do turno diurno; aparecem os campos de horário de início e término e a lista de temas, onde ele adiciona um ou mais temas da lista pré-cadastrada ou digita um tema livre quando necessário (select/input + chips removíveis, igual à adição de colaboradores). Se houver turno noturno, um bloco DDS equivalente aparece dentro da seção do turno noturno. Os dados são salvos com o relatório (inclusive no rascunho) e aparecem na visualização do RDO.

**Why this priority**: É o registro em si — sem ele não há controle de DDS.

**Independent Test**: Criar um RDO com DDS diurno (horário + 2 temas) e DDS noturno (horário + 1 tema), salvar, reabrir e conferir os dados na visualização do relatório.

**Acceptance Scenarios**:

1. **Given** o formulário de novo RDO, **When** o colaborador liga "Houve DDS?" no turno diurno, **Then** aparecem os campos Início/Término, o select das opções ativas cadastradas e o input para tema fora da lista.
2. **Given** o toggle de DDS ligado, **When** o colaborador tenta avançar sem preencher início, término ou pelo menos 1 tema, **Then** a validação bloqueia com mensagem no padrão do formulário.
3. **Given** o toggle "Houve turno noturno?" ligado, **When** o colaborador abre a seção noturna, **Then** há um bloco "Houve DDS?" próprio do turno noturno, independente do diurno.
4. **Given** DDS noturno preenchido, **When** o colaborador desliga o turno noturno e envia o RDO, **Then** o DDS noturno é gravado como desabilitado (não vaza para o relatório).
5. **Given** um rascunho salvo com DDS preenchido, **When** o colaborador retoma o rascunho, **Then** toggles, horários e temas voltam exatamente como estavam.
6. **Given** um RDO antigo criado antes da feature, **When** ele é aberto ou editado, **Then** nada quebra e o DDS aparece como "não houve".

---

### User Story 2 - Gerenciar lista de temas de DDS (Priority: P1)

Gestores e coordenadores mantêm a lista de temas de DDS (criar, renomear, desativar, reativar) numa área de administração dentro das suas respectivas páginas. Temas desativados deixam de aparecer no select do formulário, mas continuam legíveis em relatórios antigos.

**Why this priority**: A lista padroniza os temas recorrentes e reduz digitação livre; temas fora da lista podem ser revisados e cadastrados posteriormente.

**Independent Test**: Como coordenador, criar um tema, conferir que aparece no select do formulário; desativá-lo e conferir que some do select mas permanece em RDO já salvo com ele. Criar um RDO com tema livre e validar que o gestor consegue cadastrá-lo na lista oficial durante a revisão.

**Acceptance Scenarios**:

1. **Given** a área do gestor (aba Equipe), **When** o gestor abre a sub-aba "Temas de DDS", **Then** vê a lista com criação, renomeação, desativação e reativação.
2. **Given** a página do coordenador, **When** o coordenador abre a aba "Temas de DDS", **Then** tem o mesmo CRUD do gestor.
3. **Given** um tema desativado, **When** um colaborador abre o formulário de RDO, **Then** o tema não aparece no select de temas.
4. **Given** um tema usado em RDO salvo, **When** ele é renomeado ou desativado, **Then** o RDO antigo continua exibindo o nome vigente na época (snapshot).
5. **Given** um usuário colaborador ou cliente, **When** tenta criar/editar/excluir tema via API, **Then** recebe 403.

---

### User Story 3 - DDS no documento do RDO (Priority: P2)

O documento DOCX (e o PDF derivado) do RDO ganha uma seção "DDS — DIÁLOGO DIÁRIO DE SEGURANÇA" com, por turno, o horário (início às término) e os temas abordados.

**Why this priority**: O documento é a entrega formal ao cliente, mas depende do registro (US1) existir.

**Independent Test**: Gerar o DOCX de um RDO com DDS nos dois turnos e conferir a seção preenchida; gerar de um RDO sem DDS e conferir a seção em branco, sem placeholders sobrando.

**Acceptance Scenarios**:

1. **Given** um RDO com DDS diurno e noturno, **When** o DOCX é gerado, **Then** a seção DDS mostra horário e temas de cada turno.
2. **Given** um RDO sem DDS (ou antigo, sem o bloco), **When** o DOCX é gerado, **Then** os campos da seção ficam em branco e nenhum token `{{...}}` aparece no documento.
3. **Given** um RDO com DDS noturno marcado mas turno noturno desligado, **When** o DOCX é gerado, **Then** a coluna do turno noturno fica em branco.

---

### Edge Cases

- Relatórios e rascunhos criados antes da feature (sem bloco `dds` em `specialConditions`) devem ser tratados como "sem DDS" em formulário, visualização e documento.
- Edição pelo gestor: desligar o DDS na edição deve sobrescrever o bloco antigo (o merge de `specialConditions` não pode ressuscitá-lo).
- Tema renomeado/desativado após uso: relatórios gravam snapshot `{id, name}` e exibem o nome da época.
- Lista de temas vazia: o select mostra estado vazio; a validação de "≥ 1 tema" continua valendo, mas o colaborador pode registrar um tema livre para revisão posterior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O formulário de criação de RDO DEVE ter um toggle "Houve DDS?" para o turno diurno e, quando o turno noturno estiver ligado, um toggle equivalente dentro da seção noturna.
- **FR-002**: Com o toggle ligado, DEVEM aparecer campos de horário de início e término (input de hora), select das opções ativas, input para tema fora da lista e chips removíveis (padrão visual da adição de colaboradores).
- **FR-003**: Com o toggle ligado, início, término e pelo menos 1 tema são obrigatórios; com o toggle desligado, nenhum campo de DDS é exigido.
- **FR-004**: Os temas selecionados DEVEM ser gravados como snapshot `{id, name}` dentro de `specialConditions.dds` do relatório, por turno; temas livres DEVEM incluir `custom: true`.
- **FR-005**: Rascunhos DEVEM persistir e restaurar o estado completo do DDS.
- **FR-006**: A edição de RDO pelo gestor DEVE permitir alterar o DDS dos dois turnos, com as mesmas validações, e a visualização do RDO DEVE exibir o DDS por turno.
- **FR-007**: DEVE existir CRUD de temas de DDS (nome único, ordenação, ativação) com leitura para qualquer papel interno do RDO e escrita restrita a gestor (`rdo:manager`) e coordenador (`rdo:coordinator`); exclusão é desativação (soft delete).
- **FR-008**: A UI de gerenciamento DEVE estar disponível para o gestor (sub-aba na aba Equipe do GestorPage) e para o coordenador (aba própria no CoordinatorPage), em pt-BR e mobile-first.
- **FR-009**: O documento DOCX do RDO DEVE ter seção dedicada "DDS — DIÁLOGO DIÁRIO DE SEGURANÇA" com horário (início às término) e temas por turno; sem DDS, os campos saem em branco (sem tokens residuais). O PDF é derivado do DOCX sem mudança adicional.
- **FR-010**: RDOs anteriores à feature DEVEM continuar funcionando sem alteração (bloco `dds` ausente = sem DDS).

### Key Entities

- **DdsTheme**: tema de DDS gerenciável — `id`, `name` (único), `order`, `isActive`, timestamps. Padrão idêntico ao `JobRole` existente.
- **Bloco `dds` em `Report.specialConditions`** (JSON, sem migração no Report): `{ diurno: { enabled, inicio, termino, temas: [{id, name, custom?}] }, noturno: { ... } }`.

## Success Criteria *(mandatory)*

- **SC-001**: Um RDO criado com DDS nos dois turnos exibe horários e temas corretos na visualização e no DOCX/PDF gerado.
- **SC-002**: Coordenador e gestor conseguem criar/renomear/desativar temas; tema desativado some do select em novo RDO sem afetar RDOs salvos.
- **SC-003**: RDOs e rascunhos antigos (sem `dds`) abrem, editam e geram documento sem erro, com a seção DDS em branco.
- **SC-004**: Colaborador e cliente recebem 403 em qualquer escrita de tema via API.
- **SC-005**: `npm test` do backend passa, incluindo testes novos da montagem dos campos DDS do DOCX.
