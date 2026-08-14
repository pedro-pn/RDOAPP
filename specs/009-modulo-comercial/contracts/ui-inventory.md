# Inventário de UI — referência do módulo comercial

Etapa **E0-6** do `docs/PLANO_MODULO_COMERCIAL.md`. Extraído pela AST do
TypeScript a partir da referência congelada, **não por regex** — campo perdido
aqui vira campo perdido na reescrita, e ausência de campo não gera erro nenhum:
só some.

Este arquivo é o oráculo de paridade visual. O `/speckit-analyze` cruza os IDs
daqui contra as tarefas e acusa item sem cobertura. **Nenhum item pode ficar
órfão** (critério de aceite da E-1).

## Origem e estabilidade dos IDs

| | |
|---|---|
| Referência | `~/comercialAPP`, congelada em `6f5b072` |
| Extrator | `extract-ui-inventory.mjs` (AST, TypeScript 5.9) |
| Dados crus | `ui-inventory.raw.json` |

Os IDs derivam da ordem de linha do arquivo de origem. **Eles só são estáveis
porque a referência está congelada** — foi por isso que a E0-2 veio antes desta
etapa. Se a referência mudar, os IDs mudam e as tarefas que os citam passam a
apontar para outro elemento, em silêncio.

## Resumo

| Tela | ID | Arquivo | Linhas | Controles | Títulos | Textos |
|---|---|---|---:|---:|---:|---:|
| Login | `LOGIN` | `app/login/page.tsx` | 89 | 7 | 1 | 12 |
| Proposta comercial | `PROP` | `app/page.tsx` | 1760 | 137 | 22 | 330 |
| Levantamento de custos | `CUSTO` | `app/custos/page.tsx` | 3383 | 465 | 17 | 541 |
| Histórico de propostas | `HIST` | `app/historico/page.tsx` | 67 | 7 | 1 | 33 |

**Total: 616 controles e 916 textos visíveis.**

## Sinais de comportamento obrigatório

Ocorrências no código da referência, para a alínea (c) do Princípio VI
(`aria-invalid` com mensagem visível, estados de `select`, drag and drop no
padrão compartilhado, navegação em URL, tutorial de primeiro acesso).

| Tela | aria-invalid | select | drag/drop | estado em URL | localStorage | diálogo | tabela |
|---|---:|---:|---:|---:|---:|---:|---:|
| `LOGIN` | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `PROP` | 1 | 2 | 0 | 0 | 0 | 0 | 6 |
| `CUSTO` | 0 | 29 | 0 | 0 | 0 | 1 | 15 |
| `HIST` | 0 | 0 | 0 | 0 | 0 | 0 | 1 |

> **Zero em uma coluna é achado, não ausência de dado.** Onde a referência não
> tem o comportamento, o porte precisa implementá-lo para atender a constitution
> — a exceção de identidade portada dispensa a paleta, nunca o comportamento.
> Cada zero acima vira uma linha da lista de desvios deliberados (E0-8).

## LOGIN — Login

Origem: `app/login/page.tsx`

> ## ⚠ NÃO PORTADOS — `LOGIN-CTL-001..007`, `LOGIN-H-001`, `LOGIN-TXT-001..012`
>
> **Registrado na T098a, em 14/08/2026.** O módulo **não traz login próprio**:
> ele reusa o do filtroAPP. Isso é premissa desde o início do projeto — "mesmo
> nginx, mesmo login" —, não uma decisão tomada durante a implementação, e por
> isso não entra na lista fechada de desvios, que trata de paridade de UI dentro
> das telas portadas.
>
> **O registro existe para o silêncio não ser confundido com esquecimento.** Sem
> ele, o `/speckit-analyze` acusa 20 itens de inventário órfãos, e quem revisar
> a paridade vai procurar uma tela de login que nunca deveria existir.
>
> **A dívida que o reuso expôs foi corrigida na fonte** (T098): o
> `frontend/src/pages/LoginPage.tsx` do filtroAPP tinha **zero `aria-invalid`** e
> mandava campo vazio ao servidor, que respondia "usuário ou senha inválidos" —
> mensagem que manda procurar erro de digitação onde nada foi digitado, e que
> não diz qual dos dois campos faltou. Agora usa `.field-group.field-invalid` +
> `.field-error` + `aria-invalid` + `aria-describedby`, com mensagem por campo.
> Corrigir no módulo teria deixado a dívida para o próximo que reusasse o login.
>
> A tabela abaixo fica como está: ela é o inventário da **referência**, e a
> referência tinha essa tela. O que mudou é o destino dela, não o registro.

### LOGIN: títulos

| ID | Linha | Nível | Texto |
|---|---:|---|---|
| `LOGIN-H-001` | 50 | h1 | Gerador de propostas |

### LOGIN: controles

| ID | Linha | Elemento | Rótulo | Atributos |
|---|---:|---|---|---|
| `LOGIN-CTL-001` | 55 | `Link` | Continuar para o aplicativo | — |
| `LOGIN-CTL-002` | 57 | `form` | Usuário Senha | — |
| `LOGIN-CTL-003` | 58 | `label` | Usuário | — |
| `LOGIN-CTL-004` | 60 | `input` | — | value={username}, required=true, maxLength={80} |
| `LOGIN-CTL-005` | 69 | `label` | Senha | — |
| `LOGIN-CTL-006` | 71 | `input` | — | type=password, value={password}, required=true, maxLength={256} |
| `LOGIN-CTL-007` | 81 | `button` | — | disabled={loading} |

### LOGIN: textos visíveis

`jsx` = escrito direto na marcação. `codigo` = string do código (mensagem de
erro, rótulo de opção, texto de confirmação).

| ID | Linha | Origem | Texto |
|---|---:|---|---|
| `LOGIN-TXT-001` | 22 | codigo | Content-Type |
| `LOGIN-TXT-002` | 27 | codigo | Não foi possível entrar. |
| `LOGIN-TXT-003` | 49 | jsx | ACESSO INTERNO |
| `LOGIN-TXT-004` | 50 | jsx | Gerador de propostas |
| `LOGIN-TXT-005` | 51 | jsx | Entre com seu usuário para que propostas e levantamentos sejam identificados automaticamente. |
| `LOGIN-TXT-006` | 54 | jsx | Você já está conectado como |
| `LOGIN-TXT-007` | 55 | jsx | Continuar para o aplicativo |
| `LOGIN-TXT-008` | 59 | jsx | Usuário |
| `LOGIN-TXT-009` | 70 | jsx | Senha |
| `LOGIN-TXT-010` | 82 | codigo | Entrando... |
| `LOGIN-TXT-011` | 82 | codigo | Entrar |
| `LOGIN-TXT-012` | 85 | jsx | Filtrovali Engenharia · acesso restrito |

## PROP — Proposta comercial

Origem: `app/page.tsx`

### PROP: títulos

| ID | Linha | Nível | Texto |
|---|---:|---|---|
| `PROP-H-001` | 798 | h1 | Como deseja começar? |
| `PROP-H-002` | 847 | h1 | Propostas |
| `PROP-H-003` | 1186 | h2 | — |
| `PROP-H-004` | 1461 | h2 | — |
| `PROP-H-005` | 1464 | h3 | PROPOSTA Nº: |
| `PROP-H-006` | 1468 | h2 | ÍNDICE |
| `PROP-H-007` | 1472 | h3 | 1. Filtrovali é a escolha certa para a sua obra |
| `PROP-H-008` | 1475 | h3 | 1.1 Tradição e referência em serviços industriais |
| `PROP-H-009` | 1477 | h3 | 2. Descrição dos serviços que serão executados |
| `PROP-H-010` | 1479 | h4 | 2. |
| `PROP-H-011` | 1483 | h3 | — |
| `PROP-H-012` | 1485 | h4 | — |
| `PROP-H-013` | 1493 | h3 | 3. Matriz geral de responsabilidade |
| `PROP-H-014` | 1498 | h3 | 4. Previsão de atendimento |
| `PROP-H-015` | 1499 | h3 | 5. Prazo para execução dos serviços |
| `PROP-H-016` | 1500 | h3 | 6. Jornada de trabalho |
| `PROP-H-017` | 1502 | h3 | 7. Descrição dos valores |
| `PROP-H-018` | 1505 | h3 | 8. Condições de pagamento |
| `PROP-H-019` | 1509 | h3 | — |
| `PROP-H-020` | 1513 | h3 | 9. Validade da proposta |
| `PROP-H-021` | 1515 | h3 | 10. Observações |
| `PROP-H-022` | 1521 | h4 | — |

### PROP: controles

| ID | Linha | Elemento | Rótulo | Atributos |
|---|---:|---|---|---|
| `PROP-CTL-001` | 802 | `button` | ＋ Nova proposta Gera o conjunto técnico e comercial com novo número. | — |
| `PROP-CTL-002` | 803 | `button` | ↻ Revisar proposta Carrega os dados salvos e calcula a próxima revisão. | — |
| `PROP-CTL-003` | 807 | `label` | Número da proposta existente | — |
| `PROP-CTL-004` | 809 | `input` | — | value={revisionDraft.proposal}, placeholder=Ex.: 4418 |
| `PROP-CTL-005` | 820 | `button` | — | disabled={revisionSearchStatus === "loading" \|\| !revisionDraft.proposal.trim()} |
| `PROP-CTL-006` | 831 | `Link` | — | aria-label=Filtrovali |
| `PROP-CTL-007` | 838 | `Link` | Histórico | — |
| `PROP-CTL-008` | 839 | `button` | Sair | — |
| `PROP-CTL-009` | 840 | `button` | Imprimir prévia | — |
| `PROP-CTL-010` | 859 | `button` | — | — |
| `PROP-CTL-011` | 868 | `Step` | Orçamentista * Preenchido automaticamente pelo login de . | title=Cliente e responsáveis |
| `PROP-CTL-012` | 870 | `input` | — | value={crmQuery}, placeholder=Buscar empresa no Nectar... |
| `PROP-CTL-013` | 871 | `button` | — | disabled={crmStatus === "loading"} |
| `PROP-CTL-014` | 879 | `button` | — | disabled={unavailable}, title={unavailable ? "Cadastre o CNPJ desta empresa no Nectar para selecioná-la" : undefined} |
| `PROP-CTL-015` | 890 | `button` | · Usar contato | — |
| `PROP-CTL-016` | 895 | `SelectField` | — | value={form.seller}, required=true |
| `PROP-CTL-017` | 896 | `label` | Orçamentista * Preenchido automaticamente pelo login de . | — |
| `PROP-CTL-018` | 898 | `input` | — | value={authUser.estimatorName}, readOnly=true |
| `PROP-CTL-019` | 901 | `Field` | — | type=date, value={form.date}, required=true |
| `PROP-CTL-020` | 904 | `Field` | — | value={form.client}, required=true |
| `PROP-CTL-021` | 905 | `Field` | — | value={form.cnpj}, required=true |
| `PROP-CTL-022` | 908 | `Field` | — | value={form.contact}, required=true |
| `PROP-CTL-023` | 909 | `Field` | — | type=email, value={form.email}, required=true |
| `PROP-CTL-024` | 910 | `Field` | — | value={form.department} |
| `PROP-CTL-025` | 912 | `Field` | — | value={form.site}, placeholder=Ex.: Rua, número, cidade/UF ou unidade industrial, required=true |
| `PROP-CTL-026` | 917 | `Step` | Descrição dos serviços que serão executados Cada serviço vira um item próprio (2.1, 2.2...) e pode ter suas próprias tabelas e fotos. ＋ Adicionar serviço | title=Escopo comum |
| `PROP-CTL-027` | 918 | `Field` | — | value={form.title}, placeholder=Ex.: Limpeza química de tubulações, required=true |
| `PROP-CTL-028` | 925 | `button` | ＋ Adicionar serviço | type=button |
| `PROP-CTL-029` | 943 | `button` | ↑ | type=button, disabled={index === 0}, aria-label={`Mover serviço ${index + 1} para cima`} |
| `PROP-CTL-030` | 944 | `button` | ↓ | type=button, disabled={index === scopeItems.length - 1}, aria-label={`Mover serviço ${index + 1} para baixo`} |
| `PROP-CTL-031` | 945 | `button` | × | type=button, disabled={scopeItems.length === 1}, aria-label={`Remover serviço ${index + 1}`} |
| `PROP-CTL-032` | 960 | `Field` | — | value={item.title}, placeholder=Ex.: Serviço de flushing, required=true |
| `PROP-CTL-033` | 967 | `Area` | — | value={item.description}, required=true |
| `PROP-CTL-034` | 991 | `Step` | + Adicionar responsabilidade | title=Matriz de responsabilidades |
| `PROP-CTL-035` | 996 | `input` | — | value={row.item} |
| `PROP-CTL-036` | 997 | `select` | Filtrovali Contratante N/A | value={row.owner} |
| `PROP-CTL-037` | 997 | `option` | Filtrovali | — |
| `PROP-CTL-038` | 997 | `option` | Contratante | — |
| `PROP-CTL-039` | 997 | `option` | N/A | — |
| `PROP-CTL-040` | 998 | `input` | — | value={row.note} |
| `PROP-CTL-041` | 999 | `button` | × | — |
| `PROP-CTL-042` | 1004 | `button` | + Adicionar responsabilidade | — |
| `PROP-CTL-043` | 1009 | `Step` | — | title=Prazos e jornada |
| `PROP-CTL-044` | 1011 | `Field` | — | value={form.attendance}, placeholder=Ex.: até 10 dias, required=true |
| `PROP-CTL-045` | 1012 | `Field` | — | value={form.mobilization}, placeholder=Ex.: 7 dias, required=true |
| `PROP-CTL-046` | 1013 | `Field` | — | value={form.permanence}, placeholder=Ex.: 12 dias corridos, required=true |
| `PROP-CTL-047` | 1014 | `Field` | — | value={form.execution}, placeholder=Ex.: 10 dias trabalhados, required=true |
| `PROP-CTL-048` | 1016 | `Area` | — | value={form.workday}, required=true |
| `PROP-CTL-049` | 1021 | `Step` | — | title=Serviços da proposta técnica |
| `PROP-CTL-050` | 1032 | `Area` | — | value={form.technicalObjective}, required=true |
| `PROP-CTL-051` | 1033 | `Area` | — | value={form.technicalMethod}, required=true |
| `PROP-CTL-052` | 1034 | `Area` | — | value={form.technicalSteps}, required=true |
| `PROP-CTL-053` | 1036 | `Area` | — | value={form.technicalInspection}, required=true |
| `PROP-CTL-054` | 1037 | `Area` | — | value={form.technicalAcceptance}, required=true |
| `PROP-CTL-055` | 1039 | `Area` | — | value={form.technicalReports}, required=true |
| `PROP-CTL-056` | 1041 | `Area` | — | value={technicalReportNotes} |
| `PROP-CTL-057` | 1042 | `Area` | — | value={form.technicalObservations} |
| `PROP-CTL-058` | 1047 | `Step` | Incluir valor unitário Exibe preço unitário, quantidade e total conforme o modelo oficial. + Adicionar item de preço | title=Conteúdo da proposta comercial |
| `PROP-CTL-059` | 1048 | `label` | Incluir valor unitário Exibe preço unitário, quantidade e total conforme o modelo oficial. | — |
| `PROP-CTL-060` | 1048 | `input` | — | type=checkbox, checked={includeUnitValue} |
| `PROP-CTL-061` | 1053 | `input` | — | value={price.description} |
| `PROP-CTL-062` | 1054 | `input` | — | value={price.unit} |
| `PROP-CTL-063` | 1055 | `input` | — | aria-label=Quantidade, value={price.quantity} |
| `PROP-CTL-064` | 1056 | `input` | — | aria-label=Valor unitário, placeholder=R$ 0,00, value={price.unitValue} |
| `PROP-CTL-065` | 1057 | `input` | — | aria-label=Valor total, placeholder=R$ 0,00, value={price.value} |
| `PROP-CTL-066` | 1058 | `button` | × | — |
| `PROP-CTL-067` | 1063 | `button` | + Adicionar item de preço | — |
| `PROP-CTL-068` | 1065 | `Area` | — | value={form.payment}, required=true |
| `PROP-CTL-069` | 1066 | `Area` | — | value={form.observations} |
| `PROP-CTL-070` | 1068 | `Area` | — | value={form.taxes}, required=true |
| `PROP-CTL-071` | 1069 | `Field` | — | type=number, value={form.validity}, required=true |
| `PROP-CTL-072` | 1074 | `Step` | Documento comercial Proposta Comercial - - .pdf Valores, pagamento, impostos, know-how e aceite. Documento técnico Proposta Técnica - - .pdf Método, etapas, inspeção, liberação e relatórios. O que deseja baixar? As duas propostas sempre serão geradas e salvas no banco, mesmo quando você baixar apenas uma. Arquivos adicionais do cliente (opcional) Os anexos serão salvos na mesma pasta dos dois PDFs. Valor total enviado ao Nectar · empresa e contato vinculados. | title=Revisão e integração |
| `PROP-CTL-073` | 1083 | `button` | — | disabled={revisionSearchStatus === "loading" \|\| !selectedPipeline} |
| `PROP-CTL-074` | 1095 | `button` | Usar card existente Busca somente no funil . | — |
| `PROP-CTL-075` | 1096 | `button` | Criar card novo Cria na primeira etapa real do funil selecionado. | — |
| `PROP-CTL-076` | 1100 | `button` | — | disabled={revisionSearchStatus === "loading" \|\| !selectedPipeline} |
| `PROP-CTL-077` | 1125 | `label` | — | — |
| `PROP-CTL-078` | 1126 | `input` | — | type=radio, name=download-choice, value={value}, checked={downloadChoice === value} |
| `PROP-CTL-079` | 1131 | `Field` | — | value={existingFolder} |
| `PROP-CTL-080` | 1132 | `label` | Arquivos adicionais do cliente (opcional) Os anexos serão salvos na mesma pasta dos dois PDFs. | — |
| `PROP-CTL-081` | 1132 | `input` | — | type=file, multiple=true |
| `PROP-CTL-082` | 1135 | `button` | — | type=button |
| `PROP-CTL-083` | 1145 | `button` | Voltar | disabled={step === 0 \|\| finalizeStatus === "loading"} |
| `PROP-CTL-084` | 1149 | `button` | — | disabled={missing > 0 \|\| (step === 1 && scopeAssetStatus === "loading")} |
| `PROP-CTL-085` | 1150 | `button` | — | disabled={missing > 0 \|\| finalizeStatus === "loading" \|\| saved} |
| `PROP-CTL-086` | 1160 | `button` | Comercial | — |
| `PROP-CTL-087` | 1161 | `button` | Técnica | — |
| `PROP-CTL-088` | 1164 | `DocumentPreview` | — | rows={rows} |
| `PROP-CTL-089` | 1179 | `button` | Imprimir prévia | — |
| `PROP-CTL-090` | 1187 | `label` | — | — |
| `PROP-CTL-091` | 1187 | `input` | — | type={type}, value={value}, placeholder={placeholder}, required={required}, aria-invalid={Boolean(error)} |
| `PROP-CTL-092` | 1188 | `label` | — | — |
| `PROP-CTL-093` | 1188 | `textarea` | — | value={value} |
| `PROP-CTL-094` | 1190 | `label` | Selecione | — |
| `PROP-CTL-095` | 1190 | `select` | Selecione | value={value}, required={required} |
| `PROP-CTL-096` | 1190 | `option` | Selecione | value= |
| `PROP-CTL-097` | 1190 | `option` | — | value={option} |
| `PROP-CTL-098` | 1231 | `button` | — | type=button |
| `PROP-CTL-099` | 1265 | `button` | ↑ | type=button, aria-label=Mover serviço para cima, disabled={index === 0} |
| `PROP-CTL-100` | 1266 | `button` | ↓ | type=button, aria-label=Mover serviço para baixo, disabled={index === selections.length - 1} |
| `PROP-CTL-101` | 1267 | `button` | × | type=button, aria-label={`Remover ${selection.title}`} |
| `PROP-CTL-102` | 1270 | `label` | Título que aparecerá na proposta | — |
| `PROP-CTL-103` | 1272 | `input` | — | maxLength={120}, value={selection.title} |
| `PROP-CTL-104` | 1275 | `Field` | — | value={selection.parameters.nasTarget \|\| ""}, placeholder=Ex.: NAS 6, required=true |
| `PROP-CTL-105` | 1276 | `Field` | — | type=number, value={selection.parameters.ppmTarget \|\| ""}, placeholder=Ex.: 200, required=true |
| `PROP-CTL-106` | 1277 | `SelectField` | — | value={selection.parameters.oilType \|\| ""}, required=true |
| `PROP-CTL-107` | 1278 | `SelectField` | — | value={selection.parameters.material \|\| ""}, required=true |
| `PROP-CTL-108` | 1279 | `Field` | — | value={selection.parameters.otherMaterial \|\| ""}, placeholder=Ex.: cobre, alumínio ou liga especial, required=true |
| `PROP-CTL-109` | 1287 | `button` | Editar texto | type=button |
| `PROP-CTL-110` | 1288 | `button` | Restaurar modelo | type=button |
| `PROP-CTL-111` | 1292 | `label` | Texto personalizado * Os parâmetros acima não alteram um texto personalizado. Use “Restaurar modelo” para voltar ao texto automático. | — |
| `PROP-CTL-112` | 1294 | `textarea` | — | maxLength={MAX_TECHNICAL_SERVICE_TEXT}, value={selection.text} |
| `PROP-CTL-113` | 1362 | `button` | ＋ Inserir tabela | type=button, disabled={countScopeTables(allBlocks) >= MAX_SCOPE_TABLES} |
| `PROP-CTL-114` | 1363 | `label` | ＋ Incluir fotos | — |
| `PROP-CTL-115` | 1365 | `input` | — | type=file, accept=image/jpeg,image/png,image/webp, multiple=true, disabled={uploadStatus === "loading" \|\| countScopePhotos(allBlocks) >= MAX_SCOPE_PHOTOS} |
| `PROP-CTL-116` | 1386 | `button` | ↑ | type=button, aria-label=Mover conteúdo para cima, disabled={index === 0} |
| `PROP-CTL-117` | 1387 | `button` | ↓ | type=button, aria-label=Mover conteúdo para baixo, disabled={index === blocks.length - 1} |
| `PROP-CTL-118` | 1388 | `button` | × | type=button, aria-label={`Remover ${block.type === "table" ? "tabela" : "foto"}`} |
| `PROP-CTL-119` | 1392 | `label` | Título da tabela | — |
| `PROP-CTL-120` | 1392 | `input` | — | maxLength={120}, value={block.title} |
| `PROP-CTL-121` | 1395 | `input` | — | aria-label={`Cabeçalho ${columnIndex + 1}`}, maxLength={80}, value={column} |
| `PROP-CTL-122` | 1396 | `textarea` | — | aria-label={`Linha ${rowIndex + 1}, coluna ${columnIndex + 1}`}, maxLength={MAX_SCOPE_TABLE_CELL_CHARACTERS}, value={row[columnIndex] \|\| ""} |
| `PROP-CTL-123` | 1396 | `button` | × | type=button, aria-label={`Remover linha ${rowIndex + 1}`} |
| `PROP-CTL-124` | 1400 | `button` | ＋ Linha | type=button, disabled={block.rows.length >= MAX_SCOPE_TABLE_ROWS} |
| `PROP-CTL-125` | 1401 | `button` | ＋ Coluna | type=button, disabled={block.columns.length >= MAX_SCOPE_TABLE_COLUMNS} |
| `PROP-CTL-126` | 1402 | `button` | Remover última coluna | type=button, disabled={block.columns.length <= 2} |
| `PROP-CTL-127` | 1406 | `label` | Legenda da foto | — |
| `PROP-CTL-128` | 1406 | `textarea` | — | maxLength={240}, value={block.caption}, placeholder=Ex.: Condição inicial da tubulação |
| `PROP-CTL-129` | 1416 | `button` | Primeira etapa: | type=button |
| `PROP-CTL-130` | 1422 | `button` | — | type=button |
| `PROP-CTL-131` | 1460 | `ProposalPage` | Consultor de Vendas: Orçamentista: PROPOSTA Nº: CLIENTE: A/C: E-mail do solicitante: Departamento: Local da obra: CNPJ: ÍNDICE | — |
| `PROP-CTL-132` | 1471 | `ProposalPage` | 1. Filtrovali é a escolha certa para a sua obra Desde 2005, a Filtrovali entrega soluções industriais com excelência, segurança, qualidade e eficiência. 1.1 Tradição e referência em serviços industriais Limpeza química, flushing, filtragem absoluta, passagem de PIG, testes hidrostáticos, centrifugação e desidratação de óleo. 2. Descrição dos serviços que serão executados | — |
| `PROP-CTL-133` | 1492 | `ProposalPage` | 3. Matriz geral de responsabilidade | — |
| `PROP-CTL-134` | 1494 | `ResponsibilityTable` | — | title=Responsabilidade da Filtrovali, rows={rows.filter((row) => row.owner === "Filtrovali").slice(0, 6)} |
| `PROP-CTL-135` | 1495 | `ResponsibilityTable` | — | title=Responsabilidade da Contratante, rows={rows.filter((row) => row.owner === "Contratante").slice(0, 6)} |
| `PROP-CTL-136` | 1497 | `ProposalPage` | 4. Previsão de atendimento após o pedido ou contrato. Mobilização: . 5. Prazo para execução dos serviços Permanência: . Execução: . 6. Jornada de trabalho | — |
| `PROP-CTL-137` | 1512 | `ProposalPage` | 9. Validade da proposta dias após a emissão. 10. Observações | — |

