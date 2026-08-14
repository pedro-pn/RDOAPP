# Checklist de paridade — aceite lado a lado

**Purpose**: Peça 3 da §5.7 do `docs/PLANO_MODULO_COMERCIAL.md`. **Item da Definição de
Pronto**, não conferência informal.
**Created**: 2026-07-31
**Feature**: [spec.md](../spec.md) · Oráculo: [contracts/ui-inventory.md](../contracts/ui-inventory.md)

> **Este arquivo é de natureza diferente do [ux.md](./ux.md).** O `ux.md` é o que o
> `/speckit-checklist` produz: teste unitário do *texto* dos requisitos. Este aqui é
> **artefato de aceite** — conferência elemento a elemento contra a referência
> congelada. A §5.7 do plano dizia que o `/speckit-checklist` geraria este arquivo;
> não gera, e a §5.7 foi corrigida.

**Como usar**: referência de pé de um lado (`localhost:3000`, login `baseline` /
`baseline-e0`), módulo do outro, percorrendo `contracts/baseline/roteiro.md`.

**Regra de classificação**: cada divergência é **defeito** ou um dos **17 desvios
aprovados**. Divergência não listada é defeito, não escolha.

**Diferença esperada e aceita**: a fonte do chrome (desvio nº 5) e o reflow que ela
causa. **A prévia do documento mantém Arial/Helvetica e não tem desculpa para
divergir.**

---

## 1. Paridade de elemento — por faixa de ID

O risco que esta seção cobre: **perder silenciosamente** um campo, uma condição ou uma
mensagem. São ~800 strings visíveis, e o que sumir **não gera erro, gera ausência** —
e ausência não aparece em revisão de código.

### `CUSTO` — 465 controles, 17 títulos, 541 textos

- [ ] PAR-001 - `CUSTO-CTL-001..027` — shell, tira de 5 seções, diálogo "Como deseja começar?" e modal "Confirme a proposta"
- [ ] PAR-002 - `CUSTO-CTL-028..038` — **Premissas** (11 controles)
- [ ] PAR-003 - `CUSTO-CTL-039..137` — **Mão de obra** (99 controles)
- [ ] PAR-004 - `CUSTO-CTL-138..228` — **Materiais e insumos** (91 controles)
- [ ] PAR-005 - `CUSTO-CTL-229..394` — **Mob. e desmob.** (166 controles), incluindo o espelhamento da desmobilização
- [ ] PAR-006 - `CUSTO-CTL-395..465` — **Resumo e QQP** (71 controles), incluindo a faixa de 7 indicadores
- [ ] PAR-007 - `CUSTO-H-001..017` — todos os títulos, no mesmo nível hierárquico
- [ ] PAR-008 - `CUSTO-TXT-001..541` — todos os textos de erro, aviso, estado vazio e ajuda, **sem reescrita**

### `PROP` — 137 controles, 22 títulos, 330 textos

- [ ] PAR-009 - `PROP-CTL-001..010` — shell, stepper de 7 etapas e diálogo de modo/revisão
- [ ] PAR-010 - `PROP-CTL-011..025` — etapa 1 **Cliente** (15 controles)
- [ ] PAR-011 - `PROP-CTL-026..033` — etapa 2 **Escopo**, parte inline (8 controles)
- [ ] PAR-011a - `PROP-CTL-113..128` — etapa 2, **editor de blocos de conteúdo** (16 controles): incluir tabela, incluir fotos, legenda, remover, setas ↑/↓
- [ ] PAR-011b - Limites: **8 fotos**, **8 tabelas**, **6 colunas**, **40 linhas**, **300 caracteres** por célula, **240** de legenda — com o controle desabilitado e a mensagem que nomeia o limite
- [ ] PAR-011c - Otimização no cliente: recusa acima de 10 MB ou 24 megapixels, redimensiona para 1600 px, recomprime em 0,82 e depois 0,64, e **nomeia o arquivo** na mensagem de recusa
- [ ] PAR-011d - Servidor recusa por **assinatura de bytes**: `.jpg` que não é imagem não entra
- [ ] PAR-011e - As fotos **sobrevivem à revisão** — revisar não exige reenviar
- [ ] PAR-012 - `PROP-CTL-034..042` — etapa 3 **Responsabilidades** (9 controles)
- [ ] PAR-013 - `PROP-CTL-043..048` — etapa 4 **Prazos** (6 controles)
- [ ] PAR-014 - `PROP-CTL-049..057` **+ `098..112`** — etapa 5 **Técnica**, incl. o editor de serviços (24 controles)
- [ ] PAR-015 - `PROP-CTL-058..071` — etapa 6 **Comercial** (14 controles)
- [ ] PAR-016 - `PROP-CTL-072..085` **+ `129..130`** — etapa 7 **Revisão**, incl. funil e cards (16 controles)
- [ ] PAR-017 - `PROP-CTL-086..089` **+ `131..137`** — **prévia** (11 controles), presente nas 7 etapas
- [ ] PAR-017a - `PROP-CTL-090..097` — primitivas `Step`/`Field`/`Area`/`SelectField`, usadas por todas as etapas
- [ ] PAR-018 - `PROP-H-001..003` — títulos do chrome
- [ ] PAR-019 - `PROP-H-004..022` — **fac-símile do documento**: 13 itens no comercial, 10 no técnico, na mesma ordem
- [ ] PAR-020 - `PROP-TXT-001..330` — todos os textos

