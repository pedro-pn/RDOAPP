# Feature Specification: Efetivo Operacional — Planejamento Completo

**Feature Branch**: `feat/efetivo-operacional`

**Created**: 2026-08-21

**Status**: Draft

**Input**: User description: "Completar o módulo Efetivo Operacional conforme o exemplo funcional fornecido em https://efetivo-operacional.erikesimas.chatgpt.site/, incluindo Visão geral, Calendário, Colaboradores, Missões, Evolução das missões, Simulações e Administração, integrado à Produtividade já entregue."

## Contexto e limite desta expansão

A feature 011 entregou a primeira etapa do módulo: Produtividade, férias, classificação de funções operacionais e permissões. Esta expansão cobre as áreas de planejamento operacional que a especificação anterior classificou como futuras. O site de referência define os fluxos e conceitos de negócio, mas a identidade visual, autenticação, papéis e fontes de dados continuam sendo os do APP.

A produtividade realizada e a capacidade planejada permanecem indicadores distintos. Horas produtivas vêm automaticamente do ponto sincronizado; o planejamento usa dias úteis, missões, alocações, ausências e feriados. Não haverá lançamento manual de HH.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver a capacidade operacional em uma data (Priority: P1)

Como gestor do Efetivo, quero abrir uma visão geral posicionada em uma data para saber quantas pessoas estão ativas, alocadas, indisponíveis ou livres e onde há déficit por função.

**Why this priority**: é a síntese que transforma os cadastros do módulo em decisão diária de mobilização e contratação.

**Independent Test**: escolher uma data com missões e ausências cadastradas e reproduzir os totais da visão geral a partir das pessoas e demandas listadas.

**Acceptance Scenarios**:

1. **Given** colaboradores operacionais ativos, missões confirmadas e ausências na data, **When** o gestor abre a visão geral, **Then** vê efetivo ativo, alocados, indisponíveis, livres e déficit sem dupla contagem.
2. **Given** uma função cuja demanda confirmada supera as pessoas disponíveis, **When** a capacidade por função é calculada, **Then** a função aparece com o déficit exato.
3. **Given** uma data futura selecionada, **When** a página é recarregada, **Then** a mesma posição e os mesmos filtros permanecem aplicados.
4. **Given** mobilizações futuras, **When** o gestor abre a visão geral, **Then** vê as próximas missões, equipe planejada e vagas pendentes.

---

### User Story 2 - Planejar missões e alocar pessoas (Priority: P1)

Como planejador, quero cadastrar a programação de uma missão, definir a demanda por função e alocar colaboradores disponíveis para montar a equipe sem conflitos.

**Why this priority**: missões e alocações por pessoa são a fonte da capacidade futura, do calendário, dos alertas e das simulações.

**Independent Test**: criar uma missão com datas e demanda por duas funções, alocar pessoas elegíveis e confirmar que a missão fica completa e aparece nas demais áreas.

**Acceptance Scenarios**:

1. **Given** um projeto existente, **When** o gestor cria sua programação operacional, **Then** seleciona o responsável da sede entre contas ativas de coordenador e informa etapa, situação, mobilização, execução, retorno e quantidade exigida por função.
2. **Given** vagas abertas, **When** o gestor consulta disponíveis, **Then** recebe apenas colaboradores ativos, da função correta e sem ausência ou outra missão conflitante.
3. **Given** um colaborador já comprometido no período, **When** o gestor tenta alocá-lo, **Then** o sistema recusa e identifica o conflito.
4. **Given** vagas e candidatos elegíveis, **When** o gestor usa "Alocar disponíveis", **Then** o sistema preenche até o limite possível e mantém visível qualquer déficit restante.
5. **Given** uma missão alterada, **When** datas ou demanda mudam, **Then** todas as alocações afetadas são revalidadas antes da confirmação.

---

### User Story 3 - Consultar o calendário integrado (Priority: P1)

