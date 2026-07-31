# Implementation Plan: Módulo Comercial — porte fiel do gerador de propostas

**Branch**: `feat/modulo-comercial` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-modulo-comercial/spec.md`

## Summary

Portar o gerador de propostas comerciais `~/comercialAPP` — rascunho em Next.js 16 /
Cloudflare Workers / D1, nunca colocado em produção — para dentro do filtroAPP como
módulo **Comercial**, na stack do projeto, com **paridade total de UI e UX**.

A abordagem técnica se apoia em **dois oráculos independentes**, produzidos na etapa
E0 a partir da referência congelada em `6f5b072`:

- **Numérico**: 16 cenários golden com 40 invariantes, extraídos pelo fluxo real. O
  motor de custos é copiado sem alterar para `shared/comercial/` e tem de reproduzi-los
  dígito a dígito.
- **Visual**: inventário de 616 controles e 916 textos extraído por AST, com IDs
  estáveis que o `/speckit-analyze` cruza contra as tarefas.

O que **não** é porte: sete lacunas constitucionais (L1–L7) que a referência não tem e
a constitution exige, e as decisões de produto da §12.5/§12.5.1 do plano técnico —
três papéis com autoria verificada, lista de vendedores derivada dos usuários e
numeração própria.

Documento de fundo: `docs/PLANO_MODULO_COMERCIAL.md` (research). Decisões
consolidadas: [research.md](./research.md).

## Technical Context

**Language/Version**: Node.js (backend, JS) + TypeScript 5.8 (frontend e
`shared/comercial`)

**Primary Dependencies**: Express 5.2 · Prisma 7.9 · React 19.2 · Vite 6.3 ·
`react-router` 8.3 · `@tanstack/react-query` 5.101 · Zod 4.4 · `react-hook-form` 7.81 ·
`pdf-lib` 1.17 · `sharp` 0.35 · `driver.js` 1.7

**Dependência nova**: `@hookform/resolvers`. Não está instalada e `zodResolver` não
aparece em nenhum arquivo do frontend, apesar de o Princípio III exigir "react-hook-form
com resolver Zod" — ver D8 do research.

**Storage**: PostgreSQL com **dois schemas** na mesma instância — `public` (operação) e
`comercial` (módulo). Documentos gerados em disco sob `COMERCIAL_DIR`; rascunhos não
salvos em `localStorage`.

**Testing**: `node --test` — `backend/test/*.test.js` e `frontend/test/*.test.mjs`.
Nenhuma dependência de teste nova. Oráculos: os 16 goldens e a matriz de permissão.

**Target Platform**: aplicação web servida pelo mesmo Express, atrás do mesmo nginx,
com o mesmo login do filtroAPP.

**Project Type**: web application (backend + frontend), módulo dentro de monorepo
existente.

**Performance Goals**: recálculo do levantamento a cada tecla sobre ~40 coleções
aninhadas sem travar a digitação — é uma calculadora, não um CRUD.

**Constraints**: paridade pixel-a-pixel no desktop; **zero** rolagem horizontal de
página em 390 px; totais sempre recalculados no servidor (impede forjar margem);
valores suprimidos **na origem** por papel, não ocultados na tela.

**Scale/Scope**: 4 telas · **616 controles** · **916 textos visíveis** · 5 seções de
levantamento · 7 etapas de proposta · 16 cenários golden · 3 papéis · 2 schemas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Resultado: PASSA**, com 3 violações justificadas no Complexity Tracking.

| Princípio | Situação | Evidência |
|---|---|---|
| **I — Operação de servidor é sagrada** | ✅ | Nenhum comando de servidor executado por agente. Migration, `GRANT USAGE ON SCHEMA comercial`, envs e nginx entram como **roteiro para o operador** em `deploy/COMERCIAL.md` |
| **II — pt-BR e mobile-first** | ⚠️ **Violação justificada** | 100% pt-BR ✅. Mobile: a referência **não tem layout mobile** (L7) e o ajuste fino foi sequenciado para a E8.5 por decisão do mantenedor. **Sequenciamento, não dispensa** — segue condição de aceite. Ver Complexity Tracking |
| **III — Zod nas duas pontas** | ✅ com dependência nova | Toda rota valida com Zod antes de tocar regra ou banco. Formulários com `react-hook-form` + `zodResolver` — exige instalar `@hookform/resolvers` (D8) |
| **IV — Banco só via Prisma** | ✅ | `multiSchema` GA desde 6.13, repo em 7.9. Nenhuma edição ad hoc; a migration é revisada antes de aplicar |
| **V — Testes de lógica de negócio** | ✅ | 16 goldens + matriz de permissão (3 papéis × 2 entidades) + numeração (não regride, não colide) em `backend/test` |
| **VI — Consistência visual** | ✅ **sob a exceção de identidade portada** | Declarada abaixo. A alínea (c) **não é dispensada em nada** |

### Exceção de identidade portada — declaração exigida pela alínea (d)

| Requisito da emenda 1.9.0 | Como é atendido |
|---|---|
| **App de origem reproduzido** | `~/comercialAPP`, congelado em `6f5b072`, aprovado pela diretoria |
| **(a) CSS escopado sob raiz do módulo** | Todo seletor sob a raiz do módulo Comercial. Sem vazamento nos dois sentidos: nada escapa para o app, e `base.css` não afeta o interior |
| **(b) Paleta em bloco único, prefixada** | `--com-*` em **um bloco só**, nomeadas **por função** (`--com-superficie`, `--com-borda`, `--com-texto-fraco`) e nunca por cor. Hex solto espalhado pelos seletores **não atende** |
| **(c) Comportamentos obrigatórios preservados** | **Todos.** Ver tabela abaixo — não há dispensa |
| **(d) Registro e reavaliação** | Este bloco. Reavaliar quando o módulo deixar de ser porte e passar a evoluir por conta própria |

> **O mantenedor sinalizou que esta identidade pode virar o padrão do app.** É por isso
> que a alínea (b) importa tanto na prática: com a paleta em bloco único e nomeada por
> função, a promoção é **renomear tokens**, não reescrever CSS. Nome de cor
> (`--com-verde`) vira mentira no primeiro ajuste de paleta.

**A alínea (c), item a item** — a exceção é de aparência, e nenhuma garantia de
acessibilidade, responsividade ou consistência funcional é dispensada:

| Comportamento exigido | Estado na referência | O que o porte faz |
|---|---|---|
| `aria-invalid` com mensagem visível | **0 ocorrências** em `CUSTO` (465 controles) | L1 — `.field-invalid` do filtroAPP, com mensagem por campo e distinção entre **vazio** e **inválido** |
| Estados de `select` | 29 `select` em `CUSTO`, sem estados padrão | Estados padrão do app |
| Drag and drop no padrão compartilhado | **0 ocorrências** de `onDrag`/`onPointerDown` | L2 — `reorderDrag.ts`, **auditado antes de reusar**, com as setas ↑/↓ mantidas |
| Navegação em URL/query params | **0 ocorrências** de `useSearchParams`/`pushState` nas 4 telas | L3 — modo, base e seção/etapa no endereço |
| Tutorial permanente de primeiro acesso | **0 ocorrências** de `localStorage` | L4 — `driver.js`, roteiro tirado do `baseline/roteiro.md` |
| Sem rolagem horizontal de página em mobile | **39 regras de `min-width` em pixel**, a pior `.preview{min-width:390px}` | L7 — layout mobile próprio, E8.5 |

### Evidência visual exigida

| Surface | Existing reference audited | Shared component/classes | Field/dropdown states covered | Reorder drag/drop pattern | Navigation persistence | Novelty/tutorial plan | Mobile/desktop overflow evidence |
|---|---|---|---|---|---|---|---|
| Menu de entrada (`/comercial`, novo — desvio nº 9) | `frontend/src/pages/HubPage.tsx` | linguagem de cartões do hub, sob a raiz do módulo | N/A | N/A | endereço próprio | **ponto de partida do tutorial permanente** | grade `minmax(min(100%, N), 1fr)`; sem estouro em 390 px |
| `CUSTO` — 5 seções, 465 controles | `contracts/ui-inventory.md` §CUSTO; capturas `baseline/CUSTO-*-1440.png` | `.field-group` + `.field-invalid` + `.field-error` de `base.css:4085-4102` | default/focus/disabled/**error**/empty, com destaque vermelho por campo e mensagem distinta para inválido | N/A | modo, base e seção no endereço + rascunho local + `beforeunload` | tutorial cobre a **cadeia de prioridade do rodapé** | faixa de 7 indicadores e tira de 5 seções são os estouros conhecidos: quebrar, rolar internamente ou virar `select` |
| `PROP` — 7 etapas, 137 controles | `contracts/ui-inventory.md` §PROP; capturas `baseline/PROP-*-1440.png`; `frontend/src/utils/reorderDrag.ts` | idem + utilitário compartilhado de reordenação | idem, com **"E-mail inválido"/"CNPJ inválido"** distintos de "Campo obrigatório" | alça + reordenação ao vivo + espaço de destino + fantasma + cancelar restaura + persiste ao soltar + toque; **setas ↑/↓ mantidas** | etapa no endereço + rascunho local + `beforeunload` | tutorial cobre a **armadilha de e-mail/CNPJ** | prévia lateral **não pode** impor `min-width` em pixel; tabela de preços empilha |
| `HIST` — histórico | `contracts/ui-inventory.md` §HIST; `baseline/HIST-lista-1440.png` | tabela do padrão do projeto | N/A | N/A | filtros no endereço | N/A — coberto pelo tutorial do módulo | tabela vira cards; valor e status não alargam o card |
| Cadastro de vendedores (novo, §12.5) | telas de cadastro equivalentes do filtroAPP | componentes e classes padrão | default/focus/disabled/error | N/A | endereço próprio | coberto pelo tutorial | tabela vira cards |

