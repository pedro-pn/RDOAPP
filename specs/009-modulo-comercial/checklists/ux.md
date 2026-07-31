# UX & Requirements Quality Checklist: Módulo Comercial

**Purpose**: Validar a **qualidade dos requisitos escritos** — completude, clareza,
consistência, mensurabilidade e cobertura — antes da implementação. Não testa
comportamento do sistema; testa se o `spec.md` está bem escrito.
**Created**: 2026-07-31
**Feature**: [spec.md](../spec.md)

**Foco**: paridade de UI/UX, permissões e continuidade de trabalho
**Profundidade**: portão de release (a feature tem 121 tarefas e ~10 semanas)
**Público**: autor e revisor, antes do `/speckit-implement`

> Um porte fiel tem uma vantagem rara: o requisito não é prosa, é artefato. Onde o
> item aponta para o inventário ou para os goldens, a completude está resolvida por
> construção. **Os itens abaixo se concentram no que os artefatos não cobrem** — e é
> aí que os buracos estão.

## Requirement Completeness

- [ ] CHK001 - Existem requisitos de **exclusão** para levantamento e proposta? O `data-model.md` menciona "soft delete onde exclusão física for arriscada", mas nenhum FR define se, quando e por quem um registro pode ser apagado. [Gap]
- [ ] CHK002 - O comportamento está definido para **falha na geração do PDF** (antes de qualquer integração)? O FR-034 cobre falha *depois* dos documentos prontos; a falha durante a geração não tem requisito. [Gap, Spec §FR-031..034]
- [ ] CHK003 - Estão definidos requisitos para **indisponibilidade do CRM antes** da geração, na etapa de escolha de funil e card? [Coverage, Spec §FR-031]
- [ ] CHK004 - Existe requisito de **paginação ou limite** para a listagem do histórico, que é a única superfície do papel de consulta? [Gap, Spec §FR-030]
- [ ] CHK005 - Está especificado o comportamento quando **dois usuários editam a mesma proposta** simultaneamente? [Gap, Concorrência]
- [ ] CHK006 - Está especificado o que acontece quando **dois usuários finalizam a mesma proposta** ao mesmo tempo — ação irreversível que gera documento e consome integração? [Gap, Exception Flow]
- [ ] CHK007 - Existe requisito para o botão **"Imprimir prévia"**, presente na referência (`PROP-CTL-009`)? Ele aparece no inventário mas não em nenhum FR. [Gap, Spec §FR-001]
- [ ] CHK008 - Estão definidos requisitos de **estado de carregamento** para as telas que dependem de busca no CRM (busca de empresa, funil, cards)? [Gap]
- [ ] CHK009 - Estão definidos requisitos de **estado vazio** para a listagem do histórico e para o cadastro de vendedores? [Coverage, Gap]
- [ ] CHK010 - O requisito de retenção indefinida (FR-042) define **quem pode solicitar remoção** sob a LGPD, dado que a entrada no ROPA é exigida? [Completeness, Spec §FR-042]

## Requirement Clarity

- [ ] CHK011 - O desempenho do recálculo ao vivo está **quantificado**? O `plan.md` diz "sem travar a digitação", que não é verificável. Qual o limite aceitável entre tecla e resultado? [Clarity, Ambiguity, Plan §Performance Goals]
- [ ] CHK012 - "Rascunho local com salvamento automático" (FR-019) especifica a **frequência** ou o intervalo de *debounce*? Sem isso, "automático" admite de 200 ms a 60 s. [Clarity, Spec §FR-019]
- [ ] CHK013 - "Nenhuma rolagem horizontal de página em largura de celular" (FR-036) fixa a **largura de referência**? Os critérios citam 390 px; telas de 320 px estão dentro ou fora? [Clarity, Spec §FR-036, SC-004]
- [ ] CHK014 - O FR-011 nomeia mensagens para e-mail e CNPJ. **Os demais campos com formato validado** (data, valores monetários, percentuais) têm regra de mensagem definida, ou herdam "Campo obrigatório"? [Coverage, Spec §FR-011]
- [ ] CHK015 - "Oferecida explicitamente ao usuário" (FR-020) define **o que a oferta contém**? Recuperar um rascunho sem saber de quando é e do que trata é quase tão ruim quanto perdê-lo. [Clarity, Spec §FR-020]
- [ ] CHK016 - "Dispensável e rechamável" (FR-025) especifica **de onde** o tutorial é rechamado? Sem ponto de entrada definido, "rechamável" não é implementável. [Clarity, Spec §FR-025]
- [ ] CHK017 - O SC-007 ("conclui um levantamento sem ajuda externa") é **objetivamente verificável**? Como está, depende de julgamento do observador. [Measurability, Spec §SC-007]
- [ ] CHK018 - "Semeada acima do maior número existente nas duas origens" (FR-035) define **quando** a semeadura é feita e o que acontece se o CRM ganhar números maiores depois? [Clarity, Spec §FR-035]

