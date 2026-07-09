# Feature Specification: Módulo Estoque (filtros e produtos químicos)

**Feature Branch**: `001-modulo-estoque`

**Created**: 2026-07-07

**Status**: Draft

**Input**: User description: "PLANO_MODULO_ESTOQUE.md — módulo de estoque focado em filtros e produtos químicos: cadastro de itens, aba de resumo com saldos e botão de movimentação, movimentações de entrada (NF + lote + validade obrigatórios) e saída (projeto de destino), histórico em aba separada"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cadastrar itens de estoque (Priority: P1)

O gestor de estoque cadastra os itens que a empresa controla: **filtros** (contados por unidade) e **produtos químicos** (contados por peso). Cada item tem código interno único, nome, fabricante e campos específicos do tipo (micragem/modelo para filtro; dados de segurança para químico). Itens podem ser editados e inativados (sem exclusão física quando houver histórico).

**Why this priority**: sem catálogo de itens não existe estoque — é o pré-requisito de todas as demais histórias e já entrega valor como inventário padronizado dos materiais.

**Independent Test**: criar, editar e inativar um filtro e um produto químico; verificar que o item inativado deixa de aparecer para novas movimentações mas permanece no histórico.

**Acceptance Scenarios**:

1. **Given** o usuário é gestor do estoque, **When** cadastra um filtro com código, nome e campos do tipo, **Then** o item aparece na lista de itens com unidade "unidade".
2. **Given** o usuário cadastra um produto químico, **When** informa os dados, **Then** o item é criado com unidade de peso e os campos específicos de químico.
3. **Given** um item com código já existente, **When** o usuário tenta cadastrar outro com o mesmo código, **Then** o sistema rejeita com mensagem clara.
4. **Given** um item com movimentações, **When** o gestor o inativa, **Then** ele some das opções de nova movimentação mas o histórico e o saldo continuam consultáveis.

---

### User Story 2 - Registrar entrada de material (Priority: P1)

Ao receber material comprado, o gestor registra a **entrada**: item, quantidade, data, **número da NF, lote e data de validade**. A entrada cria/atualiza o saldo do item por lote, permitindo rastrear validade e origem.

**Why this priority**: junto com o cadastro, a entrada é o que constrói o saldo — sem ela o resumo não tem dado. NF/lote/validade são exigência explícita do negócio.

**Independent Test**: registrar uma entrada de químico com NF, lote e validade e verificar o saldo do item e do lote no resumo.

**Acceptance Scenarios**:

1. **Given** um produto químico cadastrado, **When** o gestor registra entrada informando quantidade, data, NF, lote e validade, **Then** o saldo do item aumenta e o lote fica registrado com sua validade.
2. **Given** o formulário de entrada de um produto químico, **When** o gestor tenta salvar sem NF, lote ou validade, **Then** o sistema bloqueia e aponta os campos faltantes.
3. **Given** uma segunda entrada do mesmo item com o mesmo lote, **When** registrada, **Then** a quantidade soma no lote existente (não cria lote duplicado).
4. **Given** uma entrada de **filtro**, **When** o gestor registra, **Then** a NF é obrigatória e lote/validade são **opcionais**; sem lote informado, a quantidade entra no lote avulso do item.

---

### User Story 3 - Registrar saída para projeto (Priority: P1)

Ao enviar material para uma obra, o gestor registra a **saída**: item, quantidade, **projeto de destino** e data. O sistema sugere o lote com validade mais próxima (vence primeiro, sai primeiro), permite trocar, e **impede saída maior que o saldo disponível**.

**Why this priority**: fecha o ciclo básico entrada→saída e responde a pergunta central do módulo: quanto tem e para onde foi.

**Independent Test**: com saldo criado na US2, registrar uma saída para um projeto e verificar a redução do saldo; tentar uma saída maior que o saldo e ver o bloqueio.

**Acceptance Scenarios**:

1. **Given** um item com saldo em dois lotes de validades diferentes, **When** o gestor abre o formulário de saída, **Then** o lote de validade mais próxima vem pré-selecionado, com opção de trocar.
2. **Given** um item com saldo 10, **When** o gestor tenta registrar saída de 15, **Then** o sistema bloqueia informando o saldo disponível.
3. **Given** uma saída válida, **When** registrada com projeto de destino e data, **Then** o saldo do item/lote reduz e a movimentação aparece no histórico com o projeto.
4. **Given** um filtro (contado por unidade), **When** o gestor informa quantidade fracionada, **Then** o sistema rejeita (filtros só em números inteiros).

---

### User Story 4 - Consultar resumo do estoque (Priority: P2)

Qualquer usuário com acesso ao módulo vê a aba **Resumo**: cada item com saldo atual, unidade e situação (normal / abaixo do mínimo / lote vencendo), com detalhe por lote ao expandir. Da própria aba parte o botão **"Registrar movimentação"**.

