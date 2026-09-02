# Roadmap do redesign do frontend

Atualizado em 02/09/2026 após a integração da `main` (`703cb0f6`) na branch
`feat/frontend-redesign-2` pelo merge `c573efbd`.

## Objetivo

Levar todo o frontend para a linguagem visual e para os contratos responsivos já
adotados no Hub e no piloto do RDO, sem alterar regras de negócio, permissões,
URLs públicas ou contratos de API.

Este roadmap passa a ser a fonte de escopo do redesign. As specs funcionais de
cada módulo continuam sendo a fonte de verdade para comportamento e dados.

## Estado após a integração

- A fundação do design system, o `AppShell`, o Hub e as principais superfícies do
  gestor do RDO já têm implementação parcial ou completa.
- Efetivo e Assinaturas chegaram funcionais, mas ainda usam majoritariamente o
  shell, os controles e as classes visuais legadas.
- Acompanhamento, Estoque, Romaneio, Qualidade, EPI, Administração e RDO receberam
  fluxos novos que precisam entrar na auditoria visual e responsiva.
- O merge preservou o redesign existente e incorporou no Hub os módulos Efetivo e
  Assinaturas, incluindo ícones, campanhas de novidade e permissões.

## Gate arquitetural antes do PR final

O `npm run architecture:check` ainda bloqueia esta branch e deve ser tratado como
P0, sem elevar artificialmente os budgets:

- `GestorPage.tsx` está com 7.109 linhas para um limite de 4.581; os blocos já
  isolados de colaboradores, upload manual e superfícies administrativas devem ser
  extraídos antes do PR final;
- o harness do design system tem um input cujo placeholder ainda funciona como
  único rótulo;
- o Gestor tem dois inputs na mesma condição e precisa receber `label`/`id` ou o
  campo compartilhado equivalente.

Esses itens não impedem o estudo e a execução das ondas do redesign, mas fazem
parte da definição de pronto da branch e devem ser concluídos antes da integração
final com a `main`.

## Contratos obrigatórios do redesign

Todas as fases devem preservar os seguintes contratos:

1. Usar tokens e componentes compartilhados; estilos específicos devem ficar
   escopados pela raiz do módulo.
2. Usar `AppShell`, navegação consistente, breadcrumb, perfil e ações utilitárias.
3. Manter em URL o estado navegável de abas, seções, filtros e detalhes.
4. Não criar scroll horizontal de página no mobile. Linhas de ações de cards devem
   permanecer em uma única linha, sem mini-scroll; quando necessário, reduzir
   texto, espaçamento ou usar ações iconográficas acessíveis.
5. Diálogos de formulário devem aparecer no mobile como caixas compactas. Apenas
   fluxos espaciais, como edição de PDF, podem ocupar uma superfície ampliada de
   forma intencional.
6. Formulários mobile devem usar densidade compacta sem reduzir a área de toque,
   com rótulo, foco, erro, disabled e tipografia padronizados.
7. Preservar foco, `Escape`, foco inicial, devolução de foco, leitor de tela e
   navegação por teclado em drawers, menus, tabs, tabelas e diálogos.
8. Cobrir loading, vazio, erro, sucesso, somente leitura e falta de permissão.

## Inventário incorporado ao escopo

| Área | Superfícies que agora fazem parte do redesign | Situação |
| --- | --- | --- |
| Hub e navegação global | Cards de Efetivo e Assinaturas, novidades, ícones e acesso por perfil | Integração concluída; revisão visual final pendente |
| Efetivo | Visão geral, Calendário, Colaboradores/Ausências, Disponibilidade, Missões, Kanban de evolução, Simulações, Produtividade e Administração | Novo módulo; redesign completo pendente |
| Assinaturas | Lista de ativos/arquivados, novo documento, configuração do PDF, assinantes, publicação, acompanhamento, auditoria e assinatura pública | Novo módulo; redesign completo pendente |
| Acompanhamento | Dashboard e cards de missão, relatórios/PDF, notas da gestão, histórico de standby, horas por colaborador, auditoria de alocação e dias não alocados | Novos fluxos; harmonização pendente |
| Estoque | Resumo expansível por lote, devolução com múltiplos itens, documentos do item e ordenação de movimentações | Novos fluxos; harmonização pendente |
| Romaneio | Impressão de etiquetas QR, scanner por câmera e continuação da inclusão do item após leitura | Novos fluxos; harmonização pendente |
| RDO e gestão | Histórico de cargos, upload manual de vários PDFs, sugestão de equipe do Efetivo, justificativas, horários obrigatórios e avisos operacionais | Parcialmente conciliado com o piloto; revisão pendente |
| Qualidade | Registros internos/SGQ no formulário de registros | Ajuste localizado pendente |
| Administração e EPI | Visibilidade de categorias Omie, cargo operacional e cargo temporário de EPI | Ajustes localizados pendentes |
| Onboarding | Tutoriais e campanhas de Efetivo, Assinaturas, QR, standby e controles operacionais | Auditoria visual e mobile pendente |

