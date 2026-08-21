# Research: Efetivo Operacional — Planejamento Completo

## 1. Fronteira entre projeto e missão operacional

**Decision**: manter `Project` como identidade canônica do contrato e criar uma programação operacional 1:1 própria (`EfetivoMissionPlan`).

**Rationale**: `Project` já concentra código, nome, cliente e local. Seus campos `mobilizationDate`, `startDate`, `laborCollaboratorIds` e previsões de HH pertencem ao Acompanhamento/realizado e não têm intervalo, integridade relacional ou auditoria suficientes para o planejamento por pessoa. A programação própria evita duplicar o contrato sem mudar o significado de dados existentes.

**Alternatives considered**:

- Acrescentar todas as colunas diretamente a `Project`: mistura ciclo comercial/execução com planejamento do Efetivo e amplia um modelo já central.
- Reutilizar `laborCollaboratorIds`: JSON sem datas, função ocupada, autoria ou proteção contra conflitos.
- Reutilizar `ProjectPlannedNormalHours`: representa HH vendidas agregadas, não vagas em pessoas.

## 2. Vínculo estável entre colaborador e função

**Decision**: adicionar `Collaborator.jobRoleId` opcional e manter `Collaborator.role` como snapshot/compatibilidade.

**Rationale**: elegibilidade, demanda e alocação exigem chave relacional. Hoje o casamento por nome normalizado é tolerável para relatórios, mas renomear um cargo pode quebrar planejamento e histórico. Na transição, registros sem chave continuam resolvidos pelo nome e aparecem como pendência quando ambíguos.

**Alternatives considered**:

- Continuar apenas com texto: frágil a renome, duplicidade e acentos.
- Remover `role`: quebra integrações, formulários e relatórios existentes; a migração precisa ser gradual.

## 3. Datas civis e sobreposição

**Decision**: representar entradas e saídas de negócio como `YYYY-MM-DD`, persistir como data civil e tratar intervalos como inclusivos.

**Rationale**: o projeto já usa `@db.Date` e helpers UTC no Efetivo. A regra uniforme de sobreposição é `a.start <= b.end && b.start <= a.end`, já aplicada nas ausências.

**Alternatives considered**:

- Instantes com horário/local: não há alocação parcial por hora nesta expansão e isso introduziria erros de fuso.
- Fim exclusivo: diverge da linguagem de mobilização/retorno e das ausências existentes.

## 4. Capacidade e utilização planejada

**Decision**: calcular a capacidade em conjuntos únicos `collaboratorId|date` na janela inclusiva; dia útil é segunda a sexta menos feriados globais. O denominador é a capacidade útil do vínculo ativo menos ausências; o numerador são dias úteis comprometidos em missões confirmadas. Denominador zero retorna indisponível (`null`).

**Rationale**: conjuntos evitam dupla contagem e tornam a fórmula reproduzível. Separar ausência do denominador e missão no numerador mantém o indicador planejado independente das HH realizadas.

**Alternatives considered**:

- Usar horas vendidas: mistura dimensão financeira/contratual com pessoas disponíveis.
- Contar dias corridos: contraria a referência funcional e distorce finais de semana.
- Tratar ausência como utilização: inflaria ocupação sem trabalho planejado.

## 5. Precedência de situação e conflitos

**Decision**: na leitura de uma data, a precedência é indisponível → alocado → livre. Qualquer sobreposição entre ausência e missão confirmada ou entre duas missões confirmadas bloqueia a escrita e identifica os registros conflitantes.

**Rationale**: uma pessoa não pode compor mais de um total. O bloqueio ocorre no serviço dentro da mesma transação da alteração; restrições únicas cobrem apenas duplicidades simples, não intervalos.

**Alternatives considered**:

- Aceitar conflito e apenas alertar: produz capacidade oficial inconsistente.
- Resolver silenciosamente pela última gravação: perde intenção e auditoria.

## 6. Permanência contínua em obra

**Decision**: ordenar e unir intervalos confirmados sobrepostos ou adjacentes por pessoa. A sequência só quebra quando existe ao menos um dia civil inteiro sem alocação ou uma `FOLGA` explícita; retorno seguido por nova mobilização no dia seguinte permanece contínuo. Contar dias corridos inclusivos e comparar ao limite configurado da função, com fallback 90/60/30 pelas categorias confirmadas.

**Rationale**: a regra empresarial fala em permanência contínua, não dias úteis. Unir intervalos evita reset artificial entre missões consecutivas.

**Alternatives considered**:

- Somar dias no ano: deixa de ser permanência contínua.
- Codificar limites somente por nome: o fallback ajuda a migração, mas a configuração explícita por função é a fonte futura.

## 7. Alertas de férias

**Decision**: derivar períodos aquisitivos anuais da admissão e verificar férias registradas na janela concessiva subsequente; alertar vencimento quando a janela encerra e programação quando faltar até 120 dias. O alerta é operacional, não substitui folha ou análise jurídica.