### PROP: textos visíveis

`jsx` = escrito direto na marcação. `codigo` = string do código (mensagem de
erro, rótulo de opção, texto de confirmação).

| ID | Linha | Origem | Texto |
|---|---:|---|---|
| `PROP-TXT-001` | 50 | codigo | Filtrovali |
| `PROP-TXT-002` | 50 | codigo | Contratante |
| `PROP-TXT-003` | 92 | codigo | Cliente |
| `PROP-TXT-004` | 92 | codigo | Escopo |
| `PROP-TXT-005` | 92 | codigo | Responsabilidades |
| `PROP-TXT-006` | 92 | codigo | Prazos |
| `PROP-TXT-007` | 92 | codigo | Técnica |
| `PROP-TXT-008` | 92 | codigo | Comercial |
| `PROP-TXT-009` | 92 | codigo | Revisão |
| `PROP-TXT-010` | 93 | codigo | Ruan |
| `PROP-TXT-011` | 93 | codigo | Cleverton |
| `PROP-TXT-012` | 93 | codigo | Aliander |
| `PROP-TXT-013` | 93 | codigo | Joelson |
| `PROP-TXT-014` | 93 | codigo | Lucas |
| `PROP-TXT-015` | 93 | codigo | Julio |
| `PROP-TXT-016` | 94 | codigo | Filtrovali é a escolha certa para sua obra |
| `PROP-TXT-017` | 94 | codigo | Descrição dos serviços |
| `PROP-TXT-018` | 94 | codigo | Matriz de responsabilidade |
| `PROP-TXT-019` | 94 | codigo | Previsão de atendimento |
| `PROP-TXT-020` | 94 | codigo | Prazo de execução |
| `PROP-TXT-021` | 94 | codigo | Jornada de trabalho |
| `PROP-TXT-022` | 94 | codigo | Descrição de valores |
| `PROP-TXT-023` | 94 | codigo | Condições de pagamento |
| `PROP-TXT-024` | 94 | codigo | Observações |
| `PROP-TXT-025` | 94 | codigo | Impostos |
| `PROP-TXT-026` | 94 | codigo | Validade |
| `PROP-TXT-027` | 94 | codigo | Propriedade intelectual |
| `PROP-TXT-028` | 94 | codigo | Aceite e assinatura |
| `PROP-TXT-029` | 95 | codigo | Escopo técnico |
| `PROP-TXT-030` | 95 | codigo | Relatórios |
| `PROP-TXT-031` | 97 | codigo | Equipe especializada para execução dos serviços |
| `PROP-TXT-032` | 98 | codigo | Ferramentas manuais, máquinas de solda, esmerilhadeira, retífica e talha |
| `PROP-TXT-033` | 99 | codigo | Encargos sociais trabalhistas, previdenciários, impostos ou taxas sobre os serviços prestados atualmente em vigor |
| `PROP-TXT-034` | 100 | codigo | Fornecimento de EPI's aos colaboradores Filtrovali Engenharia, conforme descrito nas FISPQs |
| `PROP-TXT-035` | 101 | codigo | Executar os serviços dentro dos padrões definidos pela Contratante, pelos fornecedores dos equipamentos e pelas normas técnicas |
| `PROP-TXT-036` | 102 | codigo | PPRA, PCMSO e LTCAT modelo padrão indicado pela clínica ocupacional da Contratada |
| `PROP-TXT-037` | 103 | codigo | Fornecimento de insumos e abrasivos |
| `PROP-TXT-038` | 104 | codigo | Frete para entrega e retirada dos materiais |
| `PROP-TXT-039` | 105 | codigo | Fornecimento da matéria-prima |
| `PROP-TXT-040` | 106 | codigo | Pacote de trabalho para realização do serviço |
| `PROP-TXT-041` | 107 | codigo | Aprovar e liberar os Boletins de Medição em até no máximo 48 horas; caso não sejam entregues dentro do prazo, serão considerados aceitos e a nota fiscal será encaminhada para faturamento |
| `PROP-TXT-042` | 108 | codigo | Projetos, normas, especificações, documentos e instruções |
| `PROP-TXT-043` | 109 | codigo | Fornecimento de atestado de capacidade técnica após a finalização de todos os serviços realizados com qualidade |
| `PROP-TXT-044` | 110 | codigo | Qualificação de soldadores |
| `PROP-TXT-045` | 111 | codigo | Inspetor dimensional, inspetor de solda, inspetor de LP e PM, todos qualificados conforme requerimento da ABEND e/ou FBTS |
| `PROP-TXT-046` | 112 | codigo | Todo serviço, produto, equipamento ou consumível não previsto nesta matriz será considerado de responsabilidade da Contratante |
| `PROP-TXT-047` | 115 | codigo | 8.1 - A Nota Fiscal será emitida na entrega dos serviços, e o pagamento deverá ser realizado em até 7 (sete) dias corridos contados da data de emissão da Nota Fiscal. 8.2 - Multa e juros por atraso: Em caso de atraso no pagamento de qualquer valor previsto nesta proposta, incidirá sobre o montante em aberto: a) Multa moratória de 2% (dois por cento) sobre o valor da parcela em atraso; b) Juros de mora de 0,10% ao dia (zero vírgula dez por cento ao dia), calculados pro rata die a partir do dia seguinte ao vencimento até a data do efetivo pagamento. O não pagamento nos prazos acordados poderá acarretar a suspensão imediata dos serviços até a regularização dos valores pendentes, sem prejuízo da adoção das medidas legais cabíveis e da cobrança dos custos adicionais decorrentes da paralisação. |
| `PROP-TXT-048` | 124 | codigo | 9.1 - A Filtrovali Engenharia possui PCMSO, PPRA, LTCAT e ASO, todos de acordo com as atividades desenvolvidas. Se for necessária a emissão de ARTs, PCMSO, PPRA, LTCAT, ASO ou Seguro de Responsabilidade Civil específicos para o projeto, os respectivos custos serão repassados à Contratante. 9.2 - A garantia mínima de faturamento é o quantitativo descrito como escopo original no item 7. 9.3 - Caso a Filtrovali Engenharia conclua os serviços em prazo inferior ao previsto, isso não dará à Contratante direito a descontos, abatimentos ou reduções no valor contratado, pois a remuneração decorre do cumprimento integral das obrigações assumidas, independentemente do tempo efetivamente despendido. 9.4 - A Contratante reconhece que os serviços contratados integram um pacote cujo valor considera sua totalidade. A desistência, o cancelamento ou a não utilização de qualquer serviço incluído não dará direito a reembolso, abatimento ou desconto proporcional, permanecendo a obrigação de pagamento integral nos termos acordados. |
| `PROP-TXT-049` | 132 | codigo | 10.1 - A Filtrovali Engenharia enquadra-se no regime tributário do lucro presumido. 10.1.1 - ISS: o imposto será recolhido no município onde o serviço for efetivamente prestado, conforme a alíquota e a legislação vigentes. Em conformidade com a Constituição Federal, artigo 146, e a Lei Complementar nº 116/2003, o serviço está enquadrado no código 07.02.02. O ISS deverá ser recolhido no local da execução, não cabendo retenção ou recolhimento em município diverso. Caso a Contratante considere necessário algum procedimento adicional, assumirá a responsabilidade por ele. 10.2 - Reequilíbrio tributário: Caso, após a apresentação da proposta ou assinatura do contrato, ocorra alteração na legislação tributária, criação, extinção ou modificação de tributos, alíquotas, bases de cálculo ou formas de incidência que impactem os custos da Contratada, os valores serão ajustados proporcionalmente para preservar o equilíbrio econômico-financeiro originalmente pactuado. O acréscimo será repassado à Contratante mediante comprovação do impacto financeiro e apresentação da atualização dos valores. |
| `PROP-TXT-050` | 139 | codigo | A Contratante deverá garantir acesso, liberações, utilidades e frentes de serviço nas condições e datas acordadas. Qualquer alteração de escopo, indisponibilidade de frente ou necessidade de mobilização adicional será formalizada antes da continuidade dos serviços. |
| `PROP-TXT-051` | 191 | codigo | Serviço especializado conforme escopo |
| `PROP-TXT-052` | 191 | codigo | serviço |
| `PROP-TXT-053` | 197 | codigo | Segunda a quinta: 9h; sexta: 8h, com 1h de intervalo. |
| `PROP-TXT-054` | 216 | codigo | Não foi possível consultar os funis do Nectar. |
| `PROP-TXT-055` | 220 | codigo | Nenhum dos funis Filtrovali foi encontrado no Nectar. |
| `PROP-TXT-056` | 249 | codigo | Levantamento não encontrado. |
| `PROP-TXT-057` | 253 | codigo | Falha ao vincular o levantamento. |
| `PROP-TXT-058` | 263 | codigo | Não foi possível obter o próximo número. |
| `PROP-TXT-059` | 266 | codigo | Falha ao obter o próximo número da proposta. |
| `PROP-TXT-060` | 272 | codigo | Informe o número da proposta existente. |
| `PROP-TXT-061` | 274 | codigo | Carregando a última versão salva no banco de dados... |
| `PROP-TXT-062` | 280 | codigo | Proposta não encontrada no histórico. |
| `PROP-TXT-063` | 290 | codigo | Funil Nectar |
| `PROP-TXT-064` | 340 | codigo | Serviço |
| `PROP-TXT-065` | 366 | codigo | Proposta anterior carregada por completo. |
| `PROP-TXT-066` | 366 | codigo | Dados disponíveis no histórico carregados. |
| `PROP-TXT-067` | 371 | codigo | Proposta antiga: os dados cadastrais faltantes foram completados automaticamente pelo Nectar. Confira os demais campos antes de avançar. |
| `PROP-TXT-068` | 372 | codigo | Esta proposta foi gerada antes do armazenamento completo dos campos. Confira e complete os campos que não estavam disponíveis no histórico. |
| `PROP-TXT-069` | 380 | codigo | Falha ao carregar a proposta. |
| `PROP-TXT-070` | 402 | codigo | Fornecimento de mão de obra |
| `PROP-TXT-071` | 408 | codigo | Selecione primeiro o funil do Nectar. |
| `PROP-TXT-072` | 415 | codigo | Não foi possível consultar o Nectar. |
| `PROP-TXT-073` | 418 | codigo | Selecione abaixo a oportunidade que receberá a revisão. |
| `PROP-TXT-074` | 420 | codigo | Falha ao localizar o card. |
| `PROP-TXT-075` | 424 | codigo | O número da proposta ainda não foi definido. |
| `PROP-TXT-076` | 442 | codigo | Não encontramos um card com o mesmo número, cliente e contato. Escolha abaixo um card relacionado à empresa ou ao contato. |
| `PROP-TXT-077` | 543 | codigo | foto incluída |
| `PROP-TXT-078` | 543 | codigo | fotos incluídas |
| `PROP-TXT-079` | 555 | codigo | Digite ao menos 2 caracteres. |
| `PROP-TXT-080` | 560 | codigo | Falha na busca. |
| `PROP-TXT-081` | 562 | codigo | Nenhuma empresa com CNPJ informado foi encontrada no Nectar. |
| `PROP-TXT-082` | 570 | codigo | Esta empresa não pode ser selecionada porque o CNPJ não está informado no Nectar. |
| `PROP-TXT-083` | 574 | codigo | Buscando contatos vinculados... |
| `PROP-TXT-084` | 578 | codigo | Falha ao buscar contatos. |
| `PROP-TXT-085` | 580 | codigo | Essa empresa não possui contatos vinculados no Nectar. |
| `PROP-TXT-086` | 599 | codigo | Selecione novamente o contato vinculado à empresa. |
| `PROP-TXT-087` | 600 | codigo | Nenhum contato vinculado corresponde ao nome digitado. |
| `PROP-TXT-088` | 609 | codigo | .step-content input:not([type="checkbox"]):not([type="file"]):not(:disabled), .step-content textarea:not(:disabled), .step-content select:not(:disabled), .nectar-card-choice button:not(:disabled) |
| `PROP-TXT-089` | 617 | codigo | Informe um e-mail válido, como nome@empresa.com ou nome@empresa.com.br. |
| `PROP-TXT-090` | 620 | codigo | Informe um CNPJ válido com 14 dígitos. |
| `PROP-TXT-091` | 623 | codigo | Informe o departamento correto ou deixe o campo em branco. |
| `PROP-TXT-092` | 626 | codigo | Selecione o consultor de vendas e o orçamentista. |
| `PROP-TXT-093` | 629 | codigo | Selecione o funil do Nectar. |
| `PROP-TXT-094` | 632 | codigo | Selecione a empresa e o contato diretamente pelo Nectar antes de finalizar. |
| `PROP-TXT-095` | 635 | codigo | Escolha se deseja usar um card existente ou criar um card novo no Nectar. |
| `PROP-TXT-096` | 638 | codigo | Localize e selecione o card existente do Nectar antes de finalizar. |
| `PROP-TXT-097` | 640 | codigo | Preparando a proposta comercial... |
| `PROP-TXT-098` | 642 | codigo | geração dos PDFs |
| `PROP-TXT-099` | 687 | codigo | Proposta comercial pronta. Preparando a proposta técnica... |
| `PROP-TXT-100` | 704 | codigo | As duas propostas foram geradas. Salvando no histórico... |
| `PROP-TXT-101` | 705 | codigo | preparação dos arquivos |
| `PROP-TXT-102` | 751 | codigo | envio às integrações |
| `PROP-TXT-103` | 757 | codigo | leitura da resposta |
| `PROP-TXT-104` | 762 | codigo | As duas propostas foram salvas. Escolha abaixo quais deseja baixar. |
| `PROP-TXT-105` | 765 | codigo | As duas propostas foram geradas e continuam disponíveis para download. |
| `PROP-TXT-106` | 797 | jsx | PROPOSTAS TÉCNICA E COMERCIAL |
| `PROP-TXT-107` | 798 | jsx | Como deseja começar? |
| `PROP-TXT-108` | 799 | jsx | O mesmo número e revisão serão usados nos dois documentos oficiais. |
| `PROP-TXT-109` | 801 | jsx | Levantar custos |
| `PROP-TXT-110` | 801 | jsx | Calcula custos, impostos e margem antes da proposta. |
| `PROP-TXT-111` | 802 | jsx | Nova proposta |
| `PROP-TXT-112` | 802 | jsx | Gera o conjunto técnico e comercial com novo número. |
| `PROP-TXT-113` | 803 | jsx | Revisar proposta |
| `PROP-TXT-114` | 803 | jsx | Carrega os dados salvos e calcula a próxima revisão. |
| `PROP-TXT-115` | 808 | jsx | Número da proposta existente |
| `PROP-TXT-116` | 821 | codigo | Carregando... |
| `PROP-TXT-117` | 821 | codigo | Carregar e iniciar revisão |
| `PROP-TXT-118` | 823 | codigo | crm-message error revision-message |
| `PROP-TXT-119` | 823 | codigo | crm-message revision-message |
| `PROP-TXT-120` | 835 | codigo | Nectar conectado |
| `PROP-TXT-121` | 835 | codigo | Nectar pendente |
| `PROP-TXT-122` | 836 | jsx | Microsoft 365 |
| `PROP-TXT-123` | 837 | jsx | Orçamentista: |
| `PROP-TXT-124` | 838 | jsx | Histórico |
| `PROP-TXT-125` | 839 | jsx | Sair |
| `PROP-TXT-126` | 840 | jsx | Imprimir prévia |
| `PROP-TXT-127` | 846 | jsx | FILTROVALI / |
| `PROP-TXT-128` | 846 | codigo | REVISÃO |
| `PROP-TXT-129` | 846 | codigo | NOVA PROPOSTA |
| `PROP-TXT-130` | 847 | jsx | Propostas |
| `PROP-TXT-131` | 848 | jsx | Um cadastro, dois documentos: técnico e comercial. |
| `PROP-TXT-132` | 851 | codigo | REVISÃO AUTOMÁTICA |
| `PROP-TXT-133` | 851 | codigo | NUMERAÇÃO AUTOMÁTICA |
| `PROP-TXT-134` | 853 | codigo | Integração Nectar na etapa final |
| `PROP-TXT-135` | 870 | codigo | Enter |
| `PROP-TXT-136` | 871 | codigo | Buscando... |
| `PROP-TXT-137` | 871 | codigo | Buscar no CRM |
| `PROP-TXT-138` | 873 | codigo | crm-message error |
| `PROP-TXT-139` | 879 | codigo | Cadastre o CNPJ desta empresa no Nectar para selecioná-la |
| `PROP-TXT-140` | 880 | codigo | CNPJ não informado no Nectar |
| `PROP-TXT-141` | 880 | codigo | CNPJ obrigatório |
| `PROP-TXT-142` | 880 | codigo | Escolher empresa |
| `PROP-TXT-143` | 888 | jsx | Contatos vinculados |
| `PROP-TXT-144` | 888 | jsx | Selecione o contato da oportunidade |
| `PROP-TXT-145` | 890 | codigo | Departamento não informado |
| `PROP-TXT-146` | 890 | codigo | E-mail não informado |
| `PROP-TXT-147` | 890 | jsx | Usar contato |
| `PROP-TXT-148` | 897 | jsx | Orçamentista * |
| `PROP-TXT-149` | 899 | jsx | Preenchido automaticamente pelo login de |
| `PROP-TXT-150` | 909 | codigo | Digite um e-mail válido. |
| `PROP-TXT-151` | 910 | codigo | Informe o departamento ou deixe em branco. |
| `PROP-TXT-152` | 922 | jsx | Descrição dos serviços que serão executados |
| `PROP-TXT-153` | 923 | jsx | Cada serviço vira um item próprio (2.1, 2.2...) e pode ter suas próprias tabelas e fotos. |
| `PROP-TXT-154` | 930 | jsx | ＋ Adicionar serviço |
| `PROP-TXT-155` | 940 | jsx | Todo o conteúdo abaixo ficará vinculado somente a este item. |
| `PROP-TXT-156` | 993 | jsx | Item / escopo |
| `PROP-TXT-157` | 993 | jsx | Responsável |
| `PROP-TXT-158` | 993 | jsx | Nota |
| `PROP-TXT-159` | 997 | jsx | N/A |
| `PROP-TXT-160` | 1004 | jsx | + Adicionar responsabilidade |
| `PROP-TXT-161` | 1029 | jsx | Conteúdo técnico da revisão anterior |
| `PROP-TXT-162` | 1030 | jsx | Este formato antigo foi preservado. Você pode mantê-lo ou selecionar um dos novos modelos acima. |
| `PROP-TXT-163` | 1048 | jsx | Incluir valor unitário |
| `PROP-TXT-164` | 1048 | jsx | Exibe preço unitário, quantidade e total conforme o modelo oficial. |
| `PROP-TXT-165` | 1050 | jsx | Descrição |
| `PROP-TXT-166` | 1050 | jsx | Unidade |
| `PROP-TXT-167` | 1050 | jsx | Qtd. |
| `PROP-TXT-168` | 1050 | jsx | Valor unitário |
| `PROP-TXT-169` | 1050 | jsx | Valor total |
| `PROP-TXT-170` | 1063 | jsx | + Adicionar item de preço |
| `PROP-TXT-171` | 1077 | jsx | Card existente do Nectar |
| `PROP-TXT-172` | 1077 | jsx | A revisão será anexada à oportunidade |
| `PROP-TXT-173` | 1077 | jsx | no funil |
| `PROP-TXT-174` | 1081 | jsx | Card da revisão no Nectar * |
| `PROP-TXT-175` | 1082 | jsx | Depois de escolher o funil, localize o card existente que receberá esta revisão. |
| `PROP-TXT-176` | 1092 | jsx | Destino no Nectar * |
| `PROP-TXT-177` | 1093 | jsx | Escolha se o conjunto será anexado a um card existente ou a um novo card. |
| `PROP-TXT-178` | 1095 | jsx | Usar card existente |
| `PROP-TXT-179` | 1095 | jsx | Busca somente no funil |
| `PROP-TXT-180` | 1096 | jsx | Criar card novo |
| `PROP-TXT-181` | 1096 | jsx | Cria na primeira etapa real do funil selecionado. |
| `PROP-TXT-182` | 1107 | jsx | Levantamento de custos vinculado |
| `PROP-TXT-183` | 1107 | jsx | Custo: |
| `PROP-TXT-184` | 1107 | jsx | · Venda: |
| `PROP-TXT-185` | 1107 | jsx | · Margem: |
| `PROP-TXT-186` | 1109 | codigo | Cliente e responsáveis |
| `PROP-TXT-187` | 1109 | codigo | Escopo comum |
| `PROP-TXT-188` | 1109 | codigo | Serviços técnicos e relatórios |
| `PROP-TXT-189` | 1109 | codigo | Conteúdo comercial |
| `PROP-TXT-190` | 1112 | jsx | Documento comercial |
| `PROP-TXT-191` | 1112 | jsx | Proposta Comercial - |
| `PROP-TXT-192` | 1112 | jsx | .pdf |
| `PROP-TXT-193` | 1112 | jsx | Valores, pagamento, impostos, know-how e aceite. |
| `PROP-TXT-194` | 1113 | jsx | Documento técnico |
| `PROP-TXT-195` | 1113 | jsx | Proposta Técnica - |
| `PROP-TXT-196` | 1113 | jsx | Método, etapas, inspeção, liberação e relatórios. |
| `PROP-TXT-197` | 1117 | jsx | O que deseja baixar? |
| `PROP-TXT-198` | 1118 | jsx | As duas propostas sempre serão geradas e salvas no banco, mesmo quando você baixar apenas uma. |
| `PROP-TXT-199` | 1122 | codigo | Técnica + comercial |
| `PROP-TXT-200` | 1123 | codigo | Somente comercial |
| `PROP-TXT-201` | 1124 | codigo | Somente técnica |
| `PROP-TXT-202` | 1132 | jsx | Arquivos adicionais do cliente (opcional) |
| `PROP-TXT-203` | 1132 | jsx | Os anexos serão salvos na mesma pasta dos dois PDFs. |
| `PROP-TXT-204` | 1133 | jsx | Valor total enviado ao Nectar |
| `PROP-TXT-205` | 1133 | codigo | Funil não selecionado |
| `PROP-TXT-206` | 1133 | jsx | · empresa e contato vinculados. |
| `PROP-TXT-207` | 1136 | codigo | Baixar técnica + comercial |
| `PROP-TXT-208` | 1136 | codigo | Baixar proposta comercial |
| `PROP-TXT-209` | 1136 | codigo | Baixar proposta técnica |
| `PROP-TXT-210` | 1138 | jsx | Baixar separadamente a proposta |
| `PROP-TXT-211` | 1138 | codigo | técnica |
| `PROP-TXT-212` | 1145 | jsx | Voltar |
| `PROP-TXT-213` | 1147 | jsx | Preencha |
| `PROP-TXT-214` | 1147 | codigo | campo obrigatório |
| `PROP-TXT-215` | 1147 | codigo | campos obrigatórios |
| `PROP-TXT-216` | 1149 | codigo | Enviando fotos... |
| `PROP-TXT-217` | 1149 | codigo | Salvar e continuar → |
| `PROP-TXT-218` | 1150 | codigo | Gerando e salvando... |
| `PROP-TXT-219` | 1150 | codigo | As duas propostas foram salvas |
| `PROP-TXT-220` | 1150 | codigo | Gerar e salvar técnica + comercial |
| `PROP-TXT-221` | 1157 | jsx | Prévia oficial Filtrovali |
| `PROP-TXT-222` | 1157 | jsx | As duas saídas usam o mesmo cadastro |
| `PROP-TXT-223` | 1186 | jsx | Campos com * são obrigatórios |
| `PROP-TXT-224` | 1190 | jsx | Selecione |
| `PROP-TXT-225` | 1223 | jsx | Biblioteca de serviços Filtrovali |
| `PROP-TXT-226` | 1224 | jsx | Marque todos os serviços desta proposta. Os modelos podem ser combinados e reordenados. |
| `PROP-TXT-227` | 1226 | codigo | serviço selecionado |
| `PROP-TXT-228` | 1226 | codigo | serviços selecionados |
| `PROP-TXT-229` | 1241 | codigo | Somente RDO |
| `PROP-TXT-230` | 1245 | jsx | Selecione ao menos um modelo técnico acima. |
| `PROP-TXT-231` | 1261 | jsx | Modelo salvo v |
| `PROP-TXT-232` | 1261 | codigo | somente RDO |
| `PROP-TXT-233` | 1271 | jsx | Título que aparecerá na proposta |
| `PROP-TXT-234` | 1277 | codigo | Óleo hidráulico |
| `PROP-TXT-235` | 1277 | codigo | Óleo lubrificante |
| `PROP-TXT-236` | 1278 | codigo | Aço carbono |
| `PROP-TXT-237` | 1278 | codigo | Aço inoxidável |
| `PROP-TXT-238` | 1278 | codigo | Outro metal |
| `PROP-TXT-239` | 1283 | jsx | Texto técnico |
| `PROP-TXT-240` | 1284 | codigo | Atualizado automaticamente pelos parâmetros acima. |
| `PROP-TXT-241` | 1284 | codigo | Texto personalizado para esta proposta. |
| `PROP-TXT-242` | 1287 | jsx | Editar texto |
| `PROP-TXT-243` | 1288 | jsx | Restaurar modelo |
| `PROP-TXT-244` | 1293 | jsx | Texto personalizado * |
| `PROP-TXT-245` | 1295 | jsx | Os parâmetros acima não alteram um texto personalizado. Use “Restaurar modelo” para voltar ao texto automático. |
| `PROP-TXT-246` | 1302 | jsx | Relatórios gerados automaticamente |
| `PROP-TXT-247` | 1303 | jsx | O RDO entra uma vez. Cada serviço abaixo recebe o relatório específico definido pela Filtrovali. |
| `PROP-TXT-248` | 1309 | codigo | Comum a todos os serviços |
| `PROP-TXT-249` | 1358 | jsx | Tabelas e fotos deste serviço |
| `PROP-TXT-250` | 1359 | jsx | Inclua apenas quando necessário. Sem upload, nenhuma foto será inserida neste item. |
| `PROP-TXT-251` | 1362 | jsx | ＋ Inserir tabela |
| `PROP-TXT-252` | 1364 | jsx | ＋ Incluir fotos |
| `PROP-TXT-253` | 1378 | jsx | Até |
| `PROP-TXT-254` | 1378 | jsx | tabelas e |
| `PROP-TXT-255` | 1378 | jsx | fotos JPEG, PNG ou WebP. As imagens são otimizadas automaticamente e preservadas para futuras revisões. |
| `PROP-TXT-256` | 1380 | jsx | Nenhuma tabela ou foto adicionada. Use os botões acima quando o escopo precisar de conteúdo visual. |
| `PROP-TXT-257` | 1392 | jsx | Título da tabela |
| `PROP-TXT-258` | 1400 | jsx | ＋ Linha |
| `PROP-TXT-259` | 1401 | jsx | ＋ Coluna |
| `PROP-TXT-260` | 1402 | jsx | Remover última coluna |
| `PROP-TXT-261` | 1406 | jsx | Legenda da foto |
| `PROP-TXT-262` | 1414 | jsx | Funil do Nectar * |
| `PROP-TXT-263` | 1414 | jsx | Escolha entre os dois funis onde o card será buscado ou criado. |
| `PROP-TXT-264` | 1415 | jsx | Consultando os funis autorizados... |
| `PROP-TXT-265` | 1416 | jsx | Primeira etapa: |
| `PROP-TXT-266` | 1417 | codigo | Os funis autorizados não estão disponíveis. |
| `PROP-TXT-267` | 1422 | codigo | Selecionar card |
| `PROP-TXT-268` | 1461 | codigo | Proposta Técnica |
| `PROP-TXT-269` | 1461 | codigo | Proposta Comercial |
| `PROP-TXT-270` | 1463 | jsx | Consultor de Vendas: |
| `PROP-TXT-271` | 1464 | jsx | PROPOSTA Nº: |
| `PROP-TXT-272` | 1465 | jsx | REVISÃO: |
| `PROP-TXT-273` | 1465 | jsx | Rev |
| `PROP-TXT-274` | 1466 | jsx | CLIENTE: |
| `PROP-TXT-275` | 1466 | codigo | Nome do cliente |
| `PROP-TXT-276` | 1466 | jsx | A/C: |
| `PROP-TXT-277` | 1466 | codigo | Contato |
| `PROP-TXT-278` | 1466 | jsx | E-mail do solicitante: |
| `PROP-TXT-279` | 1466 | jsx | Departamento: |
| `PROP-TXT-280` | 1466 | jsx | Local da obra: |
| `PROP-TXT-281` | 1466 | codigo | Local |
| `PROP-TXT-282` | 1466 | jsx | CNPJ: |
| `PROP-TXT-283` | 1468 | jsx | ÍNDICE |
| `PROP-TXT-284` | 1472 | jsx | 1. Filtrovali é a escolha certa para a sua obra |
| `PROP-TXT-285` | 1473 | jsx | Desde 2005, a Filtrovali entrega soluções industriais com excelência, segurança, qualidade e eficiência. |
| `PROP-TXT-286` | 1474 | codigo | Desde 2005 |
| `PROP-TXT-287` | 1474 | codigo | +700 projetos |
| `PROP-TXT-288` | 1474 | codigo | 20 estados |
| `PROP-TXT-289` | 1474 | codigo | Equipe certificada |
| `PROP-TXT-290` | 1474 | codigo | Tecnologia própria |
| `PROP-TXT-291` | 1475 | jsx | 1.1 Tradição e referência em serviços industriais |
| `PROP-TXT-292` | 1476 | jsx | Limpeza química, flushing, filtragem absoluta, passagem de PIG, testes hidrostáticos, centrifugação e desidratação de óleo. |
| `PROP-TXT-293` | 1477 | jsx | 2. Descrição dos serviços que serão executados |
| `PROP-TXT-294` | 1479 | codigo | Descreva este serviço na etapa Escopo. |
| `PROP-TXT-295` | 1480 | codigo | Descreva os serviços na etapa Escopo. |
| `PROP-TXT-296` | 1493 | jsx | 3. Matriz geral de responsabilidade |
| `PROP-TXT-297` | 1498 | jsx | 4. Previsão de atendimento |
| `PROP-TXT-298` | 1498 | codigo | A definir |
| `PROP-TXT-299` | 1498 | jsx | após o pedido ou contrato. Mobilização: |
| `PROP-TXT-300` | 1498 | codigo | a definir |
| `PROP-TXT-301` | 1499 | jsx | 5. Prazo para execução dos serviços |
| `PROP-TXT-302` | 1499 | jsx | Permanência: |
| `PROP-TXT-303` | 1499 | jsx | . Execução: |
| `PROP-TXT-304` | 1500 | jsx | 6. Jornada de trabalho |
| `PROP-TXT-305` | 1502 | jsx | 7. Descrição dos valores |
| `PROP-TXT-306` | 1503 | jsx | ITEM |
| `PROP-TXT-307` | 1503 | jsx | DESCRIÇÃO |
| `PROP-TXT-308` | 1503 | jsx | VALOR UNIT. |
| `PROP-TXT-309` | 1503 | jsx | QTD. |
| `PROP-TXT-310` | 1503 | jsx | VALOR TOTAL |
| `PROP-TXT-311` | 1503 | codigo | Item |
| `PROP-TXT-312` | 1503 | codigo | R$ - |
| `PROP-TXT-313` | 1504 | jsx | Total geral: |
| `PROP-TXT-314` | 1505 | jsx | 8. Condições de pagamento |
| `PROP-TXT-315` | 1513 | jsx | 9. Validade da proposta |
| `PROP-TXT-316` | 1514 | jsx | dias após a emissão. |
| `PROP-TXT-317` | 1515 | jsx | 10. Observações |
| `PROP-TXT-318` | 1516 | codigo | Sem observações adicionais. |
| `PROP-TXT-319` | 1521 | jsx | ESCOPO |
| `PROP-TXT-320` | 1521 | jsx | NOTA |
| `PROP-TXT-321` | 1541 | codigo | (continuação) |
| `PROP-TXT-322` | 1559 | codigo | 7.1 Objetivo |
| `PROP-TXT-323` | 1560 | codigo | 7.2 Método |
| `PROP-TXT-324` | 1561 | codigo | 7.3 Etapas operacionais |
| `PROP-TXT-325` | 1562 | codigo | 7.4 Inspeção |
| `PROP-TXT-326` | 1563 | codigo | 7.5 Critério de liberação |
| `PROP-TXT-327` | 1565 | codigo | Selecione ao menos um modelo de serviço técnico. |
| `PROP-TXT-328` | 1628 | codigo | 2.1 Conteúdo complementar do escopo |
| `PROP-TXT-329` | 1740 | codigo | Não foi possível compactar a foto. |
| `PROP-TXT-330` | 1744 | codigo | Data de emissão |

