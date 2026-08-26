# Quickstart: Planejamento Completo do Efetivo Operacional

## Pré-requisitos locais

- Node.js e npm nas versões aceitas pelo repositório.
- PostgreSQL de desenvolvimento acessível pela `DATABASE_URL` já usada pelo backend.
- Dependências do monorepo instaladas sem modificar versões fora desta feature.

Não use nem encerre processos que já ocupem `localhost:5173`. Escolha uma porta livre para o frontend desta branch.

## Preparação local

Na raiz do repositório:

```bash
npm ci
npm --prefix backend ci
npm --prefix frontend ci
npm --prefix backend run prisma:generate
```

Para um banco descartável de desenvolvimento, aplique a migração versionada pelo comando já previsto no projeto:

```bash
npm --prefix backend run prisma:migrate
```

Esse comando é somente para ambiente local controlado. Migração em produção e reinício de serviços são responsabilidade do operador e não fazem parte da execução automática desta feature.

## Execução

Use os scripts existentes do backend e frontend em terminais separados. Se o Vite informar que 5173 está ocupado, aceite a próxima porta livre; não mate nem altere o processo existente.

## Validação automatizada

Executar da raiz, direcionando cada comando ao pacote que declara o script:

```bash
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix backend test
npm --prefix frontend test
npm run architecture:check
```

No backend, executar os testes de unidade e comportamento do Efetivo, incluindo:

- datas civis, dias úteis e feriados;
- capacidade e utilização móvel de 90 dias;
- conflito de ausência e dupla alocação;
- cronologia/demanda e autoalocação;
- permanência contínua e alertas de férias;
- isolamento, rollback, concorrência e idempotência de cenários;
- regressão da Produtividade baseada no Ponto Mais.

No frontend, validar helpers de calendário, URL e Kanban, além do build TypeScript.

## Roteiro funcional mínimo

1. Entrar com `efetivo:manager` e abrir `Efetivo > Administração`.
2. Marcar funções operacionais, definir cores/prazos e cadastrar um feriado.
3. Em `Colaboradores`, vincular funções/admissões e criar uma folga de teste.
4. Em `Missões`, selecionar um projeto, informar a cronologia e escolher diretamente colaboradores pelo nome/cargo.
5. Salvar e conferir que demanda por função e equipe foram derivadas das pessoas selecionadas.
6. Tentar incluir uma pessoa em folga ou em outra missão e verificar o conflito com pessoa, período e caminho do registro, sem alteração parcial.
7. Validar a missão no calendário diário, semanal e mensal.
8. Conferir na Visão geral os totais, déficit, mobilizações e utilização de 90 dias.
9. Mover a missão no Kanban por arraste e pela alternativa acessível; cancelar um arraste e confirmar rollback visual.
10. Criar um cenário, alterar demanda, adicionar contratação hipotética e comparar com o oficial.
11. Descartar o primeiro cenário e verificar que o oficial não mudou.
12. Criar outro, aplicar e confirmar uma única troca do oficial e um evento de auditoria.
13. Abrir Produtividade e confirmar que os valores permanecem derivados somente do ponto.

## Matriz visual

Validar no mínimo 1440×900, 768×1024 e 390×844:

- nenhuma página produz scroll horizontal global;
- calendário mensal vira agenda vertical em 390 px;
- tabela de colaboradores vira cards com rótulos;
- Kanban vira seletor de etapa + lista única;
- modais mantêm cabeçalho/rodapé visíveis e corpo rolável;
- campos obrigatórios vazios exibem borda, `aria-invalid` e mensagem;
- combobox funciona com teclado, toque, loading, vazio, disabled e erro;
- seção, data, visão, filtros e item selecionado sobrevivem ao refresh.

## Evidência e entrega

- Registrar resultados de lint, build e testes.
- Capturar evidência visual apenas após dados de teste estarem consistentes.
- Não incluir cookies, tokens, nomes reais ou outros dados sensíveis em screenshots/logs.
- Entregar a migração para o operador executar no ambiente de destino conforme o procedimento vigente.

## Evidência registrada em 2026-08-26

Validações executadas nesta branch:

- backend: `139/139` arquivos de teste aprovados com `NODE_ENV=test` e uma `DATABASE_URL` sintática, sem conexão nem escrita no banco de desenvolvimento;
- frontend: `23/23` arquivos de teste aprovados;
- lint frontend: zero erros e um aviso preexistente fora do módulo (`OmieCostCategoriesPanel.tsx`);
- build frontend: TypeScript e Vite aprovados; permanece apenas o aviso conhecido de chunk principal acima de 500 kB;
- Prisma: `generate` e `validate` aprovados para o schema novo;
- arquitetura: verificação do repositório aprovada;
- contrato OpenAPI: YAML válido;
- visual funcional em `localhost:5175`: criação com duas pessoas de cargos diferentes, demanda derivada `1/1` por cargo, edição com pré-seleção, remoção de uma pessoa, exclusão lógica da programação e retorno do projeto à lista pendente; os dados de teste foram removidos ao final;
- visual em sessão limpa: lista com 47 colaboradores e seus cargos, busca por `mantenedor`, seleção com resumo `Mantenedor I · 1` e zero erros no console;
- concorrência PostgreSQL real: `2/2` casos aprovados no container local `filtrovali-local-backend`, incluindo duas transações simultâneas disputando o mesmo colaborador; apenas uma alocação foi persistida e os dados aleatórios do plano de cenário foram removidos pelo próprio teste.

Medição sintética da projeção diária + utilização de 90 dias, com 500 colaboradores, 100 missões confirmadas e 500 alocações:

- antes do índice em memória por colaborador: `4273,59 ms`;
- depois do índice em memória de ausências/missões e agregação única de demanda: `138,96 ms`;
- ganho observado na mesma execução: aproximadamente `30,8×`.

Pendências exclusivamente operacionais (revisadas em 2026-08-26):

- nenhuma migração foi criada ou aplicada por este ajuste; o banco PostgreSQL local fornecido pelo usuário já estava migrado;
- o teste de concorrência permanece ignorado por padrão nas suítes comuns; para repeti-lo, use `EFETIVO_DB_TESTS=1 DATABASE_URL=<banco descartável> node --test test/efetivo-allocation-concurrency.test.js` a partir de `backend/` (ele cria e remove os próprios dados em um plano de cenário, sem tocar no planejamento oficial);
- somente o backend local foi reiniciado para carregar as correções; banco e frontend do ambiente Docker fornecido não foram reiniciados;
- a auditoria visual reutilizou `localhost:5175` e encerrou apenas a sessão automatizada do navegador ao final.
