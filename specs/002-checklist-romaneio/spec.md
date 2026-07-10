# Feature Specification: Checklist de Equipamentos no Romaneio

**Feature Branch**: `002-checklist-romaneio`

**Created**: 2026-07-09

**Updated**: 2026-07-10

**Status**: Draft

**Input**: User description: "Checklist de equipamentos no romaneio — toggle na categoria de equipamento, pontos de checagem por categoria com override por equipamento, marcação no fluxo do romaneio de saída, assinatura do responsável no resumo, geração de PDF por equipamento (modelo Checklist.docx), anexo no card do romaneio e no e-mail de notificação, pré-cadastro dos itens do Mapa checklist.txt." Atualização 2026-07-10: o modelo e o mapa foram ajustados para que todos os checklists de um romaneio saiam em um único arquivo referente ao romaneio; a tabela do checklist é repetida para cada item com checklist e usa os placeholders `<<categoria>>` e `<<nomeoutag>>`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Marcar checklist ao montar romaneio de saída (Priority: P1)

O colaborador monta um romaneio de saída para uma missão. Ao adicionar um item que possui checklist efetivo, o sistema abre a etapa de checklist daquele item, listando os pontos de checagem aplicáveis (da categoria, ou do próprio equipamento quando houver lista própria). O colaborador classifica cada ponto como conforme, não conforme ou não aplicável e continua o preenchimento normal do romaneio. Ao enviar, o romaneio gera um único documento PDF consolidado de checklist; dentro dele, a tabela do checklist é duplicada para cada item com checklist, com os status CONFORME (verde), NÃO CONFORME (vermelho) ou NÃO APLICÁVEL (cinza).

**Why this priority**: É o coração da feature — sem a marcação no fluxo do romaneio e a geração do documento, nada do resto tem valor. Entrega sozinha um MVP funcional (usando apenas listas cadastradas por categoria).

**Independent Test**: Com categorias com checklist habilitado e itens cadastrados, criar um romaneio de saída contendo dois itens com checklist (ex.: UFP e ULQ), marcar parte dos pontos, enviar e conferir que um único PDF de checklist foi gerado, com uma tabela para cada item, status corretos e download único no card do romaneio.

**Acceptance Scenarios**:

1. **Given** uma categoria com checklist habilitado e pontos cadastrados, **When** o colaborador adiciona um equipamento dessa categoria a um romaneio de saída, **Then** a etapa de checklist do equipamento é exibida com todos os pontos iniciando como conforme.
2. **Given** a etapa de checklist aberta, **When** o colaborador altera pontos para não conforme ou não aplicável e prossegue, **Then** o sistema permite continuar e enviar o romaneio sem bloqueio nem confirmação extra.
3. **Given** um romaneio de saída com 2 equipamentos com checklist, **When** o romaneio é enviado, **Then** é gerado 1 PDF consolidado de checklist do romaneio, com nome "Checklist - Missão [código do projeto] - [dd-mm-yyyy].pdf".
4. **Given** um romaneio com UFP e ULQ com checklist, **When** o PDF consolidado é aberto, **Then** a tabela do checklist aparece uma vez para UFP e outra logo abaixo para ULQ, preenchendo `<<categoria>>` com a categoria e `<<nomeoutag>>` com a tag de cada equipamento.
5. **Given** um item consumível/produto químico com checklist no romaneio, **When** o PDF consolidado é gerado, **Then** `<<nomeoutag>>` é preenchido com o nome do produto, não com uma tag.
6. **Given** um romaneio enviado com checklists, **When** o usuário abre o card do romaneio na listagem, **Then** um único PDF consolidado de checklist aparece para download junto ao PDF/DOCX do romaneio.
7. **Given** destinatários de notificação de romaneio cadastrados, **When** o romaneio com checklists é enviado, **Then** o e-mail de notificação existente inclui o PDF consolidado de checklist como anexo, junto com o PDF do romaneio.
8. **Given** um item SEM checklist habilitado (ou item avulso/manual do catálogo), **When** ele é adicionado ao romaneio, **Then** nenhuma etapa de checklist é exibida e nenhuma tabela de checklist é gerada para ele.
9. **Given** um romaneio de ENTRADA (devolução), **When** itens são adicionados, **Then** nenhuma etapa de checklist é exibida, independentemente da categoria.