Como gestor, quero visualizar missões e indisponibilidades em calendário diário, semanal ou mensal para antecipar sobreposições e janelas livres.

**Why this priority**: a programação precisa ser compreendida no tempo, não apenas em listas de missões.

**Independent Test**: cadastrar uma missão e uma ausência e conferir ambas nas três visões do calendário, com filtro por função.

**Acceptance Scenarios**:

1. **Given** programações no período, **When** o gestor abre o calendário mensal, **Then** missões, férias, folgas e afastamentos aparecem com legenda e identificação suficiente.
2. **Given** uma função selecionada, **When** o filtro é aplicado, **Then** o calendário mostra apenas eventos que envolvam aquela função.
3. **Given** um dia com vários eventos, **When** o gestor abre o dia, **Then** vê todas as missões, pessoas ausentes, vagas e conflitos daquela data.
4. **Given** a troca entre dia, semana e mês, **When** a página é recarregada, **Then** data, visão e filtro permanecem na URL.

---

### User Story 4 - Gerir colaboradores e indisponibilidades no módulo (Priority: P1)

Como gestor, quero pesquisar e manter o efetivo na própria área operacional, vendo função, situação na data, admissão, férias e alocação futura.

**Why this priority**: o planejamento depende de uma base de pessoas confiável e acessível no mesmo contexto.

**Independent Test**: cadastrar ou editar um colaborador, programar uma indisponibilidade e conferir sua situação e impacto no calendário/capacidade.

**Acceptance Scenarios**:

1. **Given** a lista de colaboradores, **When** o gestor pesquisa por nome, filtra por função ou muda a data, **Then** a lista e os totais refletem o recorte.
2. **Given** um colaborador, **When** o gestor consulta sua linha ou card, **Then** vê função, situação na data, taxa planejada dos próximos 90 dias, admissão e alerta de férias.
3. **Given** permissão de gestão, **When** o usuário cadastra ou edita nome, função, admissão, desligamento e observação, **Then** a alteração passa a valer em todas as áreas do APP.
4. **Given** férias, folga ou afastamento, **When** o gestor programa o período, **Then** a pessoa fica indisponível nas datas e não pode ser alocada em missão conflitante.
5. **Given** uma ausência sobreposta a uma alocação existente, **When** o gestor tenta salvar, **Then** recebe o conflito e decide corrigi-lo antes de confirmar.

---

### User Story 5 - Acompanhar a evolução das missões (Priority: P2)

Como gestor, quero mover cada missão entre Stand by, Mobilização, Execução, Medição final e Finalizada para acompanhar o ciclo operacional em um kanban.

**Why this priority**: a etapa atual conecta planejamento, execução e encerramento sem criar um controle paralelo em planilhas.

**Independent Test**: mover uma missão por todas as etapas e conferir persistência, histórico e reflexo nas listas após recarregar.

**Acceptance Scenarios**:

1. **Given** missões em etapas diferentes, **When** o kanban é aberto, **Then** cada coluna exibe contagem, descrição e cartões correspondentes.
2. **Given** um cartão, **When** o gestor o arrasta ou usa alternativa acessível para outra etapa, **Then** a mudança só persiste ao concluir a ação e fica auditada.
3. **Given** uma mudança cancelada, **When** o usuário abandona o arraste, **Then** o cartão retorna à posição e etapa iniciais.
4. **Given** uma missão finalizada, **When** ela é consultada, **Then** equipe, responsável e programação histórica continuam visíveis em leitura.

---

### User Story 6 - Simular capacidade antes de alterar o oficial (Priority: P2)

Como planejador, quero testar contratações hipotéticas e mudanças de missões em um cenário isolado para comparar déficit e utilização antes de aplicar decisões.

**Why this priority**: permite avaliar alternativas sem corromper a programação oficial.

**Independent Test**: criar um cenário com contratação hipotética, comparar com a capacidade atual e aplicá-lo, verificando que nada muda antes da confirmação.

