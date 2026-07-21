# Quickstart: Custos manuais no Acompanhamento

## Prerequisites

- Dependências instaladas em `backend/` e `frontend/`.
- Banco local com migrations aplicáveis para Prisma.

## Validation Commands

```bash
cd backend
npm run prisma:generate
node --test test/acompanhamento-manual-costs.test.js test/acompanhamento-access-import.test.js test/acompanhamento-project-detail-groups.test.js
npm test
```

```bash
cd frontend
npm test
npm run lint
npm run build
```

```bash
npm run architecture:check
git diff --check
```

## Manual Scenario

1. Entrar como gestor do Acompanhamento.
2. Abrir a aba de projetos e entrar no dashboard de uma missão individual.
3. No bloco "Custos manuais", clicar em "Adicionar custo" para abrir o formulário.
4. Adicionar descrição, valor com máscara em reais, data opcional e observação opcional.
5. Confirmar que o custo aparece na lista, que o formulário volta a ficar recolhido e que "Consumo de gastos" inclui o valor manual.
6. Remover o custo e confirmar que ele sai da lista e do total realizado.
7. Simular a data até 2026-07-31 para validar o aviso Driver.js de novo recurso no primeiro acesso.