---

### User Story 2 - Assinatura do responsável no resumo do romaneio (Priority: P1)

Ao clicar em enviar e abrir o resumo/revisão do romaneio, se houver item com checklist, aparece ao final do resumo um campo de assinatura do responsável (desenho na tela ou upload de imagem, no mesmo padrão já usado para assinaturas de RDO e EPIs). Se o colaborador vinculado à conta do usuário logado já possui assinatura cadastrada no sistema, o campo é omitido e a assinatura salva é usada automaticamente. A assinatura e o nome do responsável saem impressos no final do PDF consolidado de checklist do romaneio.

**Why this priority**: O documento de checklist sem assinatura do responsável não tem validade operacional para a empresa; faz parte do mesmo fluxo de envio do P1.

**Independent Test**: Enviar um romaneio com item com checklist usando (a) uma conta vinculada a colaborador com assinatura cadastrada e (b) uma conta sem assinatura cadastrada, verificando a omissão/exibição do campo e a presença da assinatura no PDF consolidado.

**Acceptance Scenarios**:

1. **Given** usuário logado SEM assinatura cadastrada e romaneio com item com checklist, **When** o resumo de envio é aberto, **Then** o campo de assinatura (desenho/upload) aparece ao final do resumo.
2. **Given** usuário logado vinculado a colaborador COM assinatura cadastrada, **When** o resumo de envio é aberto, **Then** o campo de assinatura é omitido e a assinatura cadastrada é usada no PDF consolidado.
3. **Given** um romaneio SEM itens com checklist, **When** o resumo de envio é aberto, **Then** nenhum campo de assinatura é exibido (comportamento atual inalterado).
4. **Given** o PDF consolidado de checklist gerado, **When** aberto, **Then** o final do documento exibe a imagem da assinatura e o nome do responsável pelo romaneio.

---

### User Story 3 - Cadastrar pontos de checagem por categoria (Priority: P2)

O gestor do módulo Equipamentos, no cadastro da categoria, liga o toggle "Tem checklist" e cadastra a lista ordenada de pontos de checagem daquela categoria. Esses pontos passam a valer automaticamente para todos os equipamentos da categoria.

**Why this priority**: Necessário para alimentar o P1, mas o pré-cadastro (P4) já cobre as categorias iniciais em produção; a tela de gestão pode chegar logo depois do fluxo principal.

**Independent Test**: Habilitar checklist numa categoria, cadastrar/reordenar/remover pontos e verificar que todos os equipamentos da categoria passam a exibir essa lista na etapa de checklist do romaneio.

**Acceptance Scenarios**:

1. **Given** o formulário de categoria no módulo Equipamentos, **When** o gestor liga o toggle "Tem checklist", **Then** aparece o editor da lista de pontos de checagem (adicionar, editar, remover, reordenar itens de texto).
2. **Given** uma categoria com checklist habilitado e pontos cadastrados, **When** qualquer equipamento da categoria é consultado, **Then** seu checklist efetivo é a lista da categoria.
3. **Given** uma categoria com checklist habilitado, **When** o gestor define "Identificação no checklist" como Automático, Tag/Código ou Nome, **Then** o valor de `<<nomeoutag>>` nos snapshots futuros respeita esse modo.
4. **Given** uma categoria com checklist habilitado, **When** o gestor desliga o toggle, **Then** os equipamentos da categoria deixam de exigir checklist no romaneio (a lista cadastrada é preservada para reativação).
5. **Given** um usuário sem papel de gestor do módulo Equipamentos, **When** acessa a categoria, **Then** não consegue alterar o toggle, os pontos de checagem nem a identificação no checklist.