**Acceptance Scenarios**:

1. **Given** a programação oficial, **When** um cenário é criado, **Then** alterações de demanda, datas e contratações permanecem isoladas.
2. **Given** um cenário, **When** o gestor compara capacidade, **Then** vê lado a lado déficit, pessoas livres e utilização por função no oficial e no cenário.
3. **Given** um cenário válido, **When** o gestor confirma "Validar e aplicar", **Then** as mudanças são aplicadas em conjunto e auditadas.
4. **Given** conflitos ou dados desatualizados desde a criação, **When** a aplicação é solicitada, **Then** nada é aplicado parcialmente e os conflitos são apresentados.

---

### User Story 7 - Administrar regras e rastrear alterações (Priority: P2)

Como administrador do módulo, quero configurar funções, cores, metas, prazos e feriados e consultar a atividade recente para manter o planejamento governado.

**Why this priority**: capacidade e alertas só são confiáveis quando as regras são explícitas e as alterações rastreáveis.

**Independent Test**: alterar uma regra de função, cadastrar um feriado e confirmar seu efeito no planejamento e sua entrada no histórico.

**Acceptance Scenarios**:

1. **Given** uma função operacional, **When** o gestor altera cor de calendário ou prazo de folga, **Then** as telas passam a usar a nova configuração.
2. **Given** um feriado cadastrado, **When** a utilização planejada é calculada, **Then** esse dia não entra como capacidade disponível.
3. **Given** usuários com papéis do módulo, **When** a administração é aberta, **Then** administradores veem papéis e atividade; viewers não recebem ações de escrita.
4. **Given** criação, edição, exclusão lógica, alocação, mudança de etapa ou aplicação de cenário, **When** a ação termina, **Then** autor, data, tipo e alvo ficam registrados.

---

### User Story 8 - Receber alertas de férias e permanência em obra (Priority: P2)

Como gestor, quero ver férias a programar/vencidas e folgas exigidas por permanência contínua em obra para agir antes que a escala fique crítica.

**Why this priority**: os alertas materializam regras já confirmadas pela empresa e evitam decisões tardias.

**Independent Test**: criar uma alocação que ultrapasse o prazo da função e um colaborador sem férias no período esperado, confirmando os alertas e suas datas-limite.

**Acceptance Scenarios**:

1. **Given** permanência contínua que alcança o limite configurado da função, **When** a visão geral é aberta, **Then** o colaborador aparece com dias previstos e prazo para programar folga.
2. **Given** ao menos um dia civil inteiro sem alocação ou uma folga registrada, **When** a permanência é recalculada, **Then** a contagem contínua reinicia na mobilização seguinte; missões adjacentes permanecem na mesma sequência.
3. **Given** um período aquisitivo concluído sem férias registradas na janela concessiva, **When** a lista é aberta, **Then** aparece "Férias vencidas" com a data de prazo.
4. **Given** prazo de férias dentro dos próximos 120 dias e sem período programado, **When** a lista é aberta, **Then** aparece "Programar férias"; o alerta é informativo e não substitui validação jurídica/folha.

---

### User Story 9 - Manter a Produtividade realizada separada do planejamento (Priority: P1)

Como gestor, quero continuar consultando a Improdutividade Real baseada no ponto dentro do módulo completo sem confundi-la com taxa de alocação futura.

**Why this priority**: a expansão não pode alterar o indicador oficial já entregue nem reintroduzir entrada manual de horas.

**Independent Test**: comparar os resultados antes e depois da expansão e confirmar que só horas normais sincronizadas compõem a produtividade.

**Acceptance Scenarios**:

1. **Given** o módulo expandido, **When** Produtividade é aberta, **Then** fórmulas, filtros, pendências, detalhes e referência mensal continuam funcionando como na feature 011.
2. **Given** qualquer tela do módulo, **When** o usuário procura uma ação de lançamento de HH, **Then** ela não existe.
3. **Given** uma mudança em missões ou simulações, **When** a Improdutividade Real é recalculada, **Then** o número não muda sem novos dados do ponto.

