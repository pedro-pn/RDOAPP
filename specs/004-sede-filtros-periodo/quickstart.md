# Quickstart: Validação — Filtros de Período na Aba Sede

**Feature**: 004-sede-filtros-periodo

## Pré-requisitos

- Ambiente dev rodando com dados sincronizados do Omie cobrindo pelo menos 2 anos ou, no mínimo,
  meses em 2 trimestres diferentes (para os recortes fazerem diferença visível).
- Usuário com acesso ao Acompanhamento.
- Contrato e shapes: [contracts/sede-api.md](./contracts/sede-api.md) e [data-model.md](./data-model.md).

## Testes automatizados

```bash
cd backend && npm test
```

Suíte relevante: `acompanhamento-sede-costs.test.js` (estendida). Esperado: `buildSedeCostCards`
com `range` restringe todos os agregados ao intervalo; `'sem-data'` só sem filtro;
`availableMonths` sempre do conjunto completo; sem `range` = resultado idêntico ao atual;
Σ cards = summary (SC-001).

## Validação manual (fluxo real)

### US1 — Filtros de período fixos

1. Abrir Acompanhamento → aba Sede. **Esperado**: aba idêntica à atual + barra de filtros no topo
   com "Período" = "Todo o período" (números inalterados — SC-003).
2. Selecionar "Mês" → mês mais recente com dados. **Esperado**: KPIs e cards mostram só aquele
   mês; o valor do card de um centro bate com a linha daquele mês na lista "Meses recentes" da
   visão sem filtro (SC-002); 3º KPI mostra o rótulo do mês selecionado.
3. Selecionar "Trimestre" → um trimestre com dados. **Esperado**: recorte de exatamente 3 meses;
   lista de meses do card mostra só os meses do trimestre; soma dos cards = KPI Total (SC-001).
4. Repetir com "Semestre" (6 meses) e "Ano" (12 meses).
5. Selecionar um período sem lançamentos (se existir). **Esperado**: zeros + mensagens padrão
   "Sem custos lançados."/"Sem categorias.", sem erro.
6. Voltar a "Todo o período". **Esperado**: números originais restaurados.

### US2 — Período personalizado

1. Selecionar "Personalizado", de = out/2025, até = fev/2026. **Esperado**: agregados dos 5 meses;
   rótulo "Out/2025 – Fev/2026" no KPI.
2. Tentar até < de. **Esperado**: bloqueio com mensagem clara (e 400 pt-BR se forçado por API:
   `GET /acompanhamento/comercial/sede?from=2026-02&to=2025-10`).
3. Por API direta: `?from=2026-13&to=2026-14` e `?from=2026-01` (sem `to`). **Esperado**: 400 Zod.

### Regressões obrigatórias

- Sem filtro: resposta da API idêntica à atual exceto pelo campo novo `availableMonths`
  (comparar JSON antes/depois).
- Lançamentos "Sem data" continuam aparecendo nos agregados apenas em "Todo o período".
- Demais abas do Acompanhamento intocadas.
- Mobile (≤900px e ≤600px): barra de filtros empilha (grid do `.acp-filters`), sem scroll
  horizontal; selects estilizados (não crus).

## Constitution gates (checagem final)

- [X] UI pt-BR, mobile-first (filtros testados em viewport estreito)
- [X] Zod no backend para `from`/`to` (rejeições testadas por API direta)
- [X] Nenhuma migration (`prisma/migrations/` sem novidade)
- [X] Testes de negócio em `backend/test` passando
- [X] Padrão visual `acp-filters`/`field-group`/tokens — sem dropdown cru, sem hex/px novos