**Why this priority**: é a tela principal do módulo, mas depende dos dados criados pelas histórias P1.

**Independent Test**: com itens e movimentações existentes, conferir que os saldos exibidos batem com a soma das movimentações e que o detalhe por lote aparece.

**Acceptance Scenarios**:

1. **Given** itens com movimentações, **When** o usuário abre o Resumo, **Then** vê saldo por item calculado a partir das movimentações registradas.
2. **Given** um item expandido, **When** o usuário visualiza, **Then** vê os lotes com quantidade, validade e NF de origem.
3. **Given** um item com estoque mínimo definido e saldo abaixo dele, **When** exibido no Resumo, **Then** aparece com destaque visual de alerta.
4. **Given** um usuário com papel de consulta (viewer), **When** abre o Resumo, **Then** vê os dados mas não consegue registrar movimentações nem editar itens.

---

### User Story 5 - Consultar histórico de movimentações (Priority: P2)

Em aba separada, o usuário consulta o **histórico completo de movimentações**, com filtros por período, item, tipo (entrada/saída) e projeto. Cada linha mostra item, tipo, quantidade, data, projeto, lote/NF e quem registrou.

**Why this priority**: exigência explícita do pedido; essencial para auditoria e rastreabilidade, mas depende das movimentações existirem.

**Independent Test**: registrar movimentações variadas e verificar que os filtros retornam exatamente as movimentações esperadas.

**Acceptance Scenarios**:

1. **Given** movimentações de vários itens e projetos, **When** o usuário filtra por projeto e período, **Then** vê apenas as movimentações daquele projeto naquele período.
2. **Given** uma movimentação registrada, **When** exibida no histórico, **Then** mostra quem a registrou e quando.

---

### User Story 6 - Corrigir erros e acertar inventário (Priority: P3)

Movimentações registradas são **imutáveis**; um lançamento errado é corrigido por **estorno** (movimento inverso vinculado ao original). Além disso, o gestor registra **devolução de obra** (material que volta de projeto sem uso, sem NF nova) e **ajuste de inventário** (acerto após contagem física, com justificativa obrigatória).

**Why this priority**: a operação real produz erros de digitação, sobras de obra e divergência de contagem; sem esses mecanismos o saldo degrada e o módulo perde confiança. Não bloqueia o MVP.

**Independent Test**: estornar uma saída e verificar o saldo restaurado com vínculo visível entre as duas movimentações; registrar devolução e ajuste e conferir saldo e justificativa.

**Acceptance Scenarios**:

1. **Given** uma saída registrada por engano, **When** o gestor a estorna, **Then** o saldo é restaurado e ambas as movimentações ficam vinculadas e visíveis no histórico.
2. **Given** material que voltou de uma obra, **When** o gestor registra devolução informando o projeto de origem, **Then** o saldo aumenta sem exigir NF.
3. **Given** uma contagem física divergente, **When** o gestor registra ajuste sem justificativa, **Then** o sistema bloqueia.
4. **Given** a primeira entrega do módulo, **When** planejada, **Then** estorno, devolução de obra e ajuste de inventário fazem parte do escopo (decisão do dono do produto em 2026-07-07).

---

### Edge Cases

