# Quickstart — Validação do Módulo Estoque

Guia de validação end-to-end. Referências: [data-model.md](./data-model.md), [contracts/estoque-api.md](./contracts/estoque-api.md).

## Pré-requisitos

- Migration aplicada e client gerado (dev local):
  ```bash
  cd backend
  npm run prisma:migrate   # cria/aplica a migration estoque_module
  npm run prisma:generate
  ```
- Registry do frontend regenerado após editar `shared/modules/registry.json`:
  ```bash
  node scripts/generate-module-registry.mjs
  ```
- Backend e frontend rodando em dev (`npm run dev` em cada um).
- Um usuário ADMIN/INTERNAL com papel **Estoque - Gestor** atribuído (via tela de usuários) e outro com **Estoque - Visualizador**.

## Testes automatizados

```bash
cd backend
npm test           # inclui estoque-balance / estoque-movements / estoque-access
```

Esperado: suíte inteira verde (os testes novos cobrem saldo, saldo negativo bloqueado, FEFO, obrigatoriedade condicional NF/lote/validade, estorno, inventário e permissões).

Resultado da implementação em 2026-07-09:

- `backend`: `npx prisma validate`, `npm run prisma:generate` e `npm test` concluídos com sucesso.
- `frontend`: `npx tsc --noEmit` e `npm run build` concluídos com sucesso.
- `npm run prisma:migrate` não foi executado com sucesso nesta sessão porque o PostgreSQL local `postgres:5432` não estava acessível. A migration foi criada em `backend/prisma/migrations/20260709100000_estoque_module/` e ainda precisa ser aplicada em ambiente com banco disponível.
- O roteiro manual abaixo não foi executado nesta sessão pelo mesmo bloqueio de banco/autenticação local.

## Roteiro manual (navegador)

1. **Hub**: logar como gestor → card "Estoque" visível → abre `/estoque` com 3 abas (Resumo, Movimentações, Itens).
2. **Cadastro (US1)**: na aba Itens, criar 1 filtro (código `FL-010`, micragem 10) e 1 químico (código `PQ-001`, unidade **kg**, nº CAS `67-56-1`, com FISPQ em PDF). Tentar repetir o código → erro claro. Baixar a FISPQ pelo link.
3. **Entrada (US2)**: no Resumo → "Registrar movimentação" → entrada por compra do `PQ-001`: 100 kg, NF `12345`, lote `L-A`, validade +60 dias. Confirmar que a unidade `kg` aparece em dropdown ao lado da quantidade. Salvar sem lote → bloqueio apontando o campo. Entrada do `FL-010`: 20 un, NF `12346`, **sem lote** → aceita (lote avulso). Resumo mostra saldos 100 kg e 20 un.
4. **Segunda entrada mesmo lote**: nova compra `PQ-001`, lote `L-A`, 50 kg → lote soma 150 kg (não duplica).
5. **Saída FEFO (US3)**: criar segunda entrada `PQ-001` lote `L-B` validade +10 dias. Registrar saída de 30 kg → formulário pré-seleciona `L-B` (vence antes); concluir com projeto de destino e data. Saldo de `L-B` cai 30.
6. **Saldo insuficiente**: tentar saída de 999 kg → bloqueio informando o disponível.
7. **Quantidade inteira**: saída de `FL-010` com `1,5` → rejeitada; `2` → ok.
8. **Devolução de obra (US6)**: devolução de 5 kg do `PQ-001` informando o projeto de origem e o lote → saldo sobe sem exigir NF.
9. **Ajuste de inventário (US6)**: ajuste negativo de 1 kg sem justificativa → bloqueado; com justificativa → ok.
10. **Estorno (US6)**: no histórico, estornar a saída do passo 5 → saldo restaurado; as duas movimentações aparecem vinculadas; tentar estornar de novo → bloqueado.
11. **Histórico (US5)**: aba Movimentações → filtrar por projeto e período → só as movimentações esperadas; cada linha mostra autor.
12. **Viewer (US4)**: logar com o visualizador → vê Resumo e histórico; sem botões de movimentar/cadastrar; POST direto na API retorna 403.
13. **Alertas visuais**: definir estoque mínimo do `PQ-001` acima do saldo → badge "abaixo do mínimo" no Resumo; lote com validade próxima exibe destaque.
14. **Mobile**: repetir passos 2–5 em viewport de celular (DevTools) → sem scroll horizontal; tabelas viram cards; modais com rodapé fixo.

## Critérios de aceite (da spec)

- SC-001: movimentação completa registrável em < 1 min a partir do Resumo.
- SC-003: todo saldo exibido = soma das movimentações (conferir passos 3–10).
- SC-004: saldo nunca negativo (passos 6 e 10).
- SC-006: fluxo integral utilizável em celular (passo 14).

## Deploy (produção — **rode no servidor**, nunca pelo agente)

```bash
# no diretório backend, no servidor
npx prisma migrate deploy
npx prisma generate
# reiniciar o serviço conforme procedimento padrão do deploy/
```

Sem backfill: módulo novo, sem dados legados. Após o deploy, atribuir os papéis de Estoque aos usuários.
