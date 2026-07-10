# Research — Checklist de Equipamentos no Romaneio

**Feature**: 002-checklist-romaneio | **Date**: 2026-07-09 | **Updated**: 2026-07-10

Nenhum NEEDS CLARIFICATION restou na spec (decisões de escopo foram tomadas com o usuário antes da especificação). Abaixo, as decisões técnicas investigadas no código existente.

## D1. Onde guardar os pontos de checagem (categoria e override)

- **Decision**: `EquipmentCategory.checklistEnabled Boolean @default(false)` + `EquipmentCategory.checklistItems Json @default("[]")` (array de strings ordenado). Override por equipamento em `CompanyEquipment.checklistItems Json?` — `null` = herda da categoria; array = lista própria que substitui integralmente. "Restaurar padrão" grava `null`.
- **Rationale**: segue exatamente o padrão já usado por `fieldSchema`/`technicalSchema` (Json na categoria) e `technicalFieldOverrides` (Json no equipamento). Itens são texto puro ordenado — não justifica tabela relacional. `null` vs `[]` distingue "herda" de "override vazio (sem checklist para este equipamento)".
- **Alternatives considered**: tabela `ChecklistItem` relacional (rejeitada: sem consultas relacionais necessárias; snapshot no romaneio já protege histórico); guardar override como diff da categoria (rejeitada: complexidade sem ganho — o usuário pediu "fica valendo o do equipamento").

## D2. Snapshot do checklist no romaneio

- **Decision**: novo model `RomaneioChecklist` (romaneioId FK cascade, catalogItemId, equipmentId, equipmentCode, equipmentName, `categoryName`, `displayNameOrTag`, `displayMode`, `items Json` = `[{ text, status, checked }]`, sortOrder). Assinatura, responsável e o arquivo consolidado ficam no `Romaneio` (`checklistSignatureImage String?`, `checklistResponsibleName String?`, `checklistPdfUrl String?`, `checklistProjectLabel String?`) — uma assinatura e um PDF por romaneio.
- **Rationale**: `RomaneioItem` guarda snapshot dos itens do romaneio pelo mesmo motivo (histórico imutável); listas de categoria/equipamento mudam sem afetar romaneios enviados (FR-014). O snapshot por item continua necessário para editar/regerar cada tabela, mas o arquivo no nível do romaneio evita duplicidade de PDFs e atende ao modelo atualizado.
- **Alternatives considered**: campo Json no `Romaneio` com todos os checklists (rejeitada: dificulta edição incremental e ordenação por item); manter `pdfUrl` por checklist individual (rejeitada após atualização de 2026-07-10: gera múltiplos arquivos para o mesmo romaneio); referenciar a lista viva da categoria (rejeitada: viola FR-014).

## D3. Como o cliente informa as marcações (create/update)

- **Decision**: payload `checklists: [{ catalogItemId, statuses: [{ text, status }] }]`, com `status = CONFORME | NAO_CONFORME | NAO_APLICAVEL`; `checkedTexts` segue aceito só para compatibilidade. No CREATE o servidor resolve a lista efetiva do item do catálogo: equipamentos usam override do equipamento ou lista da categoria; consumíveis/produtos com checklist usam a lista configurada para sua categoria/fonte quando existir. O servidor monta o snapshot persistindo `status`, `checked = status === 'CONFORME'`, `categoryName` e `displayNameOrTag`. No UPDATE, a base é o snapshot existente do `RomaneioChecklist` daquele catalogItem (não a lista viva); item novo na edição usa a lista efetiva atual.
- **Rationale**: o servidor nunca confia no texto vindo do cliente para compor o documento (fonte = banco), só usa o texto como chave de status quando ele pertence à lista resolvida. Mantém o contrato pequeno e troca o binário por um estado explícito aplicável ao uso industrial.
- **Alternatives considered**: cliente envia `[{ text, checked }]` completo (rejeitada: binário insuficiente para "não aplicável"); índices booleanos/posicionais (rejeitada: frágil a reordenação entre carregar e enviar).

## D4. Descoberta no frontend de quais itens do catálogo têm checklist

