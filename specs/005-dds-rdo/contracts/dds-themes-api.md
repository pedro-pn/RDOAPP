# Contrato: API de Temas de DDS

Base: `/rdo/dds-themes` (montada em `mountRdoRoutes`, ao lado de `/job-roles`). Clone comportamental de `job-roles.js`, com escrita liberada também para coordenador.

## GET /rdo/dds-themes

- **Auth**: `requireAuth, requireRdoInternal` (qualquer papel interno do RDO).
- **Query**: `all=true` inclui inativos (uso das telas de gestão); sem `all`, retorna só `isActive: true`.
- **200**: `[{ "id": string, "name": string, "order": number, "isActive": boolean }]`, ordenado por nome (pt-BR, igual job-roles).

## POST /rdo/dds-themes

- **Auth**: `requireAuth, requireModuleRole('rdo:manager', 'rdo:coordinator')`.
- **Body (Zod)**: `{ name: string (min 1), order?: int, isActive?: boolean }`.
- **201**: tema criado. Nome duplicado → erro padrão Prisma P2002 tratado como no clone (400/409 conforme handler global).
- Colaborador/cliente → **403**.

## PATCH /rdo/dds-themes/:id

- **Auth**: idem POST.
- **Body (Zod)**: campos parciais `{ name?, order?, isActive? }`.
- **200**: tema atualizado. Inexistente → 404.

## DELETE /rdo/dds-themes/:id

- **Auth**: idem POST.
- **Efeito**: soft delete — `isActive: false` (nunca remove a linha; RDOs guardam snapshot, mas a lista preserva histórico e permite reativação).
- **200/204** conforme padrão do clone.

## Bloco `dds` no payload de reports

`POST /rdo/reports` e `PUT /rdo/reports/:id` — sem mudança de contrato: `specialConditions` continua `z.any()` e passa a carregar o bloco `dds` descrito em [data-model.md](../data-model.md). Nenhuma validação backend adicional nesta feature (padrão da casa para `specialConditions`).