### Edge Cases

- Uma pessoa não pode ser contada simultaneamente como livre, alocada e indisponível na mesma data; indisponibilidade prevalece e gera conflito se houver alocação.
- Missões em rascunho aparecem para planejamento, mas não consomem capacidade oficial até serem confirmadas.
- Datas devem obedecer `mobilização ≤ início da execução ≤ fim da execução ≤ retorno`.
- Alterar datas ou demanda pode invalidar alocações; a confirmação deve ser bloqueada até resolver os conflitos.
- Colaborador admitido ou desligado no meio da janela só oferece capacidade dentro do vínculo ativo.
- Sábados, domingos e feriados cadastrados não entram na capacidade de dias úteis, mas continuam visíveis no calendário.
- Ausências parciais por hora não fazem parte desta expansão; períodos são contabilizados por dia inteiro.
- Missão sem demanda por função pode permanecer rascunho, mas não pode ser confirmada.
- Aplicação concorrente de cenário deve detectar que a programação oficial mudou desde a comparação.
- Nenhum colaborador elegível ou nenhuma missão na janela deve produzir estados vazios claros, nunca percentuais enganosos.
- Nomes de funções longos, números grandes e muitos eventos no mesmo dia não podem criar scroll horizontal da página.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O módulo Efetivo Operacional DEVE conter as seções Visão geral, Calendário, Colaboradores, Missões, Evolução das missões, Simulações, Produtividade e Administração.
- **FR-002**: Usuários `efetivo:viewer` DEVEM consultar todas as áreas; apenas `efetivo:manager` ou administrador DEVE criar ou alterar dados operacionais.
- **FR-003**: A Visão geral DEVE aceitar uma data de posição e calcular efetivo ativo, alocados, indisponíveis, livres e déficit sem dupla contagem.
- **FR-004**: A capacidade diária DEVE ser detalhada por função operacional, mostrando demanda, alocados, livres, indisponíveis e déficit.
- **FR-005**: A Visão geral DEVE listar próximas mobilizações, quantidade exigida/alocada e vagas pendentes.
- **FR-006**: O sistema DEVE calcular utilização planejada para uma janela móvel de 90 dias como dias úteis comprometidos em missões confirmadas divididos pelos dias úteis disponíveis do efetivo, descontando ausências e feriados.
- **FR-007**: A meta de utilização planejada DEVE ser configurável pelo gestor e nascer com 80%; ela NÃO DEVE alterar a Improdutividade Real.
- **FR-008**: O Calendário DEVE oferecer visualização por dia, semana e mês, com navegação temporal e ação "Hoje".
- **FR-009**: O Calendário DEVE combinar missões confirmadas, férias, folgas e afastamentos com legenda distinta e filtro por função.
- **FR-010**: Abrir um dia do calendário DEVE apresentar todos os eventos, pessoas, vagas e conflitos da data.
- **FR-011**: O cadastro operacional de colaborador DEVE permitir nome, função, admissão, desligamento e observação, reutilizando a mesma pessoa em todo o APP.
- **FR-012**: A lista de colaboradores DEVE permitir busca por nome, filtro por função e data de posição, mostrando situação na data, utilização dos próximos 90 dias, admissão e alerta de férias.
- **FR-013**: O sistema DEVE expor férias, folga e afastamento como tipos cadastráveis de indisponibilidade; ASO e treinamento permanecem reservados até definição futura.
- **FR-014**: Períodos invertidos ou sobrepostos para a mesma pessoa DEVEM ser recusados, e conflito com missão DEVE ser apresentado antes de salvar.
- **FR-015**: Cada missão operacional DEVE estar vinculada a um projeto existente, sem duplicar cliente, local ou identidade do contrato.
- **FR-016**: A programação da missão DEVE selecionar o responsável da sede entre contas ativas de coordenador, preencher o cargo pelo colaborador vinculado à conta quando houver, permitir cargo livre sem vínculo, identificar o vínculo como “Vincular líder” e registrar snapshots de nome/cargo, etapa, situação, mobilização, início/fim da execução e retorno.
- **FR-017**: A ordem cronológica das datas da missão DEVE ser validada antes de confirmar.
- **FR-018**: A demanda de missão DEVE ser expressa como quantidade inteira não negativa por função operacional.
- **FR-019**: A equipe planejada DEVE vincular pessoas às vagas de função da missão e impedir quantidade alocada acima da demanda sem confirmação explícita de expansão da demanda.
- **FR-020**: Um colaborador só DEVE ser elegível quando estiver ativo, pertencer à função da vaga e não tiver missão confirmada ou ausência sobreposta.
- **FR-021**: A ação "Alocar disponíveis" DEVE preencher vagas com colaboradores elegíveis e deixar explícitas as vagas não preenchidas.
- **FR-022**: Missões em rascunho NÃO DEVEM consumir capacidade oficial; missões confirmadas DEVEM consumir da mobilização ao retorno.
- **FR-023**: O ciclo de vida da missão DEVE conter Stand by, Mobilização, Execução, Medição final e Finalizada.
- **FR-024**: O kanban DEVE permitir mudança de etapa por arraste e por alternativa acessível, preservando a ordem e auditando a alteração concluída.
- **FR-025**: O cartão do kanban DEVE mostrar projeto, cliente/local, data de mobilização, responsável da sede e quantidade da equipe, com expansão para detalhes.
- **FR-026**: Cenários de simulação DEVEM permanecer isolados da programação oficial até aplicação explícita.
- **FR-027**: Um cenário DEVE aceitar contratações hipotéticas por função e data de disponibilidade, além de alterações hipotéticas de datas e demanda de missões.
- **FR-028**: A comparação do cenário DEVE mostrar capacidade, déficit e utilização no oficial e no simulado, no total e por função.
- **FR-029**: Aplicar um cenário DEVE revalidar conflitos e ocorrer de forma integral; qualquer falha impede alterações parciais.
- **FR-030**: Cenários aplicados, descartados ou superados por mudanças oficiais DEVEM manter histórico e estado final.
- **FR-031**: Cada função operacional DEVE permitir cor de calendário e prazo de folga por permanência contínua.
- **FR-032**: Os prazos iniciais de permanência DEVEM ser 90 dias para apoio, operadores e encarregados, 60 para supervisores e 30 para coordenadores e engenheiros, permitindo ajuste explícito por função.
- **FR-033**: A permanência contínua DEVE considerar missões confirmadas consecutivas sem retorno/folga suficiente e reiniciar após retorno ou folga registrada.
- **FR-034**: O sistema DEVE alertar folgas a programar com pessoa, função, missão, dias contínuos previstos e data-limite.
- **FR-035**: O alerta de férias DEVE usar admissão e períodos cadastrados: janela concessiva encerrada sem férias gera "Férias vencidas"; prazo dentro de 120 dias sem férias futuras gera "Programar férias".
- **FR-036**: A Administração DEVE permitir cadastrar feriados com data, nome e abrangência global; feriados DEVEM sair dos dias úteis de capacidade.
- **FR-037**: A Administração DEVE exibir funções operacionais, usuários com papéis do módulo, parâmetros e atividade recente, respeitando permissões.
- **FR-038**: Toda criação, alteração, exclusão lógica, alocação, mudança de etapa e aplicação de cenário DEVE registrar autor, data, ação e alvo.
- **FR-039**: Estado compartilhável de seção, data, visão, função, missão, colaborador e cenário DEVE sobreviver ao refresh por parâmetros de URL, exceto dados sensíveis de formulários.
- **FR-040**: Mensagens de conflito DEVEM identificar pessoa, período e origem do conflito e oferecer caminho para o registro correspondente.
- **FR-041**: A Improdutividade Real DEVE manter as regras e fontes da feature 011, separada da capacidade planejada.
- **FR-042**: Nenhuma entrada manual de HH DEVE existir; horas realizadas continuam vindo exclusivamente do ponto sincronizado.
- **FR-043**: Dados de projetos, colaboradores, funções e papéis DEVEM reutilizar os cadastros existentes do APP, sem bases paralelas.
- **FR-044**: Exclusões de programação que tenham histórico DEVEM ser lógicas e permanecer na trilha de auditoria.
- **FR-045**: Todas as consultas DEVEM produzir estados vazios e indisponíveis explícitos quando faltarem dados, sem converter ausência de base em zero enganoso.