## Requirement Consistency

- [ ] CHK019 - **Conflito**: o FR-025 exige tutorial "marcado por usuário", e o `data-model.md` guarda o marcador em `localStorage`, que é **por navegador**, não por usuário. Dois usuários no mesmo computador compartilham o marcador; o mesmo usuário em dois computadores vê o tutorial duas vezes. Qual das duas semânticas vale? [Conflict, Spec §FR-025 × data-model.md]
- [ ] CHK020 - O FR-029 ("autor ou gestor") e o FR-027a ("vendedor vê só os seus") descrevem a mesma regra por dois ângulos. Estão **redigidos de forma consistente** quanto a leitura *versus* escrita? [Consistency, Spec §FR-027a, §FR-029]
- [ ] CHK021 - O FR-030 diz que o papel de consulta não vê valores "em nenhuma coluna"; o FR-030a trata só do download. **A prévia do documento** e qualquer exportação estão cobertas pela mesma regra? [Consistency, Coverage, Spec §FR-030, §FR-030a]
- [ ] CHK022 - As decisões 1 e 2 da §12.5 do plano técnico foram **revistas** pela §12.5.1. Todas as referências a elas no plano apontam para a versão nova? [Consistency, Plan §12.5]
- [ ] CHK023 - O FR-002 preserva 7 etapas e 5 seções; as Clarifications dizem que "as abas continuam livres". Isso está **afirmado como requisito** em algum FR, ou só na seção de contexto? [Consistency, Gap, Spec §FR-002]
- [ ] CHK024 - O desvio nº 8 registra ausência de baseline para "Nova proposta" porque dependia do CRM. Com a numeração passando a ser local (FR-035), esse desvio ainda **descreve corretamente** a limitação? [Consistency, Assumption]

## Acceptance Criteria Quality

- [ ] CHK025 - O SC-001 exige 100% dos 616 controles e 916 textos. O critério define **o que conta como presente** — mesmo rótulo, mesma posição, mesmo comportamento? [Measurability, Spec §SC-001]
- [ ] CHK026 - O SC-003 exige "zero divergências fora dos 9 desvios". Existe critério escrito para **classificar** uma divergência como desvio aprovado ou defeito, ou isso fica a critério do revisor? [Measurability, Spec §SC-003]
- [ ] CHK027 - O SC-002 ("16 de 16 goldens dígito a dígito") é o critério mais forte da feature. Está claro que **regerar golden não é caminho de correção**? [Clarity, Spec §SC-002, §FR-008]
- [ ] CHK028 - O SC-006 ("zero perda silenciosa de trabalho") enumera três saídas aceitáveis. As três são **exaustivas**, ou existe um quarto caso? [Coverage, Spec §SC-006]
- [ ] CHK029 - O SC-011 ("toda a interface em pt-BR") é verificável por inspeção, ou precisa de critério de amostragem, dado o volume de 916 textos? [Measurability, Spec §SC-011]

## Scenario Coverage

- [ ] CHK030 - Existem requisitos para o **fluxo de revisão** de uma proposta (criar a revisão N+1 a partir da N)? A US2 cobre a montagem; a revisão aparece no modelo de dados e no diálogo de modo, mas não tem história própria. [Coverage, Gap]
- [ ] CHK031 - O caso "proposta gerada antes do armazenamento completo dos campos" está nas Edge Cases. Existe **requisito** correspondente, ou só a observação? [Gap, Spec §Edge Cases]
- [ ] CHK032 - Estão definidos requisitos para **um vendedor removido do quadro** cujos levantamentos e propostas continuam existindo — quem passa a alcançá-los? [Edge Case, Spec §Edge Cases]
- [ ] CHK033 - Existem requisitos para o comportamento quando o **`localStorage` está cheio ou desabilitado**, dado que o rascunho local (FR-019) depende dele? [Edge Case, Gap]
- [ ] CHK034 - Estão definidos requisitos de **recuperação** para a migration de dois schemas, caso ela revele algo inesperado? O `research.md` cita um "plano B", mas ele não é requisito. [Recovery, Gap, Research §D1]