### `HIST` — 7 controles, 1 título, 33 textos

- [ ] PAR-021 - `HIST-CTL-001..007`, `HIST-H-001`, `HIST-TXT-001..033` — listagem com status de integração, valor, revisão e arquivos

### `LOGIN` — não portado

- [ ] PAR-022 - `LOGIN-CTL-001..007`, `LOGIN-H-001`, `LOGIN-TXT-001..012` — **não portados**, e o motivo está registrado: o módulo reusa o login do filtroAPP, premissa desde o início do projeto. **Esta linha existe para registrar a decisão, não para conferir a tela.** Sem ela, o silêncio destes IDs vira indistinguível de esquecimento.

---

## 2. Comportamento — o que não é elemento

- [ ] PAR-023 - **Cadeia de prioridade do rodapé** do levantamento: mão de obra → materiais e insumos → mob./desmob. → comissões → salvar. O botão muda de **texto e de destino**, e clicar leva à seção pendente
- [ ] PAR-024 - O botão de salvar só habilita com **título preenchido**, **precificação válida** e **preço de venda > 0**
- [ ] PAR-025 - **As abas continuam livres**: a cadeia do rodapé guia, não prende
- [ ] PAR-026 - Trava por etapa da proposta, com contador "Preencha N campo(s) obrigatório(s)" e botão desabilitado — **não dá para pular etapa incompleta**
- [ ] PAR-027 - As travas de cada etapa conferem uma a uma com a tabela do `spec.md` §3.2
- [ ] PAR-028 - Todas as **regras condicionais**: parâmetros pedidos só quando o serviço exige, espelhamento da desmobilização, desabilitações
- [ ] PAR-029 - Os **4 estágios** da finalização, anunciados ao usuário na ordem da referência
- [ ] PAR-030 - As validações pré-finalização, com **mensagem específica por problema**
- [ ] PAR-031 - **Falha de integração após os PDFs prontos**: a mensagem informa que eles continuam disponíveis para download. O trabalho não se perde
- [ ] PAR-032 - Download final: técnica + comercial juntas ou separadas
- [ ] PAR-032a - A finalização envia **três** arquivos ao destino, não dois: os dois PDFs **mais a planilha de custos** `Levantamento de Custos - {código}.csv`, em UTF-8 com BOM e separador ponto e vírgula
- [ ] PAR-032b - A planilha tem **dois formatos por versão de esquema** — proposta antiga não quebra a finalização
- [ ] PAR-033 - Modal "Confirme a proposta" com as três saídas, **incluindo "Trocar para nova"** — mantida apesar de ser saída morta na prática, porque removê-la quebraria a regra "se algo sumiu, é bug"

---

## 3. Os 17 desvios aprovados — reconhecer, não abrir defeito

Cada linha é uma divergência que o revisor **vai** encontrar.

- [ ] PAR-034 - **Desvio 1** — PDF gerado no backend: o download tem uma ida ao servidor
- [ ] PAR-035 - **Desvio 2** — Tailwind removido: nenhum efeito visual
- [ ] PAR-036 - **Desvio 3** — layout mobile **criado**, não portado. Em largura de celular **não há paridade pixel-a-pixel a perseguir**
- [ ] PAR-037 - **Desvio 4** — acréscimos exigidos pela constitution (L1, L3, L4, L5). São **acréscimos, não substituições**
- [ ] PAR-038 - **Desvio 5** — fonte do chrome herda a do app. **O fac-símile do documento mantém Arial/Helvetica**
- [ ] PAR-039 - **Desvio 6** — drag and drop **ao lado** das setas ↑/↓, que continuam. Acréscimo puro
- [ ] PAR-040 - **Desvio 7** — paleta em bloco único `--com-*`, prefixada e nomeada por função. **A cor renderizada não muda**
- [ ] PAR-041 - **Desvio 8** — fluxo "Nova proposta" sem baseline visual: conferido contra o código, não contra captura
- [ ] PAR-042 - **Desvio 9** — entrada do módulo é um menu, e a proposta sai da raiz. **Sem baseline** — não existe na referência para ser fotografado

---

## 4. As sete lacunas — trabalho novo, sem baseline para comparar