---

### User Story 4 - Checklist próprio de um equipamento (override) e restauração (Priority: P2)

O gestor edita o checklist de um equipamento específico dentro de uma categoria: a partir daí vale a lista do equipamento, não a da categoria. Um botão "Restaurar padrão da categoria" descarta a lista própria e o equipamento volta a herdar a lista da categoria.

**Why this priority**: Refinamento do modelo de herança; o fluxo funciona sem ele usando só listas de categoria, mas é necessário para casos reais (ex.: UTH 008).

**Independent Test**: Editar o checklist de um único equipamento, confirmar que apenas ele exibe a lista alterada no romaneio, restaurar o padrão e confirmar que volta a herdar da categoria.

**Acceptance Scenarios**:

1. **Given** um equipamento de categoria com checklist, **When** o gestor edita a lista de pontos do equipamento, **Then** a lista própria passa a valer somente para aquele equipamento; os demais seguem a categoria.
2. **Given** um equipamento com lista própria, **When** o gestor altera a lista da categoria, **Then** o equipamento com override NÃO é afetado; os demais refletem a mudança.
3. **Given** um equipamento com lista própria, **When** o gestor clica em "Restaurar padrão da categoria" e confirma, **Then** a lista própria é descartada e o checklist efetivo volta a ser o da categoria.
4. **Given** um equipamento sem override, **When** sua tela de checklist é aberta, **Then** a lista da categoria é exibida com indicação de que está herdada (e o botão de restaurar não se aplica/fica desabilitado).

---

### User Story 5 - Pré-cadastro dos checklists existentes (Priority: P3)

Os pontos de checagem já definidos pela empresa (Mapa checklist.txt) para as categorias UFI, UTH, UTO, UBP, ULQ, UFP e TRO são pré-cadastrados via script, para não exigir digitação manual em produção. Para a categoria UTH, os itens "Verificação da correia" e "Verificação das polias" não entram na lista da categoria; entram como lista própria (override) do equipamento de código "UTH 008", contendo todos os itens da categoria mais esses dois.

**Why this priority**: Conveniência operacional de implantação; pode rodar a qualquer momento depois que o modelo de dados existir.

**Independent Test**: Rodar o script em modo dry-run e depois em modo de aplicação num banco com as categorias/equipamentos existentes, verificando listas criadas, override do UTH 008 e idempotência (segunda execução não duplica nada).

**Acceptance Scenarios**:

1. **Given** banco com as categorias correspondentes a UFI, UTH, UTO, UBP, ULQ, UFP e TRO, **When** o script é executado, **Then** cada categoria fica com checklist habilitado e a lista de pontos do mapa (sem os itens "apenas UTH 008" na UTH).
2. **Given** o equipamento de código "UTH 008" existente, **When** o script é executado, **Then** ele recebe lista própria com os itens da categoria UTH + "Verificação da correia" + "Verificação das polias".
3. **Given** o script já executado uma vez, **When** é executado novamente, **Then** nada é duplicado nem sobrescrito indevidamente (idempotente), e listas já editadas manualmente são preservadas.
4. **Given** uma categoria ou equipamento do mapa inexistente no banco, **When** o script roda, **Then** o item é reportado como não encontrado e o restante prossegue normalmente.
5. **Given** o modo dry-run, **When** o script roda, **Then** exibe o que seria feito sem gravar nada.

---

### User Story 6 - Editar checklist de um romaneio existente (Priority: P3)

Gerente ou coordenador edita um romaneio já enviado e ajusta as marcações de checklist dos itens; ao salvar, o PDF consolidado de checklist é regenerado (assim como já ocorre com o DOCX/PDF do romaneio).