## CUSTO — Levantamento de custos

Origem: `app/custos/page.tsx`

### CUSTO: títulos

| ID | Linha | Nível | Texto |
|---|---:|---|---|
| `CUSTO-H-001` | 444 | h1 | Como deseja começar? |
| `CUSTO-H-002` | 471 | h1 | Confirme a proposta |
| `CUSTO-H-003` | 512 | h1 | Custos |
| `CUSTO-H-004` | 619 | h2 | Premissas do levantamento |
| `CUSTO-H-005` | 676 | h2 | Mão de obra por fases |
| `CUSTO-H-006` | 993 | h2 | Custos indiretos do projeto |
| `CUSTO-H-007` | 1011 | h3 | — |
| `CUSTO-H-008` | 1067 | h2 | Materiais e insumos |
| `CUSTO-H-009` | 1092 | h2 | Dimensionamento dos circuitos |
| `CUSTO-H-010` | 1201 | h2 | Produtos dimensionados por volume |
| `CUSTO-H-011` | 1235 | h2 | Filtros |
| `CUSTO-H-012` | 1256 | h2 | Previsão de efluente |
| `CUSTO-H-013` | 1578 | h2 | Mobilização e desmobilização |
| `CUSTO-H-014` | 2020 | h2 | Apresentação comercial |
| `CUSTO-H-015` | 2046 | h2 | Comissões e indicações |
| `CUSTO-H-016` | 2143 | h2 | Formação do preço |
| `CUSTO-H-017` | 2211 | h2 | QQP — Quadro de Quantidades e Preços |

### CUSTO: controles

