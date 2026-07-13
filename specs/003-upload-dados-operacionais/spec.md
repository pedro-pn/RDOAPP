# Feature Specification: Dados Operacionais no Upload Manual de Relatórios

**Feature Branch**: `003-upload-dados-operacionais`

**Created**: 2026-07-13

**Updated**: 2026-07-13 — (1) dados operacionais valem também para relatórios somente serviço (RTP, RLQ etc.) enviados por upload manual: colaboradores e horário trabalhado devem contabilizar no custo de mão de obra do Acompanhamento. (2) Relatórios somente serviço criados pelo fluxo normal do app não exigem jornada (só colaborador e data), mas cada serviço registra hora de início e término — o custo de mão de obra deve considerar esses horários como horas trabalhadas desses relatórios. (3) RDO adicionado manualmente deve permitir stand-by; a edição de relatório manual deve ser inline e pode seguir a estrutura visual da edição de RDO do app, sem botão separado "Completar dados", mantendo edição de colaboradores disponível e ocultando observações, anexos de fotos e a opção de adicionar serviço.

**Status**: Draft

**Input**: User description: "Adicionar dados operacionais ao upload manual de relatórios (PDF) no módulo de Relatórios: junto com o PDF de relatórios antigos feitos manualmente, o usuário poderá informar horário de saída, horário de entrada, colaboradores participantes e indicação de turno noturno (com as mesmas opções do fluxo normal de relatórios). Esses dados devem refletir no módulo de Acompanhamento de Projetos: o cálculo de salários/custos de mão de obra deve passar a considerar essas informações dos relatórios enviados por upload manual, da mesma forma que considera os relatórios criados normalmente no app."

## Contexto

Hoje o upload manual de relatórios (usado para digitalizar relatórios antigos feitos fora do app) grava o relatório com horários zerados (`00:00`), sem colaboradores vinculados e sem turno noturno. Por consequência, esses relatórios não alimentam o cálculo de custo de mão de obra do módulo Acompanhamento de Projetos: os dias de obra correspondentes ficam classificados como "sede/sobra" em vez de serem atribuídos ao projeto, distorcendo o custo real das obras antigas.

O fluxo normal de criação de RDO já captura horário de chegada, horário de saída, intervalo de almoço, colaboradores participantes, turno noturno (habilitado/desabilitado, com início, término, intervalo e colaboradores próprios do noturno) e stand-by (tempo total e motivo), e a partir desses dados calcula as horas trabalhadas diurnas e noturnas que o Acompanhamento consome. Esta feature leva a mesma captura para o upload manual — de RDOs **e** de relatórios somente serviço (RTP, RLQ, RCPU, RLM, RLI, RLF) — com uma ressalva: stand-by é opção de RDO manual.

A edição posterior de um relatório de upload manual passa a ser tratada como um modo inline da página de detalhe/edição. Ela pode usar a mesma organização visual do RDO criado no app, mas com restrições do fluxo manual: a página deve permitir corrigir dados operacionais e colaboradores, sem expor campos de observação, anexos de fotos ou a opção de adicionar serviço.

Observação de escopo: hoje o cálculo de mão de obra do Acompanhamento considera apenas relatórios do tipo RDO. O cálculo passa a considerar também relatórios somente serviço, com as horas vindas de duas fontes: (a) jornada informada no upload manual (esta feature); (b) para relatórios somente serviço criados pelo fluxo normal do app — que não exigem jornada, só colaborador e data — os horários de início e término já registrados em cada serviço do relatório. As demais regras (ponto batido, período do import, rateio, desempate por dia) permanecem inalteradas.

Atenção (impacto retroativo): relatórios somente serviço já existentes no banco, criados pelo app com horários de serviço preenchidos, passarão a contabilizar custo assim que a feature entrar — dias que hoje aparecem como "Sede" migrarão para os projetos correspondentes. Esse é o comportamento desejado, mas os números históricos do Acompanhamento vão mudar.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Informar dados operacionais no upload manual (Priority: P1)

O gestor faz o upload manual do PDF de um relatório antigo — RDO ou somente serviço (RTP, RLQ etc.) — e, no mesmo formulário, informa o horário de entrada (chegada), o horário de saída, o intervalo de almoço e seleciona os colaboradores que participaram daquele dia de obra — com as mesmas opções de preenchimento do fluxo normal de criação de RDO. Quando o tipo for RDO, o formulário também permite marcar stand-by com tempo total e motivo. Ao salvar, o relatório fica registrado com as horas trabalhadas calculadas pelas mesmas regras do fluxo normal.

