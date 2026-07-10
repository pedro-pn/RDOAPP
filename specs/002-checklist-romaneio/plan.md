# Implementation Plan: Checklist de Equipamentos no Romaneio

**Branch**: `002-checklist-romaneio` | **Date**: 2026-07-09 | **Updated**: 2026-07-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-checklist-romaneio/spec.md`

## Summary

Categorias de equipamento ganham um toggle "Tem checklist" com lista ordenada de pontos de checagem; equipamentos podem ter lista própria (override) com botão de restaurar. No romaneio de saída, cada item com checklist efetivo não-vazio abre uma etapa de marcação; no resumo de envio aparece assinatura do responsável (omitida se o colaborador vinculado já tem assinatura cadastrada). No envio, é gerado 1 PDF consolidado por romaneio a partir de `Modelos/definitivos/Checklist.docx` (pipeline DOCX→PDF existente): a tabela de checklist é duplicada para cada item com checklist, preenchendo `<<categoria>>` e `<<nomeoutag>>` (tag/código para equipamentos por unidade; nome para consumíveis/produtos). O snapshot continua persistido por item do romaneio; o card e o e-mail usam um único arquivo de checklist. Script de backfill idempotente pré-cadastra os itens do `Mapa checklist.txt` (UTH 008 via override).

## Technical Context

**Language/Version**: Node.js (ES Modules) no backend; TypeScript + React 18 no frontend

**Primary Dependencies**: Express, Prisma + PostgreSQL, Zod, AdmZip + @xmldom/xmldom (manipulação DOCX), pipeline `convertDocxToPdf` (LibreOffice), nodemailer (`lib/mailer.js`), React + Vite, @tanstack/react-query, react-hook-form + Zod

**Storage**: PostgreSQL via Prisma (migration versionada); arquivos gerados em `env.uploadDir/Missão <code> - <name>/ROMANEIO/` (mesmo diretório dos PDFs de romaneio)

**Testing**: `backend/test/*.test.js` via `npm test` (node:test, padrão dos testes existentes)

**Target Platform**: Web (servidor Linux + navegador, mobile-first)

**Project Type**: Web application (backend + frontend)

**Performance Goals**: Envio de romaneio com até ~5 checklists (~10 itens cada) sem degradação perceptível além da conversão DOCX→PDF já existente (uma conversão extra por romaneio com checklist, não por checklist individual)

**Constraints**: Sem execução de comandos de servidor pelo agente (Princípio I); template `Checklist.docx` fornecido pelo usuário (pendência externa); e-mail único já existente recebe anexos adicionais

**Scale/Scope**: ~7 categorias com checklist inicialmente; romaneios com poucos itens com checklist por envio; 2 telas alteradas no módulo Equipamentos, fluxo do romaneio (criação/edição/lista) e 1 script de backfill

## Constitution Check

*GATE: aprovado antes da Phase 0; reavaliado após Phase 1 — sem violações.*

- **I. Operação de servidor**: nenhum comando de produção é executado pelo agente. Migration (`prisma migrate deploy`) e backfill (`node scripts/backfill-checklist-items.js`) serão documentados como blocos "rode no servidor" no quickstart. ✅
- **II. UI pt-BR e mobile-first**: etapa de checklist no romaneio usa `Modal` com corpo rolável e rodapé fixo; editor de itens nas telas de Equipamentos segue o padrão das telas existentes; sem scroll horizontal. ✅
- **III. Zod nas duas pontas**: novos campos em `categorySchema`/`equipmentSchema` e novo bloco `checklists` + assinatura em `createRomaneioSchema` (backend); formulários do front validados como os atuais. ✅
- **IV. Banco só via Prisma**: novos campos e tabela `RomaneioChecklist` via migration Prisma; backfill idempotente com dry-run (Princípio IV). ✅
- **V. Testes de negócio no backend**: novos testes em `backend/test/romaneio-checklist.test.js` (resolução de lista efetiva, snapshot, documento consolidado, regra tag/nome, nome de arquivo, idempotência do backfill, permissões). ✅
- **VI. Consistência visual**: componentes de `frontend/src/components/ui/` (Modal, Button, ConfirmDialog, Toast), tokens de `variables.css`, reuso do padrão de captura de assinatura existente (`SignatureDialog`). ✅

## Project Structure

### Documentation (this feature)

```text
specs/002-checklist-romaneio/
├── spec.md
├── plan.md              # este arquivo
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── api.md           # Phase 1
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── prisma/
│   ├── schema.prisma                       # EquipmentCategory/CompanyEquipment + model RomaneioChecklist + campos de checklist consolidado no Romaneio
│   └── migrations/<ts>_romaneio_checklist/ # migration Prisma
├── src/
│   ├── lib/
│   │   ├── equipamentos/
│   │   │   └── equipment-checklist.js      # NOVO: normalização + resolução da lista efetiva (categoria vs override)
│   │   ├── romaneio/
│   │   │   └── romaneio-checklist-docx.js  # NOVO: geração DOCX→PDF consolidado do checklist (modelo + mapa)
│   │   ├── romaneio-docx.js                # referência de padrão (inalterado)
│   │   └── mailer.js / email-templates.js  # anexos extras no e-mail existente
│   └── routes/resources/
│       ├── equipamentos.js                 # toggle/itens na categoria, override no equipamento
│       └── romaneios.js                    # checklist-map, payload checklists+assinatura, geração, download, edição
├── scripts/
│   └── backfill-checklist-items.js         # NOVO: pré-cadastro (dry-run + --apply)
└── test/
    └── romaneio-checklist.test.js          # NOVO

frontend/
└── src/
    ├── api/
    │   ├── equipamentos.ts                 # tipos/campos novos
    │   └── romaneio.ts                     # checklist-map, payload, tipos
    └── pages/
        ├── equipamentos/
        │   ├── CategoryFormModal.tsx       # toggle + editor de pontos
        │   └── EquipmentFormModal.tsx      # override + "Restaurar padrão da categoria"
        └── romaneio/
            ├── NewRomaneioPage.tsx         # etapa de checklist + assinatura no resumo + rascunho + edição
            ├── RomaneioChecklistModal.tsx  # NOVO: modal de marcação de pontos
            └── RomaneioPage.tsx            # download do PDF consolidado de checklist no card
```

**Structure Decision**: Web application existente (backend Express + frontend React). A feature altera módulos existentes (Equipamentos, Romaneio) sem criar módulo novo; um novo lib de geração DOCX segue o padrão de `romaneio-docx.js`/`epi-docx.js`.

## Atualização de Escopo — 2026-07-10

O desenho original de "1 PDF por equipamento" fica substituído por "1 PDF consolidado por romaneio".

- O documento consolidado é salvo no nível do `Romaneio` (`checklistPdfUrl` + `checklistProjectLabel`), enquanto `RomaneioChecklist` permanece como snapshot por item para edição, auditoria e regeneração.
- A tabela do checklist no DOCX é o bloco repetível: localizar a tabela que contém `<<categoria>>`, `<<nomeoutag>>`, `<<item>>` e `<<status>>`; clonar a tabela inteira para cada snapshot, logo abaixo da anterior; dentro de cada tabela, clonar apenas a linha-template dos pontos.
- `<<categoria>>` recebe o nome da categoria usada no snapshot. `<<nomeoutag>>` usa tag/código para equipamentos e itens adicionados por unidade; usa nome do produto para consumíveis. Para reduzir erro operacional, o cadastro de categoria pode expor um modo "Identificação no checklist": Automático, Tag/Código ou Nome.
- O card do romaneio, o download e o e-mail passam a trabalhar com um único anexo de checklist. Rotas antigas por checklist individual podem ser mantidas temporariamente apenas como compatibilidade, servindo o consolidado ou redirecionando para a nova rota singular.

## Complexity Tracking

Sem violações da constitution — tabela não aplicável.