| ID | Linha | Elemento | Rótulo | Atributos |
|---|---:|---|---|---|
| `CUSTO-CTL-001` | 447 | `button` | ＋ Nova proposta Reserva o próximo número e inicia um levantamento por fases. | type=button, disabled={modeLoading} |
| `CUSTO-CTL-002` | 451 | `button` | ↻ Revisar proposta Carrega o último levantamento e preserva toda a composição. | type=button, disabled={modeLoading} |
| `CUSTO-CTL-003` | 457 | `label` | Número da proposta existente | — |
| `CUSTO-CTL-004` | 458 | `input` | — | value={proposalBase}, placeholder=Ex.: 4418 |
| `CUSTO-CTL-005` | 460 | `button` | — | type=button, disabled={modeLoading \|\| !proposalBase} |
| `CUSTO-CTL-006` | 474 | `button` | ✓ Confirmar Salvar e abrir a criação das propostas. | type=button |
| `CUSTO-CTL-007` | 480 | `button` | ＋ Trocar para nova Reservar outra numeração. | type=button, disabled={modeLoading} |
| `CUSTO-CTL-008` | 486 | `button` | ↻ Trocar para revisão Selecionar uma proposta existente. | type=button |
| `CUSTO-CTL-009` | 498 | `Link` | — | aria-label=Filtrovali |
| `CUSTO-CTL-010` | 503 | `Link` | Ir para proposta | — |
| `CUSTO-CTL-011` | 504 | `Link` | Histórico | — |
| `CUSTO-CTL-012` | 505 | `button` | Sair | type=button |
| `CUSTO-CTL-013` | 518 | `Kpi` | — | value={people(result.peakHeadcount)} |
| `CUSTO-CTL-014` | 519 | `Kpi` | — | value={`${number(result.totalLaborHours)} HH`} |
| `CUSTO-CTL-015` | 520 | `Kpi` | — | value={`${number(result.totalVolumeLiters)} L`} |
| `CUSTO-CTL-016` | 521 | `Kpi` | — | value={money(result.directCost)} |
| `CUSTO-CTL-017` | 522 | `label` | Margem desejada % | — |
| `CUSTO-CTL-018` | 524 | `NumberInput` | — | value={assumptions.desiredMarginPercent}, min={0}, max={99}, step={0.01} |
| `CUSTO-CTL-019` | 529 | `Kpi` | — | value={`${money(result.profitValue)} · ${percent(result.margin)}`} |
| `CUSTO-CTL-020` | 530 | `Kpi` | — | value={money(result.salePrice)} |
| `CUSTO-CTL-021` | 537 | `button` | — | type=button |
| `CUSTO-CTL-022` | 593 | `Link` | Cancelar e ir para proposta | — |
| `CUSTO-CTL-023` | 596 | `button` | Preencher itens obrigatórios da mão de obra → | type=button |
| `CUSTO-CTL-024` | 598 | `button` | Revisar materiais e insumos → | type=button |
| `CUSTO-CTL-025` | 600 | `button` | Preencher mobilização e desmobilização → | type=button |
| `CUSTO-CTL-026` | 602 | `button` | Completar comissões e indicações → | type=button |
| `CUSTO-CTL-027` | 603 | `button` | — | type=button, disabled={saving \|\| !String(draft.title \|\| "").trim() \|\| !result.validPricing \|\| numberValue(result.salePrice) <= 0} |
| `CUSTO-CTL-028` | 621 | `Field` | — | — |
| `CUSTO-CTL-029` | 621 | `input` | — | value={draft.title \|\| ""}, placeholder=Ex.: Limpeza química e flushing das linhas |
| `CUSTO-CTL-030` | 622 | `input` | — | value={draft.estimatorName \|\| ""}, readOnly=true |
| `CUSTO-CTL-031` | 623 | `NumberInput` | — | value={assumptions.monthlyHours}, min={1}, disabled=true |
| `CUSTO-CTL-032` | 624 | `NumberInput` | — | value={assumptions.workdaysPerMonth}, min={1}, disabled=true |
| `CUSTO-CTL-033` | 625 | `NumberInput` | — | value={assumptions.defaultHoursPerDay}, min={1}, step={0.5}, disabled=true |
| `CUSTO-CTL-034` | 626 | `NumberInput` | — | value={assumptions.overheadPercent}, min={0}, step={0.01} |
| `CUSTO-CTL-035` | 627 | `NumberInput` | — | value={assumptions.taxPercent}, min={0}, max={99}, step={0.01} |
| `CUSTO-CTL-036` | 628 | `NumberInput` | — | value={assumptions.commissionPercent}, min={0}, max={99}, step={0.01} |
| `CUSTO-CTL-037` | 629 | `NumberInput` | — | value={assumptions.commercialPercent}, min={0}, max={99}, step={0.01} |
| `CUSTO-CTL-038` | 630 | `NumberInput` | — | value={assumptions.desiredMarginPercent}, min={0}, max={99}, step={0.01} |
| `CUSTO-CTL-039` | 678 | `button` | Incluir mão de obra | type=button |
| `CUSTO-CTL-040` | 679 | `button` | + Adicionar fase | type=button |
| `CUSTO-CTL-041` | 683 | `label` | Confirmo que não haverá mão de obra | — |
| `CUSTO-CTL-042` | 683 | `input` | — | type=checkbox, checked={noLabor} |
| `CUSTO-CTL-043` | 736 | `label` | Nome da fase | — |
| `CUSTO-CTL-044` | 736 | `input` | — | aria-label=Nome da fase, value={context.name} |
| `CUSTO-CTL-045` | 739 | `button` | Duplicar | type=button |
| `CUSTO-CTL-046` | 740 | `button` | Remover | type=button, disabled={contexts.length <= 1} |
| `CUSTO-CTL-047` | 747 | `label` | Contexto / observações | — |
| `CUSTO-CTL-048` | 747 | `textarea` | — | value={context.description \|\| ""}, placeholder=Ex.: pré-engenharia em sede, execução em campo... |
| `CUSTO-CTL-049` | 748 | `label` | Início (dia do projeto) | — |
| `CUSTO-CTL-050` | 748 | `NumberInput` | — | value={context.startOffsetDays}, min={0} |
| `CUSTO-CTL-051` | 749 | `label` | Dias corridos | — |
| `CUSTO-CTL-052` | 749 | `NumberInput` | — | value={context.durationDays}, min={1}, max={context.workCondition === "offshore" ? 21 : undefined} |
| `CUSTO-CTL-053` | 767 | `label` | Dias úteis trabalhados | — |
| `CUSTO-CTL-054` | 767 | `NumberInput` | — | value={context.workingDays ?? businessDays(context.durationDays)}, min={0} |
| `CUSTO-CTL-055` | 768 | `label` | HH normal / dia | — |
| `CUSTO-CTL-056` | 768 | `NumberInput` | — | value={context.hoursPerDay}, min={0}, max={context.workCondition === "offshore" ? 12 : undefined}, step={0.1} |
| `CUSTO-CTL-057` | 786 | `button` | + Adicionar função | type=button |
| `CUSTO-CTL-058` | 826 | `select` | — | value={assignment.role} |
| `CUSTO-CTL-059` | 836 | `option` | — | value={assignment.role} |
| `CUSTO-CTL-060` | 837 | `option` | — | value={role.role} |
| `CUSTO-CTL-061` | 838 | `button` | Custos | type=button, title=Abrir composição completa do custo deste colaborador |
| `CUSTO-CTL-062` | 839 | `select` | Diurno Noturno (+35%) | value={assignment.shift \|\| "day"} |
| `CUSTO-CTL-063` | 839 | `option` | Diurno | value=day |
| `CUSTO-CTL-064` | 839 | `option` | Noturno (+35%) | value=night |
| `CUSTO-CTL-065` | 840 | `NumberInput` | — | value={assignment.quantity}, min={0} |
| `CUSTO-CTL-066` | 841 | `NumberInput` | — | value={assignment.monthlySalary}, min={0}, step={0.01} |
| `CUSTO-CTL-067` | 842 | `NumberInput` | — | value={assignment.adjustment}, min={0}, step={0.01} |
| `CUSTO-CTL-068` | 843 | `NumberInput` | — | value={assignment.allocationPercent}, min={0}, max={100}, step={1} |
| `CUSTO-CTL-069` | 854 | `button` | × | type=button |
| `CUSTO-CTL-070` | 863 | `label` | Condição de trabalho * Selecione Sede, Em viagem ou Offshore Sede / Itajaí Em viagem Offshore | — |
| `CUSTO-CTL-071` | 863 | `select` | Selecione Sede, Em viagem ou Offshore Sede / Itajaí Em viagem Offshore | required=true, value={context.workConditionConfirmed ? context.workCondition \|\| "" : ""} |
| `CUSTO-CTL-072` | 873 | `option` | Selecione Sede, Em viagem ou Offshore | value=, disabled=true |
| `CUSTO-CTL-073` | 874 | `option` | Sede / Itajaí | value=headquarters |
| `CUSTO-CTL-074` | 875 | `option` | Em viagem | value=travel |
| `CUSTO-CTL-075` | 876 | `option` | Offshore | value=offshore |
| `CUSTO-CTL-076` | 878 | `label` | Veículo obrigatório Selecione o veículo Carro sedan · 3 pessoas Pickup · 2 pessoas HR · 2 pessoas | — |
| `CUSTO-CTL-077` | 878 | `select` | Selecione o veículo Carro sedan · 3 pessoas Pickup · 2 pessoas HR · 2 pessoas | required=true, value={context.vehicleType \|\| ""} |
| `CUSTO-CTL-078` | 879 | `option` | Selecione o veículo | value=, disabled=true |
| `CUSTO-CTL-079` | 880 | `option` | Carro sedan · 3 pessoas | value=sedan |
| `CUSTO-CTL-080` | 881 | `option` | Pickup · 2 pessoas | value=pickup |
| `CUSTO-CTL-081` | 882 | `option` | HR · 2 pessoas | value=hr |
| `CUSTO-CTL-082` | 884 | `label` | Quantidade de veículos Automática pela equipe Informada manualmente | — |
| `CUSTO-CTL-083` | 884 | `select` | Automática pela equipe Informada manualmente | value={context.vehicleCountMode \|\| "automatic"} |
| `CUSTO-CTL-084` | 885 | `option` | Automática pela equipe | value=automatic |
| `CUSTO-CTL-085` | 886 | `option` | Informada manualmente | value=manual |
| `CUSTO-CTL-086` | 888 | `label` | Deslocamento hotel ↔ obra / dia (km) | — |
| `CUSTO-CTL-087` | 888 | `NumberInput` | — | value={context.hotelSiteDistanceKmPerDay ?? LEC_CONTEXT_EXPENSES.hotelSiteDistanceKmPerDay}, min={0}, step={1}, disabled={!context.workConditionConfirmed \|\| context.workCondition !== "travel"} |
| `CUSTO-CTL-088` | 895 | `label` | Nº de veículos | — |
| `CUSTO-CTL-089` | 895 | `NumberInput` | — | value={context.vehicleCount \|\| 0}, min={0}, step={1} |
| `CUSTO-CTL-090` | 903 | `label` | HE 70% / dia útil | — |
| `CUSTO-CTL-091` | 903 | `NumberInput` | — | value={context.weekdayExtra70HoursPerDay \|\| 0}, min={0}, max={context.workCondition === "offshore" ? Math.max(0, 12 - numberValue(context.hoursPerDay)) : undefined}, step={0.5} |
| `CUSTO-CTL-092` | 904 | `label` | Nº de sábados | — |
| `CUSTO-CTL-093` | 904 | `NumberInput` | — | value={context.saturdayCount \|\| 0}, min={0}, step={1} |
| `CUSTO-CTL-094` | 905 | `label` | Horas / sábado (70%) | — |
| `CUSTO-CTL-095` | 905 | `NumberInput` | — | value={context.saturdayHoursPerDay \|\| 0}, min={0}, max={context.workCondition === "offshore" ? 12 : undefined}, step={0.5} |
| `CUSTO-CTL-096` | 906 | `label` | Nº de domingos / feriados | — |
| `CUSTO-CTL-097` | 906 | `NumberInput` | — | value={context.sundayCount \|\| 0}, min={0}, step={1} |
| `CUSTO-CTL-098` | 907 | `label` | Horas / domingo ou feriado (100%) | — |
| `CUSTO-CTL-099` | 907 | `NumberInput` | — | value={context.sundayHoursPerDay \|\| 0}, min={0}, max={context.workCondition === "offshore" ? 12 : undefined}, step={0.5} |
| `CUSTO-CTL-100` | 925 | `input` | — | disabled={isHotelSiteCommute}, value={expense.name} |
| `CUSTO-CTL-101` | 927 | `select` | Hotel ↔ obra · veículo × dia trabalhado | disabled=true, value=per_vehicle_staffed_day |
| `CUSTO-CTL-102` | 927 | `option` | Hotel ↔ obra · veículo × dia trabalhado | value=per_vehicle_staffed_day |
| `CUSTO-CTL-103` | 929 | `select` | — | disabled=true, value={calendarDayBasis} |
| `CUSTO-CTL-104` | 929 | `option` | — | value={calendarDayBasis} |
| `CUSTO-CTL-105` | 930 | `select` | — | value={expense.basis} |
| `CUSTO-CTL-106` | 931 | `NumberInput` | — | disabled={isHotelSiteCommute}, value={expense.quantity}, min={0}, step={0.01} |
| `CUSTO-CTL-107` | 932 | `NumberInput` | — | value={expense.unitValue}, min={0}, step={0.01} |
| `CUSTO-CTL-108` | 933 | `input` | — | disabled={isHotelSiteCommute}, type=checkbox, checked={isHotelSiteCommute \|\| expense.included} |
| `CUSTO-CTL-109` | 935 | `button` | × | type=button, disabled={isHotelSiteCommute}, title={isHotelSiteCommute ? "Despesa obrigatória para fases em viagem" : "Remover despesa"} |
| `CUSTO-CTL-110` | 940 | `button` | + Adicionar despesa da fase | type=button |
| `CUSTO-CTL-111` | 941 | `button` | + Restaurar premissas LEC | type=button |
| `CUSTO-CTL-112` | 957 | `SummaryDatum` | — | value={number(firstNumber(summary, ["headcount", "totalEmployees"], local.headcount))} |
| `CUSTO-CTL-113` | 958 | `SummaryDatum` | — | value={number(firstNumber(summary, ["personDays"], local.personDays))} |
| `CUSTO-CTL-114` | 959 | `SummaryDatum` | — | value={`${number(firstNumber(summary, ["vehicleCount"], local.vehicleCount))} · cap. ${number(firstNumber(summary, ["vehicleCapacity"], local.vehicleCapacity))}`} |
| `CUSTO-CTL-115` | 965 | `SummaryDatum` | — | value={number(firstNumber(summary, ["normalHours"], local.normalHours))} |
| `CUSTO-CTL-116` | 966 | `SummaryDatum` | — | value={number(firstNumber(summary, ["extra70Hours"], local.extra70Hours))} |
| `CUSTO-CTL-117` | 967 | `SummaryDatum` | — | value={number(firstNumber(summary, ["extra100Hours"], local.extra100Hours))} |
| `CUSTO-CTL-118` | 968 | `SummaryDatum` | — | value={number(firstNumber(summary, ["laborHours", "totalLaborHours"], local.laborHours))} |
| `CUSTO-CTL-119` | 974 | `SummaryDatum` | — | value={`${number(commuteDistance)} km/dia · ${number(commuteTotalDistance)} km total`} |
| `CUSTO-CTL-120` | 975 | `SummaryDatum` | — | value={`${money(commuteDailyCost)}/veículo/dia · ${money(commuteTotalCost)} total`} |
| `CUSTO-CTL-121` | 981 | `SummaryDatum` | — | value={money(firstNumber(summary, ["payrollCost", "laborCost"], local.laborCost))} |
| `CUSTO-CTL-122` | 982 | `SummaryDatum` | — | value={money(firstNumber(summary, ["total", "totalCost"], local.totalCost))} |
| `CUSTO-CTL-123` | 993 | `button` | + Adicionar indireto | type=button |
| `CUSTO-CTL-124` | 997 | `input` | — | value={item.name} |
| `CUSTO-CTL-125` | 998 | `select` | — | value={item.basis \|\| "fixed"} |
| `CUSTO-CTL-126` | 999 | `NumberInput` | — | value={item.quantity ?? 1}, min={0}, step={0.01} |
| `CUSTO-CTL-127` | 1000 | `NumberInput` | — | value={item.unitValue ?? item.monthly ?? 0}, min={0}, step={0.01} |
| `CUSTO-CTL-128` | 1001 | `input` | — | type=checkbox, checked={item.included !== false} |
| `CUSTO-CTL-129` | 1002 | `button` | × | type=button |
| `CUSTO-CTL-130` | 1011 | `button` | × | type=button, aria-label=Fechar detalhamento |
| `CUSTO-CTL-131` | 1013 | `SummaryDatum` | — | value={money(detailBreakdown.monthlyCost)} |
| `CUSTO-CTL-132` | 1014 | `SummaryDatum` | — | value={money(detailBreakdown.normalHourlyCost)} |
| `CUSTO-CTL-133` | 1015 | `SummaryDatum` | — | value={money(detailBreakdown.extra70HourlyCost)} |
| `CUSTO-CTL-134` | 1016 | `SummaryDatum` | — | value={money(detailBreakdown.extra100HourlyCost)} |
| `CUSTO-CTL-135` | 1017 | `SummaryDatum` | — | value={money(detailBreakdown.normalHourlyCost * numberValue(costDetail.context.hoursPerDay))} |
| `CUSTO-CTL-136` | 1018 | `SummaryDatum` | — | value={money(firstNumber(detailCalculated, ["allocatedQuantity"], 0) > 0 ? firstNumber(detailCalculated, ["total"], 0) / firstNumber(detailCalculated, ["allocatedQuantity"], 1) : 0)} |
| `CUSTO-CTL-137` | 1021 | `SummaryDatum` | — | value={money(firstNumber(detailCalculated, ["total"], 0))} |
| `CUSTO-CTL-138` | 1067 | `button` | + Adicionar item | type=button |
| `CUSTO-CTL-139` | 1070 | `label` | Confirmo que não haverá materiais ou insumos | — |
| `CUSTO-CTL-140` | 1070 | `input` | — | type=checkbox, checked={noInputs} |
| `CUSTO-CTL-141` | 1076 | `input` | — | value={item.description} |
| `CUSTO-CTL-142` | 1077 | `select` | Material Insumo | value={item.category} |
| `CUSTO-CTL-143` | 1077 | `option` | Material | value=material |
| `CUSTO-CTL-144` | 1077 | `option` | Insumo | value=input |
| `CUSTO-CTL-145` | 1078 | `input` | — | value={item.unit} |
| `CUSTO-CTL-146` | 1079 | `NumberInput` | — | value={item.quantity}, min={0}, step={0.01} |
| `CUSTO-CTL-147` | 1080 | `NumberInput` | — | value={item.unitCost}, min={0}, step={0.01} |
| `CUSTO-CTL-148` | 1081 | `NumberInput` | — | value={item.wastePercent}, min={0}, step={0.1} |
| `CUSTO-CTL-149` | 1082 | `NumberInput` | — | value={item.freightValue}, min={0}, step={0.01} |
| `CUSTO-CTL-150` | 1083 | `input` | — | type=checkbox, checked={item.included !== false} |
| `CUSTO-CTL-151` | 1085 | `button` | × | type=button |
| `CUSTO-CTL-152` | 1092 | `button` | + Adicionar circuito | type=button |
| `CUSTO-CTL-153` | 1104 | `input` | — | aria-label={`Nome do circuito ${systemIndex + 1}`}, value={system.name} |
| `CUSTO-CTL-154` | 1107 | `button` | — | type=button, aria-label={`${isExpanded ? "Recolher" : "Abrir"} ${system.name \|\| `circuito ${systemIndex + 1}`}`} |
| `CUSTO-CTL-155` | 1118 | `button` | Remover circuito | type=button, disabled={systems.length <= 1} |
| `CUSTO-CTL-156` | 1123 | `label` | Material Aço carbono Aço inox Outro / manual | — |
| `CUSTO-CTL-157` | 1123 | `select` | Aço carbono Aço inox Outro / manual | value={system.material} |
| `CUSTO-CTL-158` | 1123 | `option` | Aço carbono | value=carbon_steel |
| `CUSTO-CTL-159` | 1123 | `option` | Aço inox | value=stainless_steel |
| `CUSTO-CTL-160` | 1123 | `option` | Outro / manual | value=other |
| `CUSTO-CTL-161` | 1124 | `label` | Ciclos de produto | — |
| `CUSTO-CTL-162` | 1124 | `NumberInput` | — | value={system.cycles}, min={1}, step={1} |
| `CUSTO-CTL-163` | 1130 | `input` | — | value={segment.description} |
| `CUSTO-CTL-164` | 1131 | `NumberInput` | — | value={segment.quantity}, min={0}, step={1} |
| `CUSTO-CTL-165` | 1132 | `NumberInput` | — | value={segment.internalDiameterMm}, min={0}, step={0.1} |
| `CUSTO-CTL-166` | 1133 | `NumberInput` | — | value={segment.lengthM}, min={0}, step={0.1} |
| `CUSTO-CTL-167` | 1134 | `NumberInput` | — | value={segment.fillPercent}, min={0}, max={100}, step={1} |
| `CUSTO-CTL-168` | 1136 | `button` | × | type=button |
| `CUSTO-CTL-169` | 1139 | `button` | + Adicionar trecho | type=button |
| `CUSTO-CTL-170` | 1147 | `select` | Capacidade personalizada | value={matchesPreset ? String(equipment.volumeLiters) : "custom"} |
| `CUSTO-CTL-171` | 1153 | `option` | — | value={preset.volumeLiters} |
| `CUSTO-CTL-172` | 1154 | `option` | Capacidade personalizada | value=custom |
| `CUSTO-CTL-173` | 1156 | `NumberInput` | — | value={equipment.quantity}, min={0}, step={1} |
| `CUSTO-CTL-174` | 1157 | `NumberInput` | — | value={equipment.volumeLiters}, min={0}, step={1} |
| `CUSTO-CTL-175` | 1158 | `input` | — | type=checkbox, checked={equipment.included !== false} |
| `CUSTO-CTL-176` | 1160 | `button` | × | type=button |
| `CUSTO-CTL-177` | 1164 | `button` | + Adicionar máquina / reservatório | type=button |
| `CUSTO-CTL-178` | 1170 | `input` | — | value={hose.description} |
| `CUSTO-CTL-179` | 1171 | `NumberInput` | — | value={hose.quantity}, min={0}, step={1} |
| `CUSTO-CTL-180` | 1172 | `NumberInput` | — | value={hose.internalDiameterMm}, min={0}, step={0.1} |
| `CUSTO-CTL-181` | 1173 | `NumberInput` | — | value={hose.lengthM}, min={0}, step={0.1} |
| `CUSTO-CTL-182` | 1174 | `NumberInput` | — | value={hose.fillPercent}, min={0}, max={100}, step={1} |
| `CUSTO-CTL-183` | 1176 | `button` | × | type=button |
| `CUSTO-CTL-184` | 1179 | `button` | + Adicionar mangueira | type=button |
| `CUSTO-CTL-185` | 1185 | `input` | — | value={volume.description} |
| `CUSTO-CTL-186` | 1186 | `NumberInput` | — | value={volume.quantity}, min={0}, step={1} |
| `CUSTO-CTL-187` | 1187 | `NumberInput` | — | value={volume.volumeLiters}, min={0}, step={0.1} |
| `CUSTO-CTL-188` | 1189 | `button` | × | type=button |
| `CUSTO-CTL-189` | 1192 | `button` | + Adicionar outro volume | type=button |
| `CUSTO-CTL-190` | 1201 | `button` | + Adicionar produto | type=button |
| `CUSTO-CTL-191` | 1212 | `input` | — | value={product.productName} |
| `CUSTO-CTL-192` | 1213 | `select` | Manual / sem circuito | value={product.systemId \|\| ""} |
| `CUSTO-CTL-193` | 1213 | `option` | Manual / sem circuito | value= |
| `CUSTO-CTL-194` | 1213 | `option` | — | value={system.id} |
| `CUSTO-CTL-195` | 1214 | `select` | % do volume L por m³ kg por m³ Quantidade manual | value={product.doseMode} |
| `CUSTO-CTL-196` | 1214 | `option` | % do volume | value=percent_volume |
| `CUSTO-CTL-197` | 1214 | `option` | L por m³ | value=liters_per_m3 |
| `CUSTO-CTL-198` | 1214 | `option` | kg por m³ | value=kg_per_m3 |
| `CUSTO-CTL-199` | 1214 | `option` | Quantidade manual | value=manual |
| `CUSTO-CTL-200` | 1215 | `NumberInput` | — | value={product.doseMode === "manual" ? product.manualQuantity : product.dose}, min={0}, step={0.01} |
| `CUSTO-CTL-201` | 1216 | `select` | kg L un. m³ | value={product.unit} |
| `CUSTO-CTL-202` | 1216 | `option` | kg | value=kg |
| `CUSTO-CTL-203` | 1216 | `option` | L | value=L |
| `CUSTO-CTL-204` | 1216 | `option` | un. | value=un |
| `CUSTO-CTL-205` | 1216 | `option` | m³ | value=m³ |
| `CUSTO-CTL-206` | 1217 | `NumberInput` | — | value={product.densityKgPerL}, min={0.0001}, step={0.01} |
| `CUSTO-CTL-207` | 1218 | `NumberInput` | — | value={product.wastePercent}, min={0}, step={0.1} |
| `CUSTO-CTL-208` | 1219 | `NumberInput` | — | value={product.packageSize}, min={0}, step={0.01} |
| `CUSTO-CTL-209` | 1220 | `select` | Unidade Embalagem | value={product.priceBasis} |
| `CUSTO-CTL-210` | 1220 | `option` | Unidade | value=unit |
| `CUSTO-CTL-211` | 1220 | `option` | Embalagem | value=package |
| `CUSTO-CTL-212` | 1221 | `NumberInput` | — | value={product.unitCost}, min={0}, step={0.01} |
| `CUSTO-CTL-213` | 1223 | `input` | — | type=checkbox, checked={product.included !== false} |
| `CUSTO-CTL-214` | 1227 | `button` | × | type=button |
| `CUSTO-CTL-215` | 1235 | `button` | + Filtro personalizado | type=button |
| `CUSTO-CTL-216` | 1241 | `input` | — | type=checkbox, checked={filter.included !== false} |
| `CUSTO-CTL-217` | 1242 | `input` | — | value={filter.filterName} |
| `CUSTO-CTL-218` | 1243 | `input` | — | value={filter.micronRating \|\| ""} |
| `CUSTO-CTL-219` | 1244 | `input` | — | value={filter.unit \|\| "un."} |
| `CUSTO-CTL-220` | 1245 | `NumberInput` | — | value={filter.quantity}, min={0}, step={1} |
| `CUSTO-CTL-221` | 1246 | `NumberInput` | — | value={filter.unitCost}, min={0}, step={0.01} |
| `CUSTO-CTL-222` | 1248 | `button` | × | type=button |
| `CUSTO-CTL-223` | 1258 | `NumberInput` | — | value={draft.effluent.multiplier}, min={0}, step={0.1} |
| `CUSTO-CTL-224` | 1260 | `label` | Responsabilidade do cliente | — |
| `CUSTO-CTL-225` | 1260 | `input` | — | type=checkbox, checked={draft.effluent.clientResponsible !== false} |
| `CUSTO-CTL-226` | 1261 | `label` | Incluir destinação no nosso custo | — |
| `CUSTO-CTL-227` | 1261 | `input` | — | type=checkbox, checked={draft.effluent.includeDisposalCost === true} |
| `CUSTO-CTL-228` | 1262 | `NumberInput` | — | value={draft.effluent.unitCostPerM3}, min={0}, step={0.01}, disabled={!draft.effluent.includeDisposalCost} |
| `CUSTO-CTL-229` | 1578 | `button` | + Outro destino | type=button |
| `CUSTO-CTL-230` | 1581 | `label` | Confirmo que não haverá mobilização ou desmobilização | — |
| `CUSTO-CTL-231` | 1581 | `input` | — | type=checkbox, checked={noLogistics} |
| `CUSTO-CTL-232` | 1594 | `button` | Remover destino | type=button |
| `CUSTO-CTL-233` | 1596 | `label` | Fase / origem do nome * Outro nome / destino | — |
| `CUSTO-CTL-234` | 1597 | `select` | Outro nome / destino | value={destinationNameSource} |
| `CUSTO-CTL-235` | 1622 | `option` | — | value={`labor:${context.id}`} |
| `CUSTO-CTL-236` | 1623 | `option` | Outro nome / destino | value=custom |
| `CUSTO-CTL-237` | 1626 | `label` | — | — |
| `CUSTO-CTL-238` | 1627 | `input` | — | disabled={destinationNameSource !== "custom"}, value={destination.name \|\| ""}, placeholder=Ex.: Unidade de Cubatão |
| `CUSTO-CTL-239` | 1638 | `label` | Endereço / cidade | — |
| `CUSTO-CTL-240` | 1638 | `input` | — | value={destination.address \|\| ""}, placeholder=Ex.: Cubatão - SP |
| `CUSTO-CTL-241` | 1639 | `label` | Distância Sede → obra (km) * | — |
| `CUSTO-CTL-242` | 1639 | `NumberInput` | — | value={destination.oneWayDistanceKm}, min={0}, step={1} |
| `CUSTO-CTL-243` | 1662 | `label` | — | — |
| `CUSTO-CTL-244` | 1662 | `input` | — | type=checkbox, checked={confirmed} |
| `CUSTO-CTL-245` | 1728 | `input` | — | aria-label=Descrição do evento logístico, value={item.description} |
| `CUSTO-CTL-246` | 1729 | `select` | Como será feito? Cálculo manual / anterior | required=true, value={item.calculationModeConfirmed ? item.calculationMode \|\| "" : ""} |
| `CUSTO-CTL-247` | 1730 | `option` | Como será feito? | value=, disabled=true |
| `CUSTO-CTL-248` | 1732 | `option` | Carro da empresa | value=company_crew_vehicle |
| `CUSTO-CTL-249` | 1733 | `option` | Carro alugado | value=rental_crew_vehicle |
| `CUSTO-CTL-250` | 1734 | `option` | Ônibus | value=bus_crew_transport |
| `CUSTO-CTL-251` | 1735 | `option` | Avião | value=air_crew_transport |
| `CUSTO-CTL-252` | 1737 | `option` | Frete contratado | value=external_freight |
| `CUSTO-CTL-253` | 1738 | `option` | Caminhão próprio + colaborador | value=company_truck_driver |
| `CUSTO-CTL-254` | 1739 | `option` | Cálculo manual / anterior | value=legacy |
| `CUSTO-CTL-255` | 1743 | `label` | Incluir | — |
| `CUSTO-CTL-256` | 1743 | `input` | — | type=checkbox, checked={item.included !== false} |
| `CUSTO-CTL-257` | 1745 | `button` | × | type=button, disabled={item.requiredSlot}, title={item.requiredSlot ? "Item padrão do destino" : "Remover evento"} |
| `CUSTO-CTL-258` | 1748 | `label` | Destino / base de distância | — |
| `CUSTO-CTL-259` | 1748 | `select` | — | disabled={item.requiredSlot}, value={item.destinationId \|\| ""} |
| `CUSTO-CTL-260` | 1754 | `option` | · km | value={destination.id} |
| `CUSTO-CTL-261` | 1770 | `label` | Usar dados da ida | — |
| `CUSTO-CTL-262` | 1770 | `input` | — | type=checkbox, checked={isLinkedReturn} |
| `CUSTO-CTL-263` | 1776 | `label` | Fase / equipe de origem * Selecione a fase | — |
| `CUSTO-CTL-264` | 1776 | `select` | Selecione a fase | value={item.contextId \|\| ""} |
| `CUSTO-CTL-265` | 1788 | `option` | Selecione a fase | value= |
| `CUSTO-CTL-266` | 1788 | `option` | — | value={context.id} |
| `CUSTO-CTL-267` | 1790 | `label` | Colaboradores Automático: todos da fase Selecionar cargos e quantidades | — |
| `CUSTO-CTL-268` | 1790 | `select` | Automático: todos da fase Selecionar cargos e quantidades | value={item.travelerCountMode \|\| "automatic"} |
| `CUSTO-CTL-269` | 1790 | `option` | Automático: todos da fase | value=automatic |
| `CUSTO-CTL-270` | 1790 | `option` | Selecionar cargos e quantidades | value=manual |
| `CUSTO-CTL-271` | 1791 | `label` | Motorista / colaborador * Selecione por cargo abaixo | — |
| `CUSTO-CTL-272` | 1792 | `label` | Veículos Quantidade manual | — |
| `CUSTO-CTL-273` | 1792 | `select` | Quantidade manual | value={item.vehicleCountMode \|\| "automatic"} |
| `CUSTO-CTL-274` | 1792 | `option` | — | value=automatic |
| `CUSTO-CTL-275` | 1792 | `option` | Quantidade manual | value=manual |
| `CUSTO-CTL-276` | 1793 | `label` | Qtd. veículos * | — |
| `CUSTO-CTL-277` | 1793 | `NumberInput` | — | value={item.vehicleCount}, min={1}, step={1} |
| `CUSTO-CTL-278` | 1794 | `label` | Pessoas por carro (máx. 4) | — |
| `CUSTO-CTL-279` | 1794 | `NumberInput` | — | value={item.passengersPerVehicle}, min={1}, max={4}, step={1} |
| `CUSTO-CTL-280` | 1807 | `label` | Disponível: · | — |
| `CUSTO-CTL-281` | 1809 | `NumberInput` | — | value={selected?.quantity \|\| 0}, min={0}, max={available}, step={1} |
| `CUSTO-CTL-282` | 1814 | `label` | Viagens / trechos iguais * | — |
| `CUSTO-CTL-283` | 1814 | `NumberInput` | — | value={item.trips}, min={1}, step={1} |
| `CUSTO-CTL-284` | 1815 | `label` | Dias corridos por trecho * | — |
| `CUSTO-CTL-285` | 1815 | `NumberInput` | — | value={item.travelCalendarDaysPerTrip}, min={1}, step={1} |
| `CUSTO-CTL-286` | 1821 | `label` | Limite de rodagem / dia (máx. 750 km) | — |
| `CUSTO-CTL-287` | 1821 | `NumberInput` | — | value={item.dailyDistanceLimitKm}, min={1}, max={750}, step={1} |
| `CUSTO-CTL-288` | 1822 | `label` | HH de viagem / dia (máx. ) | — |
| `CUSTO-CTL-289` | 1822 | `NumberInput` | — | value={item.travelHoursPerDay}, min={1}, max={isTicketedCrewTransport ? 24 : 10}, step={0.1} |
| `CUSTO-CTL-290` | 1823 | `label` | Sábados na viagem | — |
| `CUSTO-CTL-291` | 1823 | `NumberInput` | — | value={item.travelSaturdayDays}, min={0}, step={1} |
| `CUSTO-CTL-292` | 1824 | `label` | Domingos / feriados | — |
| `CUSTO-CTL-293` | 1824 | `NumberInput` | — | value={item.travelSundayDays}, min={0}, step={1} |
| `CUSTO-CTL-294` | 1825 | `label` | Passagem / pessoa / trecho * | — |
| `CUSTO-CTL-295` | 1825 | `NumberInput` | — | value={item.ticketPerPersonPerTrip}, min={0}, step={0.01} |
| `CUSTO-CTL-296` | 1826 | `label` | Durante a viagem de ônibus * Selecione obrigatoriamente Segue direto, sem desembarcar para dormir Desembarca para dormir em hotel | — |
| `CUSTO-CTL-297` | 1826 | `select` | Selecione obrigatoriamente Segue direto, sem desembarcar para dormir Desembarca para dormir em hotel | value={item.busOvernightMode \|\| ""} |
| `CUSTO-CTL-298` | 1831 | `option` | Selecione obrigatoriamente | value= |
| `CUSTO-CTL-299` | 1831 | `option` | Segue direto, sem desembarcar para dormir | value=continuous |
| `CUSTO-CTL-300` | 1831 | `option` | Desembarca para dormir em hotel | value=hotel_stop |
| `CUSTO-CTL-301` | 1834 | `label` | Pernoites por trecho * | — |
| `CUSTO-CTL-302` | 1834 | `NumberInput` | — | value={item.lodgingNightsPerTrip}, min={1}, step={1} |
| `CUSTO-CTL-303` | 1838 | `label` | Hospedagem / pessoa / noite * | — |
| `CUSTO-CTL-304` | 1838 | `NumberInput` | — | value={item.lodgingPerPersonDay}, min={0}, step={0.01} |
| `CUSTO-CTL-305` | 1839 | `label` | Alimentação / pessoa / dia corrido de viagem * | — |
| `CUSTO-CTL-306` | 1839 | `NumberInput` | — | value={item.mealPerPersonDay}, min={0}, step={0.01} |
| `CUSTO-CTL-307` | 1840 | `label` | Uso do carro alugado * Selecione obrigatoriamente | — |
| `CUSTO-CTL-308` | 1840 | `select` | Selecione obrigatoriamente | value={item.rentalUse \|\| ""} |
| `CUSTO-CTL-309` | 1845 | `option` | Selecione obrigatoriamente | value= |
| `CUSTO-CTL-310` | 1845 | `option` | — | value=mobilization_only |
| `CUSTO-CTL-311` | 1845 | `option` | — | value=mobilization_and_site |
| `CUSTO-CTL-312` | 1846 | `label` | Diária do carro alugado * | — |
| `CUSTO-CTL-313` | 1846 | `NumberInput` | — | value={item.rentalDailyRate}, min={0}, step={0.01} |
| `CUSTO-CTL-314` | 1850 | `label` | Dias corridos alugado na obra * | — |
| `CUSTO-CTL-315` | 1850 | `NumberInput` | — | value={item.rentalSiteDays}, min={1}, step={1} |
| `CUSTO-CTL-316` | 1851 | `label` | Rendimento do veículo (km/L) * | — |
| `CUSTO-CTL-317` | 1851 | `NumberInput` | — | value={item.fuelEfficiencyKmPerLiter}, min={0.1}, step={0.1} |
| `CUSTO-CTL-318` | 1852 | `label` | Combustível (R$/L) * | — |
| `CUSTO-CTL-319` | 1852 | `NumberInput` | — | value={item.fuelPricePerLiter}, min={0}, step={0.01} |
| `CUSTO-CTL-320` | 1853 | `label` | Pedágio estimado (R$/km da frota) | — |
| `CUSTO-CTL-321` | 1853 | `NumberInput` | — | value={item.tollPerVehicleKm}, min={0}, step={0.01} |
| `CUSTO-CTL-322` | 1854 | `label` | Uso / manutenção do veículo (R$/km) | — |
| `CUSTO-CTL-323` | 1854 | `NumberInput` | — | value={item.vehicleOperatingCostPerKm}, min={0}, step={0.01} |
| `CUSTO-CTL-324` | 1858 | `label` | Qtd. de fretes / caminhões * | — |
| `CUSTO-CTL-325` | 1858 | `NumberInput` | — | value={item.quantity}, min={1}, step={1} |
| `CUSTO-CTL-326` | 1859 | `label` | Viagens por frete * | — |
| `CUSTO-CTL-327` | 1859 | `NumberInput` | — | value={item.trips}, min={1}, step={1} |
| `CUSTO-CTL-328` | 1860 | `label` | Valor contratado por frete * | — |
| `CUSTO-CTL-329` | 1860 | `NumberInput` | — | value={item.unitCost}, min={0}, step={0.01} |
| `CUSTO-CTL-330` | 1864 | `label` | Categoria Equipe Equipamento Frete Viagem Hospedagem Outro | — |
| `CUSTO-CTL-331` | 1864 | `select` | Equipe Equipamento Frete Viagem Hospedagem Outro | value={item.category} |
| `CUSTO-CTL-332` | 1864 | `option` | Equipe | value=personnel |
| `CUSTO-CTL-333` | 1864 | `option` | Equipamento | value=equipment |
| `CUSTO-CTL-334` | 1864 | `option` | Frete | value=freight |
| `CUSTO-CTL-335` | 1864 | `option` | Viagem | value=travel |
| `CUSTO-CTL-336` | 1864 | `option` | Hospedagem | value=lodging |
| `CUSTO-CTL-337` | 1864 | `option` | Outro | value=other |
| `CUSTO-CTL-338` | 1865 | `label` | Fase Projeto | — |
| `CUSTO-CTL-339` | 1865 | `select` | Projeto | value={item.contextId \|\| ""} |
| `CUSTO-CTL-340` | 1865 | `option` | Projeto | value= |
| `CUSTO-CTL-341` | 1865 | `option` | — | value={context.id} |
| `CUSTO-CTL-342` | 1866 | `label` | Forma Manual / fixo Valor por km Por viagem Por pessoa Pessoa-dia | — |
| `CUSTO-CTL-343` | 1866 | `select` | Manual / fixo Valor por km Por viagem Por pessoa Pessoa-dia | value={item.basis} |
| `CUSTO-CTL-344` | 1866 | `option` | Manual / fixo | value=fixed |
| `CUSTO-CTL-345` | 1866 | `option` | Valor por km | value=per_km |
| `CUSTO-CTL-346` | 1866 | `option` | Por viagem | value=per_trip |
| `CUSTO-CTL-347` | 1866 | `option` | Por pessoa | value=per_person |
| `CUSTO-CTL-348` | 1866 | `option` | Pessoa-dia | value=per_person_day |
| `CUSTO-CTL-349` | 1867 | `label` | Qtd. / km | — |
| `CUSTO-CTL-350` | 1867 | `NumberInput` | — | value={item.quantity}, min={0}, step={0.01} |
| `CUSTO-CTL-351` | 1868 | `label` | Trechos / viagens | — |
| `CUSTO-CTL-352` | 1868 | `NumberInput` | — | value={item.trips}, min={0}, step={1} |
| `CUSTO-CTL-353` | 1869 | `label` | Veículos (0 = automático) | — |
| `CUSTO-CTL-354` | 1869 | `NumberInput` | — | value={item.vehicleCount \|\| 0}, min={0}, step={1} |
| `CUSTO-CTL-355` | 1870 | `label` | Custo unitário | — |
| `CUSTO-CTL-356` | 1870 | `NumberInput` | — | value={item.unitCost}, min={0}, step={0.01} |
| `CUSTO-CTL-357` | 1878 | `input` | — | value={additional.description} |
| `CUSTO-CTL-358` | 1879 | `select` | Total fixo Por veículo Por viagem Veículo × viagem | value={additional.basis} |
| `CUSTO-CTL-359` | 1879 | `option` | Total fixo | value=fixed |
| `CUSTO-CTL-360` | 1879 | `option` | Por veículo | value=per_vehicle |
| `CUSTO-CTL-361` | 1879 | `option` | Por viagem | value=per_trip |
| `CUSTO-CTL-362` | 1879 | `option` | Veículo × viagem | value=per_vehicle_trip |
| `CUSTO-CTL-363` | 1880 | `NumberInput` | — | value={additional.quantity}, min={0}, step={1} |
| `CUSTO-CTL-364` | 1881 | `NumberInput` | — | value={additional.unitCost}, min={0}, step={0.01} |
| `CUSTO-CTL-365` | 1882 | `input` | — | type=checkbox, checked={additional.included !== false} |
| `CUSTO-CTL-366` | 1883 | `button` | × | type=button |
| `CUSTO-CTL-367` | 1886 | `button` | + Balsa | type=button |
| `CUSTO-CTL-368` | 1886 | `button` | + Outro complemento | type=button |
| `CUSTO-CTL-369` | 1892 | `label` | Contingência (%) | — |
| `CUSTO-CTL-370` | 1892 | `NumberInput` | — | value={item.contingencyPercent}, min={0}, step={0.1} |
| `CUSTO-CTL-371` | 1893 | `label` | Impostos + comissão (%) | — |
| `CUSTO-CTL-372` | 1893 | `NumberInput` | — | value={item.taxPercent}, min={0}, max={99}, step={0.1} |
| `CUSTO-CTL-373` | 1894 | `label` | Margem LEC (%) | — |
| `CUSTO-CTL-374` | 1894 | `NumberInput` | — | value={item.marginPercent}, min={0}, max={99}, step={0.1} |
| `CUSTO-CTL-375` | 1900 | `SummaryDatum` | — | value={number(firstNumber(calculated, ["travelDays"], 0))} |
| `CUSTO-CTL-376` | 1901 | `SummaryDatum` | — | value={number(firstNumber(calculated, ["people"], 0))} |
| `CUSTO-CTL-377` | 1902 | `SummaryDatum` | — | value={`${number(firstNumber(calculated, ["travelLaborHours"], 0))} HH`} |
| `CUSTO-CTL-378` | 1903 | `SummaryDatum` | — | value={money(firstNumber(calculated, ["travelLaborCost"], 0))} |
| `CUSTO-CTL-379` | 1904 | `SummaryDatum` | — | value={money(firstNumber(calculated, ["lodgingCost"], 0))} |
| `CUSTO-CTL-380` | 1905 | `SummaryDatum` | — | value={money(firstNumber(calculated, ["mealCost"], 0))} |
| `CUSTO-CTL-381` | 1906 | `SummaryDatum` | — | value={money(firstNumber(calculated, ["ticketCost"], 0))} |
| `CUSTO-CTL-382` | 1907 | `SummaryDatum` | — | value={`${number(firstNumber(calculated, ["rentalDays"], 0))} dias por veículo · ${money(firstNumber(calculated, ["rentalCost"], 0))}`} |
| `CUSTO-CTL-383` | 1908 | `SummaryDatum` | — | value={number(firstNumber(calculated, ["calculatedVehicleCount"], 0))} |
| `CUSTO-CTL-384` | 1909 | `SummaryDatum` | — | value={`${number(firstNumber(calculated, ["fleetDistanceKm"], 0))} km`} |
| `CUSTO-CTL-385` | 1911 | `SummaryDatum` | — | value={`${number(firstNumber(calculated, ["fuelLiters"], 0))} L · ${money(firstNumber(calculated, ["fuelCost"], 0))}`} |
| `CUSTO-CTL-386` | 1912 | `SummaryDatum` | — | value={money(firstNumber(calculated, ["tollCost"], 0))} |
| `CUSTO-CTL-387` | 1914 | `SummaryDatum` | — | value={money(firstNumber(calculated, ["vehicleOperatingCost"], 0))} |
| `CUSTO-CTL-388` | 1916 | `SummaryDatum` | — | value={money(firstNumber(calculated, ["additionalCostTotal"], 0))} |
| `CUSTO-CTL-389` | 1917 | `SummaryDatum` | — | value={money(firstNumber(calculated, ["total"], 0))} |
| `CUSTO-CTL-390` | 1918 | `SummaryDatum` | — | value={money(firstNumber(calculated, ["costWithTax"], 0))} |
| `CUSTO-CTL-391` | 1919 | `SummaryDatum` | — | value={money(firstNumber(calculated, ["chargeValue"], 0))} |
| `CUSTO-CTL-392` | 1927 | `button` | Sim, copiar e manter sincronizado (recomendado) | type=button |
| `CUSTO-CTL-393` | 1934 | `button` | Não, vou revisar a volta | type=button |
| `CUSTO-CTL-394` | 1950 | `button` | + Adicionar evento | type=button |
| `CUSTO-CTL-395` | 2022 | `CommercialChoice` | — | title=Resumo calculado |
| `CUSTO-CTL-396` | 2023 | `CommercialChoice` | — | title=QQP por HH |
| `CUSTO-CTL-397` | 2024 | `CommercialChoice` | — | title=Composição comercial |
| `CUSTO-CTL-398` | 2025 | `CommercialChoice` | — | title=Valor global manual |
| `CUSTO-CTL-399` | 2027 | `label` | Valor global da proposta Custos, impostos e lucro continuam visíveis para conferência interna. | — |
| `CUSTO-CTL-400` | 2027 | `NumberInput` | — | value={commercial.globalValue}, min={0}, step={0.01} |
| `CUSTO-CTL-401` | 2031 | `input` | — | value={line.description} |
| `CUSTO-CTL-402` | 2032 | `input` | — | value={line.unit} |
| `CUSTO-CTL-403` | 2033 | `NumberInput` | — | value={line.quantity}, min={0}, step={0.01} |
| `CUSTO-CTL-404` | 2034 | `NumberInput` | — | value={line.unitValue}, min={0}, step={0.01} |
| `CUSTO-CTL-405` | 2036 | `button` | × | type=button |
| `CUSTO-CTL-406` | 2039 | `button` | + Adicionar item comercial | type=button |
| `CUSTO-CTL-407` | 2056 | `label` | Incluir comissão de representante | — |
| `CUSTO-CTL-408` | 2057 | `input` | — | type=checkbox, checked={representativeCommission.enabled === true} |
| `CUSTO-CTL-409` | 2068 | `input` | — | value={representativeCommission.representativeName \|\| ""}, placeholder=Nome ou empresa representante |
| `CUSTO-CTL-410` | 2075 | `NumberInput` | — | value={representativeCommission.percent}, min={0}, max={99}, step={0.01} |
| `CUSTO-CTL-411` | 2083 | `Field` | Valor líquido após impostos — o que entra na conta Valor bruto da nota fiscal | — |
| `CUSTO-CTL-412` | 2084 | `select` | Valor líquido após impostos — o que entra na conta Valor bruto da nota fiscal | value={representativeCommission.basis \|\| "net_after_tax"} |
| `CUSTO-CTL-413` | 2088 | `option` | Valor líquido após impostos — o que entra na conta | value=net_after_tax |
| `CUSTO-CTL-414` | 2089 | `option` | Valor bruto da nota fiscal | value=gross_invoice |
| `CUSTO-CTL-415` | 2104 | `button` | + Adicionar indicação | type=button |
| `CUSTO-CTL-416` | 2123 | `input` | — | value={bonus.employeeName \|\| ""}, placeholder=Nome do colaborador |
| `CUSTO-CTL-417` | 2124 | `NumberInput` | — | value={bonus.amount}, min={0}, step={0.01} |
| `CUSTO-CTL-418` | 2125 | `input` | — | type=checkbox, checked={bonus.included !== false}, aria-label={`Incluir bônus de ${bonus.employeeName \|\| "colaborador sem nome"}`} |
| `CUSTO-CTL-419` | 2126 | `button` | × | type=button, aria-label={`Remover indicação de ${bonus.employeeName \|\| "colaborador sem nome"}`}, title=Remover indicação |
| `CUSTO-CTL-420` | 2152 | `button` | Aplicar sugestão | type=button |
| `CUSTO-CTL-421` | 2156 | `NumberInput` | — | value={assumptions.taxPercent}, min={0}, max={99}, step={0.01} |
| `CUSTO-CTL-422` | 2157 | `NumberInput` | — | value={assumptions.commissionPercent}, min={0}, max={99}, step={0.01} |
| `CUSTO-CTL-423` | 2158 | `NumberInput` | — | value={assumptions.overheadPercent}, min={0}, max={500}, step={0.01} |
| `CUSTO-CTL-424` | 2159 | `NumberInput` | — | value={assumptions.commercialPercent}, min={0}, max={99}, step={0.01} |
| `CUSTO-CTL-425` | 2160 | `NumberInput` | — | value={assumptions.desiredMarginPercent}, min={0}, max={99}, step={0.01} |
| `CUSTO-CTL-426` | 2161 | `button` | Restaurar percentuais da planilha | type=button |
| `CUSTO-CTL-427` | 2164 | `button` | % | type=button |
| `CUSTO-CTL-428` | 2171 | `button` | Aplicar base da planilha Calculo Nov | type=button |
| `CUSTO-CTL-429` | 2179 | `SummaryLine` | — | value={result.laborCost} |
| `CUSTO-CTL-430` | 2180 | `SummaryLine` | — | value={result.indirectCost} |
| `CUSTO-CTL-431` | 2181 | `SummaryLine` | — | value={result.materialCost} |
| `CUSTO-CTL-432` | 2182 | `SummaryLine` | — | value={result.inputCost} |
| `CUSTO-CTL-433` | 2183 | `SummaryLine` | — | value={result.mobilizationCost} |
| `CUSTO-CTL-434` | 2184 | `SummaryLine` | — | value={result.demobilizationCost} |
| `CUSTO-CTL-435` | 2185 | `SummaryLine` | — | value={result.employeeReferralBonusCost} |
| `CUSTO-CTL-436` | 2186 | `SummaryLine` | — | value={result.directCost} |
| `CUSTO-CTL-437` | 2187 | `SummaryLine` | — | value={result.overheadValue} |
| `CUSTO-CTL-438` | 2188 | `SummaryLine` | — | value={result.costWithOverhead} |
| `CUSTO-CTL-439` | 2191 | `SummaryLine` | — | value={result.calculatedSalePrice} |
| `CUSTO-CTL-440` | 2192 | `SummaryLine` | — | value={result.taxValue} |
| `CUSTO-CTL-441` | 2193 | `SummaryLine` | — | value={result.netRevenue} |
| `CUSTO-CTL-442` | 2194 | `SummaryLine` | — | value={result.commissionValue} |
| `CUSTO-CTL-443` | 2195 | `SummaryLine` | — | value={result.representativeCommissionValue} |
| `CUSTO-CTL-444` | 2199 | `SummaryLine` | — | value={result.overheadValue} |
| `CUSTO-CTL-445` | 2200 | `SummaryLine` | — | value={result.commercialValue} |
| `CUSTO-CTL-446` | 2201 | `SummaryLine` | — | value={result.profitValue} |
| `CUSTO-CTL-447` | 2202 | `SummaryLine` | — | value={result.margin} |
| `CUSTO-CTL-448` | 2203 | `SummaryLine` | — | value={result.salePrice} |
| `CUSTO-CTL-449` | 2220 | `label` | Incluir QQP na proposta | — |
| `CUSTO-CTL-450` | 2221 | `input` | — | type=checkbox, checked={commercial.includeQqp} |
| `CUSTO-CTL-451` | 2250 | `NumberInput` | — | value={Math.min(requestedAdjustment, availableAdjustment)}, min={0}, max={availableAdjustment}, step={0.01}, disabled={availableAdjustment <= 0} |
| `CUSTO-CTL-452` | 2279 | `label` | — | — |
| `CUSTO-CTL-453` | 2291 | `input` | — | type=number, value={value ?? ""}, min={min}, max={max}, step={step}, placeholder={placeholder}, disabled={disabled} |
| `CUSTO-CTL-454` | 2337 | `button` | — | type=button |
| `CUSTO-CTL-455` | 3177 | `option` | Fixo / evento | value=fixed |
| `CUSTO-CTL-456` | 3178 | `option` | Por pessoa | value=per_person |
| `CUSTO-CTL-457` | 3179 | `option` | Por pessoa-dia trabalhado | value=per_person_day |
| `CUSTO-CTL-458` | 3180 | `option` | Por pessoa × dia corrido | value=per_person_calendar_day |
| `CUSTO-CTL-459` | 3181 | `option` | Por pessoa × dia útil | value=per_person_workday |
| `CUSTO-CTL-460` | 3182 | `option` | Por pessoa-mês | value=per_person_month |
| `CUSTO-CTL-461` | 3183 | `option` | Por veículo × dia corrido | value=per_vehicle_calendar_day |
| `CUSTO-CTL-462` | 3184 | `option` | Por veículo × dia útil | value=per_vehicle_workday |
| `CUSTO-CTL-463` | 3185 | `option` | Por dia da fase | value=per_context_day |
| `CUSTO-CTL-464` | 3186 | `option` | Por mês da fase | value=per_context_month |
| `CUSTO-CTL-465` | 3187 | `option` | % da mão de obra | value=percent_labor |

