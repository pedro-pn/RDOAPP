# Research — Módulo Estoque (Phase 0)

**Date**: 2026-07-07 · **Plan**: [plan.md](./plan.md)

Nenhum NEEDS CLARIFICATION restou na spec (Q1–Q3 decididas pelo dono em 2026-07-07). As pesquisas abaixo consolidam as decisões técnicas e os padrões do próprio repo que o design reutiliza.

## R1 — Controle de saldo: por lote, derivado das movimentações

- **Decision**: saldo nunca é coluna persistida; é `SUM` das movimentações agrupado por `itemId`/`batchId` (entrada soma, saída subtrai, ajuste tem sinal próprio). Toda movimentação referencia um lote.
- **Rationale**: fonte de verdade única elimina qualquer caminho de dessincronização (SC-003); o volume (milhares de movimentações/ano) torna a agregação trivial com índices `(itemId, date)` e `(batchId)`. Lote é obrigatório no modelo para viabilizar FEFO e rastreio NF→obra; itens sem lote informado usam um "lote avulso" por item (`lotNumber: ""`).
- **Alternatives considered**: coluna `currentQty` cacheada em `StockItem`/`StockBatch` (rejeitada: risco de divergência, ganho de performance irrelevante nesse volume); saldo agregado sem lote (rejeitada: perde FEFO, validade e rastreabilidade exigidas pela spec).

## R2 — Concorrência: transação com revalidação de saldo

- **Decision**: criação de saída/ajuste negativo roda em `prisma.$transaction` que (1) recalcula o saldo do lote dentro da transação com `SELECT ... FOR UPDATE` no registro do lote (`prisma.$queryRaw` de lock ou `update` no-op no `StockBatch` para serializar) e (2) insere a movimentação só se `saldo - quantidade >= 0`.
- **Rationale**: atende SC-004 (duas saídas simultâneas não podem estourar o saldo) sem constraint de banco exótica; serializar por lote é suficiente e barato.
- **Alternatives considered**: nível de isolamento SERIALIZABLE global (rejeitado: retries e complexidade desnecessários); trigger/constraint SQL manual (rejeitado: viola Princípio IV — schema só via Prisma).

## R3 — Imutabilidade e estorno

- **Decision**: sem UPDATE/DELETE de movimentação em nenhuma rota. Estorno = nova movimentação inversa com `reversalOfId` apontando para a original; a original ganha marca visual "estornada" derivada da existência do vínculo (sem flag persistida além da FK). Estornar um estorno é bloqueado; estornar duas vezes a mesma movimentação é bloqueado (unique em `reversalOfId`).
- **Rationale**: trilha de auditoria íntegra (FR-010) com o mínimo de estado; o unique garante idempotência.
- **Alternatives considered**: permitir editar a última movimentação do item (rejeitado pelo padrão assumido na spec: estorno é mais seguro e mais simples de auditar).

## R4 — Unidade de medida e precisão

- **Decision**: `unitLabel` é atributo do item: `"un"` fixo para filtro; `"kg"` ou `"L"` escolhido no cadastro do químico (decisão Q2). Quantidades `Decimal(12,3)`; validação Zod exige inteiro quando o item é filtro (`.multipleOf(1)`) e até 3 casas para químico. Unidade é imutável após a primeira movimentação do item.
- **Rationale**: cobre químicos líquidos sem converter unidades; travar a unidade após movimentar evita histórico sem sentido (10 kg virarem 10 L).
- **Alternatives considered**: unidade livre (rejeitada na clarificação — risco de inconsistência); conversão kg↔L por densidade (adiada — sem caso de uso confirmado; campo densidade não entra na Fase 1).

## R5 — Tipos e motivos de movimentação