**Why this priority**: É o núcleo da feature — sem a captura dos dados no upload, nada reflete no Acompanhamento. Sozinha já entrega valor: relatórios antigos passam a carregar jornada e equipe.

**Independent Test**: Fazer um upload manual de RDO informando entrada 07:00, saída 17:00, almoço 01:00 e dois colaboradores; conferir que o relatório salvo exibe esses dados e as horas trabalhadas diurnas calculadas (9h), e que os dois colaboradores aparecem vinculados ao relatório.

**Acceptance Scenarios**:

1. **Given** o formulário de upload manual de um RDO, **When** o gestor informa horário de entrada, saída, intervalo de almoço e seleciona colaboradores, **Then** o relatório é criado com esses dados e as horas trabalhadas diurnas são calculadas pelas mesmas regras do fluxo normal de RDO (incluindo regras de hora extra e feriados).
2. **Given** o formulário de upload manual de um RDO, **When** o gestor não informa nenhum dado operacional (apenas o PDF e os campos já existentes), **Then** o upload continua funcionando como hoje — relatório com horários zerados, sem colaboradores e fora do cálculo de mão de obra.
3. **Given** um upload manual em lote (vários PDFs de uma vez), **When** o gestor informa dados operacionais, **Then** cada arquivo do lote permite informar seus próprios horários e colaboradores (cada PDF corresponde a um dia/relatório distinto).
4. **Given** colaboradores selecionados no upload, **When** o relatório é consultado (detalhe do relatório, listagens), **Then** os colaboradores aparecem exatamente como aparecem em um RDO criado pelo fluxo normal.
5. **Given** o upload manual de um relatório somente serviço (ex.: RTP), **When** o gestor informa horários e colaboradores, **Then** o relatório é criado com os mesmos dados e cálculo de horas de um RDO manual, mantendo suas características de relatório somente serviço.
6. **Given** o formulário de upload manual de um RDO, **When** o gestor habilita stand-by e informa tempo total e motivo, **Then** o relatório é criado com `specialConditions.standby = true` e `specialConditions.standbyDetails.total/motivo` no mesmo formato do RDO criado no app.

---

### User Story 2 - Turno noturno no upload manual (Priority: P2)

Ao fazer o upload manual de um RDO antigo que teve trabalho noturno, o gestor habilita a opção de turno noturno e informa início, término, intervalo e os colaboradores do turno noturno — com as mesmas opções do fluxo normal de RDO.

**Why this priority**: Complementa a jornada do dia com o turno noturno; depende da estrutura da User Story 1, mas é menos frequente que a jornada diurna.

**Independent Test**: Fazer um upload manual habilitando turno noturno com início 22:00, término 05:00, intervalo 01:00 e um colaborador noturno; conferir que as horas noturnas calculadas (6h) constam no relatório e que o colaborador noturno aparece como nos RDOs normais.

**Acceptance Scenarios**:

1. **Given** o formulário de upload manual com turno noturno habilitado, **When** o gestor informa início, término, intervalo e colaboradores do noturno, **Then** o relatório é criado com as horas noturnas calculadas pelas mesmas regras do fluxo normal (incluindo virada de dia, ex.: 22:00 → 05:00).
2. **Given** turno noturno desabilitado, **When** o upload é enviado, **Then** nenhum dado noturno é gravado e as horas noturnas ficam zeradas.
3. **Given** um relatório manual com turno noturno, **When** ele é visualizado no detalhe do relatório, **Then** as informações do noturno aparecem no mesmo formato dos RDOs normais.

---

### User Story 3 - Custos de mão de obra refletem os relatórios manuais (Priority: P1)

Com dados operacionais informados nos uploads manuais, o módulo Acompanhamento de Projetos passa a considerar esses relatórios no cálculo de custo de mão de obra: os dias cobertos por relatórios manuais (RDO ou somente serviço) com colaboradores vinculados e horas informadas são atribuídos ao projeto correspondente (deixando de cair em "sede/sobra"), e as horas entram no rateio de custo por projeto, exatamente como acontece com RDOs criados no app.