### CUSTO: textos visíveis

`jsx` = escrito direto na marcação. `codigo` = string do código (mensagem de
erro, rótulo de opção, texto de confirmação).

| ID | Linha | Origem | Texto |
|---|---:|---|---|
| `CUSTO-TXT-001` | 55 | codigo | Premissas |
| `CUSTO-TXT-002` | 56 | codigo | Mão de obra |
| `CUSTO-TXT-003` | 57 | codigo | Materiais e insumos |
| `CUSTO-TXT-004` | 58 | codigo | Mob. e desmob. |
| `CUSTO-TXT-005` | 59 | codigo | Resumo e QQP |
| `CUSTO-TXT-006` | 217 | codigo | Reservando o próximo número... |
| `CUSTO-TXT-007` | 221 | codigo | Não foi possível obter a numeração. |
| `CUSTO-TXT-008` | 227 | codigo | Falha ao obter a numeração. |
| `CUSTO-TXT-009` | 245 | codigo | Informe o número da proposta que deseja revisar. |
| `CUSTO-TXT-010` | 249 | codigo | Carregando proposta e último levantamento... |
| `CUSTO-TXT-011` | 260 | codigo | Proposta não encontrada no histórico. |
| `CUSTO-TXT-012` | 270 | codigo | Último levantamento carregado. As fases e composições podem ser ajustadas para esta revisão. |
| `CUSTO-TXT-013` | 271 | codigo | A proposta foi localizada, mas não havia levantamento anterior. A revisão começará com um modelo novo. |
| `CUSTO-TXT-014` | 273 | codigo | Falha ao carregar a revisão. |
| `CUSTO-TXT-015` | 285 | codigo | Validando e salvando o levantamento... |
| `CUSTO-TXT-016` | 296 | codigo | Content-Type |
| `CUSTO-TXT-017` | 301 | codigo | Não foi possível salvar. |
| `CUSTO-TXT-018` | 307 | codigo | Falha ao salvar o levantamento. |
| `CUSTO-TXT-019` | 432 | codigo | QQP por HH |
| `CUSTO-TXT-020` | 434 | codigo | Composição comercial |
| `CUSTO-TXT-021` | 436 | codigo | Valor global |
| `CUSTO-TXT-022` | 437 | codigo | Resumo calculado |
| `CUSTO-TXT-023` | 443 | jsx | LEVANTAMENTO DE CUSTOS |
| `CUSTO-TXT-024` | 444 | jsx | Como deseja começar? |
| `CUSTO-TXT-025` | 445 | jsx | O levantamento será vinculado à proposta técnica e comercial com a mesma numeração. |
| `CUSTO-TXT-026` | 448 | jsx | Nova proposta |
| `CUSTO-TXT-027` | 449 | jsx | Reserva o próximo número e inicia um levantamento por fases. |
| `CUSTO-TXT-028` | 451 | codigo | Informe abaixo o número da proposta existente. |
| `CUSTO-TXT-029` | 452 | jsx | Revisar proposta |
| `CUSTO-TXT-030` | 453 | jsx | Carrega o último levantamento e preserva toda a composição. |
| `CUSTO-TXT-031` | 457 | jsx | Número da proposta existente |
| `CUSTO-TXT-032` | 461 | codigo | Carregando... |
| `CUSTO-TXT-033` | 461 | codigo | Carregar revisão |
| `CUSTO-TXT-034` | 470 | jsx | VINCULAR LEVANTAMENTO |
| `CUSTO-TXT-035` | 471 | jsx | Confirme a proposta |
| `CUSTO-TXT-036` | 472 | jsx | O levantamento, a proposta técnica e a comercial usarão o código |
| `CUSTO-TXT-037` | 478 | jsx | Confirmar |
| `CUSTO-TXT-038` | 478 | jsx | Salvar e abrir a criação das propostas. |
| `CUSTO-TXT-039` | 484 | jsx | Trocar para nova |
| `CUSTO-TXT-040` | 484 | jsx | Reservar outra numeração. |
| `CUSTO-TXT-041` | 491 | jsx | Trocar para revisão |
| `CUSTO-TXT-042` | 491 | jsx | Selecionar uma proposta existente. |
| `CUSTO-TXT-043` | 502 | jsx | Orçamentista: |
| `CUSTO-TXT-044` | 503 | jsx | Ir para proposta |
| `CUSTO-TXT-045` | 504 | jsx | Histórico |
| `CUSTO-TXT-046` | 505 | jsx | Sair |
| `CUSTO-TXT-047` | 511 | jsx | FILTROVALI / LEVANTAMENTO DE CUSTOS |
| `CUSTO-TXT-048` | 512 | jsx | Custos |
| `CUSTO-TXT-049` | 513 | jsx | Engenharia de custos Filtrovali: equipe, circuitos, materiais, logística e formação do preço em um só lugar. |
| `CUSTO-TXT-050` | 516 | jsx | Resumo em tempo real |
| `CUSTO-TXT-051` | 523 | jsx | Margem desejada |
| `CUSTO-TXT-052` | 591 | codigo | inválid |
| `CUSTO-TXT-053` | 593 | jsx | Cancelar e ir para proposta |
| `CUSTO-TXT-054` | 594 | jsx | LEVANTAMENTO E PROPOSTA |
| `CUSTO-TXT-055` | 596 | jsx | Preencher itens obrigatórios da mão de obra → |
| `CUSTO-TXT-056` | 598 | jsx | Revisar materiais e insumos → |
| `CUSTO-TXT-057` | 600 | jsx | Preencher mobilização e desmobilização → |
| `CUSTO-TXT-058` | 602 | jsx | Completar comissões e indicações → |
| `CUSTO-TXT-059` | 604 | codigo | Salvando... |
| `CUSTO-TXT-060` | 604 | codigo | Salvar levantamento e criar proposta → |
| `CUSTO-TXT-061` | 619 | jsx | Premissas do levantamento |
| `CUSTO-TXT-062` | 619 | jsx | Defina o nome do serviço e as bases financeiras. Os percentuais permanecem editáveis para cada proposta. |
| `CUSTO-TXT-063` | 626 | codigo | Overhead s/ líquida (%) |
| `CUSTO-TXT-064` | 626 | codigo | Overhead (%) |
| `CUSTO-TXT-065` | 627 | codigo | Imposto s/ bruta (%) |
| `CUSTO-TXT-066` | 627 | codigo | Impostos LEC (%) |
| `CUSTO-TXT-067` | 628 | codigo | Comissão s/ líquida (%) |
| `CUSTO-TXT-068` | 628 | codigo | Comissão LEC (%) |
| `CUSTO-TXT-069` | 630 | codigo | Margem s/ bruta (%) |
| `CUSTO-TXT-070` | 630 | codigo | Margem desejada (%) |
| `CUSTO-TXT-071` | 632 | jsx | Mão de obra calculada exclusivamente pelo LEC v1.2: cargos oficiais, composição por Sede / Viagem / Offshore, 193,6 horas mensais, HE 70% e adicional noturno de 35%. A HE 100% usa a mesma base extraordinária do LEC com multiplicador 2,0. |
| `CUSTO-TXT-072` | 635 | codigo | Este levantamento preserva a base histórica LEC. A atualização para a base Filtrovali está disponível no resumo. |
| `CUSTO-TXT-073` | 676 | jsx | Mão de obra por fases |
| `CUSTO-TXT-074` | 676 | jsx | Cada fase usa exclusivamente os cargos e a composição salarial do LEC. Informe a condição da obra e separe jornada normal, HE 70% e HE 100%. |
| `CUSTO-TXT-075` | 678 | jsx | Incluir mão de obra |
| `CUSTO-TXT-076` | 679 | jsx | + Adicionar fase |
| `CUSTO-TXT-077` | 682 | codigo | Sem mão de obra confirmado |
| `CUSTO-TXT-078` | 682 | codigo | Revisão obrigatória da mão de obra |
| `CUSTO-TXT-079` | 682 | codigo | As fases ficam preservadas, mas não entram neste levantamento. |
| `CUSTO-TXT-080` | 682 | codigo | Se realmente não houver colaboradores neste escopo, confirme para evitar uma omissão acidental. |
| `CUSTO-TXT-081` | 683 | jsx | Confirmo que não haverá mão de obra |
| `CUSTO-TXT-082` | 685 | jsx | Selecione obrigatoriamente a condição de trabalho em todas as fases: Sede, Em viagem ou Offshore. |
| `CUSTO-TXT-083` | 686 | jsx | Selecione o veículo obrigatório em todas as fases para liberar o salvamento do levantamento. |
| `CUSTO-TXT-084` | 687 | jsx | Informe a distância diária entre hotel e obra nas fases em viagem. |
| `CUSTO-TXT-085` | 697 | jsx | O combustível do deslocamento hotel ↔ obra é obrigatório nas fases em viagem. |
| `CUSTO-TXT-086` | 699 | jsx | Pico simultâneo |
| `CUSTO-TXT-087` | 699 | jsx | Maior equipe ativa no mesmo período |
| `CUSTO-TXT-088` | 700 | jsx | Pessoa-dias |
| `CUSTO-TXT-089` | 700 | jsx | Somatório das alocações nas fases |
| `CUSTO-TXT-090` | 701 | jsx | HH total |
| `CUSTO-TXT-091` | 701 | jsx | HH |
| `CUSTO-TXT-092` | 701 | jsx | Jornada normal e horas extras |
| `CUSTO-TXT-093` | 703 | jsx | Regra para fases em viagem |
| `CUSTO-TXT-094` | 703 | jsx | O padrão considera 50 km diários no trajeto hotel ↔ obra e R$ 50 de combustível por veículo a cada dia trabalhado. Sábados, domingos e feriados informados também entram no cálculo. |
| `CUSTO-TXT-095` | 736 | jsx | Nome da fase |
| `CUSTO-TXT-096` | 739 | jsx | Duplicar |
| `CUSTO-TXT-097` | 740 | jsx | Remover |
| `CUSTO-TXT-098` | 745 | jsx | Período e jornada |
| `CUSTO-TXT-099` | 745 | jsx | Defina quando a fase acontece e a carga horária normal. |
| `CUSTO-TXT-100` | 747 | jsx | Contexto / observações |
| `CUSTO-TXT-101` | 748 | jsx | Início (dia do projeto) |
| `CUSTO-TXT-102` | 749 | jsx | Dias corridos |
| `CUSTO-TXT-103` | 767 | jsx | Dias úteis trabalhados |
| `CUSTO-TXT-104` | 768 | jsx | HH normal / dia |
| `CUSTO-TXT-105` | 783 | jsx | Preset offshore: até 21 dias consecutivos, 12 h por dia, com sábados em HE 70% e domingos/feriados em HE 100%. O período e a distribuição dos dias continuam editáveis para escalas menores. |
| `CUSTO-TXT-106` | 786 | jsx | Composição da equipe |
| `CUSTO-TXT-107` | 786 | jsx | Cargos, turnos, alocação e custo individual conforme o LEC. |
| `CUSTO-TXT-108` | 786 | jsx | + Adicionar função |
| `CUSTO-TXT-109` | 788 | jsx | Cargo LEC |
| `CUSTO-TXT-110` | 788 | jsx | Turno |
| `CUSTO-TXT-111` | 788 | jsx | Qtd. |
| `CUSTO-TXT-112` | 788 | jsx | Base mensal |
| `CUSTO-TXT-113` | 788 | jsx | Ajuste |
| `CUSTO-TXT-114` | 788 | jsx | Alocação |
| `CUSTO-TXT-115` | 788 | jsx | Horas |
| `CUSTO-TXT-116` | 788 | jsx | Custo individual |
| `CUSTO-TXT-117` | 788 | jsx | Custo da fase |
| `CUSTO-TXT-118` | 839 | jsx | Diurno |
| `CUSTO-TXT-119` | 839 | jsx | Noturno (+35%) |
| `CUSTO-TXT-120` | 844 | jsx | N |
| `CUSTO-TXT-121` | 861 | jsx | Local e deslocamento |
| `CUSTO-TXT-122` | 861 | jsx | Informe a condição da equipe e o transporte diário. |
| `CUSTO-TXT-123` | 863 | jsx | Condição de trabalho * |
| `CUSTO-TXT-124` | 873 | jsx | Selecione Sede, Em viagem ou Offshore |
| `CUSTO-TXT-125` | 874 | jsx | Sede / Itajaí |
| `CUSTO-TXT-126` | 875 | jsx | Em viagem |
| `CUSTO-TXT-127` | 876 | jsx | Offshore |
| `CUSTO-TXT-128` | 878 | jsx | Veículo obrigatório |
| `CUSTO-TXT-129` | 879 | jsx | Selecione o veículo |
| `CUSTO-TXT-130` | 880 | jsx | Carro sedan · 3 pessoas |
| `CUSTO-TXT-131` | 881 | jsx | Pickup · 2 pessoas |
| `CUSTO-TXT-132` | 882 | jsx | HR · 2 pessoas |
| `CUSTO-TXT-133` | 884 | jsx | Quantidade de veículos |
| `CUSTO-TXT-134` | 885 | jsx | Automática pela equipe |
| `CUSTO-TXT-135` | 886 | jsx | Informada manualmente |
| `CUSTO-TXT-136` | 888 | jsx | Deslocamento hotel ↔ obra / dia (km) |
| `CUSTO-TXT-137` | 895 | jsx | Nº de veículos |
| `CUSTO-TXT-138` | 899 | jsx | Horas extras |
| `CUSTO-TXT-139` | 900 | codigo | Domingos e feriados são 100%. Para cada colaborador desta fase, as demais extras ficam em 70% até 30 h por mês; o excedente vira 100% automaticamente. |
| `CUSTO-TXT-140` | 901 | codigo | Este histórico preserva a classificação de HE usada quando o levantamento foi criado. |
| `CUSTO-TXT-141` | 903 | jsx | HE 70% / dia útil |
| `CUSTO-TXT-142` | 904 | jsx | Nº de sábados |
| `CUSTO-TXT-143` | 905 | jsx | Horas / sábado (70%) |
| `CUSTO-TXT-144` | 906 | jsx | Nº de domingos / feriados |
| `CUSTO-TXT-145` | 907 | jsx | Horas / domingo ou feriado (100%) |
| `CUSTO-TXT-146` | 911 | jsx | Despesas próprias desta fase |
| `CUSTO-TXT-147` | 911 | jsx | Hospedagem, alimentação, lavagem de roupa e locação de veículo usam os dias corridos da fase. HH continua pelos dias trabalhados. No deslocamento obrigatório, o valor diário permanece editável. |
| `CUSTO-TXT-148` | 913 | jsx | Despesa |
| `CUSTO-TXT-149` | 913 | jsx | Base |
| `CUSTO-TXT-150` | 913 | jsx | Multiplicador |
| `CUSTO-TXT-151` | 913 | jsx | Valor unitário |
| `CUSTO-TXT-152` | 913 | jsx | Incluir |
| `CUSTO-TXT-153` | 913 | jsx | Total |
| `CUSTO-TXT-154` | 927 | jsx | Hotel ↔ obra · veículo × dia trabalhado |
| `CUSTO-TXT-155` | 929 | codigo | Veículo × dia corrido |
| `CUSTO-TXT-156` | 929 | codigo | Pessoa × dia corrido |
| `CUSTO-TXT-157` | 935 | codigo | Despesa obrigatória para fases em viagem |
| `CUSTO-TXT-158` | 935 | codigo | Remover despesa |
| `CUSTO-TXT-159` | 938 | jsx | Nenhuma despesa contextual nesta fase. |
| `CUSTO-TXT-160` | 940 | jsx | + Adicionar despesa da fase |
| `CUSTO-TXT-161` | 949 | jsx | + Restaurar premissas LEC |
| `CUSTO-TXT-162` | 951 | jsx | Resumo da fase |
| `CUSTO-TXT-163` | 951 | jsx | Conferência final antes dos custos indiretos. |
| `CUSTO-TXT-164` | 952 | jsx | Regra sindical aplicada: |
| `CUSTO-TXT-165` | 952 | jsx | HH que ultrapassaram |
| `CUSTO-TXT-166` | 952 | jsx | h/mês foram convertidas de 70% para 100%. |
| `CUSTO-TXT-167` | 955 | jsx | Equipe |
| `CUSTO-TXT-168` | 955 | jsx | Dimensionamento |
| `CUSTO-TXT-169` | 963 | jsx | Normal e adicionais |
| `CUSTO-TXT-170` | 972 | jsx | Deslocamento |
| `CUSTO-TXT-171` | 972 | jsx | Hotel ↔ obra |
| `CUSTO-TXT-172` | 979 | jsx | Resultado da fase |
| `CUSTO-TXT-173` | 993 | jsx | Custos indiretos do projeto |
| `CUSTO-TXT-174` | 993 | jsx | Escolha a base correta para evitar que uma despesa fixa seja multiplicada indevidamente por todos os colaboradores. |
| `CUSTO-TXT-175` | 993 | jsx | + Adicionar indireto |
| `CUSTO-TXT-176` | 995 | jsx | Item |
| `CUSTO-TXT-177` | 995 | jsx | Quantidade |
| `CUSTO-TXT-178` | 1004 | jsx | Nenhum custo indireto cadastrado. |
| `CUSTO-TXT-179` | 1005 | jsx | Total de indiretos |
| `CUSTO-TXT-180` | 1011 | jsx | COMPOSIÇÃO INDIVIDUAL · LEC V1.2 |
| `CUSTO-TXT-181` | 1011 | codigo | Turno noturno |
| `CUSTO-TXT-182` | 1011 | codigo | Turno diurno |
| `CUSTO-TXT-183` | 1023 | jsx | Este cargo usa o custo mensal carregado informado pela Filtrovali. Por isso não há rateio separado de encargos e benefícios. |
| `CUSTO-TXT-184` | 1025 | jsx | Grupo |
| `CUSTO-TXT-185` | 1025 | jsx | Componente mensal |
| `CUSTO-TXT-186` | 1025 | jsx | Valor por colaborador |
| `CUSTO-TXT-187` | 1028 | jsx | Folha e provisões |
| `CUSTO-TXT-188` | 1029 | jsx | Benefícios |
| `CUSTO-TXT-189` | 1030 | jsx | Custo mensal carregado |
| `CUSTO-TXT-190` | 1033 | jsx | Detalhamento interno por colaborador. Pode ser aberto somente quando necessário para justificar a composição ao cliente. |
| `CUSTO-TXT-191` | 1067 | jsx | Cadastre peças, filtros, consumíveis e itens manuais. Produtos químicos dimensionados pelos circuitos aparecem no bloco seguinte. |
| `CUSTO-TXT-192` | 1067 | jsx | + Adicionar item |
| `CUSTO-TXT-193` | 1069 | codigo | Sem insumos confirmado |
| `CUSTO-TXT-194` | 1069 | codigo | Composição de insumos identificada |
| `CUSTO-TXT-195` | 1069 | codigo | Revisão obrigatória dos insumos |
| `CUSTO-TXT-196` | 1069 | codigo | Materiais, produtos, filtros e efluente ficam fora deste levantamento. |
| `CUSTO-TXT-197` | 1069 | codigo | Se este serviço realmente não utilizar insumos, confirme explicitamente antes de finalizar. |
| `CUSTO-TXT-198` | 1070 | jsx | Confirmo que não haverá materiais ou insumos |
| `CUSTO-TXT-199` | 1072 | jsx | Adicione ao menos um material, circuito, produto manual ou filtro, ou confirme que não haverá insumos. |
| `CUSTO-TXT-200` | 1074 | jsx | Descrição |
| `CUSTO-TXT-201` | 1074 | jsx | Categoria |
| `CUSTO-TXT-202` | 1074 | jsx | Unidade |
| `CUSTO-TXT-203` | 1074 | jsx | Custo unitário |
| `CUSTO-TXT-204` | 1074 | jsx | Perda |
| `CUSTO-TXT-205` | 1074 | jsx | Frete |
| `CUSTO-TXT-206` | 1074 | jsx | Subtotal |
| `CUSTO-TXT-207` | 1077 | jsx | Material |
| `CUSTO-TXT-208` | 1077 | jsx | Insumo |
| `CUSTO-TXT-209` | 1087 | jsx | Nenhum material ou insumo manual cadastrado. |
| `CUSTO-TXT-210` | 1088 | jsx | Materiais + insumos |
| `CUSTO-TXT-211` | 1092 | jsx | Dimensionamento dos circuitos |
| `CUSTO-TXT-212` | 1092 | jsx | Informe o diâmetro interno em milímetros e a metragem. O volume usa a área circular real; reservatórios, bombas, mangueiras e equipamentos entram como volumes adicionais. |
| `CUSTO-TXT-213` | 1092 | jsx | + Adicionar circuito |
| `CUSTO-TXT-214` | 1094 | jsx | Volume total |
| `CUSTO-TXT-215` | 1094 | jsx | L |
| `CUSTO-TXT-216` | 1095 | jsx | Aço carbono |
| `CUSTO-TXT-217` | 1096 | jsx | Inox |
| `CUSTO-TXT-218` | 1112 | codigo | Recolher |
| `CUSTO-TXT-219` | 1112 | codigo | Abrir |
| `CUSTO-TXT-220` | 1118 | jsx | Remover circuito |
| `CUSTO-TXT-221` | 1123 | jsx | Aço inox |
| `CUSTO-TXT-222` | 1123 | jsx | Outro / manual |
| `CUSTO-TXT-223` | 1124 | jsx | Ciclos de produto |
| `CUSTO-TXT-224` | 1126 | jsx | Tubulações por diâmetro interno |
| `CUSTO-TXT-225` | 1126 | jsx | O cálculo usa somente o diâmetro interno em milímetros, a metragem e a quantidade. |
| `CUSTO-TXT-226` | 1128 | jsx | Linha / trecho |
| `CUSTO-TXT-227` | 1128 | jsx | Diâmetro interno (mm) |
| `CUSTO-TXT-228` | 1128 | jsx | Comprimento (m) |
| `CUSTO-TXT-229` | 1128 | jsx | Preenchimento (%) |
| `CUSTO-TXT-230` | 1128 | jsx | Volume |
| `CUSTO-TXT-231` | 1138 | jsx | Adicione ao menos um trecho para calcular o volume da tubulação. |
| `CUSTO-TXT-232` | 1139 | jsx | + Adicionar trecho |
| `CUSTO-TXT-233` | 1141 | jsx | Máquinas e reservatórios de processo |
| `CUSTO-TXT-234` | 1141 | jsx | Selecione as capacidades de 120, 240, 1.000 ou 4.000 litros, ou ajuste o volume manualmente. |
| `CUSTO-TXT-235` | 1143 | jsx | Equipamento |
| `CUSTO-TXT-236` | 1143 | jsx | Volume unitário (L) |
| `CUSTO-TXT-237` | 1151 | codigo | Equipamento / reservatório personalizado |
| `CUSTO-TXT-238` | 1154 | jsx | Capacidade personalizada |
| `CUSTO-TXT-239` | 1163 | jsx | Nenhuma máquina ou reservatório de processo selecionado. |
| `CUSTO-TXT-240` | 1164 | jsx | + Adicionar máquina / reservatório |
| `CUSTO-TXT-241` | 1166 | jsx | Mangueiras de interligação |
| `CUSTO-TXT-242` | 1166 | jsx | O volume é calculado pelo diâmetro interno e pela metragem, separado das tubulações do cliente. |
| `CUSTO-TXT-243` | 1168 | jsx | Mangueira |
| `CUSTO-TXT-244` | 1178 | jsx | Nenhuma mangueira de interligação cadastrada. |
| `CUSTO-TXT-245` | 1179 | jsx | + Adicionar mangueira |
| `CUSTO-TXT-246` | 1181 | jsx | Outros volumes |
| `CUSTO-TXT-247` | 1181 | jsx | Use para tanques, acumuladores, equipamentos do cliente ou folgas não representadas acima. |
| `CUSTO-TXT-248` | 1191 | jsx | Sem volume adicional. |
| `CUSTO-TXT-249` | 1192 | jsx | + Adicionar outro volume |
| `CUSTO-TXT-250` | 1193 | jsx | Volume de trabalho deste circuito |
| `CUSTO-TXT-251` | 1201 | jsx | Produtos dimensionados por volume |
| `CUSTO-TXT-252` | 1201 | jsx | Dosagens e preços partem do CUSTO.Produtos da LEC. A planilha registra os químicos em kg; o app também mostra o equivalente por litro usando a densidade editável. |
| `CUSTO-TXT-253` | 1201 | jsx | + Adicionar produto |
| `CUSTO-TXT-254` | 1203 | jsx | Produto |
| `CUSTO-TXT-255` | 1203 | jsx | Circuito |
| `CUSTO-TXT-256` | 1203 | jsx | Regra |
| `CUSTO-TXT-257` | 1203 | jsx | Dosagem |
| `CUSTO-TXT-258` | 1203 | jsx | Un. |
| `CUSTO-TXT-259` | 1203 | jsx | Densidade kg/L |
| `CUSTO-TXT-260` | 1203 | jsx | Embalagem |
| `CUSTO-TXT-261` | 1203 | jsx | Preço por |
| `CUSTO-TXT-262` | 1203 | jsx | Preço base |
| `CUSTO-TXT-263` | 1203 | jsx | R$/L calculado |
| `CUSTO-TXT-264` | 1203 | jsx | Necessidade / compra |
| `CUSTO-TXT-265` | 1213 | jsx | Manual / sem circuito |
| `CUSTO-TXT-266` | 1214 | jsx | % do volume |
| `CUSTO-TXT-267` | 1214 | jsx | L por m³ |
| `CUSTO-TXT-268` | 1214 | jsx | kg por m³ |
| `CUSTO-TXT-269` | 1214 | jsx | Quantidade manual |
| `CUSTO-TXT-270` | 1215 | codigo | L/m³ |
| `CUSTO-TXT-271` | 1216 | jsx | kg |
| `CUSTO-TXT-272` | 1216 | jsx | un. |
| `CUSTO-TXT-273` | 1216 | jsx | m³ |
| `CUSTO-TXT-274` | 1225 | jsx | Excluído |
| `CUSTO-TXT-275` | 1225 | jsx | O cadastro será preservado. |
| `CUSTO-TXT-276` | 1226 | jsx | Comprar |
| `CUSTO-TXT-277` | 1230 | jsx | Nenhum produto químico cadastrado. |
| `CUSTO-TXT-278` | 1231 | jsx | Custo dos produtos |
| `CUSTO-TXT-279` | 1235 | jsx | Filtros |
| `CUSTO-TXT-280` | 1235 | jsx | Selecione os filtros da lista do CUSTO.Produtos, informe a quantidade e ajuste o valor unitário quando necessário. |
| `CUSTO-TXT-281` | 1235 | jsx | + Filtro personalizado |
| `CUSTO-TXT-282` | 1237 | jsx | Selecionar |
| `CUSTO-TXT-283` | 1237 | jsx | Filtro |
| `CUSTO-TXT-284` | 1237 | jsx | Micragem / referência |
| `CUSTO-TXT-285` | 1252 | jsx | Custo dos filtros selecionados |
| `CUSTO-TXT-286` | 1256 | jsx | Previsão de efluente |
| `CUSTO-TXT-287` | 1256 | jsx | A LEC estima o efluente em quatro vezes o volume físico dos circuitos, incluindo tubulações, máquinas, reservatórios e mangueiras, sem multiplicar novamente pelos ciclos de produto. |
| `CUSTO-TXT-288` | 1259 | jsx | Volume estimado |
| `CUSTO-TXT-289` | 1259 | jsx | litros |
| `CUSTO-TXT-290` | 1260 | jsx | Responsabilidade do cliente |
| `CUSTO-TXT-291` | 1261 | jsx | Incluir destinação no nosso custo |
| `CUSTO-TXT-292` | 1263 | jsx | Custo incluído |
| `CUSTO-TXT-293` | 1263 | codigo | Informativo — cliente assume |
| `CUSTO-TXT-294` | 1263 | codigo | Incluído em insumos |
| `CUSTO-TXT-295` | 1263 | codigo | Ainda não incluído |
| `CUSTO-TXT-296` | 1445 | codigo | Outro complemento |
| `CUSTO-TXT-297` | 1578 | jsx | Mobilização e desmobilização |
| `CUSTO-TXT-298` | 1578 | jsx | Use uma fase da mão de obra como nome do destino ou escolha “Outro nome / destino”. Depois informe a distância da Sede, aplicada à ida e ao retorno da equipe e dos equipamentos. |
| `CUSTO-TXT-299` | 1578 | jsx | + Outro destino |
| `CUSTO-TXT-300` | 1580 | codigo | Sem mobilização e desmobilização confirmado |
| `CUSTO-TXT-301` | 1580 | codigo | Revisão obrigatória da logística |
| `CUSTO-TXT-302` | 1580 | codigo | Nenhum deslocamento de equipe ou equipamento será incluído. |
| `CUSTO-TXT-303` | 1580 | codigo | O destino principal já prevê equipe e equipamento na mobilização e na desmobilização. |
| `CUSTO-TXT-304` | 1581 | jsx | Confirmo que não haverá mobilização ou desmobilização |
| `CUSTO-TXT-305` | 1594 | jsx | Destino |
| `CUSTO-TXT-306` | 1594 | codigo | Destino sem identificação |
| `CUSTO-TXT-307` | 1594 | jsx | Remover destino |
| `CUSTO-TXT-308` | 1596 | jsx | Fase / origem do nome * |
| `CUSTO-TXT-309` | 1623 | jsx | Outro nome / destino |
| `CUSTO-TXT-310` | 1626 | codigo | Nome do destino * |
| `CUSTO-TXT-311` | 1626 | codigo | Nome usado |
| `CUSTO-TXT-312` | 1638 | jsx | Endereço / cidade |
| `CUSTO-TXT-313` | 1639 | jsx | Distância Sede → obra (km) * |
| `CUSTO-TXT-314` | 1641 | jsx | eventos usam esta base de distância, incluindo mob. e desmob. |
| `CUSTO-TXT-315` | 1648 | jsx | Conclua os campos obrigatórios dos eventos incluídos antes de salvar o levantamento. |
| `CUSTO-TXT-316` | 1649 | jsx | A mesma equipe está ligada a mais de um transporte na mesma direção. Selecione os cargos e quantidades em cada evento sem repetir colaboradores. |
| `CUSTO-TXT-317` | 1660 | codigo | Equipe na mobilização |
| `CUSTO-TXT-318` | 1660 | codigo | Equipe na desmobilização |
| `CUSTO-TXT-319` | 1660 | jsx | de |
| `CUSTO-TXT-320` | 1660 | jsx | colaboradores cobertos |
| `CUSTO-TXT-321` | 1671 | jsx | Capacidade suficiente para o efetivo dimensionado. |
| `CUSTO-TXT-322` | 1680 | codigo | Mobilização |
| `CUSTO-TXT-323` | 1680 | codigo | Desmobilização |
| `CUSTO-TXT-324` | 1730 | jsx | Como será feito? |
| `CUSTO-TXT-325` | 1732 | jsx | Carro da empresa |
| `CUSTO-TXT-326` | 1733 | jsx | Carro alugado |
| `CUSTO-TXT-327` | 1734 | jsx | Ônibus |
| `CUSTO-TXT-328` | 1735 | jsx | Avião |
| `CUSTO-TXT-329` | 1737 | jsx | Frete contratado |
| `CUSTO-TXT-330` | 1738 | jsx | Caminhão próprio + colaborador |
| `CUSTO-TXT-331` | 1739 | jsx | Cálculo manual / anterior |
| `CUSTO-TXT-332` | 1742 | codigo | Equipe obrigatória |
| `CUSTO-TXT-333` | 1742 | codigo | Equipamento obrigatório |
| `CUSTO-TXT-334` | 1745 | codigo | Item padrão do destino |
| `CUSTO-TXT-335` | 1745 | codigo | Remover evento |
| `CUSTO-TXT-336` | 1748 | jsx | Destino / base de distância |
| `CUSTO-TXT-337` | 1754 | jsx | km |
| `CUSTO-TXT-338` | 1755 | jsx | Distância aplicada |
| `CUSTO-TXT-339` | 1760 | codigo | Aguardando decisão na mobilização |
| `CUSTO-TXT-340` | 1762 | codigo | Volta sincronizada com a ida |
| `CUSTO-TXT-341` | 1763 | codigo | Volta personalizada |
| `CUSTO-TXT-342` | 1765 | codigo | Conclua a ida e confirme se estas condições serão repetidas. |
| `CUSTO-TXT-343` | 1767 | codigo | Alterar qualquer campo abaixo personaliza somente o retorno. |
| `CUSTO-TXT-344` | 1768 | codigo | Os valores deste retorno não serão sobrescritos por mudanças na mobilização. |
| `CUSTO-TXT-345` | 1770 | jsx | Usar dados da ida |
| `CUSTO-TXT-346` | 1774 | jsx | Este evento mantém a composição histórica de HH. Selecione os cargos abaixo para atualizar o cálculo pela equipe real. |
| `CUSTO-TXT-347` | 1775 | jsx | A locação também está incluída nas despesas da fase. Desative uma das duas composições para não cobrar o carro duas vezes. |
| `CUSTO-TXT-348` | 1776 | jsx | Fase / equipe de origem * |
| `CUSTO-TXT-349` | 1788 | jsx | Selecione a fase |
| `CUSTO-TXT-350` | 1790 | jsx | Colaboradores |
| `CUSTO-TXT-351` | 1790 | jsx | Automático: todos da fase |
| `CUSTO-TXT-352` | 1790 | jsx | Selecionar cargos e quantidades |
| `CUSTO-TXT-353` | 1791 | jsx | Motorista / colaborador * |
| `CUSTO-TXT-354` | 1791 | jsx | Selecione por cargo abaixo |
| `CUSTO-TXT-355` | 1792 | jsx | Veículos |
| `CUSTO-TXT-356` | 1792 | codigo | Automático: 1 por motorista |
| `CUSTO-TXT-357` | 1792 | codigo | Automático: pela lotação |
| `CUSTO-TXT-358` | 1793 | jsx | Qtd. veículos * |
| `CUSTO-TXT-359` | 1794 | jsx | Pessoas por carro (máx. 4) |
| `CUSTO-TXT-360` | 1796 | codigo | Motoristas / colaboradores da viagem * |
| `CUSTO-TXT-361` | 1796 | codigo | Colaboradores da viagem * |
| `CUSTO-TXT-362` | 1796 | jsx | O HH será calculado pela tarifa real de cada cargo selecionado. |
| `CUSTO-TXT-363` | 1808 | jsx | Disponível: |
| `CUSTO-TXT-364` | 1812 | jsx | Selecione uma fase que tenha colaboradores dimensionados. |
| `CUSTO-TXT-365` | 1814 | jsx | Viagens / trechos iguais * |
| `CUSTO-TXT-366` | 1815 | jsx | Dias corridos por trecho * |
| `CUSTO-TXT-367` | 1821 | jsx | Limite de rodagem / dia (máx. 750 km) |
| `CUSTO-TXT-368` | 1822 | jsx | HH de viagem / dia (máx. |
| `CUSTO-TXT-369` | 1823 | jsx | Sábados na viagem |
| `CUSTO-TXT-370` | 1824 | jsx | Domingos / feriados |
| `CUSTO-TXT-371` | 1825 | jsx | Passagem / pessoa / trecho * |
| `CUSTO-TXT-372` | 1826 | jsx | Durante a viagem de ônibus * |
| `CUSTO-TXT-373` | 1831 | jsx | Selecione obrigatoriamente |
| `CUSTO-TXT-374` | 1831 | jsx | Segue direto, sem desembarcar para dormir |
| `CUSTO-TXT-375` | 1831 | jsx | Desembarca para dormir em hotel |
| `CUSTO-TXT-376` | 1834 | jsx | Pernoites por trecho * |
| `CUSTO-TXT-377` | 1838 | jsx | Hospedagem / pessoa / noite * |
| `CUSTO-TXT-378` | 1839 | jsx | Alimentação / pessoa / dia corrido de viagem * |
| `CUSTO-TXT-379` | 1840 | jsx | Uso do carro alugado * |
| `CUSTO-TXT-380` | 1845 | codigo | Somente para a mobilização |
| `CUSTO-TXT-381` | 1845 | codigo | Somente para a desmobilização |
| `CUSTO-TXT-382` | 1845 | codigo | Também ficará alugado para uso na obra |
| `CUSTO-TXT-383` | 1845 | codigo | É o mesmo carro que ficou alugado na obra |
| `CUSTO-TXT-384` | 1846 | jsx | Diária do carro alugado * |
| `CUSTO-TXT-385` | 1850 | jsx | Dias corridos alugado na obra * |
| `CUSTO-TXT-386` | 1851 | jsx | Rendimento do veículo (km/L) * |
| `CUSTO-TXT-387` | 1852 | jsx | Combustível (R$/L) * |
| `CUSTO-TXT-388` | 1853 | jsx | Pedágio estimado (R$/km da frota) |
| `CUSTO-TXT-389` | 1854 | jsx | Uso / manutenção do veículo (R$/km) |
| `CUSTO-TXT-390` | 1858 | jsx | Qtd. de fretes / caminhões * |
| `CUSTO-TXT-391` | 1859 | jsx | Viagens por frete * |
| `CUSTO-TXT-392` | 1860 | jsx | Valor contratado por frete * |
| `CUSTO-TXT-393` | 1864 | jsx | Viagem |
| `CUSTO-TXT-394` | 1864 | jsx | Hospedagem |
| `CUSTO-TXT-395` | 1864 | jsx | Outro |
| `CUSTO-TXT-396` | 1865 | jsx | Fase |
| `CUSTO-TXT-397` | 1865 | jsx | Projeto |
| `CUSTO-TXT-398` | 1866 | jsx | Forma |
| `CUSTO-TXT-399` | 1866 | jsx | Manual / fixo |
| `CUSTO-TXT-400` | 1866 | jsx | Valor por km |
| `CUSTO-TXT-401` | 1866 | jsx | Por viagem |
| `CUSTO-TXT-402` | 1866 | jsx | Por pessoa |
| `CUSTO-TXT-403` | 1866 | jsx | Pessoa-dia |
| `CUSTO-TXT-404` | 1867 | jsx | Qtd. / km |
| `CUSTO-TXT-405` | 1868 | jsx | Trechos / viagens |
| `CUSTO-TXT-406` | 1869 | jsx | Veículos (0 = automático) |
| `CUSTO-TXT-407` | 1874 | jsx | Complementos da viagem |
| `CUSTO-TXT-408` | 1874 | jsx | Balsa, travessia, estacionamento, escolta e outras taxas. |
| `CUSTO-TXT-409` | 1876 | jsx | Complemento |
| `CUSTO-TXT-410` | 1879 | jsx | Total fixo |
| `CUSTO-TXT-411` | 1879 | jsx | Por veículo |
| `CUSTO-TXT-412` | 1879 | jsx | Veículo × viagem |
| `CUSTO-TXT-413` | 1885 | jsx | Nenhum complemento. Use os atalhos abaixo quando houver balsa ou outra despesa. |
| `CUSTO-TXT-414` | 1886 | codigo | Balsa / travessia |
| `CUSTO-TXT-415` | 1886 | jsx | + Balsa |
| `CUSTO-TXT-416` | 1886 | jsx | + Outro complemento |
| `CUSTO-TXT-417` | 1890 | jsx | Formação comercial do transporte |
| `CUSTO-TXT-418` | 1892 | jsx | Contingência (%) |
| `CUSTO-TXT-419` | 1893 | jsx | Impostos + comissão (%) |
| `CUSTO-TXT-420` | 1894 | jsx | Margem LEC (%) |
| `CUSTO-TXT-421` | 1923 | jsx | Usar as mesmas características na desmobilização? |
| `CUSTO-TXT-422` | 1924 | jsx | Confirme esta etapa para não deixar a volta sem revisão. |
| `CUSTO-TXT-423` | 1932 | jsx | Sim, copiar e manter sincronizado (recomendado) |
| `CUSTO-TXT-424` | 1936 | codigo | active secondary |
| `CUSTO-TXT-425` | 1939 | jsx | Não, vou revisar a volta |
| `CUSTO-TXT-426` | 1943 | jsx | Resposta obrigatória antes de concluir o levantamento. |
| `CUSTO-TXT-427` | 1945 | codigo | A volta acompanhará as mudanças feitas na ida. |
| `CUSTO-TXT-428` | 1946 | codigo | A desmobilização ficou liberada para preenchimento independente. |
| `CUSTO-TXT-429` | 1949 | jsx | Nenhum evento cadastrado. |
| `CUSTO-TXT-430` | 1950 | codigo | 0 10px 10px |
| `CUSTO-TXT-431` | 1950 | jsx | + Adicionar evento |
| `CUSTO-TXT-432` | 1954 | jsx | Carros usam a distância Sede → obra e o limite de até 750 km/dia. Ônibus e avião usam os dias corridos informados, sempre com HH, alimentação e passagem; a hospedagem é incluída quando houver pernoite. A jornada separa horas normais, HE 70% e HE 100% conforme os dias da viagem. Ao concluir cada ida, confirme obrigatoriamente se a volta será sincronizada ou revisada separadamente. |
| `CUSTO-TXT-433` | 2020 | jsx | Apresentação comercial |
| `CUSTO-TXT-434` | 2020 | jsx | Os custos internos nunca são expostos automaticamente. Escolha a forma que será enviada para a proposta comercial e mantenha o QQP quando ele fizer parte da negociação. |
| `CUSTO-TXT-435` | 2027 | jsx | Valor global da proposta |
| `CUSTO-TXT-436` | 2027 | jsx | Custos, impostos e lucro continuam visíveis para conferência interna. |
| `CUSTO-TXT-437` | 2039 | codigo | serviço |
| `CUSTO-TXT-438` | 2039 | jsx | + Adicionar item comercial |
| `CUSTO-TXT-439` | 2046 | jsx | Comissões e indicações |
| `CUSTO-TXT-440` | 2047 | jsx | Registre os canais comerciais sem reduzir a margem. A comissão do representante é compensada no preço final; o bônus de colaborador entra como custo direto da obra. |
| `CUSTO-TXT-441` | 2053 | codigo | Comissão de representante incluída |
| `CUSTO-TXT-442` | 2053 | codigo | Sem representante nesta proposta |
| `CUSTO-TXT-443` | 2054 | jsx | Ative somente quando houver um representante externo com comissão adicional à base financeira da Filtrovali. |
| `CUSTO-TXT-444` | 2062 | jsx | Incluir comissão de representante |
| `CUSTO-TXT-445` | 2088 | jsx | Valor líquido após impostos — o que entra na conta |
| `CUSTO-TXT-446` | 2089 | jsx | Valor bruto da nota fiscal |
| `CUSTO-TXT-447` | 2093 | jsx | Comissão calculada |
| `CUSTO-TXT-448` | 2095 | jsx | Acréscimo automático no preço: |
| `CUSTO-TXT-449` | 2101 | jsx | Indicação interna de serviços |
| `CUSTO-TXT-450` | 2102 | jsx | Informe o colaborador e o bônus fixo. Cada lançamento será salvo como canal de venda para análise anual. |
| `CUSTO-TXT-451` | 2116 | jsx | + Adicionar indicação |
| `CUSTO-TXT-452` | 2121 | jsx | Colaborador * |
| `CUSTO-TXT-453` | 2121 | jsx | Valor do bônus * |
| `CUSTO-TXT-454` | 2125 | codigo | colaborador sem nome |
| `CUSTO-TXT-455` | 2128 | jsx | Bônus incluídos no custo da obra |
| `CUSTO-TXT-456` | 2130 | jsx | Nenhuma indicação interna lançada. |
| `CUSTO-TXT-457` | 2135 | jsx | Preencha o nome e o percentual do representante para liberar o salvamento. |
| `CUSTO-TXT-458` | 2139 | jsx | Toda indicação incluída precisa do nome do colaborador e de um bônus maior que zero. |
| `CUSTO-TXT-459` | 2143 | jsx | Formação do preço |
| `CUSTO-TXT-460` | 2143 | jsx | Conferência completa entre as categorias do levantamento e o valor final da proposta. |
| `CUSTO-TXT-461` | 2147 | jsx | BASE DE CÁLCULO FILTROVALI |
| `CUSTO-TXT-462` | 2147 | jsx | Imposto por dentro, como na planilha |
| `CUSTO-TXT-463` | 2147 | jsx | Imposto e margem incidem sobre a receita bruta. Comissão, overhead e comercial incidem sobre a receita líquida após imposto. |
| `CUSTO-TXT-464` | 2148 | jsx | MODELO HISTÓRICO LEC |
| `CUSTO-TXT-465` | 2148 | jsx | Margem controlada por você |
| `CUSTO-TXT-466` | 2148 | jsx | Este levantamento mantém a regra usada quando foi criado para não alterar o histórico. |
| `CUSTO-TXT-467` | 2150 | codigo | Margem base da planilha |
| `CUSTO-TXT-468` | 2152 | jsx | Aplicar sugestão |
| `CUSTO-TXT-469` | 2156 | codigo | Impostos (%) |
| `CUSTO-TXT-470` | 2157 | codigo | Comissão-base Filtrovali s/ líquida (%) |
| `CUSTO-TXT-471` | 2157 | codigo | Comissão-base (%) |
| `CUSTO-TXT-472` | 2161 | jsx | Limite matemático atual |
| `CUSTO-TXT-473` | 2161 | jsx | menor que |
| `CUSTO-TXT-474` | 2161 | jsx | Restaurar percentuais da planilha |
| `CUSTO-TXT-475` | 2169 | codigo | Preço calculado = custo ÷ [1 − imposto − margem − (comissão + overhead + comercial) × (1 − imposto) − comissão adicional do representante]. A base líquida ou bruta do representante é convertida automaticamente no denominador. |
| `CUSTO-TXT-476` | 2170 | codigo | Preço calculado = custo com overhead ÷ (1 − impostos − comissão − margem). Impostos, comissão, lucro e margem efetiva são conciliados sobre o valor final. |
| `CUSTO-TXT-477` | 2171 | jsx | Quer recalcular esta revisão com a regra atual da Filtrovali? |
| `CUSTO-TXT-478` | 2171 | jsx | Aplicar base da planilha Calculo Nov |
| `CUSTO-TXT-479` | 2172 | jsx | Neste modo o valor digitado é a base comercial. Quando houver comissão de representante, o sistema aplica o gross-up e, se necessário, eleva o preço ao mínimo que preserva a margem configurada. |
| `CUSTO-TXT-480` | 2196 | codigo | não informado |
| `CUSTO-TXT-481` | 2196 | codigo | s/ bruta |
| `CUSTO-TXT-482` | 2196 | codigo | s/ líquida |
| `CUSTO-TXT-483` | 2211 | jsx | QQP — Quadro de Quantidades e Preços |
| `CUSTO-TXT-484` | 2212 | jsx | Recolhido por padrão. Abra somente quando precisar conferir, incluir na proposta ou ajustar a apresentação da mobilização. |
| `CUSTO-TXT-485` | 2215 | codigo | Incluída na proposta |
| `CUSTO-TXT-486` | 2215 | codigo | Não incluída |
| `CUSTO-TXT-487` | 2222 | jsx | Incluir QQP na proposta |
| `CUSTO-TXT-488` | 2225 | jsx | Realocação comercial registrada |
| `CUSTO-TXT-489` | 2230 | jsx | Ajuste somente de apresentação |
| `CUSTO-TXT-490` | 2232 | jsx | Na coluna “Transferir para serviços”, informe quanto deseja retirar visualmente de cada linha de mobilização/desmobilização. O sistema distribui esse valor nas demais linhas, mantém o custo real intacto e preserva exatamente o total da proposta. |
| `CUSTO-TXT-491` | 2233 | jsx | A composição atual não possui cobrança logística com valor disponível. Para realocar, use “Resumo calculado” ou “QQP por HH” e informe a mobilização/desmobilização na etapa anterior. |
| `CUSTO-TXT-492` | 2236 | jsx | Valor calculado |
| `CUSTO-TXT-493` | 2236 | jsx | Transferir para serviços |
| `CUSTO-TXT-494` | 2236 | jsx | Valor exibido |
| `CUSTO-TXT-495` | 2242 | codigo | Serviços |
| `CUSTO-TXT-496` | 2258 | jsx | Limitado a |
| `CUSTO-TXT-497` | 2267 | jsx | Total da QQP |
| `CUSTO-TXT-498` | 2268 | jsx | A QQP aparecerá quando houver itens com custo ou preço calculável. |
| `CUSTO-TXT-499` | 2315 | jsx | HH normal |
| `CUSTO-TXT-500` | 2316 | jsx | Dia normal ( |
| `CUSTO-TXT-501` | 2316 | jsx | h) |
| `CUSTO-TXT-502` | 2317 | jsx | Mês carregado |
| `CUSTO-TXT-503` | 2318 | jsx | HH 70% |
| `CUSTO-TXT-504` | 2318 | jsx | · HH 100% |
| `CUSTO-TXT-505` | 2348 | codigo | Serviços industriais Filtrovali |
| `CUSTO-TXT-506` | 2384 | codigo | combustivel obra / hotel |
| `CUSTO-TXT-507` | 2385 | codigo | combustivel hotel / obra |
| `CUSTO-TXT-508` | 2386 | codigo | deslocamento hotel ↔ obra (combustivel) |
| `CUSTO-TXT-509` | 2398 | codigo | lavagem de roupa |
| `CUSTO-TXT-510` | 2402 | codigo | locacao de veiculo |
| `CUSTO-TXT-511` | 2407 | codigo | Locação de veículo |
| `CUSTO-TXT-512` | 2418 | codigo | Alimentação |
| `CUSTO-TXT-513` | 2419 | codigo | Lavagem de roupa |
| `CUSTO-TXT-514` | 2430 | codigo | Deslocamento hotel ↔ obra (combustível) |
| `CUSTO-TXT-515` | 2464 | codigo | Despesa indireta |
| `CUSTO-TXT-516` | 2514 | codigo | Obra principal |
| `CUSTO-TXT-517` | 2656 | codigo | Pré-engenharia |
| `CUSTO-TXT-518` | 2657 | codigo | Planejamento, levantamento e preparação antes da execução. |
| `CUSTO-TXT-519` | 2694 | codigo | Nova despesa |
| `CUSTO-TXT-520` | 2706 | codigo | Novo custo indireto |
| `CUSTO-TXT-521` | 2722 | codigo | Circuito de aço carbono |
| `CUSTO-TXT-522` | 2734 | codigo | Linha principal |
| `CUSTO-TXT-523` | 2738 | codigo | Mangueira de interligação |
| `CUSTO-TXT-524` | 2741 | codigo | Máquina / reservatório 120 L |
| `CUSTO-TXT-525` | 2746 | codigo | Reservatório / outro volume |
| `CUSTO-TXT-526` | 2753 | codigo | Novo produto |
| `CUSTO-TXT-527` | 2770 | codigo | Filtro personalizado |
| `CUSTO-TXT-528` | 2849 | codigo | Deslocamento de mobilização |
| `CUSTO-TXT-529` | 2849 | codigo | Retorno de desmobilização |
| `CUSTO-TXT-530` | 3177 | jsx | Fixo / evento |
| `CUSTO-TXT-531` | 3179 | jsx | Por pessoa-dia trabalhado |
| `CUSTO-TXT-532` | 3180 | jsx | Por pessoa × dia corrido |
| `CUSTO-TXT-533` | 3181 | jsx | Por pessoa × dia útil |
| `CUSTO-TXT-534` | 3182 | jsx | Por pessoa-mês |
| `CUSTO-TXT-535` | 3183 | jsx | Por veículo × dia corrido |
| `CUSTO-TXT-536` | 3184 | jsx | Por veículo × dia útil |
| `CUSTO-TXT-537` | 3185 | jsx | Por dia da fase |
| `CUSTO-TXT-538` | 3186 | jsx | Por mês da fase |
| `CUSTO-TXT-539` | 3187 | jsx | % da mão de obra |
| `CUSTO-TXT-540` | 3198 | codigo | Encargos e provisões |
| `CUSTO-TXT-541` | 3201 | codigo | Remuneração |

## HIST — Histórico de propostas

Origem: `app/historico/page.tsx`

### HIST: títulos

| ID | Linha | Nível | Texto |
|---|---:|---|---|
| `HIST-H-001` | 54 | h1 | Histórico de propostas |

### HIST: controles

| ID | Linha | Elemento | Rótulo | Atributos |
|---|---:|---|---|---|
| `HIST-CTL-001` | 51 | `Link` | — | aria-label=Filtrovali Engenharia |
| `HIST-CTL-002` | 52 | `Link` | ← Voltar ao gerador | — |
| `HIST-CTL-003` | 52 | `button` | Sair | type=button |
| `HIST-CTL-004` | 56 | `form` | Buscar | — |
| `HIST-CTL-005` | 56 | `input` | — | value={query}, placeholder=Buscar por número, cliente, documento, responsável ou funil... |
| `HIST-CTL-006` | 56 | `button` | Buscar | — |
| `HIST-CTL-007` | 56 | `button` | Limpar | type=button |

### HIST: textos visíveis

`jsx` = escrito direto na marcação. `codigo` = string do código (mensagem de
erro, rótulo de opção, texto de confirmação).

| ID | Linha | Origem | Texto |
|---|---:|---|---|
| `HIST-TXT-001` | 32 | codigo | Falha ao consultar o histórico. |
| `HIST-TXT-002` | 52 | jsx | Orçamentista: |
| `HIST-TXT-003` | 52 | jsx | ← Voltar ao gerador |
| `HIST-TXT-004` | 52 | jsx | Sair |
| `HIST-TXT-005` | 54 | jsx | COMERCIAL / PROPOSTAS |
| `HIST-TXT-006` | 54 | jsx | Histórico de propostas |
| `HIST-TXT-007` | 54 | jsx | Consulte as propostas geradas, integrações e destinos de arquivamento. |
| `HIST-TXT-008` | 54 | jsx | registros encontrados |
| `HIST-TXT-009` | 56 | jsx | Buscar |
| `HIST-TXT-010` | 56 | jsx | Limpar |
| `HIST-TXT-011` | 58 | jsx | Carregando histórico... |
| `HIST-TXT-012` | 58 | jsx | Nenhuma proposta registrada ainda. As próximas finalizações aparecerão aqui. |
| `HIST-TXT-013` | 58 | jsx | Proposta |
| `HIST-TXT-014` | 58 | jsx | Cliente / serviço |
| `HIST-TXT-015` | 58 | jsx | Documentos |
| `HIST-TXT-016` | 58 | jsx | Responsáveis |
| `HIST-TXT-017` | 58 | jsx | Contato |
| `HIST-TXT-018` | 58 | jsx | Valor |
| `HIST-TXT-019` | 58 | jsx | Integrações / funil |
| `HIST-TXT-020` | 58 | jsx | Atualização |
| `HIST-TXT-021` | 58 | jsx | Comercial |
| `HIST-TXT-022` | 58 | jsx | Baixar comercial |
| `HIST-TXT-023` | 58 | jsx | Técnica |
| `HIST-TXT-024` | 58 | jsx | Baixar técnica |
| `HIST-TXT-025` | 58 | jsx | Vendedor |
| `HIST-TXT-026` | 58 | jsx | Orçamentista |
| `HIST-TXT-027` | 58 | jsx | Custo: |
| `HIST-TXT-028` | 58 | jsx | · Margem: |
| `HIST-TXT-029` | 58 | jsx | Nectar |
| `HIST-TXT-030` | 58 | jsx | SharePoint |
| `HIST-TXT-031` | 58 | jsx | Custos |
| `HIST-TXT-032` | 58 | jsx | Funil: |
| `HIST-TXT-033` | 58 | jsx | Oportunidade |

## Revisão humana

- [ ] Percorrer a referência de pé (E0-7) e conferir que cada tela do inventário
      corresponde ao que aparece na tela.
- [ ] Marcar os itens que são ruído de extração e não elemento de UI.
- [ ] Marcar os itens que o porte NÃO vai reproduzir, com motivo — eles viram a
      lista fechada de desvios deliberados (E0-8).
- [ ] Conferir os zeros da tabela de sinais contra a tela real.

