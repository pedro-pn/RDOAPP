# 06 — Mapeamento do Projeto Atual → Design System

Baseado na auditoria de `frontend/src` (`base.css` 13.284 linhas, `variables.css` ~15 vars).
**Este documento indica o que substituir — não executa a migração.** O agente de programação
deve migrar módulo a módulo, preservando comportamento/rotas/estado.

## 0. Estado após a Fase 1

| Entrega | Estado |
|---------|--------|
| tokens completos + aliases legados | concluído |
| `foundation.css`, `utilities.css` e `legacy.css` | concluído |
| Tailwind v4 sem Preflight, integrado por cascade layers | concluído |
| Inter variável auto-hospedada | concluído |
| tema `light` / `dark` / `system` com persistência | concluído |
| `BrandLogo`, `AppIcon` e `ThemeToggle` | concluído |
| componentes primitivos do DS | **próxima fase; não iniciado** |
| páginas, shell, Hub e módulos | não iniciados |

Detalhes técnicos e contratos da fundação: [`07-foundation-phase-1.md`](./07-foundation-phase-1.md).

## 1. Fundação de estilo

| Atual | Ação | Novo |
|-------|------|------|
| `styles/variables.css` (~15 vars no baseline) | **Concluído na Fase 1** | Tokens completos + temas + aliases temporários |
| `styles/base.css` (13.284 linhas) | **Em transição** | Importado por `legacy.css` em `layer(legacy)`; desmontar incrementalmente |
| (sem fronteira de migração) | **Concluído na Fase 1** | `.fv-ds` / `[data-fv-ds]` delimita conteúdo novo |
| (sem Tailwind) | **Concluído na Fase 1** | Tailwind v4, sem Preflight, tokens em `@theme` |
| 151 cores hex | Consolidar | ~5 famílias tokenizadas (marca + neutros + 4 feedback) |
| 70 `!important` | Remover | Corrigir especificidade via componente/props |
| 50 `box-shadow` distintos | Mapear | `--shadow-e0..e3` |
| 20+ `border-radius` | Mapear | `--radius-sm/md/lg/xl/pill` |
| 23 breakpoints | Consolidar | `sm/md/lg/xl/2xl` |
| `font-family: Segoe UI` | Em transição | `Inter Variable` (`--font-sans`) nas fronteiras `.fv-ds` |
| fontes 9–13px + fracionárias | Normalizar | escala `--text-*` (mín. 12px) |
| sem dark mode | Fundação concluída | `.light` / `.dark` / `system`; telas adotam ao migrar |

## 2. Layout / shell

| Atual | Ação | Novo |
|-------|------|------|
| `.app-shell { max-width: 420px }` | **Remover teto** | Shell fluido (`max-width: 1280px`) |
| `layout/Shell.tsx` | Refatorar | Shell responsivo (Sidebar ≥ lg / BottomBar < lg) |
| `layout/TopBar.tsx` | Consolidar | `TopBar` do DS (breadcrumb + search + ações) |
| `layout/BottomBar.tsx` | Consolidar | `BottomBar` do DS (tabs + FAB) |
| (sem sidebar desktop) | Adicionar | `Sidebar` do DS (≥ lg) |
| `HubPage` + `hubModules.ts` | Recompor | Hub/Dashboard do doc 04 (mantendo `moduleRegistry`) |

## 3. Componentes de UI existentes

| Atual (`components/ui/*`) | Ação | Novo |
|---------------------------|------|------|
| `Button.tsx` (4 variantes, 8px/12px) | Ampliar | `Button` (5 variantes, sm/md/lg, loading) |
| `Modal.tsx` (a11y boa) | **Manter a11y + padronizar** | `Modal` com tamanhos sm/md/lg/full; → BottomSheet no mobile |
| `Toast.tsx` (4s fixo) | Evoluir | `Toast` com pausa no hover + ação/undo |
| `Skeleton.tsx` | Generalizar | `Skeleton` (text/block/circle/table-rows/card) |
| `SearchBar.tsx` + hooks | Consolidar | `Search` (mantém debounce/URL/persistência) |
| `ConfirmDialog` | Padronizar | `Modal size="sm"` com ação `danger` |
| (inputs espalhados) | Criar | `Input` / `Select` unificados |

