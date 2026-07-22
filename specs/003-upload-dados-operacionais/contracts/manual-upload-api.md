# API Contract: Upload Manual com Dados Operacionais

**Feature**: 003-upload-dados-operacionais | **Date**: 2026-07-13

Base: rotas de relatórios (`backend/src/routes/resources/reports.js`), autenticação
`requireAuth + requireRdoManager` em todas as operações abaixo.

## 1. `POST /reports/manual-upload` (estendido)

Payload atual + bloco opcional `operationalData`:

```jsonc
{
  "projectId": "ckx...",
  "reportType": "RDO",
  "sequenceNumber": 12,              // opcional
  "reportDate": "2024-03-15",
  "fileName": "RDO-12.pdf",
  "pdfDataUrl": "data:application/pdf;base64,...",
  "signatureMode": "APPROVED",       // APPROVED | SIGNED | REQUIRES_SIGNATURE

  "operationalData": {               // NOVO — opcional; aceito para qualquer reportType do upload
    "arrivalTime": "07:00",
    "departureTime": "17:00",
    "lunchBreak": "01:00:00",
    "collaboratorIds": ["ckxA", "ckxB"],
    "noturno": {
      "enabled": true,
      "inicio": "22:00",
      "termino": "05:00",
      "intervalo": "01:00:00",
      "collaboratorIds": ["ckxC"]
    },
    "standby": {                       // apenas quando reportType = RDO
      "enabled": true,
      "total": "02:00:00",
      "motivo": "Aguardando liberação da área"
    }
  }
}
```

Comportamento:

- Sem `operationalData` (ou bloco vazio): idêntico a hoje (horários `00:00`, sem vínculos).
- Com `operationalData`: minutos calculados por `calculateReportOvertime(project, payload)`;
  `daytimeCount = collaboratorIds.length`; vínculos `ReportCollaborator` criados na mesma
  transação; `specialConditions.noturno`/`noturnoDetails` gravados com snapshot de colaboradores
  (`enrichNightCollaboratorsInSpecialConditions`); para RDO manual, `standby`/`standbyDetails`
  gravados no mesmo shape do fluxo normal.
- Tipos somente serviço (RTP, RLQ etc.): `operationalData` é aceito da mesma forma;
  `serviceOnly: true` e `serviceData` continuam gravados como hoje. `standby.enabled = true`
  não é aceito para esses tipos.

Respostas:

| Código | Caso |
|--------|------|
| 201 | Criado (payload de `ReportSummary`, como hoje — agora incluindo colaboradores/horas) |
| 400 | Validação Zod: horários mal formatados, noturno habilitado sem início/término, stand-by sem tempo/motivo, stand-by em tipo não-RDO, colaborador inexistente |
| 409 | Conflitos existentes (número de sequência, assinante ausente) — inalterados |

## 2. `PUT /reports/:id/manual-data` (NOVO)

Edita apenas os dados operacionais de um relatório de upload manual, sem tocar no PDF.

```jsonc
// Request body = o mesmo shape de "operationalData" acima (nível raiz):
{
  "reportDate": "2024-03-15",
  "arrivalTime": "07:00",
  "departureTime": "17:00",
  "lunchBreak": "01:00:00",
  "collaboratorIds": ["ckxA", "ckxB"],
  "noturno": { "enabled": false },
  "standby": {
    "enabled": true,
    "total": "02:00:00",
    "motivo": "Aguardando liberação da área"
  }
}
```

Comportamento:

- Guarda: 404 se relatório inexistente/indisponível; 400 se não for de upload manual
  (`specialConditions.__manualUpload.uploadedAt` ausente). Vale para qualquer tipo de relatório
  do upload manual (RDO e somente serviço).
- Atualiza `reportDate` quando informado, recalcula minutos, substitui vínculos (delete + create), faz merge de
  `noturno`/`noturnoDetails` e `standby`/`standbyDetails` em `specialConditions` e carimba
  `__manualUpload.operationalDataUpdatedAt/UpdatedByUserId`. `standby` só é aceito para RDO
  manual.
- Não altera: status, PDF, versões, assinaturas, `sequenceNumber`,
  `dailyDescription` nem `specialConditions.generalUploads`.
- Enviar campos vazios/null permite **limpar** dados informados anteriormente (volta ao
  comportamento zerado), incluindo limpar stand-by de RDO manual quando `standby.enabled = false`.

Respostas: 200 com `ReportSummary` atualizado; 400/404 conforme acima.

## 3. `PUT /reports/:id/manual-pdf` (comportamento garantido)

Sem mudança de payload. Garantia nova (testada): a substituição do PDF **preserva**
`noturno`, `noturnoDetails`, vínculos de colaboradores, horários e carimbos de dados
operacionais já gravados (FR-009).

## Frontend (`frontend/src/api/reports.ts`)

- `ManualReportUploadPayload` ganha `operationalData?: ManualReportOperationalData`.
- Nova função `updateManualReportData(reportId, payload)` → `PUT /reports/:id/manual-data`.
- A tela de relatório manual usa `updateManualReportData` inline na página de edição/detalhe; não
  deve existir botão separado "Completar dados".
- A UI mostra stand-by apenas para `reportType = RDO` e oculta observações, anexos de fotos e a
  ação de adicionar serviço para relatórios manuais.
- Invalidação react-query: mesmas chaves usadas pelo upload manual hoje (listagens de relatórios,
  contagens) + detalhe do relatório; telas do Acompanhamento já refazem fetch por conta própria.