### Visual/UI Contract *(mandatory if feature touches frontend)*

O site fornecido é referência funcional, não identidade visual. Todas as superfícies seguem o shell, kit, tokens e linguagem visual do APP.

| Surface | Existing reference inspected | Components/classes to use | Form/dropdown pattern | Reorder drag/drop pattern | Navigation persistence | Novelty/tutorial contract | Responsive/overflow contract |
|---------|------------------------------|---------------------------|-----------------------|---------------------------|------------------------|---------------------------|------------------------------|
| Página e navegação interna | `EfetivoPage.tsx`, `AcompanhamentoPage.tsx` | `Shell`, `TopBar`, abas/segmentos do APP | N/A | N/A | `?section=` e parâmetros específicos | Tutorial permanente do módulo atualizado para todas as seções | Abas quebram/rolam internamente sem ampliar a página |
| Visão geral | `SedeCostsBoard.tsx`, dashboards do Acompanhamento | cards de KPI, skeletons, badges e tokens globais | data com `field-group` | N/A | `?data=` | campanha de 10 dias para capacidade planejada | cards com `minmax(min(100%, ...), 1fr)`; números quebram/truncam |
| Calendário | padrões de filtros e cards existentes | `Button`, selects globais, cards/tokens | selects nativos estilizados ou dropdown compartilhado | N/A | `?view=&data=&funcao=` | tutorial temporário apontando visão/filtros/dia | grade mensal fica contida; no mobile usa agenda empilhada, sem scroll da página |
| Colaboradores e ausências | `GestorPage.tsx`, `CollaboratorForm.tsx`, `AbsenceFormModal.tsx` | `SearchBar`, `Modal`, `Button`, `ConfirmDialog`, `Toast` | react-hook-form + resolver Zod; `.field-invalid`/`.field-error` | N/A | `?data=&funcao=&colaborador=` | novidade de 10 dias para situação/alocação | tabela vira cards; ações empilham; textos longos não alargam viewport |
| Missões e alocações | formulários e cards de projetos do Acompanhamento | `Modal`, `Button`, `ConfirmDialog`, `Toast`, componentes de busca | react-hook-form + resolver Zod; combobox compartilhado para pessoas | N/A | `?missao=` | tutorial temporário para demanda e alocação | formulário em uma coluna no mobile; rodapé fixo e corpo rolável |
| Kanban | `ProjectCardsBoard.tsx` e padrão constitucional de drag/drop | cards, handle dedicado e menu acessível | N/A | handle; reordenação ao vivo; placeholder/legenda; ghost; cancelar restaura; persiste só no drop; Pointer Events | `?section=evolucao&missao=` | tutorial temporário apontando handle e alternativa acessível | colunas viram seletor + lista no mobile, sem scroll horizontal de página |
| Simulações | cards e modais de planejamento do APP | cards comparativos, `Modal`, `ConfirmDialog`, `Toast` | react-hook-form + resolver Zod | N/A | `?cenario=` | tutorial temporário para comparar/aplicar | comparativo vira blocos empilhados no mobile |
| Administração e auditoria | `JobRoleManager.tsx`, telas admin existentes | componentes do kit, tokens, lista de atividade | validação compartilhada e campos globais | apenas se houver ordenação de função, usando padrão compartilhado | `?adminTab=` quando aplicável | novidade de 10 dias para parâmetros/feriados | listas e parâmetros viram cards em 390 px |

