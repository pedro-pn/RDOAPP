# Feature Specification: Custos manuais no Acompanhamento

**Feature Branch**: `feature/acompanhamento-manual-project-cost`

**Created**: 2026-07-21

**Status**: Ready

**Input**: User description: "Adicionar custos manuais no dashboard de projeto do Acompanhamento para que gestores lancem valores pagos pelo cliente que devem compor o custo realizado mesmo sem Omie."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lançar custo manual em um projeto (Priority: P1)

Um gestor do Acompanhamento abre o dashboard de uma missão individual e registra um custo que deve entrar no acompanhamento, mesmo não existindo como compra no Omie.

**Why this priority**: Este é o fluxo principal solicitado; sem ele o projeto continua com custo realizado menor do que o custo gerencial real.

**Independent Test**: Autenticar como gestor, abrir um projeto individual, preencher descrição, valor, data opcional e observação opcional, salvar e confirmar que o custo aparece na lista do projeto.

**Acceptance Scenarios**:

1. **Given** um gestor no dashboard de uma missão individual, **When** informa descrição e valor positivo e salva, **Then** o custo é persistido e exibido no bloco "Custos manuais".
2. **Given** um formulário de custo manual, **When** descrição vazia, valor inválido ou data inválida é enviada, **Then** o sistema bloqueia o envio com mensagem de validação.
3. **Given** um usuário sem permissão de gestor do Acompanhamento, **When** tenta criar custo manual pela API, **Then** a operação é negada.

---

### User Story 2 - Considerar custo manual nos totais do acompanhamento (Priority: P1)

Qualquer usuário com acesso ao Acompanhamento visualiza os totais de consumo incluindo os custos manuais já lançados.

**Why this priority**: O lançamento manual só gera valor operacional se entrar nos indicadores usados na reunião semanal de acompanhamento.

**Independent Test**: Com um custo manual salvo para um projeto, consultar cards, dashboard e detalhe do projeto e verificar que o total realizado inclui o custo manual sem alterar o total vindo do Omie.

**Acceptance Scenarios**:

1. **Given** um projeto com custo Omie, consumo de estoque e custo manual, **When** o dashboard é calculado, **Then** o custo realizado soma as três fontes e preserva o valor Omie separado.
2. **Given** um agrupamento de missões, **When** há custos manuais em membros do grupo, **Then** o detalhe consolidado soma e lista os custos dos membros.
3. **Given** um filtro por categoria Omie, **When** o dashboard é exibido, **Then** o resultado filtrado continua refletindo apenas a origem Omie daquela categoria.

---

### User Story 3 - Remover lançamento incorreto (Priority: P2)

Um gestor remove um custo manual lançado por engano sem perder rastreabilidade básica.

**Why this priority**: Erros de digitação ou duplicidade são esperados em lançamentos manuais e precisam de correção sem exclusão física.

**Independent Test**: Criar um custo manual, remover pelo dashboard e verificar que ele sai dos totais e permanece como registro soft-deleted no banco.

**Acceptance Scenarios**:

1. **Given** um custo manual existente, **When** o gestor aciona excluir, **Then** o custo é marcado como removido e deixa de compor os totais.
2. **Given** um custo já removido ou de outro projeto, **When** a API recebe uma remoção, **Then** responde que o custo não foi encontrado.

---

### User Story 4 - Descobrir o novo recurso (Priority: P3)

Um gestor do Acompanhamento descobre a funcionalidade no primeiro acesso durante a janela de divulgação.

**Why this priority**: A constitution exige campanha temporária para funções visíveis novas.

**Independent Test**: Simular primeiro acesso antes de 2026-07-31 e confirmar aviso Driver.js; marcar como visto e confirmar que não reaparece para o mesmo usuário/browser; simular acesso após 2026-07-31 e confirmar que não aparece.

**Acceptance Scenarios**:

1. **Given** gestor que ainda não viu a novidade, **When** abre o dashboard de missão individual até 2026-07-31, **Then** vê um aviso centralizado e tutorial apontando o bloco real de custos manuais.
2. **Given** a data global posterior a 2026-07-31, **When** qualquer usuário abre o dashboard, **Then** o aviso não aparece.

### Edge Cases

