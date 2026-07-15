# Data Model: DDS no RDO

## Entidade nova: `DdsTheme`

Clone estrutural de `JobRole` (`backend/prisma/schema.prisma:359-371`):

```prisma
model DdsTheme {
  id        String   @id @default(cuid())
  name      String   @unique
  order     Int      @default(0)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([isActive, order])
}
```

Regras:

- `name` único (case-sensitive, igual JobRole); criação com nome duplicado → 409/400 conforme padrão da rota clonada.
- Exclusão é soft delete (`isActive: false`); reativação permitida.
- `order` reservado para ordenação manual futura; listagem padrão ordena por nome.

## Bloco `dds` em `Report.specialConditions` (Json — sem migração)

```json
"dds": {
  "diurno": {
    "enabled": true,
    "inicio": "07:00",
    "termino": "07:15",
    "temas": [
      { "id": "cln0abc...", "name": "Uso correto de EPI" },
      { "id": "custom-...", "name": "Risco específico da atividade", "custom": true }
    ]
  },
  "noturno": {
    "enabled": false,
    "inicio": "",
    "termino": "",
    "temas": []
  }
}
```

Regras:

- `temas[]` é **snapshot** `{id, name, custom?}` do momento do preenchimento — renomear/desativar o tema não altera relatórios salvos nem a regeração do DOCX.
- Temas digitados fora da lista oficial são gravados com `custom: true`; na revisão, gestor/coordenador pode cadastrá-los em `DdsTheme` e revincular o snapshot antes de salvar.
- `dds` ausente (relatórios pré-feature) ⇒ tratar como `enabled: false` nos dois turnos, em todo consumidor (`|| {}` defensivo).
- `dds.noturno.enabled` DEVE ser gravado como `false` quando `specialConditions.noturno !== true` (turno noturno desligado), mesmo que o usuário tenha preenchido antes de desligar.
- Horários são strings `"HH:MM"` (idioma de `arrivalTime`/`noturnoDetails.inicio`).
- Na edição pelo gestor, o `buildPayload` faz spread de `report.specialConditions` — o bloco `dds` DEVE ser sempre sobrescrito explicitamente (inclusive com `enabled: false`) para não ressuscitar valor antigo.

## Estado no frontend

`rdoStore` (criação) e `RdoFormState`/`ManualReportOperationalFieldsValue` (edição) usam campos planos:

```ts
ddsDay: boolean; ddsDayStart: string; ddsDayEnd: string; ddsDayThemes: { id: string; name: string; custom?: boolean }[];
ddsNight: boolean; ddsNightStart: string; ddsNightEnd: string; ddsNightThemes: { id: string; name: string; custom?: boolean }[];
```

Mapeamento payload: `ddsDay* → dds.diurno`, `ddsNight* → dds.noturno` (com `enabled: noturno && ddsNight`).

## Campos do DOCX (`buildDocxData`)

| Placeholder | Fonte | Regra |
|---|---|---|
| `{{ddsdaystart}}` | `dds.diurno.inicio` | vazio se `!enabled` |
| `{{ddsdayend}}` | `dds.diurno.termino` | vazio se `!enabled` |
| `{{ddsdaythemes}}` | `dds.diurno.temas[].name` join `", "` | vazio se `!enabled` |
| `{{ddsnightstart}}` | `dds.noturno.inicio` | vazio se `!enabled` ou `!hasNight` |
| `{{ddsnightend}}` | `dds.noturno.termino` | vazio se `!enabled` ou `!hasNight` |
| `{{ddsnightthemes}}` | `dds.noturno.temas[].name` join `", "` | vazio se `!enabled` ou `!hasNight` |