- **Decision**: novo endpoint `GET /api/romaneios/checklist-map` retornando `{ hasSavedSignature, map: { [catalogItemId]: { equipmentId, equipmentCode, equipmentName, categoryName, displayNameOrTag, displayMode, items: string[] } } }` — apenas itens ativos do catálogo com checklist efetivo não-vazio. `hasSavedSignature` = colaborador vinculado ao usuário logado possui `signatureImage`.
- **Rationale**: uma chamada resolve os dois dados de que o `NewRomaneioPage` precisa (quando abrir a etapa de checklist; se mostra o campo de assinatura no resumo). Evita inflar o payload de `GET /catalog` (usado também para o PDF do catálogo) e evita N chamadas por equipamento.
- **Alternatives considered**: flag `hasChecklist` no `GET /catalog` + fetch por item ao adicionar (rejeitada: mais chamadas e estados de loading no fluxo de campo/mobile); embutir no bootstrap (rejeitada: dado específico do romaneio).

## D5. Geração do documento (DOCX → PDF, cores e assinatura)

- **Decision**: novo lib `backend/src/lib/romaneio/romaneio-checklist-docx.js` no padrão de `romaneio-docx.js` (AdmZip + xmldom, `replaceTokenInElement`, clonagem de tabela e linha-template). Placeholders do modelo validado/atualizado: `<<projeto>>` ("`<código> - <nome>`"; só o código quando a missão ainda não tem nome), `<<data>>`; tabela repetível do checklist com `<<categoria>>`, `<<nomeoutag>>`, linha-template `<<item>>`/`<<status>>`; bloco final com `<<assinatura>>`/`<<responsavel>>`. A geração localiza a tabela que contém esses quatro placeholders do checklist, clona a tabela inteira uma vez por snapshot e, dentro de cada clone, clona a linha-template por ponto. Dois acréscimos já praticados no projeto: (a) cor do status — localizar o `w:r` que contém `<<status>>` na linha clonada e gravar `w:rPr/w:color` (`00B050` CONFORME / `FF0000` NÃO CONFORME / `808080` NÃO APLICÁVEL) antes da substituição; (b) assinatura — embutir PNG via `word/media` + relationship + `w:drawing`, seguindo o padrão de `epi-docx.js` (que já injeta `Collaborator.signatureImage` em DOCX) e os helpers de `signature-image.js`. Conversão com `convertDocxToPdf` existente; o DOCX intermediário é apagado, persiste só o PDF consolidado.
- **Rationale**: reusa 100% do ferramental existente; `epi-docx.js` prova o caminho da assinatura data-URL → media do DOCX.
- **Alternatives considered**: pdf-lib direto (rejeitada: o modelo é um DOCX fornecido pelo cliente com layout próprio); docxtemplater (rejeitada: dependência nova, fora do padrão do projeto — constitution Stack).

## D6. Nome e local do arquivo

- **Decision**: `Checklist - Missão <código projeto> - <dd-mm-yyyy>.pdf`, salvo em `env.uploadDir/Missão <code> - <name>/ROMANEIO/` (mesma pasta dos arquivos do romaneio), com `safePath` para sanitizar. Data com hífens (`/` é inválido em nome de arquivo) — confirmado pelo usuário em 2026-07-09.
- **Rationale**: espelha `buildRomaneioFileName` (que já converte a data para hífens) e mantém os documentos da missão juntos.

## D7. Integração com o envio (transação, e-mail, falhas)

- **Decision**: no `POST /api/romaneios`, gerar o PDF consolidado de checklist junto com o DOCX/PDF do romaneio ANTES da transação (mesmo padrão atual: arquivos primeiro, `cleanupFailedRomaneioCreate` remove tudo se a transação falhar — estendido para o arquivo de checklist). As linhas `RomaneioChecklist` são criadas na mesma transação do romaneio, mas a URL do arquivo fica em `Romaneio.checklistPdfUrl`. `notifyRecipients` passa a anexar o PDF consolidado além do PDF do romaneio (mesmo e-mail, mesmos destinatários). No `PUT`, snapshots são atualizados, o PDF consolidado é regenerado e o antigo removido como já ocorre com docx/pdf do romaneio.
- **Rationale**: paridade com o comportamento e a semântica de falha atuais (edge case da spec: nada persiste pela metade).
- **Alternatives considered**: gerar PDFs pós-commit em background (rejeitada: card/e-mail sairiam sem os anexos; estado parcial).

## D8. Assinatura do responsável