- Projetos excluídos ou inexistentes não aceitam criação de custo manual.
- Valores nulos, zero, negativos, não numéricos ou acima do limite operacional são rejeitados.
- Textos com espaços repetidos são normalizados antes de persistir.
- Agrupamentos exibem custos manuais consolidados, mas criação permanece restrita à missão individual.
- Remoção é soft delete para evitar perda operacional do histórico.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE permitir que gestores do Acompanhamento criem custos manuais para uma missão individual.
- **FR-002**: O sistema DEVE validar descrição obrigatória, valor positivo, data opcional válida e observação opcional antes de persistir.
- **FR-003**: O sistema DEVE negar criação e remoção para usuários sem permissão de gestor do Acompanhamento.
- **FR-004**: O sistema DEVE persistir custos manuais com projeto, descrição, valor, data opcional, observação opcional, criador e carimbos de criação/atualização.
- **FR-005**: O sistema DEVE remover custos manuais por soft delete e excluir registros removidos de todos os cálculos.
- **FR-006**: O sistema DEVE somar custos manuais ao custo realizado total dos cards, dashboard e detalhe do projeto.
- **FR-007**: O sistema DEVE manter separado o total de compras do Omie para não confundir origem sincronizada com lançamento manual.
- **FR-008**: O sistema DEVE incluir custos manuais na lista de maiores gastos do detalhe do projeto.
- **FR-009**: O sistema DEVE consolidar custos manuais em agrupamentos de missões.
- **FR-010**: O sistema DEVE exibir campanha temporária de novidade por Driver.js para o público impactado, com validade global até 2026-07-31.
- **FR-011**: O sistema DEVE manter o formulário de criação recolhido por padrão e exibir o valor digitado com máscara monetária brasileira.

### Visual/UI Contract *(mandatory if feature touches frontend)*

| Surface | Existing reference inspected | Components/classes to use | Form/dropdown pattern | Navigation persistence | Novelty/tutorial contract | Responsive/overflow contract |
|---------|------------------------------|---------------------------|-----------------------|------------------------|---------------------------|------------------------------|
| Bloco "Custos manuais" no dashboard do projeto | `frontend/src/components/projects/ProjectDetailDashboard.tsx`, padrão dos cards `.page-card` e formulários `field-group` | `mini-btn`, `field-group`, `form-error`, `.acp-manual-costs`, `.acp-manual-cost-list` | `react-hook-form` com resolver Zod; labels explícitos; descrição em linha cheia; valor e data dividem a segunda linha; observação em linha cheia; valor com máscara `R$ 1.234,56`; formulário recolhido por padrão atrás de botão; erros por campo; sem dropdown | N/A; o detalhe de projeto já é aberto pelo fluxo existente do Acompanhamento | Driver.js em `ProjectManualCostNovelty`, visto em `localStorage` por usuário/browser, expiração global em 2026-07-31, tutorial apontando `[data-acp-manual-cost-add]` | Lista empilha no mobile; formulário vira uma coluna até 860px; grid/flex com `min-width: 0`; textos, botões e valores quebram/empilham sem scroll horizontal |

### Key Entities *(include if feature involves data)*

- **ProjectManualCost**: lançamento gerencial de custo para um projeto; contém descrição, valor, data opcional, observação opcional, criador, soft delete e timestamps.
- **Project**: projeto/missão existente que recebe os custos manuais e tem os totais recalculados.
- **User**: usuário criador do lançamento, usado para rastreabilidade visual.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um gestor consegue lançar um custo manual válido em menos de 1 minuto a partir do dashboard do projeto.
- **SC-002**: Após salvar ou remover um custo manual, cards, dashboard e detalhe refletem o novo total sem recarregar manualmente a página.
- **SC-003**: 100% dos custos manuais ativos entram no total realizado e 0% dos custos removidos entram no cálculo.
- **SC-004**: Usuários sem permissão de gestor não conseguem criar ou remover custos manuais pela interface nem pela API.
- **SC-005**: O aviso de novidade aparece no máximo uma vez por usuário/browser e nunca após 2026-07-31.
- **SC-006**: O formulário de custo manual não ocupa espaço visual até o gestor clicar em "Adicionar custo", e o valor digitado aparece em formato monetário pt-BR antes de salvar.

## Assumptions

- Custos manuais são raros e podem ser listados diretamente no detalhe do projeto sem paginação na primeira versão.
- A criação de custos manuais em agrupamentos não é necessária; gestores devem lançar no projeto membro correto.
- O valor manual é custo gerencial e não altera registros vindos do Omie nem cria contas a pagar.
- O histórico operacional é preservado por soft delete, sem auditoria dedicada nesta primeira versão.