**Why this priority**: É o objetivo de negócio declarado — corrigir o custo das obras antigas. Depende dos dados capturados na User Story 1, mas o valor final da feature se materializa aqui.

**Independent Test**: Com um import de ponto vigente cobrindo determinado mês, fazer o upload manual de um RDO daquele mês com colaboradores que têm ponto batido no dia; recalcular o Acompanhamento e conferir que o custo daquele dia migrou de "Sede" para o projeto do relatório.

**Acceptance Scenarios**:

1. **Given** um RDO manual com colaboradores e horas informadas em dia coberto pelo ponto vigente, **When** o custo de mão de obra é calculado, **Then** o dia entra como dia de projeto (diária/periculosidade e rateio) para aqueles colaboradores, com o mesmo tratamento de um RDO normal.
2. **Given** um RDO manual sem dados operacionais (upload como hoje), **When** o custo é calculado, **Then** o resultado é idêntico ao atual — o relatório não altera o cálculo.
3. **Given** um RDO manual e um RDO normal do mesmo colaborador no mesmo dia, **When** o custo é calculado, **Then** vale a mesma regra de desempate já usada entre dois RDOs normais do mesmo dia (prevalece o de mais horas trabalhadas).
4. **Given** um relatório somente serviço manual com colaboradores e horas informadas em dia coberto pelo ponto vigente, **When** o custo é calculado, **Then** o dia e as horas contabilizam para o projeto da mesma forma que um RDO manual.
5. **Given** um relatório somente serviço manual e um RDO (manual ou normal) do mesmo colaborador no mesmo dia, **When** o custo é calculado, **Then** o dia é contado uma única vez, aplicando a mesma regra de desempate (prevalece o relatório de mais horas trabalhadas) — sem dupla contagem.
6. **Given** um relatório somente serviço criado pelo fluxo normal do app (sem jornada, com colaboradores) cujos serviços têm hora de início e término, **When** o custo é calculado, **Then** as horas trabalhadas do relatório são derivadas dos horários dos serviços e o dia contabiliza para o projeto como nos demais casos.
7. **Given** um relatório somente serviço com dois serviços em horários sobrepostos (ex.: 08:00–12:00 e 10:00–14:00), **When** as horas são derivadas, **Then** o período sobreposto conta uma única vez (total 6h, não 10h).
8. **Given** um relatório somente serviço sem jornada e cujos serviços não têm horários preenchidos, **When** o custo é calculado, **Then** o relatório fica fora do cálculo (sem horas não há o que contabilizar).
9. **Given** dashboards e abas do Acompanhamento que exibem horas de RDO (custo/hora, detalhe do projeto), **When** existem relatórios manuais com dados ou relatórios de serviço com horários, **Then** as horas desses relatórios aparecem somadas sem distinção de origem.

---

### User Story 4 - Editar uploads manuais já existentes em tela própria (Priority: P3)

O gestor abre um relatório que foi enviado por upload manual antes desta feature (ou enviado sem dados operacionais) e edita, na própria página de edição do relatório manual, data, horários, turnos, stand-by quando for RDO, e colaboradores, sem precisar reenviar o PDF e sem acionar um botão separado "Completar dados". A página pode seguir a estrutura da edição de RDO criado no app, mas observações, anexos de fotos e adicionar serviço não aparecem nesse fluxo.

**Why this priority**: Destrava o acervo já digitalizado, mas o fluxo principal (novos uploads) funciona sem isso.

**Independent Test**: Abrir um relatório manual existente sem dados operacionais, editar entrada/saída e colaboradores diretamente na página de edição manual, salvar e conferir que as horas calculadas e os vínculos aparecem, que o Acompanhamento reflete a mudança, que não existe botão "Completar dados" separado, e que campos de observação, anexos de fotos e adicionar serviço não estão disponíveis nessa tela.

**Acceptance Scenarios**:

1. **Given** um relatório de upload manual existente, **When** o gestor abre a edição, **Then** a página mostra os campos próprios de relatório manual (data, horários, turnos, stand-by para RDO e colaboradores) já preenchidos quando existirem, sem botão separado "Completar dados".
2. **Given** um relatório de upload manual existente, **When** o gestor edita os dados operacionais ou colaboradores e salva, **Then** horas trabalhadas são recalculadas e os vínculos de colaboradores substituem os anteriores.
3. **Given** a edição de um relatório manual, **When** a página é renderizada, **Then** campos de observação (`dailyDescription` e observações de serviço), anexos de fotos (`generalUploads` e uploads de serviço) e a ação de adicionar serviço não aparecem nem podem ser alterados por esse fluxo.
4. **Given** um RDO manual existente, **When** o gestor altera stand-by na edição manual, **Then** `specialConditions.standby/standbyDetails` são atualizados no mesmo formato do RDO do app.
5. **Given** um relatório manual de tipo somente serviço, **When** o gestor abre a edição, **Then** stand-by não é oferecido, mantendo apenas dados operacionais, turnos aplicáveis e colaboradores.
6. **Given** a edição de dados operacionais, **When** o gestor salva sem tocar no PDF, **Then** o PDF permanece o mesmo (a edição de dados não exige reenvio do arquivo).

---

### Edge Cases