**Rationale**: a CLT prevê aquisição após 12 meses e concessão nos 12 meses seguintes; os registros de férias da feature 011 tornam o alerta calculável. Fontes oficiais consultadas: [CLT, arts. 130 e 134](https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm) e [TST — Férias](https://www.tst.jus.br/en/ferias1).

**Alternatives considered**:

- Armazenar um status manual: fica rapidamente desatualizado.
- Declarar conformidade legal integral: fora do escopo e incompatível com as exceções que um sistema de folha conhece.

## 8. Cenários, concorrência e aplicação

**Decision**: usar o mesmo grafo relacional `EfetivoPlan → missões → demandas/alocações/contratações planejadas` para o oficial e para cenários. Cada cenário é uma cópia materializada do oficial e guarda a revisão de base. A aplicação usa uma única transação, faz compare-and-swap da revisão, revalida conflitos, cria o novo oficial, supera o anterior, grava auditoria e marca o cenário como aplicado. Repetir a aplicação de cenário já aplicado devolve o resultado existente.

**Rationale**: impede aplicação parcial e sobrescrita de mudanças feitas depois da comparação. O repositório já usa `updateMany` como claim/CAS, tratamento idempotente de conflitos únicos e auditoria dentro de transação.

**Alternatives considered**:

- Guardar apenas patches em JSON: difícil consultar, comparar, auditar e validar relações com as mesmas regras do oficial.
- Aplicar endpoint por endpoint: cria estado parcial quando uma etapa falha.
- Lock pessimista de longa duração: desnecessário para o volume esperado.

## 9. Auditoria do módulo

**Decision**: criar `EfetivoAuditEvent` genérico, gravado na mesma transação de cada mutação, com tipo/alvo/ação e snapshots antes/depois.

**Rationale**: logs atuais são específicos de RDO ou EPI. Um evento próprio mantém o domínio isolado e permite a atividade recente da Administração.

**Alternatives considered**:

- Reusar `ReportAuditLog`: semântica e relações específicas de relatório.
- Log somente textual: não permite reconstruir o que mudou.

## 10. Contratos e permissão

**Decision**: expor rotas próprias sob `/api/efetivo` para projetos mínimos, colaboradores, planejamento e administração, usando `efetivo:viewer` para leitura e `efetivo:manager` para escrita.

**Rationale**: rotas de projetos/colaboradores existentes exigem papéis de outros módulos. Um gestor exclusivo do Efetivo precisa trabalhar sem receber acesso a custos/RDO; as rotas próprias continuam escrevendo nos cadastros canônicos.

**Alternatives considered**:

- Dar papel do Acompanhamento a todos: viola mínimo privilégio.
- Duplicar projetos/colaboradores: cria divergência cadastral.

## 11. Calendário e navegação frontend

**Decision**: implementar calendário/agenda sem dependência nova, com data helpers locais e estado em query params; desktop oferece grade mensal/semanal e mobile troca para agenda empilhada. A página mantém `?section=` e limpa apenas parâmetros incompatíveis.

**Rationale**: não há biblioteca de calendário no projeto; adicionar uma para oito visões simples aumentaria bundle e identidade visual. `useUrlParamState` e as páginas modulares existentes já resolvem persistência/limpeza de URL.

**Alternatives considered**:

- Biblioteca externa de calendário: peso e personalização desnecessários para o escopo.
- Estado só em memória: quebra refresh e compartilhamento.

## 12. Kanban e drag-and-drop

**Decision**: estender o padrão de `QualityNaturesTab` e `utils/reorderDrag.ts` para movimento entre colunas, com Pointer Events, ghost, placeholder, cancelamento e persistência somente no drop; oferecer menu/select acessível equivalente.

**Rationale**: é o padrão constitucional e já funciona com mouse/toque. `ProjectCardsBoard` serve como referência de card/detalhe, mas não é kanban nem DnD.

**Alternatives considered**:

- API HTML5 Drag apenas: falha em toque e teclado.
- Adicionar biblioteca DnD: dependência nova sem ganho necessário.

## 13. Formulários, busca e responsividade

**Decision**: usar o padrão de `AbsenceFormModal` para formulários e `SearchBar` para busca. Como não há combobox compartilhado, criar um componente de seleção pesquisável no kit antes de usá-lo para projetos/pessoas. Tabelas viram cards em até 640 px e o kanban vira seletor de etapa + lista.

**Rationale**: garante validação Zod nas duas pontas, rodapé fixo, mensagens por campo e ausência de overflow. Criar o combobox uma vez evita controles ad hoc divergentes.

**Alternatives considered**:

- `select` com centenas de pessoas/projetos: ruim para busca e acessibilidade.
- Combobox específico em cada modal: duplica lógica complexa.
