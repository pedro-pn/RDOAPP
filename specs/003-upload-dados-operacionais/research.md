# Research: Dados Operacionais no Upload Manual de Relatórios

**Feature**: 003-upload-dados-operacionais | **Date**: 2026-07-13

Nenhum NEEDS CLARIFICATION restou na spec; esta fase consolida as decisões técnicas
investigadas no código existente.

## R1. Como o fluxo normal grava jornada, colaboradores e noturno

**Investigação** (`backend/src/routes/resources/reports.js`, `backend/src/lib/overtime.js`,
`backend/prisma/schema.prisma`):

- Jornada diurna: colunas `Report.arrivalTime`, `departureTime`, `lunchBreak` (strings `HH:MM`),
  `daytimeCount` (nº de colaboradores diurnos).
- Minutos calculados: `calculateReportOvertime(project, payload)` em `overtime.js:120` devolve
  `daytimeWorkedMinutes`, `nighttimeWorkedMinutes`, `daytimeOvertimeMinutes`,
  `nighttimeOvertimeMinutes`, `totalOvertimeMinutes` — considera virada de dia (saída < entrada
  soma 24h), intervalo (`parseBreak` aceita `HH:MM[:SS]`, "sem intervalo", "1h30" etc.), jornada
  esperada do projeto (`workdayHours`/`weekendWorkdayHours`/sábado/domingo) e feriados nacionais.
- Colaboradores: payload `collaboratorIds: string[]` → linhas em `ReportCollaborator`
  (`@@id([reportId, collaboratorId])`).
- Turno noturno: `specialConditions.noturno` (bool) + `specialConditions.noturnoDetails`
  `{ enabled, inicio, termino, intervalo|jantaIntervalo, collaboratorIds, colaboradores }`.
  `enrichNightCollaboratorsInSpecialConditions(tx, specialConditions)` (reports.js:3702) resolve
  `collaboratorIds` → snapshot `colaboradores: [{ id, name, role }]`.
- Stand-by: `specialConditions.standby` (bool) + `specialConditions.standbyDetails`
  `{ total, motivo }`, preenchidos no fluxo normal a partir de `standby`, `standbyDuration` e
  `standbyMotivo`.
- Frontend do fluxo normal (`frontend/src/store/rdoStore.ts`): campos `noturno`, `noturnoStart`,
  `noturnoEnd`, `noturnoInterval` (default `01:00:00`).

**Decision**: Reusar exatamente essas estruturas e funções no upload manual; stand-by entra apenas
para RDO manual, no mesmo shape do fluxo normal.
**Rationale**: Qualquer consumidor (Acompanhamento, estatísticas, detalhe) enxerga os relatórios
manuais sem tratamento especial — SC-005 por construção.
**Alternatives considered**: Guardar os dados dentro de `__manualUpload` (rejeitado: exigiria
adaptar todos os consumidores); criar tabela própria (rejeitado: duplicaria o modelo existente).

## R2. Onde o upload manual zera os dados hoje

**Investigação**: `POST /reports/manual-upload` (reports.js:6004) cria o `Report` com
`arrivalTime: '00:00'`, `departureTime: '00:00'`, `lunchBreak: '00:00:00'`, `daytimeCount: 0`,
minutos zerados e sem `collaborators`. O schema `manualReportUploadSchema` (reports.js:3657) não
aceita nenhum campo operacional.

**Decision**: Estender `manualReportUploadSchema` com bloco opcional de dados operacionais,
aceito para **qualquer tipo de relatório** do upload (RDO e somente serviço); quando presente,
calcular via `calculateReportOvertime` e criar os vínculos na mesma transação
(`tx.report.create({ data: { ..., collaborators: { create: [...] } } })`). Nos tipos somente
serviço, `serviceOnly: true` e `serviceData` continuam gravados como hoje.
**Rationale**: Mudança localizada; ausência do bloco = comportamento atual intacto (FR-006).
Decisão do usuário (2026-07-13): relatórios somente serviço também devem contabilizar mão de obra.
**Alternatives considered**: Restringir ao tipo RDO (rejeitado pelo usuário: obras antigas
documentadas só por relatórios de serviço ficariam sem custo); tornar campos obrigatórios
(rejeitado: PDFs antigos podem não ter a informação; spec exige opcionalidade).

## R3. Como o Acompanhamento consome os RDOs (e o ajuste para relatórios de serviço)

**Investigação** (`backend/src/lib/acompanhamento/labor-cost.js`):

- `getRdoDataByCollaborator(periodStart, periodEndExclusive)` (linha 117) busca
  `Report.findMany({ where: { reportType: 'RDO', deletedAt: null, reportDate: {...} } })` com
  `daytimeWorkedMinutes`, `nighttimeWorkedMinutes` e `collaborators` — **não filtra por origem**
  (`specialConditions.source` é ignorado), mas **filtra por tipo**: relatórios somente serviço
  (RTP, RLQ etc.) ficam fora hoje.
