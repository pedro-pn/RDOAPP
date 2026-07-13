# Implementation Plan: Dados Operacionais no Upload Manual de Relatórios

**Branch**: `003-upload-dados-operacionais` | **Date**: 2026-07-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-upload-dados-operacionais/spec.md`

## Summary

O upload manual de relatórios (PDFs antigos — RDO **e** somente serviço) passa a aceitar, opcionalmente, os mesmos dados operacionais do fluxo normal: horário de entrada/saída, intervalo de almoço, colaboradores participantes, turno noturno (início, término, intervalo e colaboradores do noturno) e, para RDO manual, stand-by (tempo total e motivo). A abordagem técnica é **gravar esses dados exatamente nas mesmas estruturas que o fluxo normal já usa** — colunas `arrivalTime`/`departureTime`/`lunchBreak` do `Report`, vínculos `ReportCollaborator` e blocos `specialConditions.noturnoDetails`/`standbyDetails` — e calcular as horas com o motor existente `calculateReportOvertime` (`backend/src/lib/overtime.js`). No Acompanhamento, o custo de mão de obra exige **um ajuste pontual em `getRdoDataByCollaborator` (labor-cost.js)**: a consulta hoje filtra `reportType: 'RDO'` e passa a incluir também relatórios de outros tipos que tenham horas trabalhadas — vindas da jornada informada no upload manual **ou derivadas, em tempo de leitura, dos horários início/término dos serviços** (`ReportService.startTime/endTime`, já capturados como campos obrigatórios no fluxo normal de serviço — `ServiceFields.tsx`). A derivação em leitura cobre o histórico existente sem backfill. O desempate por dia existente (prevalece o relatório de mais horas) evita dupla contagem quando RDO e relatório de serviço cobrem o mesmo dia. O endpoint de edição de dados manuais continua dedicado, mas a UI deixa de ter um botão separado "Completar dados": os campos ficam na própria página de edição manual, com colaboradores editáveis e sem observações, anexos de fotos ou ação de adicionar serviço.

## Technical Context

**Language/Version**: Node.js + Express (backend, ESM), React + Vite + TypeScript (frontend)

**Primary Dependencies**: Prisma + PostgreSQL, Zod (validação nas duas pontas), @tanstack/react-query, react-hook-form, zustand

**Storage**: PostgreSQL via Prisma — **sem mudança de schema**: `Report.arrivalTime/departureTime/lunchBreak/daytime*/nighttime*` e `ReportCollaborator` já existem; turno noturno vive em `Report.specialConditions.noturnoDetails` (Json); stand-by vive em `Report.specialConditions.standby/standbyDetails` (Json)

**Testing**: `backend/test/*.test.js` via `npm test` (padrão existente; ver `acompanhamento-labor-cost.test.js` e `derived-service-report-edit.test.js` como referências)

**Target Platform**: Web (servidor Linux + navegador, mobile-first)

**Project Type**: Web application (backend + frontend)

**Performance Goals**: Sem novos requisitos — o upload em lote já processa N arquivos sequencialmente; os campos extras não alteram a ordem de grandeza do payload (PDF domina)

**Constraints**: Compatibilidade total com uploads sem dados (comportamento atual preservado byte a byte); consumidores leem as mesmas estruturas — única exceção: o filtro de tipos da consulta de RDOs do labor-cost, ampliado para relatórios com horas (sem mudança de semântica para os dados existentes)

**Scale/Scope**: 2 endpoints tocados + 1 endpoint dedicado mantido/ampliado, 1 ajuste pontual no labor-cost (filtro da consulta de RDOs), 1 modal do frontend estendido (GestorPage), 1 página de detalhe/edição com modo manual específico (ReportDetailPage), ~5 arquivos de backend, ~5 de frontend, sem migration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação |
|-----------|-----------|
| I. Operação de servidor | ✅ Nenhum comando de servidor no escopo; deploy segue fluxo humano padrão |
| II. UI pt-BR e mobile-first | ✅ Campos novos entram no modal de upload existente do GestorPage (corpo rolável, rodapé fixo); a página de edição manual fica inline e sem botão "Completar dados"; labels pt-BR; seleção de colaboradores deve funcionar em telas estreitas |
| III. Zod nas duas pontas | ✅ `manualReportUploadSchema` estendido no backend; formulário do modal validado no cliente antes do envio (o modal atual usa estado manual — a validação espelhada será aplicada no submit, e o backend continua a barreira canônica) |
| IV. Banco só via Prisma | ✅ Sem mudança de schema; nenhuma migration necessária |
| V. Testes de lógica de negócio | ✅ Novos testes em `backend/test` para o upload com dados, edição e reflexo no labor-cost |
| VI. Consistência visual | ✅ Reuso dos componentes do kit (`Modal`, `Button`, inputs de `base.css`); seleção de colaboradores segue o padrão de multiseleção já usado no fluxo normal de RDO |

**Resultado**: PASS — nenhuma violação a justificar (Complexity Tracking vazio).

*Re-check pós-Phase 1*: PASS — o design não introduziu desvios (sem schema novo, sem componente visual novo fora do kit).

## Project Structure

### Documentation (this feature)

```text
specs/003-upload-dados-operacionais/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 — decisões e racional
├── data-model.md        # Phase 1 — entidades e campos
├── quickstart.md        # Phase 1 — guia de validação
├── contracts/
│   └── manual-upload-api.md  # Phase 1 — contrato dos endpoints
└── tasks.md             # Phase 2 (/speckit-tasks — não criado aqui)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── routes/resources/reports.js   # manualReportUploadSchema + POST /manual-upload +
│   │                                 # PUT /:id/manual-pdf (preservação) + PUT /:id/manual-data
│   └── lib/
│       ├── overtime.js               # calculateReportOvertime — REUSO, sem mudança
│       └── acompanhamento/
│           └── labor-cost.js         # getRdoDataByCollaborator — AJUSTE: incluir relatórios
│                                     # não-RDO com horas (jornada gravada OU derivada da união
│                                     # dos intervalos startTime/endTime dos serviços)
├── prisma/schema.prisma              # sem mudança
└── test/
    ├── manual-report-upload.test.js  # NOVO (ou extensão de teste existente do fluxo manual)
    └── acompanhamento-labor-cost.test.js  # estender: RDO manual entra no rateio

frontend/
└── src/
    ├── api/reports.ts                # ManualReportUploadPayload + novo updateManualReportData
    ├── pages/gestor/GestorPage.tsx   # modal de upload manual: campos operacionais por arquivo
    ├── pages/ReportDetailPage.tsx    # modo de edição manual inline (sem observação/fotos/adicionar serviço)
    └── store/rdoStore.ts             # referência do shape noturno — REUSO de convenções, sem mudança
```

**Structure Decision**: Web application existente (Option 2 do template). Toda a mudança é encaixada nos arquivos do fluxo de relatórios já existentes; nenhum módulo novo é criado.

## Design Decisions (resumo)

1. **Mesmas estruturas de dados do fluxo normal** — o upload manual (qualquer tipo de relatório) grava `arrivalTime`, `departureTime`, `lunchBreak`, `daytimeCount`, os minutos calculados por `calculateReportOvertime`, os vínculos `ReportCollaborator` e `specialConditions.noturnoDetails` (com `enrichNightCollaboratorsInSpecialConditions` para snapshot de nome/cargo). Para RDOs manuais, também grava `specialConditions.standby` e `specialConditions.standbyDetails.total/motivo` quando o gestor informar stand-by. `getRdoDataByCollaborator` (labor-cost.js:117) passa a enxergar RDOs manuais sem qualquer mudança — FR-005 e SC-005 satisfeitos por construção.
2. **Ajuste no labor-cost para relatórios somente serviço (FR-005a–d)** — a consulta de `getRdoDataByCollaborator` deixa de filtrar só `reportType: 'RDO'` e passa a incluir relatórios de qualquer tipo com horas: `OR: [{ reportType: 'RDO' }, { daytimeWorkedMinutes: { gt: 0 } }, { nighttimeWorkedMinutes: { gt: 0 } }, { services: { some: { startTime: { not: null }, endTime: { not: null } } } }]`, selecionando também `services: { select: { startTime, endTime } }`. As horas efetivas por relatório: `daytimeWorkedMinutes + nighttimeWorkedMinutes` quando > 0; senão, **união dos intervalos** início→término dos serviços (merge de sobreposições — somar dobraria serviços em paralelo; término < início soma 24h, reutilizando a lógica de `parseHm` de `overtime.js` ou helper equivalente). Horas derivadas são tratadas como diurnas. RDOs continuam entrando incondicionalmente (preserva a classificação de dias atual); a deduplicação por dia existente (`dayProject`, prevalece o de mais horas) evita dupla contagem entre RDO e relatório de serviço do mesmo dia — inclusive serviços derivados/vinculados a um RDO. Derivação em tempo de leitura → histórico coberto sem backfill (Princípio IV nem é acionado). Extrair a derivação para função pura exportada (testável em `acompanhamento-labor-cost.test.js`).
3. **Campos opcionais com validação condicional** — o schema Zod aceita ausência total (comportamento atual: `00:00`, zero colaboradores). Se qualquer dado operacional vier, exige o conjunto mínimo consistente (entrada + saída juntos; noturno habilitado exige início + término; stand-by em RDO exige tempo total + motivo), espelhando o fluxo normal. Jornada/noturno/colaboradores valem para todos os tipos de relatório do upload; stand-by vale apenas para `reportType: 'RDO'` e deve ser rejeitado se enviado para relatório somente serviço. Nos tipos somente serviço, `serviceOnly: true` e `serviceData` continuam gravados como hoje.
4. **Dados por arquivo no lote** — o modal do GestorPage já mantém `files[]` com campos por arquivo (`sequenceNumber`, `reportDate`, ...); os dados operacionais entram nesse mesmo array, com um bloco recolhível por arquivo para não poluir o lote.
5. **Endpoint dedicado `PUT /reports/:id/manual-data`** para US4 (editar dados manuais sem reenviar PDF), restrito a `requireRdoManager` + relatórios com `__manualUpload`, qualquer tipo de relatório. Não reutiliza o `PUT /:id` genérico porque este exige payload completo do fluxo normal e mexe em status/edição versionada; nem o `PUT /:id/manual-pdf`, que exige `pdfDataUrl`. A UI consome esse endpoint pela própria página de edição manual, não por um botão/modal separado "Completar dados".
6. **`daytimeCount` = quantidade de colaboradores diurnos selecionados** (paridade com o fluxo normal, que envia a contagem junto).
7. **Hora extra calculada mas sem fluxo de aprovação** — o relatório manual já nasce `APPROVED`/`SIGNED`; os minutos de HE são gravados como o motor calcular (necessários ao labor-cost, que faz o split 70/100 a partir do ponto, não do RDO), sem disparar aceite de HE.
8. **Modo de edição manual inline** — `ReportDetailPage.tsx` deve distinguir relatórios com `specialConditions.__manualUpload` e renderizar uma superfície de edição na mesma organização visual do RDO comum quando fizer sentido: data/horários/turno/noturno/stand-by quando RDO/colaboradores, sem `dailyDescription`, sem `specialConditions.generalUploads`, sem uploads/observações de serviço e sem ação de adicionar serviço. Colaboradores seguem editáveis porque impactam Acompanhamento; observações e fotos ficam fora porque o PDF histórico é a evidência principal.

Detalhes e alternativas rejeitadas em [research.md](./research.md).

## Complexity Tracking

Sem violações — tabela não aplicável.
