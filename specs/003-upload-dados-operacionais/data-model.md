# Data Model: Dados Operacionais no Upload Manual de Relatórios

**Feature**: 003-upload-dados-operacionais | **Date**: 2026-07-13

**Sem migration Prisma** — todos os campos e relações já existem; a feature passa a preenchê-los
pelo fluxo de upload manual.

## Entidades e campos envolvidos

### Report (existente — passa a ser preenchido pelo upload manual)

| Campo | Tipo | Preenchimento no upload manual |
|-------|------|-------------------------------|
| `reportDate` | Date | Informado no upload; editável pela página de relatório manual |
| `arrivalTime` | String `HH:MM` | Informado pelo gestor; default atual `'00:00'` quando ausente |
| `departureTime` | String `HH:MM` | Informado pelo gestor; default atual `'00:00'` quando ausente |
| `lunchBreak` | String | Informado (`HH:MM:SS`, "sem intervalo", etc.); default atual `'00:00:00'` |
| `daytimeCount` | Int | = quantidade de `collaboratorIds` diurnos; default atual `0` |
| `daytimeWorkedMinutes` | Int | Calculado por `calculateReportOvertime` |
| `nighttimeWorkedMinutes` | Int | Calculado (0 se noturno desabilitado) |
| `daytimeOvertimeMinutes` | Int | Calculado |
| `nighttimeOvertimeMinutes` | Int | Calculado |
| `totalOvertimeMinutes` | Int | Calculado |
| `specialConditions` | Json | Ver blocos abaixo |
| `dailyDescription` | String? | Não editável pela página de relatório manual |

Invariante: upload sem dados operacionais grava exatamente os valores atuais (zerados) — nenhum
consumidor muda de comportamento.

### ReportCollaborator (existente — passa a ser criado pelo upload manual)

| Campo | Tipo | Regra |
|-------|------|-------|
| `reportId` | String | Relatório manual criado/editado |
| `collaboratorId` | String | Deve existir em `Collaborator`; conjunto = colaboradores diurnos selecionados |

Na edição (`manual-data`), os vínculos são substituídos (delete + create) dentro da transação.

### ReportService (existente — passa a ser fonte de horas no cálculo de custo)

| Campo | Tipo | Papel nesta feature |
|-------|------|---------------------|
| `startTime` | String? `HH:MM` | Início do serviço — obrigatório no formulário do app |
| `endTime` | String? `HH:MM` | Término/pausa do serviço |

Para relatórios **sem** minutos gravados (fluxo normal somente serviço), o labor-cost deriva as
horas trabalhadas como a **união dos intervalos** `startTime→endTime` dos serviços do relatório
(sobreposições contam uma vez; término < início soma 24h), tratadas como horas diurnas. Minutos
gravados (> 0) sempre prevalecem sobre a derivação. Derivação em tempo de leitura — nenhuma
escrita em `ReportService`, nenhum backfill.

### Report.specialConditions (Json — blocos relevantes)

```jsonc
{
  "source": "MANUAL_UPLOAD",            // existente, inalterado
  "noturno": true,                       // NOVO no fluxo manual (mesmo shape do fluxo normal)
  "noturnoDetails": {                    // NOVO no fluxo manual (mesmo shape do fluxo normal)
    "enabled": true,
    "inicio": "22:00",
    "termino": "05:00",
    "intervalo": "01:00:00",
    "collaboratorIds": ["ckx..."],
    "colaboradores": [                   // snapshot via enrichNightCollaboratorsInSpecialConditions
      { "id": "ckx...", "name": "Fulano", "role": "Operador" }
    ]
  },
  "standby": true,                       // NOVO no RDO manual (mesmo shape do fluxo normal)
  "standbyDetails": {
    "total": "02:00:00",
    "motivo": "Aguardando liberação da área"
  },
  "generalUploads": [                    // existente em RDO do app; não editável no fluxo manual
    { "url": "...", "name": "foto.jpg" }
  ],
  "__manualUpload": {                    // existente; ganha carimbos de edição de dados
    "originalFileName": "RDO-12.pdf",
    "uploadedAt": "...",
    "uploadedByUserId": "...",
    "signatureMode": "APPROVED",
    "operationalDataUpdatedAt": "...",       // NOVO (só quando US4 editar dados)
    "operationalDataUpdatedByUserId": "..."  // NOVO
  }
}
```