- Dia com dois relatórios do mesmo colaborador: prevalece o de mais horas (linhas 140–143,
  `dayProject`) — regra de desempate cobre manual vs normal e, estendida a consulta, também
  RDO vs relatório de serviço do mesmo dia (sem dupla contagem).
- Restrições vigentes que permanecem: só dias dentro do período do import de ponto e com ponto
  batido alimentam verbas variáveis (`classifyDays` itera `workedDates` do ponto); relatório
  manual fora do período do ponto simplesmente não entra.

**Decision**: Para RDOs manuais, zero mudança. Para atender FR-005a–d (relatórios somente serviço
com horas), ajustar `getRdoDataByCollaborator`:

- `where`: `OR: [{ reportType: 'RDO' }, { daytimeWorkedMinutes: { gt: 0 } },
  { nighttimeWorkedMinutes: { gt: 0 } }, { services: { some: { startTime: { not: null },
  endTime: { not: null } } } }]` (mantendo `deletedAt: null` e o range de datas), com
  `services: { select: { startTime: true, endTime: true } }` no select.
- Horas efetivas por relatório: minutos gravados quando > 0; senão, derivadas dos serviços
  (ver R6). Nenhuma mudança em `cost-engine.js`, `salary.js` ou no restante do labor-cost.

**Rationale**: RDOs continuam entrando incondicionalmente (preserva a classificação de dias atual,
inclusive RDOs com horas zeradas); relatórios de serviço entram quando têm horas gravadas (upload
manual) ou horários de serviço (fluxo normal — cobre o histórico sem backfill). O desempate por
dia já existente absorve a sobreposição RDO + serviço.
**Alternatives considered**: Incluir todos os tipos incondicionalmente (rejeitado: relatórios sem
nenhuma fonte de horas entrariam como ruído e poderiam roubar o dia do RDO no desempate em empate
de 0h); flag para incluir/excluir relatórios manuais do custo (rejeitado: complexidade sem
demanda; quem não quiser refletir, basta não preencher os dados).

## R4. Edição de dados de uploads existentes (US4)

**Investigação**: O fluxo de edição normal (`PUT /reports/:id`) exige payload completo do fluxo
normal e mexe em versionamento/status; `PUT /reports/:id/manual-pdf` (reports.js:6123) exige
`pdfDataUrl` e sobrescreve `specialConditions` a partir do existente.

**Decision**: Novo endpoint `PUT /reports/:id/manual-data` (requireRdoManager), aceitando apenas o
bloco de dados operacionais; valida que o relatório é de upload manual
(`manualReportUploadMeta(report).uploadedAt`), recalcula minutos com `calculateReportOvertime`,
substitui os vínculos (`deleteMany` + `create`) e faz merge não destrutivo de
`specialConditions.noturnoDetails` e, quando for RDO manual, `standby/standbyDetails`. Registrar
carimbo de edição dentro de `__manualUpload` (ex.: `operationalDataUpdatedAt`,
`operationalDataUpdatedByUserId`) para auditoria.
**Rationale**: Endpoints existentes têm contratos incompatíveis; um endpoint dedicado mantém as
invariantes do fluxo manual (status, PDF intocado — FR-008).
**Alternatives considered**: Estender `manual-pdf` tornando `pdfDataUrl` opcional (rejeitado:
mistura duas operações distintas e complica o modo de assinatura); reutilizar `PUT /:id`
(rejeitado: dispara versionamento/edição do fluxo normal, incompatível com relatório manual).

Complemento: `PUT /:id/manual-pdf` hoje reconstrói `specialConditions` espalhando o existente —
verificar na implementação que `noturnoDetails` e os novos carimbos sobrevivem à troca de PDF
(FR-009) e cobrir com teste.

## R5. UI do upload manual (lote) e paridade de opções

**Investigação** (`frontend/src/pages/gestor/GestorPage.tsx`): o modal mantém
`ManualReportFormState` com `files: ManualReportUploadFileState[]` — cada arquivo já tem
`sequenceNumber`, `reportDate`, `serviceEquipment`, `serviceSystem`. A seleção de colaboradores do
fluxo normal usa lista de colaboradores ativos com multiseleção; noturno usa os campos do
`rdoStore` (start/end/interval).

**Decision**: Acrescentar a `ManualReportUploadFileState` os campos `arrivalTime`,
`departureTime`, `lunchBreak`, `collaboratorIds`, `noturno` (bool), `noturnoStart`, `noturnoEnd`,
`noturnoInterval`, `noturnoCollaboratorIds` e, quando o arquivo for RDO, `standby`,
`standbyDuration`, `standbyMotivo`, exibidos num bloco recolhível "Dados operacionais (opcional)"
por arquivo. Jornada/noturno/colaboradores ficam disponíveis para todos os tipos de relatório do
upload; stand-by fica disponível apenas para RDO. Defaults iguais ao fluxo normal
(`lunchBreak: '01:00:00'`, `noturnoInterval: '01:00:00'`). Reusar componentes do kit e o padrão de
multiseleção de colaboradores já existente no app.
**Rationale**: Constituição VI (kit + tela análoga) e II (mobile: bloco recolhível evita um modal
quilométrico no lote).
**Alternatives considered**: Um único conjunto de dados para o lote inteiro (rejeitado: cada PDF é
um dia distinto — FR-007); segunda etapa de wizard (rejeitado: mais complexidade de navegação no
modal para pouco ganho).

