# Specification Quality Checklist: Módulo Comercial — porte fiel do gerador de propostas

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-07-31
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

### Iteração 1 — 2026-07-31

Dois `[NEEDS CLARIFICATION]` foram levantados e **ambos foram respondidos pelo
mantenedor na mesma sessão**. Nenhum tinha padrão razoável que se pudesse assumir sem
mudar o produto entregue.

| Questão | Onde | Resposta |
|---|---|---|
| Alcance do papel de consulta | FR-030 | **Somente leitura** — mantido, e endurecido na iteração 2 (também não vê valores) |
| Menu de entrada × diálogo de modo | FR-043 | **Os dois passos coexistem**, sem atalho. Preserva o fluxo da referência e mantém a lista fechada em 9 desvios. O diálogo não reaparece quando o modo já vem no endereço (FR-044) |

**Checklist completo.** Nenhum marcador remanescente.

> A conclusão de que "toda escrita pertence ao manager", tirada desta iteração,
> **caiu na iteração 2** — ela dependia de existirem só dois papéis.

### Iteração 2 — 2026-07-31, modelo de permissão reaberto

A ressalva do FR-029 (a regra de autoria tinha ficado vazia) foi levada ao mantenedor
e a resposta **substituiu o modelo inteiro**: são **três** papéis, não dois. Os nomes
anteriores confundiam porque `manager` acumulava "gestor" e "orçamentista".

| Papel | Levantamentos | Propostas | Valores |
|---|---|---|---|
| `comercial:manager` — Gestor | cria; vê todos | edita e finaliza qualquer uma | vê tudo |
| `comercial:seller` — Vendedor | cria; vê só os seus | cria, edita e finaliza só as suas | vê os seus |
| `comercial:viewer` — Consulta | nenhum acesso | somente leitura | **nenhum** |

O FR-029 volta a ter função: com o vendedor podendo criar, a verificação de autoria
passa a restringir de fato — e agora vale para **duas entidades**, levantamento e
proposta, não só a proposta como a §12.5 previa.

**Isto revê as decisões 1 e 2 da §12.5 do plano**, que ficaram desatualizadas:

| Decisão §12.5 | Era | Agora |
|---|---|---|
| 1 — quem vê custo e margem | só o gestor | gestor (todos) e vendedor (só os seus) |
| 2 — quem finaliza | só o gestor | o autor finaliza a sua; o gestor, qualquer uma |

**Consequências de escopo**, todas fora do que a estimativa de 45,5-49,5 d cobre:

1. Verificação de autoria em **duas** entidades, não uma — a §12.5 orçou uma.
2. Filtragem por autoria nas **listagens**, não só nas rotas de escrita.
3. Papel novo no registro de módulos, com migração de enum própria.
4. Supressão de valores **na origem** para o papel de consulta, incluindo bloqueio do
   download da proposta comercial. Esconder no cliente não é restrição.

### Ressalvas registradas, não bloqueantes

- **"Sem detalhe de implementação" tem um limite nesta feature.** A spec cita
  artefatos por caminho (`contracts/ui-inventory.md`, `contracts/goldens/`) e padrões
  compartilhados do filtroAPP por nome de arquivo. Isso é deliberado: em um porte
  fiel, o artefato de referência **é** o requisito — "reproduzir os 616 controles"
  não é verificável sem apontar onde eles estão catalogados. Os critérios de sucesso
  (SC-001 a SC-011), esses sim, ficaram livres de tecnologia.
- **A `Visual/UI Contract` cita arquivos do filtroAPP** (`reorderDrag.ts`,
  `base.css`, `HubPage.tsx`). É o formato que o próprio template exige — a coluna
  pede "existing reference inspected" com referências concretas.
- **Escopo além do porte**: as decisões da §12.5 (permissões, autoria, cadastro de
  vendedores, numeração própria, retenção) divergem da referência **sem** constar da
  lista fechada de 9 desvios, porque aquela lista trata de paridade de UI/UX e estas
  são regra de negócio. Registrado em Assumptions para o `/speckit-analyze` não
  acusar contradição.
