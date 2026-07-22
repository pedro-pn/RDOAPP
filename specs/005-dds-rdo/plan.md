# Implementation Plan: DDS no RDO

**Branch**: `feat/005-dds-rdo` | **Date**: 2026-07-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-dds-rdo/spec.md`

## Summary

Registro do DDS (Diálogo Diário de Segurança) por turno no RDO. Três frentes: (1) **backend** — novo model `DdsTheme` (clone do padrão `JobRole`) com rota CRUD `/rdo/dds-themes` (leitura para papéis internos; escrita para `rdo:manager` e `rdo:coordinator`); o registro do DDS no relatório vai dentro de `Report.specialConditions.dds` (JSON, precedente `noturnoDetails` — **sem migração no Report**); (2) **frontend** — toggle "Houve DDS?" por turno no formulário de criação (`NewReportPage` + `rdoStore`, com draft) e na edição (`ManualReportOperationalFields` + `ReportDetailPage`), temas no padrão select + chips da adição de colaboradores; gerenciamento de temas via `DdsThemeManager` (clone do `JobRoleManager`) plugado no GestorPage (sub-aba de Equipe) e no CoordinatorPage (aba própria); (3) **documento** — seção dedicada "DDS — DIÁLOGO DIÁRIO DE SEGURANÇA" no template `Modelo definitivo.docx` com 6 placeholders escalares mapeados em `buildDocxData` (`report-docx.js`); PDF é conversão do DOCX, sem mudança.

## Technical Context

**Language/Version**: Node.js + Express 5 (backend, ESM `.js`), React + Vite + TypeScript (frontend)

**Primary Dependencies**: Prisma + PostgreSQL, Zod, @tanstack/react-query, Zustand (rdoStore), adm-zip + @xmldom/xmldom (geração DOCX)

**Storage**: 1 tabela nova `DdsTheme` (migração Prisma `add_dds_theme`); registro do DDS em `Report.specialConditions` (Json existente)

**Testing**: `backend/test/report-dds.test.js` novo, no molde de `report-collaborators.test.js` (funções puras, sem DB)

**Target Platform**: Web (mobile-first)

**Project Type**: Web application (backend + frontend + template DOCX)

**Constraints**: Snapshot `{id, name}` dos temas no relatório (regeração de DOCX após renomear/desativar tema); consumo defensivo do bloco `dds` (relatórios antigos); `dds.noturno.enabled` forçado a `false` quando turno noturno desligado; template binário exige validação visual antes do commit

**Scale/Scope**: 1 model + 1 rota backend; ~6 arquivos frontend tocados + 2 novos; 1 função do gerador DOCX; 1 template binário

## Constitution Check

| Princípio | Avaliação |
|-----------|-----------|
| I. Operação de servidor | ✅ Migração em produção será apresentada como bloco "rode no servidor"; nada executado direto |
| II. UI pt-BR e mobile-first | ✅ Textos pt-BR; blocos DDS usam collapse-sections e chips já responsivos do formulário; manager de temas segue JobRoleManager (já mobile) |
| III. Zod nas duas pontas | ✅ Rota dds-themes com Zod; `specialConditions` segue o contrato existente (`z.any()`, padrão da casa p/ esse campo); validação de DDS no formulário segue o padrão do NewReportPage |
| IV. Banco só via Prisma | ✅ `DdsTheme` via migração versionada; Report sem mudança de schema |
| V. Testes de lógica de negócio | ✅ `backend/test/report-dds.test.js` cobre a montagem dos campos DOCX (função pura) |
| VI. Consistência visual | ✅ Reuso literal: `.tog-row`/`.collapse-section` (toggles), `.colab-tag`/`.cadd` (chips/select), JobRoleManager (CRUD), tabs existentes das páginas |

**Resultado**: PASS — sem violações.

## Project Structure

### Documentation (this feature)

```text
specs/005-dds-rdo/
├── spec.md
├── plan.md              # Este arquivo
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── dds-themes-api.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (arquivos afetados)

```text
backend/
├── prisma/schema.prisma                          # + model DdsTheme
├── prisma/migrations/<ts>_add_dds_theme/         # nova migração
├── src/routes/resources/dds-themes.js            # NOVO (clone de job-roles.js)
├── src/routes/index.js                           # montar /dds-themes
├── src/lib/report-docx.js                        # buildDocxData: 6 campos dds*
└── test/report-dds.test.js                       # NOVO

frontend/src/
├── api/ddsThemes.ts                              # NOVO (clone de jobRoles.ts)
├── components/reports/DdsThemeManager.tsx        # NOVO (clone de JobRoleManager.tsx)
├── components/reports/ManualReportOperationalFields.tsx   # + campos/props DDS
├── components/reports/manualReportOperationalData.ts      # defaults + validação
├── store/rdoStore.ts                             # + 8 campos e actions DDS
├── pages/collaborator/NewReportPage.tsx          # UI + payload + draft
├── pages/collaborator/HomePage.tsx               # restore de draft
├── pages/gestor/GestorPage.tsx                   # sub-aba "Temas de DDS"
├── pages/coordinator/CoordinatorPage.tsx         # aba "Temas de DDS"
└── pages/ReportDetailPage.tsx                    # reportToForm/buildPayload/summary

Modelos/definitivos/
├── Modelo definitivo.docx                        # + seção DDS (binário, validação visual)
└── Mapa do modelo definitivo.txt                 # documentar tokens novos
```

## Decisões de design

1. **Persistência do DDS no Report**: bloco `dds` em `specialConditions` (shape em [data-model.md](./data-model.md)). Sem migração; mesmo idioma de `noturnoDetails`.
2. **Snapshot de temas**: o relatório grava `{id, name}`. O editor exibe chips pelo `name` do snapshot mesmo se o tema sumiu da lista ativa.
3. **Permissões de escrita de temas**: `requireModuleRole('rdo:manager', 'rdo:coordinator')` — diferente do `requireManager` de job-roles, porque coordenador também gerencia.
4. **DOCX**: seção própria (decisão do usuário) com placeholders escalares `{{ddsdaystart}}`, `{{ddsdayend}}`, `{{ddsdaythemes}}`, `{{ddsnightstart}}`, `{{ddsnightend}}`, `{{ddsnightthemes}}`; temas em string única (join `, `). `clearRemainingPlaceholders` já limpa quando não há DDS.
5. **Fluxo manual-data fica fora**: RDOs enviados por upload de PDF (feature 003) não têm DDS; os campos no componente compartilhado ficam atrás da prop `showDds`.