**Auditoria antes de reusar** — exigida pelo template:

- `reorderDrag.ts` é **auditado contra a constitution antes de ser usado** (0,5 d
  orçado). Se reprovar, o conserto é **na origem compartilhada** (+1 d) e beneficia as
  4 telas que já o usam. Não se contorna no módulo.
- As classes `.field-*` foram verificadas: em uso em 10 arquivos, entregam rótulo
  vermelho, borda vermelha e fundo `#fff5f5`, mais `.field-invalid-panel` para grupo
  sem borda própria. **São classes de comportamento, não de identidade** — a exceção do
  Princípio VI não se aplica a elas.
- **Divergência pré-existente, fora do escopo desta feature**: as 4 telas que usam
  `react-hook-form` hoje não usam resolver Zod, contra o Princípio III. Anotado para
  quem for tocá-las; esta feature não as corrige, mas também não copia o padrão.

## Project Structure

### Documentation (this feature)

```text
specs/009-modulo-comercial/
├── plan.md                    # Este arquivo
├── spec.md                    # 48 FR, 12 SC
├── research.md                # Fase 0 — D1 a D15
├── data-model.md              # Fase 1 — models + matriz de acesso
├── quickstart.md              # Fase 1 — roteiro de validação
├── checklists/
│   └── requirements.md
├── contracts/
│   ├── api-contracts.md       # Fase 1 — rotas + matriz de permissão
│   ├── ui-inventory.md        # E0 — oráculo visual (616 controles)
│   ├── ui-inventory.raw.json
│   ├── goldens/               # E0 — oráculo numérico (16 cenários)
│   ├── lacunas-constitucionais.md
│   ├── e0-8-desvios-e-estimativa.md
│   ├── baseline-runbook.md
│   └── baseline/              # E0 — capturas + roteiro clicável
└── tasks.md                   # Fase 2 — /speckit-tasks
```

