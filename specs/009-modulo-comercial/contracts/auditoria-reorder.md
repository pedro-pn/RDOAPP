# Auditoria de `frontend/src/utils/reorderDrag.ts` (tarefa T001)

**Data**: 2026-07-31 · **Motivo**: o `plan-template.md` exige checar se a fonte
compartilhada ainda cumpre a constitution **antes** de reusar, e mandar corrigir a
origem se houver dívida.

## Veredito: **APROVADO para reuso**, com uma ressalva de escopo

O utilitário **não viola** nenhum requisito da constitution. Mas ele **não é o padrão
completo** — é um conjunto de ferramentas. Quem reusa monta o resto.

Isso não é defeito: é o desenho dele. Só precisa estar escrito, senão o módulo Comercial
consome o utilitário achando que ganhou o padrão inteiro e entrega dois terços dele.

## O que a constitution exige, item a item

| Exigência | Onde está | Quem entrega |
|---|---|---|
| Alça dedicada | — | **o chamador** (via `rowSelector` + `data-reorder-id`) |
| Reordenação ao vivo durante o arrasto | `reorderRowsById` | utilitário (matemática) + chamador (estado) |
| Placeholder com legenda de posição | `.drag-placeholder` em `base.css:12194-12215`, com `::after { content: 'Soltar aqui' }` | **CSS + o chamador** |
| Fantasma visual | `createPointerDragGhost`, `movePointerDragGhost`, `setReorderDragImage` | **utilitário** ✅ |
| Cancelar restaura a ordem inicial | — | **o chamador** |
| Persistir só ao soltar | — | **o chamador** |
| Toque via Pointer Events com `touch-action: none` | pointer no utilitário; `touch-action` em `base.css` | **utilitário + CSS** |

## O padrão completo existe — e funciona

Conferido em `frontend/src/pages/qualidade/QualityNaturesTab.tsx`, que é o uso mais
maduro:

- **alça** com `aria-label={`Arrastar ${nature.name} para reordenar`}` (linha 375)
- **placeholder** aplicando `drag-placeholder` na linha arrastada (linha 362)
- **cancelamento** em `onPointerCancel` → `finishNaturePointerDrag(event, false)`, que
  chama `applyOrderedNatures(naturesQuery.data)` e **restaura a ordem do servidor**
  (linha 387)
- **persistência só ao soltar**: `persistNatureOrder` só roda com `persist === true`
- **captura de ponteiro** liberada corretamente no fim

Ou seja: o padrão está íntegro **como montado ali**. O que não existe é um componente
único que o entregue pronto.

## Consequência para o módulo Comercial (T068–T071)

**Não há dívida a consertar na origem.** A T002 (corrigir `reorderDrag.ts`) **não é
necessária** e o risco de +1 dia orçado na estimativa **não se materializa**.

Em compensação, ao aplicar a L2 nas listas do escopo, dos serviços técnicos e dos blocos
de conteúdo, é preciso montar as **três peças que o utilitário não dá**:

1. **alça dedicada** com `aria-label` descritivo, e `data-reorder-id` na linha
2. **placeholder** com `.drag-placeholder` — a legenda "Soltar aqui" vem do CSS de graça
3. **cancelar restaurando**, em `onPointerCancel` **e** em `Escape`

> `QualityNaturesTab` trata `onPointerCancel` mas **não trata `Escape`**. Não é violação
> — a constitution diz "cancelar restaura a ordem inicial" sem nomear o gesto, e o
> cancelamento de ponteiro está coberto. Mas teclado é o caminho de acessibilidade, e
> quem usa as setas ↑/↓ vai tentar `Escape`. **O módulo Comercial trata os dois.**

## O que fica registrado na lista de desvios

Nada. O reuso é conforme, e nenhuma divergência nova entra na lista fechada de 9.
