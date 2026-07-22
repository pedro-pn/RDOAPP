# API Contracts — Checklist de Equipamentos no Romaneio

**Feature**: 002-checklist-romaneio | **Date**: 2026-07-09 | **Updated**: 2026-07-10

Convenções: mesmas dos módulos atuais — sessão autenticada (`requireAuth`), erros `{ error: string }`, validação Zod no backend.

## Módulo Equipamentos (`/api/equipamentos`)

### `POST /categories` e `PUT /categories/:id` (alterados)

Auth: `requireEquipamentosManager`.

Body ganha:

```jsonc
{
  "checklistEnabled": true,            // opcional, boolean
  "checklistDisplayMode": "AUTO",      // opcional: AUTO | TAG | NAME
  "checklistItems": [                  // opcional, array de strings (ordem = ordem de exibição)
    "Drenagem e limpeza das carcaças dos filtros",
    "Limpeza da válvula de retenção"
  ]
}
```

Respostas passam a incluir `checklistEnabled`, `checklistDisplayMode` e `checklistItems` (o `GET /categories` já devolve o registro inteiro).

### `POST /` e `PUT /:id` (equipamento — alterados)

Auth: `requireEquipamentosManager`.

Body ganha:

```jsonc
{
  "checklistItems": ["...", "..."]   // opcional; array = define override; null = restaurar padrão da categoria; ausente = não mexe
}
```

Resposta do equipamento inclui `checklistItems` (null quando herda).

## Módulo Romaneio (`/api/romaneios`)

### `GET /checklist-map` (novo)

Auth: `requireRomaneioAccess`. Uso: `NewRomaneioPage` (criação e edição).

```jsonc
// 200
{
  "hasSavedSignature": true,          // colaborador vinculado ao usuário logado tem signatureImage
  "map": {
    "<catalogItemId>": {
      "equipmentId": "ckq...",
      "equipmentCode": "UFP 001",
      "equipmentName": "Unidade de Filtragem Portátil",
      "categoryName": "UFP",
      "displayNameOrTag": "UFP 001",
      "displayMode": "AUTO",
      "items": ["Drenagem e limpeza...", "Limpeza da válvula..."]
    }
  }
}
```

Só entram itens ativos do catálogo com checklist efetivo não-vazio. Para equipamentos, a lista vem da categoria/override do módulo Equipamentos. Para consumíveis/produtos com checklist, `displayNameOrTag` usa o nome do item/produto, salvo se a categoria forçar outro modo.

### `POST /` (alterado)

Body ganha (opcional, considerado apenas quando `type='OUTBOUND'`):

```jsonc
{
  "checklists": [
    {
      "catalogItemId": "ckq...",
      "statuses": [
        { "text": "Drenagem e limpeza...", "status": "CONFORME" },
        { "text": "Teste", "status": "NAO_CONFORME" },
        { "text": "Item não instalado nesta configuração", "status": "NAO_APLICAVEL" }
      ]
    }
  ],
  "checklistSignatureImage": "data:image/png;base64,..."   // opcional; ausente → usa assinatura cadastrada do colaborador vinculado
}
```

Comportamento:
- Para cada item do romaneio com checklist efetivo (via `checklist-map` do servidor), o servidor monta o snapshot `[{ text, status, checked }]`, aceitando `status = CONFORME | NAO_CONFORME | NAO_APLICAVEL`; entrada `checklists` sem catalogItem correspondente no romaneio é ignorada; item com checklist sem entrada em `checklists` → todos os pontos ficam `CONFORME`. `checkedTexts` permanece aceito apenas como compatibilidade legada.
- Gera 1 PDF consolidado por romaneio a partir de `Modelos/definitivos/Checklist.docx`; nome `Checklist - Missão <código projeto> - <dd-mm-yyyy>.pdf`; salvo junto aos arquivos do romaneio. Placeholder `<<projeto>>` = `<código> - <nome>` (só o código quando a missão ainda não tem nome); o rótulo estampado fica gravado em `Romaneio.checklistProjectLabel`.
- Dentro do documento, a tabela que contém `<<categoria>>`, `<<nomeoutag>>`, `<<item>>` e `<<status>>` é duplicada para cada snapshot, respeitando a ordem do romaneio. `<<categoria>>` usa `categoryName`; `<<nomeoutag>>` usa `displayNameOrTag`; `<<status>>` imprime `CONFORME`, `NÃO CONFORME` ou `NÃO APLICÁVEL`.
- `checklistResponsibleName` = nome do usuário autenticado; assinatura = payload ?? assinatura existente do romaneio em edição ?? `Collaborator.signatureImage`. Se houver checklist e nenhuma assinatura puder ser resolvida, a API retorna `400` e não salva o romaneio.
- Falha na geração do PDF consolidado → envio falha por inteiro (mesma semântica de limpeza atual).
- E-mail de notificação existente anexa também o PDF consolidado de checklist.