### Source Code (repository root)

```text
shared/
├── comercial/                 # copiado sem alterar da referência; tsconfig próprio → dist/
│   ├── cost-model.ts          # o motor que os goldens verificam
│   ├── technical-services.ts
│   ├── scope-content.ts
│   ├── proposal-visuals.ts
│   ├── finalization.ts        # os 4 estágios
│   └── nectar-pipelines.ts
├── schemas/comercial.js       # contrato Zod do payload Json
└── modules/registry.json      # + módulo comercial, 3 papéis

backend/
├── prisma/schema.prisma       # schemas = ["public", "comercial"]
├── src/middleware/auth.js     # + requireComercialAccess/Estimator/Manager
├── src/routes/comercial/
└── lib/comercial/
    ├── access.js              # autoria em DUAS entidades + filtro de listagem
    ├── cost-estimates.js
    ├── proposals.js
    ├── proposal-pdf.js        # porte para pdf-lib
    ├── pdf-images.js          # sharp
    ├── storage.js             # disco sob COMERCIAL_DIR
    ├── scope-assets.js        # fotos do escopo: assinatura de bytes, escopo/AAAA/MM/
    ├── cost-csv.js            # planilha anexada à finalização
    └── jobs.js                # Nectar + SharePoint

frontend/src/
├── pages/comercial/
│   ├── ComercialPage.tsx      # menu de entrada (desvio nº 9)
│   ├── custos/                # container + 5 seções
│   ├── proposta/              # container + 7 etapas + prévia + blocos de conteúdo
│   └── historico/
├── styles/comercial.css       # escopado, --com-* em bloco único
└── utils/reorderDrag.ts       # REUSO, após auditoria

backend/test/                  # goldens + permissão + numeração
frontend/test/
```

