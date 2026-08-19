# Implementation Plan: Efetivo Operacional — Produtividade e Improdutividade Real

**Branch**: `feat/efetivo-operacional` | **Date**: 2026-08-19 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/011-efetivo-operacional/spec.md` · Evidências: [research.md](./research.md)

## Summary

Criar a área **Efetivo Operacional** como módulo próprio do APP, entregando de início apenas a
seção **Produtividade**, com a Improdutividade Real por colaborador e a Taxa Geral do efetivo
operacional. O cálculo lê as horas normais já sincronizadas do Ponto Mais
(`PontoPeriodSummary` → `mergePontoPeriods`), sem novo importador, sem lançamento manual e sem
depender do motor de custo. A arquitetura nasce com espaço para as demais seções do protótipo
(Visão geral, Calendário, Colaboradores, Missões, Evolução, Simulações, Administração), mas nenhuma
delas é implementada agora.

## Technical Context

**Language/Version**: Node.js + Express (ESM) no backend; React 19 + Vite + TypeScript no frontend

**Primary Dependencies**: Prisma + PostgreSQL, Zod, @tanstack/react-query, react-hook-form

**Storage**: PostgreSQL via Prisma; leitura de `PontoPeriodSummary`, `Collaborator`, `JobRole`

**Testing**: `backend/test/*.test.js` (`npm test`), `frontend/test/*.test.mjs`,
`npm run architecture:check`

**Target Platform**: Web (desktop e mobile), autenticado

**Project Type**: Módulo novo (backend + frontend + registry compartilhado)

**Performance Goals**: consulta do indicador de um ano inteiro em uma requisição, com resposta
adequada a ~20–60 colaboradores e ~12 meses; sem N+1 por colaborador

**Constraints**: nenhum comando de servidor executado pelo agente; migration Prisma obrigatória
para qualquer mudança de schema; UI pt-BR e mobile-first

**Scale/Scope**: 1 módulo, 1 seção funcional, ~3 endpoints, 1 migration

## Constitution Check

*Gate avaliado contra a constitution v1.9.0.*

| Princípio | Situação |
|-----------|----------|
| I — Operação de servidor é sagrada | ✅ Migration e deploy entregues como blocos "rode no servidor"; o agente não executa nada |
| II — UI pt-BR e mobile-first | ✅ Tabela por colaborador vira cards em telas estreitas; abas/filtros do módulo com quebra ou `select` no mobile; sem scroll horizontal de página |
| III — Zod nas duas pontas | ✅ Query params do indicador e payload da marcação de função operacional validados com Zod no backend; filtros do frontend tipados |
| IV — Banco só via Prisma | ✅ `JobRole.isOperational` e o parâmetro de referência entram por migration versionada; nenhum backfill destrutivo |
| V — Testes no backend | ✅ `backend/test/efetivo-operacional.test.js` cobre a fórmula (piso 0%, média simples, exclusão de HE, meses analisados) e a permissão |
| VI — Consistência visual | ✅ Kit `components/ui/`, tokens de `variables.css`, tela análoga = `AcompanhamentoPage` + `SedeCostsBoard`; navegação em `?section=`/`?colaborador=`; tutorial permanente de módulo novo + novidade de 10 dias. **A exceção de identidade portada NÃO se aplica** — o protótipo não é um app aprovado em porte, é referência funcional |

**Sem violações a registrar em Complexity Tracking.** A única escolha que merece justificativa é
criar módulo novo em vez de reaproveitar o Acompanhamento (ver abaixo).

## Decisão de arquitetura: módulo próprio, não uma aba do Acompanhamento

**Escolha**: novo módulo `efetivo` no `shared/modules/registry.json`, com papéis
`efetivo:manager` e `efetivo:viewer`.

**Por quê**:

- O `docs/PADRAO_MODULO.md` já define o caminho (scaffold `npm run new:module`, registry como fonte
  de verdade, permissão modular) e o CI valida a sincronia registry ↔ Prisma ↔ frontend.
- A direção futura do protótipo (Calendário, Missões, Simulações, Administração própria) é sobre
  **pessoas e capacidade**, enquanto o Acompanhamento é sobre **missões e dinheiro**. Empilhar
  isso como quinta aba do Acompanhamento agravaria uma tela que já tem quatro seções e um motor de
  custo pesado.
- A permissão é diferente: hoje quem vê o Acompanhamento vê custo de projeto. Produtividade
  individual é dado de pessoas e merece papel próprio (e é dado pessoal sob a ótica de LGPD, ver
  `LGPD_ROPA.md`).

**Custo aceito**: o módulo novo consome `backend/src/lib/acompanhamento/labor-cost.js` como
biblioteca de leitura de ponto. Isso cria uma dependência entre módulos que hoje não existe.

**Mitigação**: o módulo novo **não** importa o motor de custo — importa apenas as funções puras de
leitura do ponto (`mergePontoPeriods`, `filterIgnoredPontoPeriods`). Se essa fronteira incomodar,
o passo seguinte é mover essas duas funções para `backend/src/lib/ponto/` e ambos os módulos
passarem a consumir de lá — refatoração pequena, sem mudança de comportamento.

**Alternativa descartada**: nova seção `?section=produtividade` dentro do Acompanhamento. Entrega
mais rápido, mas prende a área a um módulo cujo escopo é outro e obriga migração depois, quando o
Calendário e as Missões chegarem.

## Estrutura da implementação

### Registry e permissão

```text
shared/modules/registry.json         → módulo "efetivo" (id, badge, título, card do hub, rotas, papéis)
npm run modules:generate             → frontend/src/modules/registry.generated.ts
backend/prisma/schema.prisma         → AppModule.EFETIVO, ModuleRoleCode.EFETIVO_MANAGER/EFETIVO_VIEWER
frontend/src/modules/moduleRoutes.tsx→ rota /efetivo
```

### Backend

```text
backend/src/lib/efetivo/
  access.js          → requireEfetivoManager / requireEfetivoViewer
  productivity.js    → funções puras do indicador (sem Prisma)
  service.js         → orquestra Prisma + productivity.js
  settings.js        → parâmetro de referência (161 HH/mês) e defaults
backend/src/routes/resources/efetivo.js
backend/test/efetivo-operacional.test.js
```

`productivity.js` (puro, testável sem banco):

```text
buildMonthlyProductiveHours(periods)            → Map<collaboratorId, Map<'YYYY-MM', horasNormais>>
selectAnalyzedMonths(monthly, { year, cutoff, admissionDate, ... })
computeIndividualRate({ totalHours, analyzedMonths, reference })
computeGeneralRate(individualRates)             → média simples das taxas válidas
buildProductivityReport({ collaborators, jobRoles, periods, filters, reference })
```

Regras fixadas em código (FR-005 a FR-007): HE fora do numerador; piso 0% na taxa individual; taxa
geral = média simples. A referência vem de parâmetro, não de literal (FR-009).

### Frontend

```text
frontend/src/api/efetivo.ts
frontend/src/pages/efetivo/EfetivoPage.tsx           → shell + navegação por ?section=
frontend/src/pages/efetivo/components/
  ProductivityBoard.tsx                              → KPIs + evolução mensal + tabela/cards
  ProductivityCollaboratorDetail.tsx                 → detalhe por ?colaborador=
  ProductivityPendingList.tsx                        → pendências (FR-013)
frontend/src/pages/efetivo/utils/productivityPeriods.ts
frontend/test/efetivo.test.mjs
```

Reaproveitar: `components/ui/` (Modal, Button, SearchBar, Skeleton, Toast), tokens de
`styles/variables.css`, o padrão de filtros de período de `frontend/src/utils/sedePeriods.ts`
(feature 004) e a estrutura visual de `components/projects/SedeCostsBoard.tsx`. Tutorial permanente
de módulo novo no padrão de `AcompanhamentoTutorial.tsx` e novidade de 10 dias no padrão de
`PontoMaisSyncNovelty.tsx`.

### Banco (migration única)

```prisma
model JobRole {
  // ...
  isOperational Boolean @default(true)   // valor padrão conforme D-4
}
```

Parâmetro de referência: reutilizar o padrão de `AcompanhamentoSetting` criando um
`EfetivoSetting` (chave/valor com `updatedAt` e `updatedByUserId`) ou uma linha de configuração do
módulo — decisão de implementação, não de negócio. Nenhum backfill de dado existente é necessário;
a migration apenas adiciona coluna com default.

### Contrato de API (rascunho)

```text
GET  /api/efetivo/produtividade?ano=2026&ateMes=8
     → { referenciaMensalHH, periodo, ultimaSincronizacao,
         resumo: { hhAcumuladas, mediaMensalEquipe, taxaGeral, pendencias },
         evolucaoMensal: [{ mes, mediaHH, referencia }],
         colaboradores: [{ id, nome, cargo, hhAcumuladas, mediaMensal, heExcluidas,
                           mesesAnalisados, improdutividade }],
         pendentes: [{ tipo, descricao, referencia }] }

GET  /api/efetivo/produtividade/:collaboratorId?ano=2026
     → detalhe mês a mês

PATCH /api/job-roles/:id  { isOperational }    (rota existente, campo novo)
```

Validação Zod nos query params (`ano` inteiro plausível, `ateMes` 1–12) e no corpo do PATCH.

## Protótipo x APP atual

Classificação de cada funcionalidade/conceito do protótipo contra o que o APP realmente tem.

### Já existe / reutilizar

| Conceito do protótipo | O que o APP já tem |
|---|---|
| HH produtivas realizadas por pessoa e por mês | `PontoPeriodSummary.monthly` + `mergePontoPeriods()` (`labor-cost.js:331`), alimentado pela sincronização diária do Ponto Mais |
| Separação entre horas normais e horas extras | `workedMinutes` vs `he70Minutes`/`he100Minutes`/extras genéricas, já separadas na origem |
| Base de colaboradores, cargo e admissão | `Collaborator` (`name`, `role`, `admissionDate`, `isActive`) e `JobRole` |
| Cadastro de funções (aba Administração do protótipo) | `JobRoleManager.tsx` + `routes/resources/job-roles.js` — falta só a marcação de operacional |
| Filtros por ano/período | `utils/sedePeriods.ts` e o padrão da aba Sede (feature 004) |
| Controle de acesso por papéis | Registry de módulos com `<modulo>:manager` / `<modulo>:viewer` |
| Onde a pessoa esteve (alocação realizada) | Cruzamento ponto × RDO já existente (`classifyProjectHours`, `rdoDataByCollaboratorFromReports`) e relatório mensal de alocação (`allocation-monthly-report.js`) |
| Missões com cliente, local e mobilização | `Project` com `clientName`, `location`, `mobilizationDate`, `startDate`; fim previsto derivado em `avanco.js` |
| Agrupamento de missões | `AcompanhamentoMissionGroup` |
| Trilha de auditoria | Padrão já usado em outros módulos (`ReportAuditLog`, `EpiSignatureRequestAuditLog`) |

### Necessário para a primeira entrega

| Item | Observação |
|---|---|
| Módulo `efetivo` no registry + papéis + rota + card do hub | Scaffold `npm run new:module` |
| `JobRole.isOperational` (migration + UI no `JobRoleManager`) | Define o denominador do indicador (D-4) |
| Motor `productivity.js` com a fórmula oficial | 161 HH; HE fora; piso 0%; taxa geral = média simples |
| Endpoint `GET /api/efetivo/produtividade` (+ detalhe) | Zod, permissão modular |
| Tela Produtividade (KPIs, evolução mensal, tabela/cards, detalhe) | Kit e tokens do APP; sem cópia do layout do protótipo |
| Lista de pendências (ponto sem vínculo, sem meses, cargo sem `JobRole`) | Equivalente ao "Lançamentos pendentes" do protótipo |
| Parâmetro configurável da referência mensal | Evita 161 espalhado no código |
| Testes de fórmula e permissão + tutorial/novidade | Constitution V e VI |

### Preparar arquitetura (agora), implementar depois

| Item | Como preparar sem implementar |
|---|---|
| Seções futuras (Visão geral, Calendário, Colaboradores, Missões, Evolução, Simulações, Administração) | `EfetivoPage` navega por `?section=`, com apenas `produtividade` registrada; adicionar seção é adicionar entrada, não refatorar a página |
| Conceito de "efetivo operacional" | Nasce como propriedade de `JobRole`, reutilizável por qualquer indicador futuro |
| Leitura do ponto como biblioteca | `productivity.js` consome funções puras; se a fronteira entre módulos incomodar, mover `mergePontoPeriods`/`filterIgnoredPontoPeriods` para `backend/src/lib/ponto/` |
| Parâmetros do módulo | Um lugar único para constantes (161 hoje; prazos de folga, metas e janelas amanhã) |
| Competência mensal | O serviço já expõe "meses analisados" e a data da última sincronização — se o fechamento formal for aprovado (D-2), ele vira um filtro sobre a mesma lista, não uma reescrita |
| Ausências | Nenhum modelo é criado agora, mas o serviço isola "meses analisados" em uma função (`selectAnalyzedMonths`) — é ali que férias/afastamento entrarão |

### Futuro / fora do escopo desta entrega

| Item do protótipo | Por quê fica fora |
|---|---|
| Visão geral com efetivo ativo, alocados, livres, indisponíveis e déficit do dia | Depende de alocação **planejada** e de ausências, que não existem no APP |
| Calendário operacional (dia/semana/mês, ausências, conflitos) | Exige cadastro de ausências, feriados e alocação planejada |
| Missões com composição por função em **pessoas**, retorno e "alocar disponíveis" | Hoje a previsão por cargo é em **horas** (`ProjectPlannedNormalHours`), não em cabeças; não há data de retorno nem alocação planejada por pessoa |
| Kanban de evolução das missões (stand by → … → finalizados) | Não existe status de ciclo de vida em `Project`; é feature própria e toca o Acompanhamento |
| Simulações de cenário com contratações hipotéticas | Depende de missões planejadas e disponibilidade futura |
| Alertas de permanência contínua em obra / folgas a programar | Depende de ausências e de regra de negócio (D-5) |
| Taxa de alocação / utilização planejada (90 dias, meta 80%) | Indicador distinto; fórmula explicitamente **não presumida** (D-6) |
| "+ Lançar HH" (entrada manual de horas) | Contraria a feature 010, que eliminou o lançamento manual — Ponto Mais é a verdade do tempo |
| Papéis "Planejador"/"Leitor" e convites do protótipo | O APP já tem seu próprio modelo de papéis; adotar `manager`/`viewer` |

### Regra de negócio ainda indefinida

| Tema | Decisão |
|---|---|
| O que conta como "meses analisados" (pró-rata, mês parcial, férias) | D-1 |
| Competências abertas entram no indicador? Haverá fechamento formal? | D-2 |
| Tratamento de desligados (falta data de desligamento no APP) | D-3 |
| Quais cargos são operacionais e qual o default da migration | D-4 |
| Prazos de folga por permanência contínua (90/60/30 do protótipo) | D-5 |
| Fórmula da Taxa de Alocação/Utilização | D-6 |
| Meta de improdutividade | D-7 |

## Roadmap de expansão (referência conceitual, não compromisso)

```text
Efetivo Operacional
├── Produtividade            ← ENTREGA 1 (esta feature)
├── Administração            ← Entrega 2: funções operacionais, parâmetros, trilha
├── Colaboradores            ← Entrega 3: base + situação (exige cadastro de ausências)
├── Calendário               ← Entrega 4: exige ausências + feriados + alocação planejada
├── Missões                  ← Entrega 5: exige necessidade por função em pessoas e retorno
├── Visão Geral              ← Entrega 6: só faz sentido quando 3–5 existirem
├── Evolução / Histórico     ← Entrega 7: status de ciclo de vida da missão
└── Simulações               ← Entrega 8: depende de 4–6
```

Ordem proposta pelo custo de pré-requisito: quase tudo na Visão Geral do protótipo depende de dois
cadastros que hoje não existem — **ausências** e **alocação planejada por pessoa**. Enquanto eles
não existirem, qualquer KPI de disponibilidade seria estimativa.

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Mês de férias penaliza duas vezes (161 já é anualizada) | Indicador injusto com quem tirou férias | Explicitar na tela o que entra na conta; resolver de verdade só com cadastro de ausências (D-1) |
| Mês corrente parcial derruba a média geral | Número enganoso no início do mês | D-2; exibir aviso de mês em curso |
| Correção retroativa do Ponto Mais muda número já divulgado | Perda de confiança | Exibir data da última sincronização e alcance do período (FR-014) |
| Cargo sem `JobRole` correspondente esconde pessoa | Indicador incompleto | Pendência explícita (FR-013) |
| Dado pessoal (produtividade individual) exposto a papel amplo | LGPD | Papel próprio do módulo; revisar `LGPD_ROPA.md` ao implementar |
| Dependência do novo módulo em `lib/acompanhamento` | Acoplamento entre módulos | Importar só funções puras; extrair para `lib/ponto/` se crescer |

## Próximos passos

1. Revisar com o solicitante as decisões **D-1 a D-4** (as únicas que mudam números da primeira
   entrega).
2. Rodar `/speckit-tasks` para gerar `tasks.md` a partir desta spec e deste plano.
3. Implementar em uma única PR: registry + migration + backend + frontend + testes.
4. Migration e deploy entregues como blocos "rode no servidor" (Princípio I).