**Why this priority**: Paridade com o comportamento atual de edição de romaneio; menos frequente que o fluxo de criação.

**Acceptance Scenarios**:

1. **Given** um romaneio de saída existente com checklists, **When** gerente/coordenador abre a edição, **Then** as marcações salvas de cada item são exibidas e editáveis.
2. **Given** marcações alteradas na edição, **When** o romaneio é salvo, **Then** o PDF consolidado de checklist é regenerado com os novos status e substitui o anterior no card e no armazenamento.
3. **Given** um item com checklist adicionado durante a edição, **When** o romaneio é salvo, **Then** o novo item também aparece como nova tabela no PDF consolidado (com marcação feita na edição).

---

### Edge Cases

- Item com checklist habilitado mas lista efetiva vazia (categoria sem pontos cadastrados e sem override): a etapa de checklist não é exibida e nenhuma tabela é gerada para ele.
- A lista da categoria/equipamento muda DEPOIS de um romaneio enviado: o romaneio guarda cópia (snapshot) dos pontos no momento do envio; o PDF consolidado e edições posteriores usam o snapshot, não a lista atual.
- O mesmo equipamento é removido e recolocado no romaneio antes do envio: as marcações feitas anteriormente naquela sessão são descartadas ao remover (recolocar reabre zerado).
- Rascunho de romaneio: as marcações de checklist feitas até então são preservadas no rascunho e restauradas ao retomá-lo.
- Falha na geração do PDF consolidado de checklist no envio: o envio do romaneio não pode ficar em estado parcial silencioso — o erro é tratado da mesma forma que a falha de geração do PDF do romaneio hoje (envio falha por inteiro e nada é persistido pela metade).
- Falha no e-mail: o romaneio permanece criado com status de e-mail de erro (comportamento atual), incluindo os checklists no card.
- Assinatura: usuário sem colaborador vinculado e que não desenha/envia assinatura no resumo — o envio é permitido e o PDF sai com espaço de assinatura em branco, apenas com o nome do responsável.
- Quantidade > 1 do mesmo equipamento serializado numa linha do romaneio: o checklist é único por linha de equipamento (uma tabela no PDF consolidado por item distinto, não por unidade de quantidade).
- Consumível/produto sem tag: `<<nomeoutag>>` usa o nome do produto. Equipamento/unidade com tag: `<<nomeoutag>>` usa a tag. Se a classificação ficar ambígua, o cadastro da categoria pode forçar o modo de exibição no checklist.
- Template Checklist.docx ausente no servidor: o envio de romaneio com itens com checklist falha com mensagem clara; romaneios sem checklist não são afetados.
- Romaneio para missão criada como cadastro pendente (sem nome): o PDF sai só com o código do projeto; ao baixar depois do cadastro do nome, o documento vem atualizado (FR-019).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O cadastro de categoria de equipamento DEVE oferecer um toggle "Tem checklist" (visível/editável apenas para o gestor do módulo Equipamentos).
- **FR-002**: Com o toggle ligado, a categoria DEVE permitir cadastrar uma lista ordenada de pontos de checagem (texto livre), com adicionar, editar, remover e reordenar.
- **FR-003**: Todo equipamento herda automaticamente a lista de pontos da sua categoria; o sistema DEVE permitir definir uma lista própria por equipamento (override) que substitui integralmente a da categoria.
- **FR-004**: O sistema DEVE oferecer, no equipamento com lista própria, um botão "Restaurar padrão da categoria" que descarta o override e volta a herdar a lista da categoria, com confirmação.
- **FR-005**: Em romaneios de SAÍDA, ao adicionar um item do catálogo cuja lista efetiva de checklist não é vazia, o sistema DEVE exibir a etapa de checklist daquele item com todos os pontos iniciando como "Conforme".
- **FR-006**: O colaborador DEVE poder classificar cada ponto como "Conforme", "Não conforme" ou "Não aplicável" livremente e prosseguir com o romaneio, sem bloqueio nem aviso adicional.
- **FR-007**: Romaneios de ENTRADA não exibem checklist nem geram documentos de checklist.
- **FR-008**: No resumo de envio do romaneio, quando houver ao menos um item com checklist, o sistema DEVE exibir ao final um campo de assinatura do responsável (desenho ou upload de imagem, no mesmo padrão das assinaturas de RDO/EPI); o campo DEVE ser omitido quando o colaborador vinculado ao usuário logado já possui assinatura cadastrada, usando-a automaticamente.
- **FR-009**: A assinatura desenhada/enviada no resumo NÃO altera a assinatura cadastrada do colaborador; vale apenas para os documentos daquele romaneio.
- **FR-010**: Ao enviar o romaneio, o sistema DEVE gerar um único documento PDF consolidado de checklist por romaneio, a partir do modelo `Modelos/definitivos/Checklist.docx`, preenchendo: identificação do projeto (código e nome da missão), data do romaneio, uma tabela de checklist por item com checklist, uma linha por ponto com status "CONFORME" (verde), "NÃO CONFORME" (vermelho) ou "NÃO APLICÁVEL" (cinza), e ao final a assinatura (imagem) e o nome do responsável.
- **FR-019**: Quando o projeto ainda não tem nome (missão criada como cadastro pendente pelo próprio romaneio), o documento sai apenas com o código do projeto; depois que o nome for cadastrado, novos downloads do PDF de checklist DEVEM trazer o documento atualizado com o nome do projeto (sem reenvio de e-mail).
- **FR-011**: O nome do arquivo DEVE ser "Checklist - Missão [código do projeto] - [dd-mm-yyyy].pdf" (data do romaneio com hífens).
- **FR-012**: O PDF consolidado de checklist DEVE ficar disponível para download no card do romaneio, junto ao PDF/DOCX do romaneio, respeitando as mesmas regras de acesso.
- **FR-013**: O e-mail de notificação de romaneio existente DEVE incluir o PDF consolidado de checklist como anexo adicional, no mesmo envio do PDF do romaneio.
- **FR-014**: O romaneio DEVE armazenar, por item com checklist, a lista de pontos e as marcações no momento do envio (snapshot), de forma que mudanças posteriores nas listas de categoria/equipamento não alterem romaneios já enviados.
- **FR-015**: Na edição de romaneio (gerente/coordenador), as marcações de checklist DEVEM ser editáveis e o PDF consolidado regenerado ao salvar, substituindo o anterior.
- **FR-016**: Rascunhos de romaneio DEVEM preservar e restaurar as marcações de checklist.
- **FR-017**: Um script de pré-cadastro idempotente, com modo dry-run, DEVE cadastrar os pontos do Mapa checklist.txt nas categorias UFI, UTH, UTO, UBP, ULQ, UFP e TRO, colocando "Verificação da correia" e "Verificação das polias" apenas como override do equipamento "UTH 008" (itens da categoria UTH + os dois), reportando categorias/equipamentos não encontrados sem interromper o restante.
- **FR-018**: A validação de entrada das novas operações DEVE seguir o padrão do projeto (validação no backend e no frontend), e as permissões DEVEM respeitar os papéis existentes: gestor do módulo Equipamentos para cadastro de listas; papéis atuais do romaneio para marcação/envio.
- **FR-020**: Para cada item adicionado ao romaneio que possui checklist, o sistema DEVE duplicar a tabela do checklist logo abaixo da anterior no mesmo documento, preenchendo `<<categoria>>` com o nome da categoria e `<<nomeoutag>>` conforme a regra do item.
- **FR-021**: O placeholder `<<nomeoutag>>` DEVE usar a tag/código para equipamentos ou itens adicionados por unidade, e o nome do produto para consumíveis/produtos químicos. Para reduzir ambiguidade, o cadastro da categoria PODE oferecer um modo de exibição do checklist (automático, tag/código ou nome).