- Relatório somente serviço com horas no mesmo dia de um RDO do mesmo colaborador: risco de dupla contagem — o cálculo deve contar o dia uma única vez por colaborador (regra de desempate existente: prevalece o relatório de mais horas). Vale também para relatórios de serviço derivados/vinculados a um RDO do mesmo dia.
- Serviços com horários sobrepostos ou em paralelo no mesmo relatório: somar os períodos causaria dupla contagem — as horas derivadas devem ser a união dos intervalos.
- Serviço com término menor que início (virada de dia, ex.: 22:00 → 02:00): soma 24h, mesma regra da jornada.
- Relatório somente serviço com jornada informada no upload manual **e** serviços com horários: prevalece a jornada informada (dado mais completo); os horários dos serviços são o fallback.
- Horas derivadas de serviços são tratadas como horas diurnas (serviços não distinguem turno noturno); o turno noturno explícito só existe via jornada informada.
- RDO manual e relatório somente serviço manual na mesma data são permitidos (a unicidade de data por projeto vale só para RDO) — o desempate por horas resolve a alocação do dia.
- Impacto retroativo: relatórios de serviço antigos criados pelo app com horários preenchidos passam a contabilizar custo imediatamente após a entrega — mudança esperada nos números históricos do Acompanhamento (dias migram de "Sede" para projetos).
- Horário de saída menor que o de entrada (virada de dia) deve seguir a mesma regra do fluxo normal (soma 24h), tanto no diurno quanto no noturno.
- Colaborador selecionado no upload mas sem ponto batido no dia: o dia não alimenta verbas variáveis (mesma regra vigente para RDOs normais — "dia com RDO e sem ponto não conta").
- Relatório manual de data anterior ao período do ponto vigente: não entra no cálculo atual (o cálculo é limitado ao período do import de ponto), sem erro.
- Preenchimento parcial (ex.: horários sem colaboradores, ou colaboradores sem horários): o sistema deve validar a combinação — horas sem colaboradores não alocam custo a ninguém; colaboradores sem horas não geram horas de projeto. O formulário deve orientar o preenchimento completo quando algum dado operacional for informado.
- Turno noturno habilitado sem início/término informados: bloquear o envio com mensagem clara (mesma validação do fluxo normal).
- Stand-by habilitado sem tempo total ou sem motivo em RDO manual: bloquear o envio com mensagem clara (mesma validação do fluxo normal).
- Stand-by enviado para relatório manual que não é RDO: bloquear no backend com erro claro; a UI não deve oferecer a opção nesses tipos.
- Edição de relatório manual não deve permitir alterações de observação, anexos de fotos nem adição de serviço, mesmo que esses campos/ações existam em um RDO criado no app.
- A remoção do botão "Completar dados" não pode remover a capacidade de corrigir colaboradores; a edição de colaboradores passa a viver na própria página de edição manual.
- Substituição do PDF de um relatório manual (fluxo existente de troca de PDF): não pode apagar os dados operacionais já informados.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O formulário de upload manual de relatórios (RDO e somente serviço — RTP, RLQ, RCPU, RLM, RLI, RLF) DEVE permitir informar, opcionalmente: horário de entrada (chegada), horário de saída, intervalo de almoço e colaboradores participantes, com as mesmas opções de preenchimento do fluxo normal de criação de RDO.
- **FR-002**: O formulário de upload manual DEVE permitir habilitar turno noturno e, quando habilitado, informar início, término, intervalo e colaboradores do turno noturno — com as mesmas opções do fluxo normal.
- **FR-003**: Ao salvar um upload manual com dados operacionais, o sistema DEVE calcular horas trabalhadas diurnas e noturnas (e horas extras) usando exatamente as mesmas regras de cálculo do fluxo normal de RDO — para qualquer tipo de relatório do upload.
- **FR-004**: Os colaboradores informados DEVEM ser vinculados ao relatório da mesma forma que no fluxo normal (mesma estrutura de vínculo), de modo que qualquer consumidor desses dados (Acompanhamento, estatísticas, detalhe do relatório) os enxergue sem tratamento especial.
- **FR-005**: O cálculo de custo de mão de obra do Acompanhamento de Projetos DEVE considerar relatórios de upload manual com dados operacionais nas mesmas regras dos RDOs normais: atribuição de dias ao projeto, rateio de horas e verbas variáveis por colaborador.
- **FR-005a**: O cálculo de custo de mão de obra DEVE passar a considerar também relatórios somente serviço com colaboradores vinculados que tenham horas trabalhadas, vindas de jornada informada (upload manual) **ou** derivadas dos horários de início/término dos serviços do relatório (fluxo normal do app); relatórios sem nenhuma das duas fontes permanecem fora do cálculo.
- **FR-005b**: Um mesmo colaborador num mesmo dia NÃO PODE ter o dia contado em dobro quando houver RDO e relatório somente serviço com horas: aplica-se a regra de desempate vigente (prevalece o relatório de mais horas trabalhadas).
- **FR-005c**: As horas derivadas dos serviços DEVEM ser calculadas como a união dos intervalos início→término dos serviços do relatório (sobreposições contam uma vez; término menor que início soma 24h). Quando o relatório tiver jornada informada, a jornada prevalece sobre a derivação.
- **FR-005d**: A derivação por horários de serviço DEVE valer também para relatórios somente serviço já existentes no banco (sem necessidade de reprocessamento ou correção manual dos dados históricos).
- **FR-006**: Todos os dados operacionais DEVEM ser opcionais no upload: um upload sem esses dados DEVE se comportar exatamente como hoje (relatório aprovado com horários zerados, fora do cálculo de mão de obra).
- **FR-007**: No upload em lote (múltiplos PDFs), os dados operacionais DEVEM ser informáveis por arquivo, já que cada PDF corresponde a um relatório/dia distinto.
- **FR-008**: O fluxo de edição de relatórios de upload manual DEVE permitir acrescentar ou corrigir os dados operacionais de relatórios já enviados, sem exigir reenvio do PDF, recalculando as horas ao salvar.
- **FR-009**: A substituição do PDF de um relatório manual NÃO PODE descartar os dados operacionais já gravados.
- **FR-010**: As validações de preenchimento DEVEM espelhar o fluxo normal: formato de horários, turno noturno habilitado exige início e término, e mensagens de erro em português.
- **FR-011**: A entrada desses dados DEVE ser validada no backend antes de tocar em regra de negócio ou banco (nenhuma confiança apenas na validação do cliente).
- **FR-012**: O detalhe do relatório e as listagens DEVEM exibir os dados operacionais de relatórios manuais no mesmo formato dos RDOs normais.
- **FR-013**: O upload manual de RDO DEVE permitir informar stand-by, com os mesmos campos e validações do fluxo normal (`standby`, `standbyDetails.total`, `standbyDetails.motivo`). Essa opção NÃO DEVE aparecer para relatórios somente serviço.
- **FR-014**: A edição de relatório de upload manual DEVE ser feita na própria página de edição/detalhe manual, sem botão separado "Completar dados"; ela pode seguir a organização visual do RDO criado no app, mantendo as restrições do fluxo manual.
- **FR-015**: A página de edição de relatório manual DEVE permitir alterar colaboradores, data, horários, turno noturno e stand-by quando aplicável, mas NÃO DEVE exibir nem aceitar edição de observações (`dailyDescription` e observações de serviço), anexos de fotos (`specialConditions.generalUploads` e uploads de serviço) ou adição de serviço nesse fluxo.

### Key Entities