### Key Entities *(include if feature involves data)*

- **Programação operacional da missão**: complemento do projeto com etapa, situação, datas, responsável e demanda por função.
- **Necessidade por função**: quantidade de pessoas de uma função exigida por uma missão.
- **Alocação planejada**: vínculo entre colaborador, missão e função ocupada durante a programação.
- **Cenário de simulação**: conjunto isolado de alterações hipotéticas de missões e contratações, com versão da programação usada como base.
- **Contratação hipotética**: capacidade adicional por função disponível a partir de uma data, existente somente no cenário até aplicação.
- **Feriado operacional**: dia sem capacidade útil, com nome e abrangência global.
- **Configuração de função**: classificação operacional, cor de calendário e prazo de folga contínua.
- **Evento de auditoria do Efetivo**: autoria e contexto de toda alteração relevante do planejamento.
- **Indisponibilidade**: férias, folga ou afastamento que bloqueia alocação por dia inteiro.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Para uma data com até 500 colaboradores e 100 missões na janela, o gestor visualiza capacidade e déficit em até 3 segundos após abrir ou trocar a posição.
- **SC-002**: Os totais de alocados, indisponíveis, livres e déficit são reproduzíveis manualmente a partir das listas de pessoas, missões e ausências, sem divergência.
- **SC-003**: Um gestor consegue criar uma missão, definir demanda e montar uma equipe elegível em menos de 5 minutos sem planilha externa.
- **SC-004**: 100% das tentativas de dupla alocação ou alocação sobre ausência são bloqueadas antes da confirmação e identificam a origem do conflito.
- **SC-005**: Dia, semana, mês, função, missão e cenário selecionados permanecem após recarregar ou compartilhar a URL.
- **SC-006**: Um cenário pode ser criado, comparado e descartado sem alterar nenhum número ou registro da programação oficial.
- **SC-007**: 100% das alterações de programação, alocação, etapa, parâmetros e cenários aplicados aparecem na atividade com autor e data.
- **SC-008**: A Improdutividade Real apresenta os mesmos resultados para a mesma base de ponto antes e depois desta expansão.
- **SC-009**: Todas as oito seções funcionam em viewport de 390 px sem scroll horizontal de página e com todas as ações acessíveis por toque e teclado.
- **SC-010**: A visão geral identifica todas as funções deficitárias e todas as próximas missões com vagas pendentes dentro da janela apresentada.

## Assumptions

- O projeto/contrato existente continua sendo a identidade da missão; o módulo adiciona planejamento de pessoas, sem criar cadastro comercial paralelo.
- Dia útil significa segunda a sexta-feira, excluindo feriados globais cadastrados e indisponibilidades da pessoa.
- Missões confirmadas consomem capacidade do dia de mobilização ao dia de retorno, inclusive; rascunhos aparecem apenas nas áreas de planejamento.
- Ausências são de dia inteiro nesta expansão.
- A regra de férias é um alerta operacional derivado dos dados cadastrados e não substitui a validação legal ou o sistema de folha.
- O alvo inicial de utilização é 80%, configurável; ele não é meta da Improdutividade Real.
- Produtividade continua automática pelo Ponto Mais e não oferece lançamento manual de HH, mesmo que o site de referência demonstre esse botão.
- Papéis `efetivo:manager` e `efetivo:viewer` permanecem; os rótulos de perfil do protótipo não criam um segundo modelo de acesso.
- ASO e treinamento continuam reservados até existirem regras de bloqueio e origem de dados confirmadas.