## 4. Cards (consolidar ~102 classes → 1 componente)

Substituir todas as variações por `Card` + props. Exemplos de classes a aposentar:

| Classes atuais (amostra) | Novo |
|--------------------------|------|
| `acp-pcard`, `admin-card`, `auth-card`, `client-report-card`, `equip-card`, `stats-card`, `colab-card`, … | `Card variant/padding` |
| toolbars de card (`admin-card-toolbar`, `acp-pcards-filters`) | `FilterBar` |

## 5. Badges / status (consolidar → Badge + StatusPill)

| Classes atuais | Novo | tone |
|----------------|------|------|
| `badge-ok`, `equip-badge-ok`, `privacy-status-ok`, `*-signed`, `*-active` | `StatusPill` | `success` |
| `badge-pen`, `equip-badge-expiring`, `*-pending` | `StatusPill` | `warning` |
| `badge-rej`, `equip-badge-expired`, `*-rejected`, `*-cancelled` | `StatusPill` | `danger` |
| `badge-rev`, `rtype-badge`, `*-draft`, `*-info` | `StatusPill` | `info` |
| `equip-badge-none`, `*-na` | `StatusPill` | `neutral` |
| `ops-pill` e chips de categoria | `Badge tone` | conforme categoria |

> Novos status → entrada no mapa central `statusToTone`. Nunca nova classe por módulo.

## 6. Feedback / erros

| Atual | Novo |
|-------|------|
| `field-error`, `inline-error`, `form-error`, `ops-error` | `Alert` (inline) ou `errorText` do Input |
| mensagens de sucesso ad-hoc | `Toast` / `Alert success` |
| `error` genérico em blocos | `EmptyState variant="error"` + retry |

## 7. Estados vazios / loading

| Atual | Novo |
|-------|------|
| `colab-empty`, `stats-empty`, `tech-summary-empty`, etc. | `EmptyState` (variants) |
| `.spinner` / `.loading` avulsos | `Skeleton` (conteúdo) ou spinner do `Button` (ação) |

## 8. Tabelas

| Atual | Novo |
|-------|------|
| 11 páginas com `<table>` ad-hoc dentro de 420px | `DataTable` responsivo (tabela ≥ md → cards < md) |
| filtros de tabela heterogêneos | `FilterBar` |

## 9. Onboarding / tutoriais

| Atual | Ação |
|-------|------|
| 20+ chaves de `localStorage` de "novelty", `driver.js` (`HubTutorial`, `ClientTutorial`, `*Novelty.tsx`) | **Reduzir dependência**: a clareza do novo DS (hierarquia, estados vazios, rótulos) deve tornar a maioria dispensável. Manter apenas tours de real valor; não migrar pop-ups que só compensavam baixa affordance. Não é remoção obrigatória — é meta de redução. |

## 10. Ordem sugerida de migração (para o agente de programação)

1. **Fundação — concluída:** tokens, Inter, Tailwind sem Preflight, layers, tema,
   `BrandLogo`, `AppIcon`, `ThemeToggle` e compatibilidade legada.
2. **Primitivos de UI — próxima fase:** `Button`, `Input`, `Select`, `Card`, `Badge`, `StatusPill`, `Alert`,
   `EmptyState`, `Skeleton`, `Toast`, `Modal` (tamanhos), `BottomSheet`.
3. **Shell responsivo:** remover teto de 420px; `Sidebar` (≥ lg) + `BottomBar` (< lg) + `TopBar`.
4. **DataTable + FilterBar:** migrar as 11 telas de tabela.
5. **Hub/Dashboard:** recompor conforme doc 04.
6. **Módulo a módulo:** trocar classes `*-card`/`*-badge`/erros/vazios pelos componentes;
   remover `!important`; aposentar breakpoints extras.
7. **Limpeza final:** deletar CSS morto do `base.css` à medida que cada módulo migra.

> Regra de segurança: **não** alterar backend, APIs, rotas, autenticação (`RoleRoute`,
> `PrivateRoute`, `rolePath`), stores (`zustand`) nem queries (`react-query`). O redesign é
> estritamente da camada de apresentação.