**Structure Decision**: web application dentro do monorepo existente. O módulo segue
o padrão de `qualidade` e `estoque` (`shared/modules/registry.json` +
`pages/<modulo>/` + `lib/<modulo>/`), com duas diferenças: **schema Postgres próprio**
(D1) e **CSS escopado com identidade própria** (exceção do Princípio VI). As duas telas
grandes são decompostas por exigência de CI — o repositório reprova página acima de
700–900 linhas, e `custos` tem 3.382.

## Complexity Tracking

| Violação | Por que é necessária | Alternativa mais simples rejeitada porque |
|---|---|---|
| **Mobile entregue em passada própria no fim (E8.5), e não desde a primeira versão** — Princípio II | A referência **não tem layout mobile** para portar (L7): 39 regras de `min-width` em pixel, a pior `.preview{min-width:390px}`. Não é ajuste de tabela, é layout que não existe. O mantenedor sequenciou o ajuste fino para o fim do porte | Fazer mobile junto com cada tela dobraria o custo de decisão em E6–E8, com o desktop ainda em validação contra a baseline. **Isto é sequenciamento, não dispensa**: segue condição de aceite, e as telas nascem com as primitivas certas (nunca `min-width` em pixel de container, `min-width: 0` em filho de flex/grid, tabela dentro do próprio `overflow-x: auto`). Sem essa disciplina a E8.5 vira reescrita e custa o dobro |
| **Recálculo ao vivo do levantamento fora do ciclo padrão de formulário** | `calculateEstimate` roda a cada tecla sobre ~40 coleções aninhadas; a tela é calculadora, não CRUD. É comportamento da referência e faz parte da paridade | Validar e calcular só no submit esconderia margem negativa e erro de dimensionamento até o fim do preenchimento — **na tela onde o preço é formado** |
| **`shared/comercial` com passo de build (`tsc`)** | 4.529 linhas com ~80 tipos exportados precisam rodar no backend (JS) e no frontend (TS). O motor é copiado sem alterar, porque é o que os goldens verificam | `.js` + `.d.ts` escritos à mão, como `shared/schemas/*`, seria fonte dupla de verdade nesse volume — e o drift apareceria como divergência de golden meses depois |

## Estimativa revista

A §12.5.1 acrescentou o papel `comercial:seller` e quatro consequências que não
estavam precificadas. Elas entram assim:

| Etapa | Escopo | Antes | **Agora** | O que entrou |
|---|---|---|---|---|
| E0 | Preparação, goldens, inventário, baseline | 3 d | **3 d** | realizado |
| E-1 | Fluxo spec-kit | 2–2,5 d | 2–2,5 d | — |
| E1 | Scaffold do módulo | 0,5 d | **0,75 d** | terceiro papel + enum `COMERCIAL_SELLER` |
| E2 | `shared/comercial` | 2 d | 2 d | — |
| E3 | Banco e dois schemas | 1,5 d | 1,5 d | — |
| E4 | Backend — levantamentos, consultores, numeração | 3 d | **3,25 d** | autoria em `CostEstimate` + filtro na listagem, **menos** o CRUD de vendedores (a lista virou consulta) |
| E5 | Backend — propostas, PDFs, integrações | 5,5 d | **9 d** | autoria + supressão na origem + fotos do escopo + planilha + **anexos e OneDrive** (+0,5 d) + **arquivamento** (+0,5 d) + **concorrência** (+0,5 d) + **revisão** (+0,25 d) |
| E6 | Frontend — base, histórico, CSS, menu | 3–3,5 d | **3,25–3,75 d** | histórico variando por papel |
| E7 | Frontend — levantamento de custos | 9–10 d | 9–10 d | L1 (+3 d), L3 (+1 d) |
| E8 | Frontend — proposta | 9–10 d | **10,75–11,75 d** | L2, L4, L3, **mais o editor de blocos de conteúdo** (+2 d), **menos** a tela de vendedores |
| **E8.5** | Passada de mobile sobre as 4 telas | 3–4 d | 3–4 d | L7 |
| E9 | Testes e CI | 2,5 d | **3,5 d** | matriz de permissão, cadeia de recusa do upload, concorrência e ausência de exclusão |
| E10 | Produção | 1,5 d | **1,75 d** | registro no ROPA |
| | **Até produção** | 45,5–49,5 d | **52,5–56,5 d** | **+7 d** |
| E11 | Substituir o import do Access | 3–5 d | 3–5 d | — |

**≈ 52,5 a 56,5 dias úteis (~11 semanas).**

> **O `/speckit-analyze` achou um subsistema inteiro fora do escopo: +3,5 d.** Os blocos
> de conteúdo do escopo — tabelas e **fotos**, com upload, otimização no cliente,
> verificação de assinatura de bytes e 16 controles — não tinham requisito, rota, modelo
> nem tarefa. Escaparam porque os controles caem numa faixa de ID que a tabela de
> cobertura mandava para a prévia: o componente é **definido** depois dela no fonte, mas
> **renderiza** na etapa 2. Junto vieram a planilha de custos da finalização (+0,5 d) e o
> registro no ROPA (+0,25 d).
>
> **Segunda leva de achados, 31/07: +2 d.** Os **anexos do cliente** e a **pasta do
> OneDrive** (`PROP-CTL-080/081`) também existiam na referência e escaparam — o plano os
> marcava como "novo" porque a *rota* seria nova, não a funcionalidade. Junto entraram as
> decisões do mantenedor: **arquivar sem exclusão**, **tutorial marcado por usuário** e
> **proteção de concorrência** na finalização.
>
> A unificação de vendedor com usuário (31/07) **devolveu 0,75 d**: some o model, o
> CRUD e a tela de cadastro, e entra uma consulta derivada. É a primeira decisão desta
> série que reduz escopo em vez de aumentar.
>
> Os +1,5 d líquidos são **decisão de produto**, não exigência da constitution. Junto com o
> menu de entrada e o rascunho da proposta, são os únicos itens do quadro que voltam a
> ser negociáveis se o prazo apertar. Tudo o mais — L1 a L7 — é obrigatório.

**Ordem de execução**: E0 → E-1 → E1 → E2 → E3 → (E4 e E6 em paralelo) → E5 → E7 →
E8 → **E8.5** → E9 → E10, com E11 depois. **E7 e E8 são o caminho crítico.**

## Re-avaliação do Constitution Check (pós-Fase 1)

**Resultado: PASSA.** O desenho da Fase 1 não introduziu violação nova, e fechou duas
frestas que só apareceram ao detalhar:

1. **Supressão de valores tinha de sair da tela e ir para a serialização.** Ocultar
   `totalValue` no cliente deixaria o valor no JSON — visível para qualquer um que abra
   as ferramentas do navegador. O `api-contracts.md` fixa a omissão **na origem**.
2. **Filtro de autoria tinha de alcançar a listagem, não só a rota de item.** É o
   vazamento mais provável e o menos visível: `GET /:id` nega, e o índice devolve tudo.
   Virou linha própria na matriz de teste, com o caso `seller` A × registro de
   `seller` B.

Nenhuma das três violações do Complexity Tracking mudou de natureza. A E8.5 continua
sendo **sequenciamento com condição de aceite preservada**, não dispensa de mobile.