Resposta (201) — romaneio agora inclui:

```jsonc
{
  "checklistResponsibleName": "Fulano da Silva",
  "checklistPdfUrl": "/relatorios/Miss%C3%A3o%20123.../ROMANEIO/Checklist%20-%20...pdf",
  "checklists": [
    {
      "id": "ckr...",
      "equipmentCode": "UFP 001",
      "equipmentName": "Unidade de Filtragem Portátil",
      "categoryName": "UFP",
      "displayNameOrTag": "UFP 001",
      "items": [{ "text": "Drenagem e limpeza...", "status": "CONFORME", "checked": true }],
      "sortOrder": 0
    }
  ]
}
```

(`GET /` e `GET /:id` passam a incluir `checklists` no `include`; `checklistSignatureImage` NÃO é retornado nas listagens para não inflar payload.)

### `PUT /:id` (alterado)

Mesmo bloco `checklists` do POST. Diferenças:
- Base do snapshot = `RomaneioChecklist` existente do mesmo `catalogItemId` (textos preservados); item novo na edição usa a lista efetiva atual; item removido → snapshot removido e PDF consolidado regenerado.
- PDF consolidado regenerado; arquivo antigo removido (padrão atual do docx/pdf do romaneio).
- Assinatura: mantém a existente se nenhum `checklistSignatureImage` for enviado.

### `GET /:id/checklist/pdf` (novo)

Auth: `requireRomaneioAccess` + visibilidade do romaneio (`visibleRomaneioWhere`). Retorna o PDF consolidado (`Content-Disposition: attachment`), 404 se o romaneio não possuir checklist ou arquivo gerável. Mesmo padrão de `GET /:id/pdf`, com um passo extra (FR-019):

- Antes de servir, recalcula o rótulo do projeto (`<código> - <nome>` ou só código se sem nome); se divergir do `checklistProjectLabel` gravado (missão pendente ganhou nome), regenera o PDF consolidado a partir dos snapshots (itens + categoria + `nomeoutag` + assinatura + responsável persistidos), sobrescreve o arquivo, atualiza `checklistProjectLabel` e serve o documento atualizado. Sem reenvio de e-mail. Se a regeneração falhar, serve o arquivo existente (best-effort, com log).

### `GET /:id/checklists/:checklistId/pdf` (legado temporário)

Durante a migração do frontend, pode permanecer como compatibilidade. Deve servir/redirecionar para o PDF consolidado do romaneio ou retornar 410 depois que não houver cliente usando a rota. Não deve gerar PDFs individuais novos.

## Frontend (contratos de UI)

- `NewRomaneioPage`: ao adicionar item presente no `checklist-map` (romaneio OUTBOUND), abre `RomaneioChecklistModal` com controles "Conforme", "Não conforme" e "Não aplicável", iniciando em "Conforme"; item selecionado exibe indicador/botão para reabrir e editar status; status persistem no rascunho (payload do draft) e são restaurados.
- Resumo de envio: se houver checklist e `hasSavedSignature=false`, seção de assinatura (desenho/upload — padrão `SignatureDialog`) aparece dentro do modal de revisão; a confirmação fica bloqueada até haver assinatura. Se `hasSavedSignature=true`, a seção é omitida e a assinatura cadastrada é usada automaticamente.
- `RomaneioPage` (card): um botão de download do checklist consolidado (`Checklist` ou `Checklist do romaneio`), junto a PDF/DOCX.
- Edição: status carregados de `romaneio.checklists` (snapshot), não do `checklist-map`.

## Script de backfill (contrato de execução)

```bash
# dry-run (default): mostra o que seria feito, não grava nada
node scripts/backfill-checklist-items.js

# aplica
node scripts/backfill-checklist-items.js --apply
```

- Categorias-alvo: UFI, UTH, UTO, UBP, ULQ, UFP, TRO (resolução por prefixo de código dos equipamentos, fallback nome/systemKey).
- UTH: categoria SEM "Verificação da correia (apenas UTH 008)" / "Verificação das polias (apenas UTH 008)"; equipamento `UTH 008` recebe override = itens da categoria + os dois (sem o sufixo "(apenas UTH 008)").
- Idempotente: não sobrescreve `checklistItems` não-vazios nem override existente; reporta categorias/equipamentos não encontrados e segue.
