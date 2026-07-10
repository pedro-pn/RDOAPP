# Quickstart — Validação: Checklist de Equipamentos no Romaneio

**Feature**: 002-checklist-romaneio

## Pré-requisitos

1. `Modelos/definitivos/Checklist.docx` presente no repositório (fornecido pelo usuário) com os placeholders do `Mapa checklist.txt`, incluindo `<<categoria>>` e `<<nomeoutag>>` na tabela repetível do checklist.
2. Backend + frontend rodando em dev (`npm run dev` em `backend/` e `frontend/`); banco com migrations aplicadas (`npx prisma migrate dev`).
3. Uma conta gestor do módulo Equipamentos e uma conta com papel de romaneio (operator/manager).
4. SMTP configurado (ou aceitar `emailStatus` de erro) e ao menos 1 destinatário em Notificações do Romaneio.

## Cenário 1 — Cadastro por categoria (User Story 3)

1. Módulo Equipamentos → editar uma categoria → ligar "Tem checklist".
2. Cadastrar 3 pontos, reordenar, salvar. Reabrir e conferir persistência.
3. Conferir o controle "Identificação no checklist" e salvar em Automático; opcionalmente forçar Tag/Código ou Nome em uma categoria de teste para validar `<<nomeoutag>>`.
4. Com conta não-gestora, confirmar que toggle/editor/identificação não são editáveis.

## Cenário 2 — Override por equipamento (User Story 4)

1. Editar um equipamento da categoria acima → checklist mostra lista herdada.
2. Editar a lista (adicionar 1 ponto) e salvar → só este equipamento muda.
3. Alterar a lista da categoria → equipamento com override não é afetado.
4. "Restaurar padrão da categoria" (com confirmação) → volta a herdar.

## Cenário 3 — Fluxo do romaneio (User Stories 1 e 2)

1. Novo romaneio de SAÍDA → adicionar equipamento da categoria com checklist → modal de checklist abre com itens iniciando como conforme.
2. Marcar parte dos itens, fechar, adicionar um item SEM checklist (nenhum modal) e um segundo equipamento COM checklist.
3. Salvar rascunho, sair, retomar → marcações restauradas.
4. Enviar → no resumo: campo de assinatura aparece (conta sem assinatura cadastrada) ou é omitido (conta vinculada a colaborador com assinatura).
5. Após envio, conferir:
   - Card do romaneio com 1 botão de download do checklist consolidado + PDF/DOCX do romaneio.
   - Nome do arquivo: `Checklist - Missão <código> - <dd-mm-yyyy>.pdf`.
   - PDF: uma tabela de checklist para cada item com checklist, duplicada logo abaixo da anterior; `<<categoria>>` preenchido com a categoria; `<<nomeoutag>>` preenchido com tag/código nos equipamentos (ex.: UFP/ULQ) e com nome do produto em consumíveis.
   - PDF: status CONFORME (verde), NÃO CONFORME (vermelho) e NÃO APLICÁVEL (cinza), assinatura + nome do responsável no final.
   - E-mail recebido com PDF do romaneio + 1 PDF consolidado de checklist anexo.
6. Romaneio de ENTRADA com o mesmo equipamento → nenhum checklist é pedido.
7. Cabeçalho do PDF: `<<projeto>>` = "código - nome" da missão. Criar um romaneio informando só o código de uma missão inexistente (cadastro pendente): o PDF consolidado sai só com o código; cadastrar o nome da missão e baixar o checklist de novo → PDF atualizado com "código - nome" (FR-019).

## Cenário 4 — Edição (User Story 6)

1. Como gerente/coordenador, editar o romaneio enviado → marcações aparecem como salvas.
2. Alterar marcações e salvar → PDF consolidado regenerado com novos status (baixar de novo e conferir).
3. Alterar a lista da categoria ANTES da edição → a edição continua mostrando o snapshot antigo (FR-014).

## Cenário 5 — Backfill (User Story 5)

```bash
# dev (local)
cd backend
node scripts/backfill-checklist-items.js            # dry-run: revisa saída
node scripts/backfill-checklist-items.js --apply    # aplica
node scripts/backfill-checklist-items.js --apply    # roda de novo: nada muda (idempotência)
```

Conferir: 7 categorias com checklist habilitado e itens do mapa; UTH sem os 2 itens "apenas UTH 008"; equipamento UTH 008 com override (itens da categoria + correia + polias); categorias/equipamentos ausentes reportados sem abortar.

## Testes automatizados

```bash
cd backend
npm test    # inclui test/romaneio-checklist.test.js
```

## Produção (operador humano — Princípio I)

Rode no servidor:

```bash
# 1. migration
docker compose exec backend npx prisma migrate deploy

# 2. backfill (dry-run primeiro, depois aplicar)
docker compose exec backend node scripts/backfill-checklist-items.js
docker compose exec backend node scripts/backfill-checklist-items.js --apply
```

(Os comandos exatos de compose/serviço seguem deploy/PRODUCTION.md.)