- **Relatório (RDO de upload manual)**: relatório existente criado pelo fluxo de upload; passa a carregar jornada diurna (entrada, saída, almoço), horas calculadas e marcação de origem manual que já possui hoje.
- **Vínculo Relatório–Colaborador**: associação existente entre relatório e colaboradores participantes; passa a ser criada também pelos uploads manuais.
- **Turno noturno do relatório**: bloco de dados existente do fluxo normal (habilitado, início, término, intervalo, colaboradores do noturno); passa a ser preenchível pelo upload manual.
- **Stand-by do RDO manual**: bloco de dados existente do fluxo normal (`specialConditions.standby` e `standbyDetails` com tempo total/motivo); passa a ser preenchível no upload e na edição de RDO manual.
- **Serviço do relatório**: registro existente de cada serviço executado (tipo, equipamento, hora de início, hora de término); seus horários passam a servir de fonte de horas trabalhadas para relatórios somente serviço sem jornada.
- **Cálculo de custo de mão de obra (Acompanhamento)**: consumidor dos dados — mantém as regras de rateio/ponto/desempate; passa a aceitar relatórios somente serviço como fonte de dias e horas (jornada informada ou horários de serviço).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um upload manual de RDO com dados operacionais completos resulta em relatório com horas diurnas/noturnas idênticas às que o fluxo normal calcularia para os mesmos horários (paridade de cálculo em 100% dos casos de teste).
- **SC-002**: Dias de obra cobertos por relatórios manuais (RDO ou somente serviço) com colaboradores vinculados, horas informadas e ponto batido deixam de aparecer como "Sede" e passam a compor o custo do projeto correspondente no Acompanhamento.
- **SC-003**: Uploads manuais sem dados operacionais continuam funcionando sem nenhuma mudança de comportamento (zero regressão no fluxo atual).
- **SC-004**: O gestor consegue editar os dados de um relatório manual antigo diretamente na página de edição manual em menos de 2 minutos, sem reenviar o PDF e sem usar um botão separado "Completar dados".
- **SC-005**: Nenhum consumidor existente de dados de relatório (estatísticas, detalhe, listagens, Acompanhamento) precisa de tratamento especial para distinguir relatórios manuais com dados de RDOs normais.
- **SC-006**: Relatórios somente serviço criados pelo app (novos e já existentes) com colaboradores e horários de serviço preenchidos passam a compor o custo de mão de obra dos projetos sem nenhuma ação manual de correção de dados.

## Assumptions

- Os dados operacionais aplicam-se a todos os tipos de relatório do upload manual (RDO e somente serviço). Nos tipos somente serviço, o preenchimento serve para contabilizar custo de mão de obra; o relatório mantém suas demais características de "somente serviço" (decisão do usuário em 2026-07-13, substituindo a premissa inicial de restringir ao RDO).
- Todos os dados operacionais são opcionais: o objetivo é permitir enriquecer relatórios antigos, não bloquear a digitalização de PDFs cujos dados se perderam.
- O cálculo de horas reutiliza o motor existente do fluxo normal (mesmas regras de intervalo, virada de dia, hora extra e feriado) — não se cria regra nova de cálculo.
- O Acompanhamento precisa de um ajuste pontual: hoje o cálculo considera apenas relatórios do tipo RDO; passa a considerar também relatórios de outros tipos que tenham horas trabalhadas — por jornada informada ou derivadas dos horários dos serviços — e colaboradores, mantendo todas as demais regras. A limitação vigente de que apenas dias dentro do período do import de ponto (e com ponto batido) alimentam verbas variáveis permanece válida, assim como o desempate por dia (evita dupla contagem).
- A derivação por horários de serviço acontece no momento do cálculo (leitura), sem alterar os relatórios gravados — por isso cobre automaticamente o histórico existente, sem backfill (decisão do usuário em 2026-07-13: considerar início/término dos serviços nos relatórios somente serviço do app).
- Relatórios manuais criados antes desta feature poderão ser editados pelo fluxo manual inline (User Story 4); não haverá backfill automático de dados a partir dos PDFs.
- O status do relatório manual (aprovado/assinado conforme o modo de assinatura escolhido) permanece como é hoje; os dados operacionais não alteram o fluxo de assinatura.
- Stand-by é requisito apenas para RDO manual; relatórios somente serviço continuam sem stand-by, salvo nova decisão de produto.
- Observações, anexos de fotos e adição de serviço de RDO criado no app não são parte do fluxo de relatório manual; o PDF histórico continua sendo a evidência principal do relatório manual.