## Inventário de diálogos e overlays

### Efetivo

- ausência;
- cadastro operacional de colaborador;
- programação de missão;
- seleção de equipe por disponibilidade;
- alocação e períodos individuais;
- conclusão de missão;
- criação de cenário;
- detalhe de produtividade do colaborador;
- configuração da referência de produtividade;
- cadastro de feriado.

### Assinaturas

- envio de novo PDF;
- publicação e validade dos convites;
- confirmações de arquivar, cancelar e excluir;
- seletor contextual de assinante sobre o PDF;
- fluxo público de leitura e assinatura.

### Demais módulos

- Acompanhamento: relatórios da missão, visualizador de PDF, histórico de standby
  e horas por colaborador;
- Estoque: documentos do item e formulários ampliados de item/movimentação;
- Romaneio: etiquetas QR e leitor por câmera;
- Gestor: edição do histórico de cargos e cards do upload manual;
- Qualidade: formulário de registro com destino interno/SGQ.

## Fases de implementação

### F0 — Integração e baseline

Status: concluída neste ciclo.

- integrar a `main` sem perder o redesign existente;
- conciliar Hub, TopBar, cargos e colaboradores;
- atualizar dependências de PDF e QR;
- manter testes de contrato dos dois lados do merge.

Saída: build de produção e suíte estática do frontend verdes.

### F1 — Fundação compartilhada para os módulos novos

Prioridade: P0.

- migrar Efetivo e Assinaturas de `Shell`/`TopBar` legados para `AppShell`;
- criar modelos de navegação dos dois módulos sem duplicar regras do registry;
- padronizar cabeçalho, filtros, tabs/segmentos, cards, métricas, tabelas e estados;
- consolidar um contrato visual de diálogo sobre o `Modal` existente;
- criar variantes compactas para filtros, selects e formulários no mobile;
- adicionar exemplos dos novos padrões ao harness do design system.
- corrigir os rótulos estruturais apontados pelo check arquitetural;
- iniciar a extração do `GestorPage.tsx`, priorizando blocos já encapsulados e sem
  mudar contratos funcionais.

Critério de saída: as páginas-raiz usam o shell novo e nenhuma navegação funcional
é perdida em refresh, back/forward ou troca de perfil.

### F2 — Efetivo Operacional

Prioridade: P0. Executar em quatro ondas para limitar regressões.

#### F2.1 — Navegação e leitura executiva

- navegação das nove seções e seletor mobile;
- filtros de data e função;
- Visão geral, Calendário e Disponibilidade;
- detalhe do dia, vagas e conflitos.

#### F2.2 — Pessoas

- Colaboradores e Ausências;
- lista, busca, disponibilidade e estados selecionados pela URL;
- diálogos de colaborador e ausência;
- histórico e períodos que impactam capacidade.

#### F2.3 — Missões

- lista de missões e pendências;
- Kanban de evolução;
- programação, equipe, alocações individuais e conclusão;
- estados de conflito, confirmação e somente leitura.

#### F2.4 — Planejamento avançado e administração

- Simulações e comparação de cenários;
- Produtividade, pendências e detalhe individual;
- regras, referência, feriados e atividade/auditoria;
- tutorial permanente e campanha de novidade.