### Key Entities

- **Lista de pontos da categoria**: pertence à categoria de equipamento; habilitada pelo toggle "Tem checklist"; itens de texto ordenados.
- **Lista própria do equipamento (override)**: pertence ao equipamento; quando presente, substitui integralmente a lista da categoria; pode ser descartada (restaurar padrão).
- **Checklist do romaneio (snapshot)**: pertence a um romaneio + item com checklist; guarda os pontos vigentes no envio, a marcação de cada um, a categoria exibida e o valor de `<<nomeoutag>>`; compõe o PDF consolidado gerado.
- **Documento consolidado de checklist**: arquivo único do romaneio que contém uma tabela duplicada por snapshot de checklist, respeitando a ordem dos itens no romaneio.
- **Assinatura do responsável**: imagem (desenhada, enviada ou cadastrada) + nome do responsável; associada ao envio do romaneio e impressa no PDF consolidado de checklist daquele romaneio.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um colaborador consegue preencher o checklist de um equipamento (lista típica de ~10 pontos) em menos de 1 minuto dentro do fluxo do romaneio, sem sair da tela.
- **SC-002**: 100% dos romaneios de saída enviados com itens de categorias com checklist habilitado possuem um PDF consolidado de checklist no card e no e-mail de notificação.
- **SC-003**: Após rodar o pré-cadastro em produção, as 7 categorias do mapa têm seus pontos disponíveis sem nenhuma digitação manual, e o UTH 008 exibe seus 2 pontos exclusivos.
- **SC-004**: Alterar a lista de uma categoria reflete imediatamente em todos os equipamentos sem override; nenhum romaneio já enviado tem seu documento alterado por mudanças de lista.
- **SC-005**: O fluxo de romaneio sem itens com checklist permanece idêntico ao atual (zero passos adicionais).