## Validação (Zod — backend, espelhada no cliente)

Bloco opcional `operationalData` no payload de upload (e payload integral do endpoint de edição):

| Campo | Regra |
|-------|-------|
| `reportDate` | data ISO `YYYY-MM-DD`; opcional no upload operacional, editável no endpoint `manual-data` |
| `arrivalTime` | `HH:MM` (regex `^\d{1,2}:\d{2}$`); obrigatório se `departureTime` informado |
| `departureTime` | `HH:MM`; obrigatório se `arrivalTime` informado (par atômico) |
| `lunchBreak` | formato aceito por `parseBreak` (`HH:MM[:SS]`, "sem intervalo", `1h30`, `45 min`); default `'01:00:00'` quando o par de horários vier |
| `collaboratorIds` | `string[]` (ids existentes, deduplicados); pode vir vazio |
| `noturno.enabled` | boolean |
| `noturno.inicio` / `noturno.termino` | `HH:MM`; **obrigatórios quando `enabled = true`** |
| `noturno.intervalo` | mesmo formato de `lunchBreak`; default `'01:00:00'` |
| `noturno.collaboratorIds` | `string[]`; pode vir vazio |
| `standby.enabled` | boolean; aceito apenas quando `reportType = RDO` |
| `standby.total` | mesmo formato de intervalo (`HH:MM[:SS]`, `1h30`, etc.); obrigatório quando `standby.enabled = true` |
| `standby.motivo` | string não vazia; obrigatório quando `standby.enabled = true` |
| (bloco inteiro) | Jornada/noturno/colaboradores aceitos para qualquer tipo de relatório do upload manual (RDO e somente serviço); nos tipos somente serviço, `serviceOnly: true` e `serviceData` continuam gravados como hoje |

Regras cruzadas (superRefine):

- `noturno.enabled = true` sem `inicio`/`termino` → erro "Informe início e término do turno noturno."
- `standby.enabled = true` em RDO sem `total`/`motivo` → erro "Informe tempo total e motivo do stand-by."
- `standby.enabled = true` em relatório manual que não é RDO → erro "Stand-by está disponível apenas para RDO manual."
- Bloco presente mas totalmente vazio → tratado como ausente (comportamento atual).
- Virada de dia permitida em ambos os turnos (saída < entrada soma 24h — regra do motor).
- Edição manual não aceita mutação de `dailyDescription` nem de `specialConditions.generalUploads`;
  se esses campos existirem no relatório, permanecem preservados e fora da tela.

## Fluxo de estados

Nenhuma transição nova: o relatório manual continua nascendo `APPROVED` ou `SIGNED` conforme o
`signatureMode`; a edição de dados operacionais não altera status, versões nem assinatura. A
troca de dados operacionais acontece pela página de edição manual inline e usa o endpoint
`manual-data`; não existe transição intermediária "completar dados".

## Consumidores

- `getRdoDataByCollaborator` (labor-cost.js:117): **única mudança de leitura** — o `where` passa
  de `reportType: 'RDO'` para `OR: [{ reportType: 'RDO' }, { daytimeWorkedMinutes: { gt: 0 } },
  { nighttimeWorkedMinutes: { gt: 0 } }, { services: { some: { startTime: { not: null },
  endTime: { not: null } } } }]`, com `services` no select; horas efetivas = minutos gravados
  (> 0) ou união dos intervalos dos serviços (função pura nova, testável). Relatórios sem nenhuma
  fonte de horas continuam fora. Demais funções do labor-cost inalteradas.
- Regra de desempate dia com 2 relatórios (labor-cost.js:140, `dayProject` — prevalece o de mais
  horas): já cobre manual vs normal e RDO vs relatório de serviço (sem dupla contagem).
- Estatísticas (`statistics.js`) e detalhe do relatório: leem as mesmas colunas/blocos, sem
  mudança de código.
- Página de edição manual (`ReportDetailPage.tsx`): para relatórios com `__manualUpload`, renderiza
  data/horários/noturno/stand-by quando RDO/colaboradores; oculta observações (`dailyDescription`
  e observações de serviço), anexos gerais/serviço e a ação de adicionar serviço.