- **Decision**: no resumo de envio, se houver checklist e `hasSavedSignature=false`, o front exibe captura de assinatura (desenho/upload) reutilizando o padrão do componente `SignatureDialog` (`frontend/src/components/reports/SignatureDialog.tsx`, mesmo usado em RDO/EPIs) e envia `checklistSignatureImage` (data URL) no payload. Se omitido, o servidor usa `Collaborator.signatureImage` do colaborador vinculado a `req.auth.user`. `checklistResponsibleName` = nome do usuário autenticado (servidor). A assinatura enviada não altera o cadastro do colaborador (FR-009).
- **Rationale**: exatamente o fluxo pedido pelo usuário na clarificação; reusa componente e formato (PNG data URL) já padronizados por `scripts/migrate-signatures-to-dataurl.js`.

## D9. Backfill de produção

- **Decision**: `backend/scripts/backfill-checklist-items.js`, padrão dos `backfill-*.js` existentes: dry-run por default, `--apply` para gravar. Mapa embutido no script (fonte: `Modelos/definitivos/Mapa checklist.txt`). Resolução de categoria por prefixo de código dos equipamentos (ex.: equipamentos `UFP 001` → categoria dona) com fallback por nome/systemKey contendo a sigla; não sobrescreve `checklistItems` não-vazios (preserva edições manuais; idempotente); UTH 008 recebe override = itens da categoria UTH + "Verificação da correia" + "Verificação das polias", apenas se ainda sem override; categorias/equipamentos não encontrados são reportados sem abortar.
- **Rationale**: Princípio IV (idempotência + dry-run); execução manual no servidor pelo operador (Princípio I).

## D10. Atualização do `<<projeto>>` em novos downloads (missão com cadastro pendente)

- **Decision**: `Romaneio` guarda `checklistProjectLabel` (o texto estampado no `<<projeto>>` na geração do consolidado). Na rota de download do PDF de checklist, o servidor recalcula o rótulo atual (`<código> - <nome>` ou só `<código>` quando `name` vazio); se divergir do gravado, regenera o PDF consolidado a partir dos snapshots (itens, categoria, `displayNameOrTag`, assinatura e responsável já estão persistidos no banco — regeneração autossuficiente), sobrescreve o arquivo, atualiza `checklistProjectLabel` e serve o novo. Nenhum reenvio de e-mail. O nome do ARQUIVO não muda (contém só o código do projeto).
- **Rationale**: exigência do mapa atualizado — romaneios podem criar missões como cadastro pendente (sem nome); quando o gestor cadastra o nome, novos downloads devem sair atualizados. Regenerar sob demanda no download é a forma mais simples: sem job, sem hook no cadastro de projeto, custo de uma conversão DOCX→PDF apenas quando o rótulo mudou.
- **Alternatives considered**: hook ao editar projeto regenerando todos os checklists (rejeitada: acopla módulo de projetos ao romaneio e regenera arquivos que talvez nunca sejam baixados); regenerar em TODO download (rejeitada: latência da conversão em todo clique sem necessidade).

## D11. Regra `<<nomeoutag>>`

- **Decision**: resolver `displayNameOrTag` no servidor no momento do snapshot. Em `AUTO`, equipamentos e itens adicionados por unidade usam tag/código (`equipmentCode`/código do item); consumíveis/produtos usam nome. `EquipmentCategory.checklistDisplayMode` pode forçar `TAG` ou `NAME` quando a classificação automática não for confiável.
- **Rationale**: o documento precisa ser estável depois do envio e não deve depender de heurística em download futuro. Persistir o valor resolvido evita que renomeações ou mudanças na categoria alterem romaneios antigos.
- **Alternatives considered**: decidir no DOCX durante cada geração (rejeitada: pode mudar histórico se a categoria/produto mudar); deixar só heurística sem override (rejeitada: o usuário explicitou risco de confusão e autorizou toggle/controle no cadastro da categoria).

## Pendências externas

Nenhuma. (1) `Modelos/definitivos/Checklist.docx` fornecido e validado em 2026-07-09 e atualizado pelo usuário em 2026-07-10 com `<<categoria>>` e `<<nomeoutag>>` na tabela repetível. (2) Formato da data no nome do arquivo confirmado pelo usuário em 2026-07-09: `dd-mm-yyyy` (hífens).
