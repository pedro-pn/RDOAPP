# E0-8 — Lista fechada de desvios e revisão da estimativa

Pacote de aprovação da última etapa da E0. Duas decisões suas:

- **Parte A** — a lista fechada de desvios deliberados, revisada com o que a E0
  descobriu. Depois de aprovada, **divergência fora da lista é bug, não escolha**.
- **Parte B** — a estimativa da §8 do plano, revisada. As lacunas L1 a L7 são
  trabalho novo que a §8 não precificou.

Nada aqui é irreversível: é o combinado que o `/speckit-specify` vai consumir.

---

## Parte A — Desvios deliberados

A numeração 1 a 5 é a mesma da §5.7 do plano, para as referências existentes
continuarem valendo. Os itens **3** e **4** foram reescritos porque a E0 mostrou
que estavam subdimensionados. Os itens **6 a 8** são novos.

| # | Desvio | Situação |
|---|---|---|
| 1 | PDF gerado no backend | Inalterado |
| 2 | Tailwind removido | Inalterado |
| 3 | Layout mobile inexistente será **criado** | **Reescrito** (era "corrigir `nowrap` das tabelas") |
| 4 | Acréscimos exigidos pela constitution | **Reescrito** (lista completa, L1/L3/L4/L5) |
| 5 | Fonte do chrome herda a do app | Inalterado |
| 6 | Drag and drop **substitui** os botões ↑/↓ | **Novo** (L2) |
| 7 | Paleta em bloco único, prefixada, com escopo | **Novo** (L6) |
| 8 | Fluxo "Nova proposta" sem baseline visual | **Novo** — limitação, não escolha |

### 1. PDF gerado no backend

O download passa a ter uma ida ao servidor (§5.3). Imposto pela stack fixada na
constitution, não é escolha de produto.

### 2. Tailwind removido

Não era usado no rascunho. Nenhum efeito visual.

### 3. Layout mobile inexistente será criado — *reescrito*

**O que dizia:** "correção de scroll horizontal no celular onde o `nowrap` das
tabelas de custo estoura a viewport, preservando o desktop".

**Por que mudou:** a E0-7 mostrou que não é um ajuste pontual em tabela. **Não
existe layout mobile** — o desktop carrega no celular com rolagem horizontal
(lacuna L7). A causa raiz são **39 regras de `min-width` em pixel**, a pior
delas `.preview{min-width:390px}`, que sozinha estoura qualquer viewport de
390 px. Os 13 breakpoints do `globals.css` mostram que houve intenção
responsiva; os pisos fixos a anulam.

**O que fica combinado:** o módulo terá layout mobile próprio, seguindo a
padronização visual do desktop. **Em largura de celular não há paridade
pixel-a-pixel a perseguir** — não há do que ser fiel. O desktop continua
pixel-a-pixel.

**Sua decisão já registrada:** a passada de ajuste fino mobile fica para o fim do
porte. Isso é sequenciamento, não dispensa: segue sendo condição de aceite.

### 4. Acréscimos exigidos pela constitution — *reescrito*

**O que dizia:** "tutorial permanente de primeiro acesso, `aria-invalid` nos
campos inválidos, estado navegacional em query params".

**Por que mudou:** a lista estava incompleta e, mais importante, **estava citada
na §5.7 mas não precificada na §8**. A lista completa:

| Lacuna | Acréscimo | Onde |
|---|---|---|
| L1 | Validação por campo com `aria-invalid` e mensagem visível | `CUSTO` (465 controles) |
| L3 | Seção e etapa em query param | `CUSTO`, `PROP` |
| L4 | Tutorial permanente de primeiro acesso + campanha de novidade de 10 dias | todas |
| L5 | Estado de campo inválido no login | `LOGIN` |

São **acréscimos, não substituições**: nenhum comportamento da referência é
removido por eles. A L1 é a mais séria — é a tela onde o preço é formado, e hoje
o app entrega todas as pendências grudadas num banner único (nos goldens, o
cenário 01 devolve 12 erros de uma vez). A informação para fazer certo já existe:
`validateCostEstimate` devolve `{ path, message, severity }` por item, e o
`path` é o endereço do campo. A referência joga isso fora.

### 5. Fonte do chrome herda a do app

`'Segoe UI', system-ui` em vez do `Arial, Helvetica` do rascunho. O fac-símile do
documento **mantém Arial/Helvetica**, para continuar fiel ao PDF.

Nota da E0-6: as fontes Geist que o rascunho baixa **nunca são usadas** —
`globals.css:26` fixa `font-family:Arial` e vence a variável do `layout.tsx:51`.
O desvio é menor do que parecia: só o chrome muda, e o documento não muda nada.