- [ ] PAR-043 - **L1** — salvar com campo obrigatório vazio destaca **cada** campo em vermelho, com mensagem visível e `aria-invalid`. O banner-resumo permanece
- [ ] PAR-044 - **L1** — "E-mail inválido" e "CNPJ inválido" são **distintos** de "Campo obrigatório". É o ponto de travamento mais provável do fluxo
- [ ] PAR-045 - **L2** — arrastar tem alça dedicada, reordenação ao vivo, espaço indicando destino, fantasma, cancelar restaura, persiste só ao soltar
- [ ] PAR-046 - **L2** — funciona em toque, e **as setas ↑/↓ continuam** como caminho de teclado
- [ ] PAR-047 - **L3** — F5 volta ao mesmo modo, base e seção/etapa, pelo endereço
- [ ] PAR-048 - **L3** — rascunho não salvo é **oferecido**, nunca restaurado em silêncio, e descartado ao salvar
- [ ] PAR-049 - **L3** — fechar a aba com alteração pendente dispara aviso, **nas duas telas**
- [ ] PAR-050 - **L4** — tutorial permanente aparece no primeiro acesso, é dispensável e não reaparece sozinho
- [ ] PAR-051 - **L5** — login com campo vazio tem estado de campo inválido, não só erro global
- [ ] PAR-052 - **L6** — nenhum `--com-*` vaza para fora da raiz do módulo, e nenhum token global é redefinido
- [ ] PAR-053 - **L7** — **zero rolagem horizontal de página** nas 4 telas em 390 px
- [ ] PAR-054 - **L7** — os dois estouros conhecidos resolvidos: faixa de 7 indicadores e tira de 5 seções

---

## 5. Permissão — a matriz dos 3 papéis

- [ ] PAR-055 - `comercial:manager` alcança levantamentos e propostas de **qualquer autor**, e finaliza qualquer uma
- [ ] PAR-056 - `comercial:seller` alcança **apenas os seus**, e finaliza **apenas as suas**
- [ ] PAR-057 - **O caso crítico**: `seller` A pede a **listagem** enquanto existe registro de `seller` B — e não o recebe. Se a filtragem estiver só na rota de item, este é o único ponto que pega
- [ ] PAR-058 - `seller` pedindo registro de outro autor por **endereço direto** recebe 403, não tela vazia
- [ ] PAR-059 - `comercial:viewer` não alcança levantamento por nenhum caminho
- [ ] PAR-060 - `comercial:viewer` recebe a listagem **sem valor, custo nem margem — ausentes da resposta**, não escondidos na tela
- [ ] PAR-061 - `comercial:viewer` baixa a **técnica** e recebe **403 na rota** ao pedir a **comercial**
- [ ] PAR-062 - `comercial:viewer` não tem tela de detalhe de proposta — sua superfície é a listagem
- [ ] PAR-063 - O card do módulo não aparece no hub para quem não tem nenhum dos três papéis
- [ ] PAR-063a - No campo "Consultor de Vendas" (`PROP-CTL-016`), `comercial:seller` recebe **apenas o próprio nome**, já pré-selecionado, e `comercial:manager` recebe a lista completa. **A decisão é do servidor** — um vendedor não deve nem receber os nomes dos outros
- [ ] PAR-063b - A lista de consultores é **derivada dos usuários** com o papel `comercial:seller`: conceder o papel faz aparecer, sem passo de cadastro. **Não existe tela de cadastro de vendedores** — sua ausência é decisão registrada, não esquecimento
- [ ] PAR-063c - Desativar ou renomear um usuário **não altera proposta já emitida**: o `sellerName` gravado é o do momento da emissão

---

## 6. Números — o oráculo que não admite opinião

- [ ] PAR-064 - **16 de 16 goldens** reproduzidos **dígito a dígito**, cobrindo os 40 invariantes
- [ ] PAR-065 - Nenhum golden foi regerado durante o porte. O commit em `manifest.json` bate com o `HEAD` de `~/comercialAPP`
- [ ] PAR-066 - Os totais gravados são **os do servidor**, não os enviados pelo cliente — margem forjada é rejeitada
- [ ] PAR-067 - A numeração não regride e não colide

---

## 7. Portões finais

- [ ] PAR-068 - `npm run architecture:check` verde
- [ ] PAR-069 - `npm --prefix frontend run lint` verde
- [ ] PAR-070 - As duas suítes verdes
- [ ] PAR-071 - **`/speckit-analyze` sem nenhum item de inventário órfão**
- [ ] PAR-072 - Comparação por captura das 4 telas contra `contracts/baseline/*-1440.png`, com toda diferença explicada
- [ ] PAR-073 - **Nenhum comando de servidor executado por agente ou desenvolvedor** — `deploy/COMERCIAL.md` documenta o roteiro para o operador