## Assumptions

- Itens do catálogo do romaneio com checklist efetivo podem gerar tabela no PDF consolidado; itens manuais/avulsos sem checklist continuam fora do fluxo.
- Para equipamentos/itens adicionados por unidade, `<<nomeoutag>>` usa a tag/código. Para consumíveis/produtos químicos com checklist, `<<nomeoutag>>` usa o nome do produto.
- O checklist é único por linha de item no romaneio (equipamentos serializados; quantidade não multiplica checklists).
- O formato da data no nome do arquivo usa hífens (dd-mm-yyyy), pois "/" não é permitido em nomes de arquivo — confirmado pelo usuário em 2026-07-09.
- O modelo `Modelos/definitivos/Checklist.docx` foi fornecido e validado (2026-07-09) e atualizado pelo usuário em 2026-07-10: contém `<<projeto>>`, `<<data>>`, tabela CHECKLIST com `<<categoria>>`, `<<nomeoutag>>`, linha-template `<<item>>`/`<<status>>` e tabela RESPONSÁVEL com `<<assinatura>>`/`<<responsavel>>`, no padrão de linhas-template dos demais modelos DOCX do projeto. Se `<<equipamento>>`/`<<tag>>` ainda existirem no cabeçalho legado, o gerador deve preenchê-los com resumo dos itens ou limpá-los para não deixar placeholder exposto.
- "Responsável" é o usuário autenticado que envia o romaneio; a assinatura cadastrada considerada é a do colaborador vinculado à sua conta (mesma assinatura usada em RDO/EPIs).
- Os nomes/códigos reais das categorias em produção correspondentes a UFI, UTH, UTO, UBP, ULQ, UFP e TRO serão resolvidos pelo script de pré-cadastro (por prefixo de código dos equipamentos e/ou nome da categoria), reportando o que não casar.
- Desligar o toggle da categoria preserva as listas cadastradas (categoria e overrides) para reativação futura.
- A tela/etapa de checklist no romaneio segue o padrão visual e mobile-first do app (constitution II e VI).