## Non-Functional Requirements

- [ ] CHK035 - Estão definidos requisitos de **acessibilidade** além de `aria-invalid` — navegação por teclado nas 5 seções e nas 7 etapas, e ordem de foco? As setas ↑/↓ são citadas como "caminho de teclado da reordenação", o que sugere que o resto foi assumido. [Coverage, Gap, Spec §FR-017]
- [ ] CHK036 - Existe requisito de **desempenho** para a listagem do histórico e para a geração dos dois PDFs? A geração passou para o servidor (desvio nº 1), o que introduz espera que não existia. [Gap, NFR]
- [ ] CHK037 - Estão definidos requisitos de **auditoria** no `spec.md`? O `ProposalAuditLog` aparece no modelo de dados e nas tarefas, mas nenhum FR o exige. [Gap, Traceability]
- [ ] CHK038 - Os requisitos de segurança cobrem o fato de que os dois schemas **não entregam isolamento** — mesmo processo, mesmo usuário de banco? A ressalva está no `research.md`, não no `spec.md`. [Completeness, Research §D1]

## Dependencies & Assumptions

- [ ] CHK039 - A premissa de que a referência permanece **congelada em `6f5b072`** está registrada com a consequência de violá-la: os IDs do inventário passam a apontar para outro elemento **em silêncio**. Existe verificação prevista para detectar isso? [Assumption, Spec §Assumptions]
- [ ] CHK040 - A dependência de `@hookform/resolvers` (não instalado) está registrada no `plan.md`. Ela aparece em algum requisito ou critério de aceite? [Dependency, Plan §Technical Context]
- [ ] CHK041 - A premissa de que a auditoria do `reorderDrag.ts` pode **reprovar** está orçada (+1 d). O que acontece com o cronograma e com as 4 telas que já o usam está documentado? [Assumption, Research §D6]
- [ ] CHK042 - Está registrado que os IDs `LOGIN-*` **não têm destino** no porte, e por quê? Sem esse registro, o silêncio deles vira indistinguível de esquecimento. [Traceability, Tasks §T098a]

## Resolvidos em 31/07 pelo mantenedor

- [x] **CHK019** — marcador do tutorial: **por usuário, no servidor**. `localStorage`
      fica só para a campanha de novidade. *"O tutorial acompanha a pessoa, a campanha
      acompanha o dispositivo."* → FR-025a, FR-025b
- [x] **CHK001** — exclusão: **não existe**. Só **arquivar**, sem exclusão definitiva.
      → FR-060 a FR-063
- [x] **CHK005/CHK006** — concorrência: finalização **exclusiva** (409 informando quando
      e por quem); escrita concorrente **avisa antes de sobrescrever**, sem travar.
      → FR-069, FR-070
- [x] **CHK030** — fluxo de revisão: **não precisou de decisão**. A referência define
      tudo — número base, próxima revisão, os dois caminhos de `snapshotAvailable` e o
      reuso do card do CRM. Escrito a partir da evidência. → FR-064 a FR-068

## Ambiguities & Conflicts — resumo do que precisa de decisão

Os itens abaixo são os que, se não resolvidos, produzem retrabalho:

- [x] ~~CHK043~~ - **CHK019** (marcador do tutorial: por usuário ou por navegador) — decide onde o estado mora, e a escolha errada é percebida só em produção.
- [x] ~~CHK044~~ - **CHK001** (não há requisito de exclusão) — decide se existem rotas e telas que hoje não estão em nenhuma das 121 tarefas.
- [x] ~~CHK045~~ - **CHK005/CHK006** (edição e finalização concorrentes) — a finalização é irreversível e consome integração externa.
- [x] ~~CHK046~~ - **CHK030** (fluxo de revisão sem história própria) — está no modelo de dados e no diálogo de modo, mas ninguém escreveu o que ele exige.