Critério de saída: todas as nove seções e os dez diálogos passam na matriz
desktop/mobile, inclusive com usuário viewer e manager.

### F3 — Assinaturas

Prioridade: P0.

#### F3.1 — Biblioteca de documentos

- lista vertical, busca, status, ativos/arquivados;
- cards, métricas de status, estados vazios e erros;
- diálogo de novo documento e upload de PDF.

#### F3.2 — Preparação

- cadastro e identificação visual dos assinantes;
- canvas do PDF, paginação, posicionamento, resize e remoção de campos;
- seletor contextual por toque/clique;
- diálogo de publicação.

#### F3.3 — Acompanhamento e auditoria

- status dos assinantes e ações de reenvio/copiar;
- ações de ciclo de vida e confirmações;
- timeline de auditoria, downloads e estados finais.

#### F3.4 — Assinatura pública

- leitura do documento, identificação, aceite e assinatura;
- estados expirado, revogado, concluído e erro;
- responsividade sem expor segredo em URL ou telemetria.

Critério de saída: configuração por mouse e toque, assinatura pública e lifecycle
funcionam sem overflow e com o mesmo vocabulário visual do app.

### F4 — Acompanhamento, Estoque e Romaneio

Prioridade: P1.

- Acompanhamento: migrar novas ações rápidas, painéis, notas, tabelas e os quatro
  diálogos; manter o PDF como overlay espacial deliberado;
- Estoque: harmonizar tabela expansível, lotes, devolução em lote, documentos e
  filtros/ordenação;
- Romaneio: harmonizar gatilhos, prévia/impressão de etiquetas e scanner; garantir
  fallback quando câmera ou permissão não estiver disponível.

Critério de saída: novas ações permanecem em uma linha nos cards e não introduzem
scroll localizado acidental em 360 px de largura.

### F5 — RDO, Gestão e ajustes transversais

Prioridade: P1.

- finalizar a superfície de histórico de cargos no padrão do gestor;
- redesenhar cards de upload manual e replicação de colaboradores;
- harmonizar avisos do planejamento, sugestão de equipe, justificativas e horários;
- revisar detalhes de relatório e estados operacionais;
- aplicar o padrão aos ajustes de Qualidade, EPI e Administração;
- revisar campanhas temporárias e tutoriais que apontam para controles redesenhados.
- concluir a decomposição do `GestorPage.tsx` abaixo do budget arquitetural.

Critério de saída: todo fluxo novo que entrou pelo merge está visualmente coberto e
os contratos do piloto do RDO continuam verdes.

### F6 — Consolidação e retirada do legado

Prioridade: P2, após F2–F5.

- remover CSS e componentes legados sem consumidores;
- reduzir duplicação entre `Button`, campos, busca, modal e componentes DS;
- dividir páginas críticas quando a migração permitir, sem ampliar arquivos acima
  dos budgets arquiteturais;
- executar auditoria de acessibilidade, responsividade e contraste;
- registrar screenshots de referência e testes de regressão visual dos fluxos
  principais.

## Matriz mínima de validação por entrega

- larguras: 360, 390, 768 e 1280 px;
- temas: claro e escuro quando a superfície estiver no shell novo;
- perfis: sem acesso, somente leitura e gestor/editor;
- estados: loading, vazio, erro, conteúdo curto, conteúdo longo e ação pendente;
- entrada: teclado, mouse e toque;
- navegação: refresh, back/forward e link direto com query params;
- automação: teste de contrato estático, teste comportamental do fluxo crítico,
  `npm run lint`, `npm test` e `npm run build`.

## Ordem recomendada dos próximos lotes

1. F1 + F2.1: shell e primeira fatia do Efetivo.
2. F3.1: shell e biblioteca de Assinaturas.
3. F2.2 e F2.3: pessoas e missões.
4. F3.2 e F3.3: preparação e acompanhamento de assinaturas.
5. F4: módulos existentes com novas superfícies.
6. F2.4, F3.4 e F5: fluxos avançados, público e ajustes transversais.
7. F6: remoção de legado e regressão visual final.

Essa ordem prioriza primeiro os shells e padrões reutilizáveis, depois os fluxos
operacionais de maior uso e, por fim, a consolidação técnica.