- Saída com quantidade exatamente igual ao saldo: permitida (saldo zera).
- Duas saídas simultâneas do mesmo lote: a validação de saldo deve valer no momento do registro (a segunda falha se exceder).
- Lote vencido com saldo: continua visível no resumo com destaque; a saída para uso em projeto a partir de lote vencido deve exigir confirmação explícita.
- Item inativado com saldo remanescente: permanece no resumo até zerar; some apenas das opções de novo cadastro de movimentação de entrada.
- Projeto encerrado/inativo: não aparece como destino de novas saídas, mas o histórico antigo permanece.
- Quantidades: filtros aceitam apenas inteiros; produtos químicos aceitam até 3 casas decimais.
- Dois lotes com a mesma validade: sugestão de saída escolhe o mais antigo (data de entrada).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE permitir cadastrar, editar e inativar itens de estoque de dois tipos — filtro (unidade) e produto químico (peso) — com código interno único, nome, fabricante, descrição, estoque mínimo opcional e localização física opcional.
- **FR-002**: Itens do tipo filtro DEVEM ter campos específicos (modelo/part number, tipo de filtro, micragem) e itens do tipo produto químico DEVEM ter campos específicos de segurança (ficha FISPQ/FDS anexável, nº ONU opcional e nº CAS opcional).
- **FR-003**: A unidade de medida de cada produto químico DEVE ser definida no cadastro do item, entre quilograma (kg) e litro (L); filtros são sempre contados em unidade.
- **FR-004**: O sistema DEVE permitir registrar movimentação de **entrada** com item, quantidade, data e número da NF obrigatórios; para produto químico, lote e data de validade também obrigatórios; para filtro, lote e validade opcionais (sem lote, a quantidade entra no lote avulso do item).
- **FR-005**: O sistema DEVE permitir registrar movimentação de **saída** com item, quantidade, projeto de destino e data obrigatórios.
- **FR-006**: O saldo DEVE ser controlado **por lote**: entradas criam ou somam em lotes; saídas debitam de um lote específico, com sugestão automática do lote de validade mais próxima (FEFO) e possibilidade de troca manual.
- **FR-007**: O sistema DEVE impedir qualquer movimentação que deixe saldo negativo em item ou lote, informando o saldo disponível.
- **FR-008**: O saldo exibido DEVE ser sempre derivado da soma das movimentações registradas (fonte de verdade única), nunca um valor editável.
- **FR-009**: O sistema DEVE registrar automaticamente em cada movimentação o usuário que a registrou e a data/hora do registro.
- **FR-010**: Movimentações DEVEM ser imutáveis; correções ocorrem por estorno (movimento inverso vinculado ao original), restrito ao papel de gestor.
- **FR-011**: A aba Resumo DEVE listar cada item com saldo atual, unidade, situação de alerta (abaixo do mínimo, lote vencendo/vencido) e detalhe por lote, além do acesso direto ao registro de movimentação.
- **FR-012**: A aba de histórico DEVE listar as movimentações com filtros por período, item, tipo e projeto, exibindo item, tipo, quantidade, data, projeto, lote, NF e autor.
- **FR-013**: O acesso DEVE ser controlado por papéis do módulo: gestor (cadastra itens e movimenta) e consulta (somente leitura).
- **FR-014**: Quantidades DEVEM respeitar o tipo do item: inteiros para filtro, decimais (até 3 casas) para produto químico; o formulário de movimentação DEVE exibir a unidade do item ao lado da quantidade para conferência.
- **FR-015**: A movimentação de saída DEVE permitir registrar o solicitante/responsável pelo material (opcional) e observações livres.
- **FR-016**: A movimentação de entrada DEVE permitir registrar fornecedor (opcional) e custo unitário (opcional, sem cálculo de relatórios nesta entrega).
- **FR-017**: Itens e movimentações DEVEM permanecer consultáveis mesmo após inativação do item ou encerramento do projeto relacionado.

### Key Entities

- **Item de Estoque**: material controlado (filtro ou produto químico); código único, nome, tipo, unidade de medida, estoque mínimo, campos específicos por tipo (incluindo CAS para químico), situação ativo/inativo.
- **Lote**: agrupamento de quantidade de um item recebido com mesma identificação de lote; carrega validade, NF e fornecedor de origem; pertence a um item.
- **Movimentação**: registro imutável de entrada, saída ou acerto; quantidade, data, tipo/motivo, lote, projeto relacionado (destino na saída, origem na devolução), NF, autor do registro, observações; pertence a um item e a um lote.
- **Projeto** (existente): destino das saídas e origem das devoluções; reutilizado do cadastro atual de projetos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O gestor registra uma movimentação completa (entrada ou saída) em menos de 1 minuto a partir da aba Resumo.
- **SC-002**: 100% das saídas registradas ficam associadas a um projeto de destino e a um lote rastreável até a NF de origem (quando a entrada exigiu NF).
- **SC-003**: O saldo exibido no Resumo confere com a soma das movimentações em 100% dos casos (nenhum caminho permite divergência).
- **SC-004**: Nenhuma movimentação consegue deixar saldo negativo, mesmo com dois usuários registrando ao mesmo tempo.
- **SC-005**: Um usuário encontra qualquer movimentação dos últimos 12 meses em menos de 30 segundos usando os filtros do histórico.
- **SC-006**: O módulo é utilizável integralmente em celular (todas as ações de cadastro, movimentação e consulta) sem scroll horizontal.

## Assumptions

- **Papéis**: dois papéis bastam na primeira entrega — gestor (tudo) e consulta (somente leitura), espelhando o padrão do módulo Equipamentos. Um papel intermediário "operador" (movimenta mas não cadastra) fica para quando houver demanda real.
- **Correção de erros**: o mecanismo padrão é estorno (não edição/exclusão de movimentação), por ser mais seguro para auditoria.
- **Custo unitário**: campo opcional na entrada desde já, mas valorização de estoque e relatórios de custo ficam fora desta entrega.
- **Alertas por e-mail** (estoque mínimo, validade próxima): fora desta entrega; o Resumo já exibe os destaques visuais e o modelo de dados (estoque mínimo, validade por lote) já suporta os alertas futuros.
- **Integrações futuras** (baixa automática via Romaneio, custo por projeto no Acompanhamento): fora de escopo; nada nesta entrega pode impedi-las.
- **Usuários e projetos existentes são reutilizados**: o módulo usa o cadastro de projetos e o sistema de contas/papéis já existentes no app.
- **Volume**: estoque de dezenas a poucas centenas de itens e milhares de movimentações/ano — sem exigência de otimizações especiais além dos padrões do app.