## R5b. UI de edição para relatório manual

**Investigação** (`frontend/src/pages/ReportDetailPage.tsx`): a tela de edição normal do RDO já
tem campos de data, horários, turno, stand-by, observações e anexos gerais. O fluxo manual atual
foi planejado inicialmente como ação/botão separado "Completar dados", reutilizando um modal com
campos operacionais.

**Decision**: Relatórios com `specialConditions.__manualUpload` devem usar um modo de edição
inline na página de detalhe/edição, com a mesma organização visual do RDO criado no app quando
isso melhorar a consistência da tela: data, horários, turno noturno, stand-by quando `reportType`
for `RDO`, e colaboradores ficam disponíveis inline; observações, anexos de fotos e a ação de
adicionar serviço não são renderizados nem aceitos nesse fluxo; o botão separado "Completar dados"
é removido. O salvamento continua usando `PUT /reports/:id/manual-data` para preservar PDF,
status, versão e assinatura.

**Rationale**: Relatório manual tem o PDF histórico como evidência principal, mas a navegação pode
seguir o padrão já conhecido da edição de RDO. Manter colaboradores na própria página evita perder
a principal correção operacional que alimenta o Acompanhamento.

**Alternatives considered**: Manter o botão/modal "Completar dados" (rejeitado pelo usuário:
campo deve ficar na própria página de edição); reutilizar a edição completa de RDO do app sem
restrições (rejeitado: expõe observações, fotos e adição de serviço que não pertencem ao fluxo
manual).

## R6. Horas de relatórios somente serviço do fluxo normal (horários dos serviços)

**Investigação**: O fluxo normal de relatório somente serviço (`POST /reports/service-only`,
reports.js:6485) não exige jornada — o relatório nasce com minutos zerados e `daytimeCount` =
nº de colaboradores. Porém, cada serviço capturado no app tem "Hora de início" e "Hora de
término/pausa" **obrigatórios** no formulário (`frontend/src/components/reports/ServiceFields.tsx:1302-1319`),
persistidos em `ReportService.startTime`/`endTime` (strings `HH:MM`, nullable no schema). Ou seja:
o dado necessário já existe no banco, inclusive para relatórios antigos.

**Decision**: Derivar as horas trabalhadas desses relatórios **em tempo de leitura**, dentro do
labor-cost, como a **união dos intervalos** `startTime→endTime` dos serviços do relatório
(ordenar por início, mesclar sobreposições; término < início soma 24h). Precedência: se o
relatório tem minutos gravados (> 0, ex.: jornada informada no upload manual), eles prevalecem e
a derivação não é usada. Horas derivadas contam como diurnas (serviços não distinguem turno).
Implementar como função pura exportada (ex.: `serviceIntervalsWorkedMinutes(services)`) com
testes unitários.
**Rationale**: (a) união em vez de soma — serviços em paralelo/sobrepostos dobrariam as horas;
(b) derivação em leitura em vez de materializar nas colunas — cobre todo o histórico sem script
de backfill (que exigiria dry-run/idempotência pelo Princípio IV) e não cria risco de divergência
quando serviços são editados; (c) precedência da jornada — é o dado mais completo quando existe.
**Alternatives considered**: Materializar minutos nas colunas ao criar/editar relatório de serviço
(rejeitado: exige backfill do histórico + recomputo em toda edição de serviço; duas fontes de
verdade); usar `min(início)→max(término)` (rejeitado: contaria intervalos ociosos entre serviços);
somar durações (rejeitado: dupla contagem em serviços paralelos).

## R7. Hora extra e status do relatório manual

**Investigação**: No fluxo normal, HE calculada pode exigir aceite (`overtimeAccepted`); o
relatório manual nasce `APPROVED`/`SIGNED` (modo de assinatura escolhido no upload).

**Decision**: Gravar os minutos de HE que `calculateReportOvertime` devolver, sem fluxo de aceite;
status e assinatura do fluxo manual permanecem intocados.
**Rationale**: O labor-cost deriva HE 70/100 do ponto, não do RDO — os minutos do RDO servem a
estatísticas/exibição; introduzir aceite de HE retroativo contradiz o propósito (digitalizar
histórico já aprovado).
**Alternatives considered**: Zerar HE nos manuais (rejeitado: quebraria paridade de exibição com
RDOs normais — FR-003/FR-012).
