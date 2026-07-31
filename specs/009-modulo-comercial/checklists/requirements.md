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
| Alcance do papel de consulta | FR-030 | **Somente leitura.** O viewer consulta propostas emitidas, histórico e documentos. Toda escrita do módulo pertence ao manager (FR-030a) |
| Menu de entrada × diálogo de modo | FR-043 | **Os dois passos coexistem**, sem atalho. Preserva o fluxo da referência e mantém a lista fechada em 9 desvios. O diálogo não reaparece quando o modo já vem no endereço (FR-044) |

**Checklist completo.** Nenhum marcador remanescente.

### Uma consequência derivada, para o `/speckit-clarify`

A resposta ao FR-030 **esvaziou o FR-029**. A §12.5 decidiu que escrita em proposta é
"só do autor ou de um manager"; com o viewer somente leitura, todo autor é manager, e
qualquer manager pode editar proposta de qualquer um — a regra deixa de restringir
alguma coisa.

Não é bloqueante e não muda arquitetura, mas muda o trabalho: ou a verificação de
autoria sai (e com ela o teste que a §12.5 mandou criar), ou o que se queria dizer é
que **um manager só edita as próprias propostas**. Está registrado como ressalva
dentro do próprio FR-029.

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