- **Decision**: `type` (ENTRADA | SAIDA | AJUSTE) + `reason` (COMPRA, DEVOLUCAO_OBRA, USO_EM_PROJETO, PERDA, DESCARTE_VALIDADE, INVENTARIO, ESTORNO). Regras condicionais por combinação (ver data-model.md): COMPRA exige NF (+ lote/validade se químico); DEVOLUCAO_OBRA exige projeto de origem e lote existente; USO_EM_PROJETO exige projeto de destino; AJUSTE/INVENTARIO exige justificativa (`notes`) e aceita sinal positivo ou negativo via campo `direction` implícito no type ENTRADA/SAIDA? — **Não**: ajuste usa `type: AJUSTE` com `quantity` assinada não; mantemos `quantity` sempre positiva e um campo `adjustmentDirection` não é criado: o AJUSTE registra `quantity` positiva + subcampo `reason=INVENTARIO` e um booleano derivado do formulário que o backend converte em duas variantes internas (`AJUSTE` com efeito + ou −) persistidas como `type: ENTRADA|SAIDA` com `reason: INVENTARIO`. Ou seja: **no banco existem só ENTRADA e SAIDA + ESTORNO como reason**; "ajuste" é um par (tipo, motivo). `type: AJUSTE` é eliminado do enum.
- **Rationale**: manter `quantity > 0` sempre e o efeito no saldo determinado exclusivamente por `type` simplifica a agregação (SUM condicional) e elimina ambiguidade de sinal. A UI continua mostrando "Ajuste de inventário" como conceito único.
- **Alternatives considered**: enum `AJUSTE` com quantidade assinada (rejeitado: quebra o invariante `quantity > 0` e complica agregação e validação); tabela separada de ajustes (rejeitado: fragmenta o histórico).

## R6 — Anexos (FISPQ na Fase 1; NF adiada)

- **Decision**: FISPQ do produto químico usa o padrão de anexos por token do Equipamentos (`app.js: GET /api/equipamentos-anexos/:token` → novo `GET /api/estoque-anexos/:token`, armazenamento via `stored-image`/documents lib existente, upload como dataUrl no PUT do item). Anexo de NF na movimentação fica para a Fase 2 (campo `nfAttachmentToken` já previsto no modelo, nullable).
- **Rationale**: FISPQ é cadastral e de baixa frequência (encaixa na Fase 1 sem custo); anexo por movimentação multiplica uploads e não é exigência da spec para a primeira entrega.
- **Alternatives considered**: adiar FISPQ também (mantido na Fase 1 por ser obrigação NR-26 e ter implementação idêntica à já existente).

## R7 — Registro do módulo e permissões

- **Decision**: novo bloco em `shared/modules/registry.json` (id `estoque`, `prismaModule: "ESTOQUE"`, badge "STQ", hub path `/estoque`, roles `ESTOQUE_MANAGER`/`ESTOQUE_VIEWER` públicos `estoque:manager`/`estoque:viewer`, accountTypes ADMIN+INTERNAL) + `node scripts/generate-module-registry.mjs` para regenerar `frontend/src/modules/registry.generated.ts`. Middleware `requireEstoqueAccess`/`requireEstoqueManager` copiando o padrão de `requireEquipamentosAccess` (`backend/src/middleware/auth.js:138`). Admins do hub têm acesso implícito? — seguir o padrão Equipamentos (acesso só por papel do módulo), não o do Acompanhamento (admin OR papel).
- **Rationale**: o registry central propaga hub, rotas e opções de papel automaticamente; Equipamentos é a tela análoga (Princípio VI).
- **Alternatives considered**: padrão Acompanhamento com bypass de admin (rejeitado para manter simetria com Equipamentos; admin pode se atribuir o papel).

## R8 — Aba Resumo: agregação no backend

- **Decision**: endpoint único `GET /estoque/resumo` retorna itens com saldo total, saldo por lote, flags `belowMin` e `expiringSoon`/`expired` (janela de 30 dias) calculados no backend em uma query agregada + join de lotes.
- **Rationale**: evita N+1 no cliente, mantém a regra de alerta num só lugar (será reutilizada pelos e-mails da Fase 2), payload pequeno no volume esperado.
- **Alternatives considered**: agregar no frontend a partir do histórico (rejeitado: transfere regra de negócio para a UI e cresce com o histórico).