### 6. Drag and drop substitui os botões ↑/↓ — *novo*

Três listas reordenáveis em `app/page.tsx` (itens de serviço do escopo, serviços
técnicos, blocos de conteúdo) usam par de botões ↑/↓. O app inteiro tem **zero**
ocorrências de `onDrag`, `draggable`, `onPointerDown` ou `touch-action`.

A constitution exige o padrão compartilhado: alça dedicada, reordenação ao vivo
durante o arraste, placeholder com legenda de posição, fantasma visual,
cancelamento restaurando a ordem inicial, persistência só da ordem final, e toque
via Pointer Events.

**Este é o único desvio que remove um controle existente da referência.** Por
isso vale a pena ser explícito: os ↑/↓ somem. Se você quiser mantê-los como
alternativa acessível ao lado da alça, é uma decisão sua e eu implemento — mas
precisa ser dita aqui, senão o aceite lado a lado vai marcar como bug.

### 7. Paleta em bloco único, prefixada, com escopo — *novo*

O `globals.css` tem **dois** blocos `:root` (linhas 26 e 56) redefinindo os mesmos
sete tokens com valores diferentes. Mesma especificidade, então o segundo vence:
**o app renderiza verde, e a paleta azul da linha 26 é código morto**. Os nomes
`--navy` e `--blue` apontam para tons de verde.

Copiar isso como está tem dois efeitos ruins: nomes genéricos (`--ink`, `--line`,
`--bg`, `--muted`) em `:root` colidem com os tokens do `variables.css` do
filtroAPP e **vazam a paleta do módulo para o app inteiro**; e a duplicação já
produziu uma conclusão errada durante a própria E0 (ver
`baseline/README.md`, correção do stepper).

O porte usa um bloco único sob `.comercial-app`, com nomes `--com-*` escolhidos
**pela função e não pela cor**. **A cor renderizada não muda** — é a mesma paleta
verde da linha 56. Muda só como o CSS está escrito.

Isto é desvio de código, não de aparência. Está listado para que a comparação
lado a lado não o classifique como bug.

### 8. Fluxo "Nova proposta" sem baseline visual — *novo*

Não é escolha: é limitação registrada. `app/api/nectar/next-number/route.ts:24-30`
faz chamada real ao CRM Nectar para reservar a numeração e devolve **503 "Token do
Nectar não configurado."** sem `NECTAR_API_TOKEN`. Não há caminho local.

A baseline foi capturada pelo caminho **"Revisar proposta" → 4418**, que não toca
o Nectar. As telas de formulário são as mesmas — muda só o cabeçalho de modo — mas
**o passo de reserva do número ficou sem captura de referência**.

Consequência prática: a paridade visual desse passo específico será conferida
contra o código, não contra screenshot. Se você tiver um token de teste do Nectar,
eu capturo e este item some da lista.

---

## Parte B — Revisão da estimativa

### Por que revisar

A §8 dimensionou as etapas E4 a E8 como **reescrita fiel de UI**. As lacunas L1 a
L7 não são reescrita: são funcionalidade que a referência não tem e que a
constitution exige. Três delas (L1, L3, L4) até aparecem no texto da §5.7, mas
**nenhuma entrou nos números da §8**.

Além disso a E0 custou mais que o orçado: 2 dias previstos, ~3 realizados. O que
consumiu a diferença foram os goldens (7 iterações até fechar os invariantes) e
subir a referência (três obstáculos: `.openai/hosting.json` ausente, corepack
quebrado, e login sem senha real).

### Quadro revisado

| Etapa | Escopo | Antes | **Agora** | O que entrou |
|---|---|---|---|---|
| E0 | Preparação, goldens, inventário, referência rodando | 2 d | **3 d** | Realizado |
| E-1 | Fluxo spec-kit + emenda à constitution | 2–2,5 d | 2–2,5 d | — |
| E1 | Scaffold do módulo | 0,5 d | 0,5 d | — |
| E2 | `shared/comercial` | 2 d | 2 d | — |
| E3 | Banco e dois schemas | 1,5 d | 1,5 d | — |
| E4 | Backend — levantamentos, vendedores, numeração | 3 d | 3 d | — |
| E5 | Backend — propostas, autoria, PDFs, integrações | 5,5 d | 5,5 d | — |
| E6 | Frontend — base, histórico, porte do CSS | 2 d | **2,5–3 d** | L6 (auditar bloco ativo) + primitivas seguras de mobile |
| E7 | Frontend — levantamento de custos | 5–6 d | **8–9 d** | **L1** (+3 d) e L3 |
| E8 | Frontend — assistente da proposta + vendedores | 5–6 d | **8–9 d** | **L2** (+1,5 d), **L4** (+1 d), L3 |
| **E8.5** | **Passada de mobile sobre as 4 telas** | — | **3–4 d** | **L7** |
| E9 | Testes e CI | 2 d | **2,5 d** | Testes de validação por campo e de ausência de scroll horizontal |
| E10 | Produção | 1,5 d | 1,5 d | — |
| | **Até produção** | **32–35,5 d** | **43–47 d** | **+11 dias úteis (~2 semanas)** |
| E11 | Substituir o import do Access | 3–5 d | 3–5 d | — |

**~7 semanas → ~9 semanas.**

### De onde vem cada delta

**L1 → +3 d em E7.** Não são 465 edições manuais: os campos saem de poucos
componentes repetidos por alocação e por item. O custo real é (a) generalizar o
componente `Field` de `app/page.tsx:1187` — que já faz o certo e é o **único**
`aria-invalid` do app — (b) escrever o resolvedor de `path` → id de campo, e (c)
ligar as 5 seções. ~1 d de encanamento, ~1,5 d de ligação, ~0,5 d de teste.

**L2 → +1,5 d em E8.** 0,5 d para auditar se o componente de drag and drop que já
existe no filtroAPP atende a constitution atual (o `plan-template.md` exige essa
checagem antes de reusar, e manda corrigir a origem se houver dívida visual) e
1 d para aplicar nas três listas. **Risco de +1 d** se a auditoria reprovar o
componente compartilhado — aí o conserto é na origem e beneficia o app todo.

**L3 → +0,5 d, dividido entre E7 e E8.** Barato: 5 seções em `CUSTO`, 7 etapas em
`PROP`, query param e limpeza de params incompatíveis na troca.

**L4 → +1 d em E8.** O `driver.js` já está nas dependências do frontend; a peça
existe. O que custa é escrever o roteiro — e ele depende do `roteiro.md` da E0-7,
que ainda está pendente.

**L5 → 0 d.** Absorvido pela L1: o mesmo componente generalizado resolve o login.

**L6 → +0,25 d em E6.** A §5.6 já previa a paleta prefixada. O acréscimo é a
auditoria regra a regra de qual bloco `:root` está ativo — a duplicação já me fez
errar uma vez.

**L7 → +3–4 d em uma etapa nova (E8.5), mais ~0,5 d diluído em E6–E8.** A parte
diluída é disciplina, não tempo: ao escrever cada tela, nunca portar `min-width`
em pixel de container, `min-width: 0` em filho de flex/grid desde o início,
tabela larga já dentro do próprio `overflow-x: auto`, grade de cards com
`minmax(min(100%, Npx), 1fr)`. Com isso a E8.5 é ajuste de espaçamento e ordem.
**Sem isso, a E8.5 é reescrita de layout e custa o dobro.**

### Se 9 semanas não couber

As alavancas são suas. As três, com o custo honesto de cada uma:

| Alavanca | Economia | O que custa |
|---|---|---|
| Adiar a **E8.5 mobile** para depois do go-live | −3 a 4 d | O módulo entra em produção com scroll horizontal no celular. É condição de aceite da constitution: precisa de decisão explícita registrada, e vira dívida com prazo |
| Adiar o **tutorial (L4)** | −1 d | Módulo novo sem onboarding. A campanha de novidade tem expiração de 10 dias contados da implementação, então adiar desalinha a campanha do release |
| Cortar a **L1** | −3 d | **Não recomendo.** É a tela onde o preço é formado. Levantamento com campo obrigatório em branco vira proposta com preço errado, e o formulário não aponta onde |

O que **não** é alavanca: a L6 e as primitivas de mobile diluídas em E6–E8. As
duas são mais baratas agora do que depois, e a L6 tem efeito colateral no app
inteiro se for feita errado.

---

## O que ainda falta para fechar a E0

Independente desta aprovação:

- [ ] Confirmar **L3** — trocar de aba em `/custos` e apertar F5: volta para
      "Premissas"?
- [ ] Confirmar **L2** — as listas reordenáveis de `/` só têm ↑/↓, sem arrastar?
- [ ] Capturas de prioridade 2 — `LOGIN-erro`, `CUSTO-erro-salvar`, `PROP-preview`
- [ ] `roteiro.md` — o caminho clicável (é insumo do roteiro da L4)
