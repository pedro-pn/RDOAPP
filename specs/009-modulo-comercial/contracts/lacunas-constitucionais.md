# Lacunas constitucionais da referência

Achados da extração do inventário de UI (E0-6). São comportamentos que a
**constitution exige** e que a referência congelada **não tem** — portanto não
podem ser portados por cópia: precisam ser implementados.

Isto não é a lista de desvios deliberados da E0-8. Desvio é o que decidimos não
copiar. Aqui é o contrário: é o que precisamos **acrescentar** para o módulo
poder ser aceito.

A emenda 1.9.0 (exceção de identidade portada, Princípio VI) dispensa o módulo de
convergir para a paleta e as medidas do kit. A alínea (c) **não** dispensa
comportamento: `aria-invalid` com mensagem visível, estados de `select`,
reordenação no padrão compartilhado de drag and drop, navegação em URL, tutorial
permanente de primeiro acesso e ausência de scroll horizontal em mobile
continuam obrigatórios.

## Resumo

| # | Lacuna | Telas | Gravidade |
|---|---|---|---|
| L1 | Validação por campo inexistente na maior tela | `CUSTO` | Alta |
| L2 | Reordenação por botão ↑/↓ em vez de drag and drop | `PROP` | Média |
| L3 | Estado fora da URL **e levantamento perdido no F5** | `CUSTO`, `PROP` | **Alta** |
| L4 | Sem tutorial permanente de primeiro acesso | todas | Média |
| L5 | Login sem estado de campo inválido | `LOGIN` | Baixa |
| L6 | Paleta em `:root` duplicado e sem prefixo | CSS | Alta |
| L7 | Sem layout mobile: scroll horizontal de página | todas | Alta |

## L1 — Validação por campo inexistente na tela de custos

> **Confirmada na tela em 31/07/2026.** O erro sai em **banner único**, como o
> código indicava.
>
> **Decisão do mantenedor:** o campo obrigatório não preenchido tem de ficar
> **destacado em vermelho, igual ao filtroAPP**.

**Evidência.** `app/custos/page.tsx` tem 465 controles e 29 `select`, e
**zero** ocorrências de `aria-invalid`. A tela nunca chama `validateCostEstimate`
no cliente: o único tratamento de erro é o do retorno do servidor, concatenado
numa string única (`app/custos/page.tsx:299-301`):

```ts
const data = await response.json() as { id?: string; error?: string; issues?: string[] };
if (!response.ok) throw new Error(data.error || data.issues?.join(" ") || "Não foi possível salvar.");
```

O usuário recebe todas as pendências grudadas num banner, sem saber a qual campo
cada uma pertence. Nos goldens da E0-5, o cenário 01 devolve **12 erros de uma
vez** — é essa a experiência hoje.

**Por que é a lacuna mais séria.** É a tela onde o preço é formado. Um
levantamento de custos com campo obrigatório em branco é uma proposta com preço
errado, e o formulário não aponta onde.

**O que o porte precisa fazer.** `validateCostEstimate` já devolve
`{ path, message, severity }` por item — o `path` é exatamente o endereço do
campo. A informação existe e a referência a joga fora. O porte liga cada `path`
ao seu campo. **Isto é trabalho novo, não porte**, e não está dimensionado nas
etapas E4–E7 do plano.

**O padrão do filtroAPP já existe e é o alvo** — `frontend/src/styles/base.css:4085-4102`:

```css
.field-invalid label { color: var(--rd); }
.field-invalid input,
.field-invalid select,
.field-invalid textarea,
.field-invalid-panel { border-color: var(--rd) !important; background-color: #fff5f5 !important; }
```

Ou seja: rótulo em vermelho, borda vermelha e fundo rosa claro no controle, mais
`.field-invalid-panel` para grupo (checkbox, radio) que não tem borda própria. É
exatamente o "destacado em vermelho" pedido, e já está em uso em 10 arquivos do
frontend. O módulo consome esse padrão em vez de inventar outro — **as classes
`.field-*` são de comportamento, não de identidade visual**, então a exceção do
Princípio VI não se aplica a elas.

O banner único **não some**: continua como resumo no topo, com o número de
pendências. O que muda é que cada pendência passa a ter endereço.

### Vazio e inválido são dois estados, não um

> **Decisão do mantenedor, 31/07/2026**, na revisão do `baseline/roteiro.md`:
> *"corrigir para dizer que é invalido (e-mail e cnpj), não apenas mensagem
> genérica"*.

A etapa 1 da proposta conta e-mail e CNPJ como pendência **só quando inválidos**
(`app/page.tsx:472-486`: `emailValid ? form.email : ""`). Do ponto de vista do
contador do rodapé, digitar errado é indistinguível de não ter digitado — e o
usuário vê "Preencha 1 campo obrigatório" olhando para um formulário que parece
cheio. **É o ponto de travamento mais provável do app**, confirmado pelo
mantenedor.

Marcar de vermelho resolve o *onde* e não resolve o *quê*: o campo fica
destacado, o usuário olha, vê texto lá dentro e continua sem entender. A
marcação precisa carregar mensagem por estado:

| Estado do campo | Mensagem |
|---|---|
| vazio | "Campo obrigatório" |
| preenchido, formato inválido | **"E-mail inválido"** / **"CNPJ inválido"** |

Cabe no orçamento já previsto para a L1 — é camada de mensagem sobre o mesmo
resolvedor de `path` → campo, não encanamento novo.

## L2 — Reordenação por botão ↑/↓ em vez de drag and drop

> **Confirmada na tela em 31/07/2026.** Só as setas funcionam; não é possível
> arrastar.
>
> **Decisão do mantenedor:** tem de dar para arrastar, **igual ao filtroAPP,
> com fantasma e mostrando o novo local**.

**Evidência.** Três listas reordenáveis em `app/page.tsx`, todas com o mesmo
padrão de par de botões:

- linha 943-944 — itens de serviço do escopo;
- linha 1265-1266 — serviços técnicos selecionados;
- linha 1386-1387 — blocos de conteúdo (tabela e foto).

`onDrag`, `draggable`, `onPointerDown` e `touch-action`: zero ocorrências no app
inteiro.

**O que a constitution exige.** Alça dedicada, reordenação ao vivo durante o
arraste, placeholder com legenda de posição, fantasma visual, cancelamento
restaurando a ordem inicial, persistência só da ordem final, e funcionamento em
toque via Pointer Events com `touch-action: none`.

**O que o porte precisa fazer.** Usar o padrão compartilhado que o filtroAPP já
tem — `frontend/src/utils/reorderDrag.ts` (109 linhas), em uso em quatro telas
(`QualityNaturesTab`, `CategoryManager`, `TechnicalSchemaBuilder`, `GestorPage`).
A primeira leitura bate com o que foi pedido:

| Exigência | Onde já está |
|---|---|
| Fantasma visual | `createPointerDragGhost` + `.app-reorder-drag-ghost` / `.app-reorder-touch-ghost` (`base.css:12293`) |
| Mostrar o novo local | `.drag-placeholder` tracejado com legenda **"Soltar aqui"** via `::after` (`base.css:12194-12215`) |
| Alça dedicada | `.quality-nature-drag-handle` com `aria-label="Arrastar … para reordenar"` (`QualityNaturesTab.tsx:375-377`) |
| Toque | `reorderIdFromPoint` por Pointer Events + `touch-action: none` |
| Rolar na borda | `scrollReorderContainerEdge` |

**Auditoria pendente antes de reusar** — o `plan-template.md` exige a checagem, e
manda corrigir a origem se houver dívida. Dois pontos a verificar:

- **Cancelamento por `Escape` restaurando a ordem inicial**: não achei tratamento
  de `Escape` no consumidor lido. Se faltar mesmo, o conserto é no utilitário
  compartilhado e beneficia as quatro telas que já o usam.
- **Persistência só da ordem final**, não a cada movimento durante o arraste.

**As setas ficam** (decidido em 31/07/2026). Alça de arrastar e par ↑/↓ convivem
na mesma linha, então a exigência de operar por teclado sai atendida junto. Duas
regras que precisam ir para o `tasks.md`:

- arraste e clique na seta chamam a **mesma** função de reordenar
  (`reorderRowsById`), senão as duas divergem em lista filtrada ou com item
  recém-inserido;
- seta da ponta fica **`disabled`**, não oculta — o primeiro item sem ↑ e o
  último sem ↓ — para a linha não mudar de largura entre um item e outro.

## L3 — Estado fora da URL, e o levantamento inteiro se perde no F5

> **Confirmada na tela em 31/07/2026, e é pior do que este documento afirmava.**
> A previsão era "volta para Premissas". O que acontece de verdade é que o F5
> **volta para o diálogo de escolha de modo** — a captura está em
> `baseline/L3-f5-perde-levantamento.png`. O levantamento carregado desaparece
> por inteiro. A gravidade subiu de Média para **Alta**.

**Evidência.** `app/custos/page.tsx:64-72` — três estados que nascem vazios a
cada montagem e nenhuma persistência:

```ts
const [estimateMode, setEstimateMode] = useState<EstimateMode | null>(null);
const [activeSection, setActiveSection] = useState<CostSection>("premises");
const [draft, setDraft] = useState<AnyRecord>(() => ensureDraft({
  ...(createDefaultCostEstimatePayload() as AnyRecord), ...
}));
```

`estimateMode` em `null` é o que faz o diálogo "Como deseja começar?" reabrir. E
`draft` volta ao payload padrão: **zero** ocorrências de `localStorage`,
`sessionStorage` ou `beforeunload` no arquivo, e nenhuma de `useSearchParams`,
`pushState`, `replaceState` ou `location.hash` em nenhuma das quatro telas.

**Consequência.** Um F5 acidental no meio de um levantamento de 465 controles
apaga tudo o que não foi salvo, sem aviso e sem confirmação de saída. Não é só
perda de navegação — é perda de trabalho, na tela onde o preço é formado.

**O que o porte precisa fazer.** São duas coisas, e só a primeira é a exigência
literal da constitution:

1. **Navegação em query param** — modo, base da proposta e seção na URL,
   limpando params incompatíveis na troca. Isso já resolve o caminho "Revisar
   proposta", porque `?modo=revisao&base=4418&secao=labor` permite recarregar do
   servidor. Também destrava mandar link para uma seção.
2. **Rascunho local** — a URL sozinha não salva o que ainda não foi para o
   servidor: nem o "Levantar custos" começado do zero, nem as edições não salvas
   de uma revisão. Precisa de autossalvamento em `localStorage` por
   modo + código de proposta, com oferta explícita de recuperação ("recuperar
   rascunho não salvo?") em vez de restaurar em silêncio.

Sem o item 2, a URL conserta o sintoma e mantém a perda de trabalho.

### O rascunho vale para a proposta também, e não é só o F5

> **Decisão do mantenedor, 31/07/2026**, na revisão do `baseline/roteiro.md`:
> *"Custos e propostas devem ter um rascunho que permanece salvo mesmo se fechar
> ou atualizar a página sem querer."*

Duas ampliações sobre o que estava escrito acima:

- **`PROP` entra no item 2.** O previsto para a proposta era só o estado da etapa
  na URL. Mas as 7 etapas acumulam tanto trabalho não salvo quanto as 5 seções do
  levantamento — itens de escopo com título e descrição, matriz de
  responsabilidades, tabela de preços — e nada disso vai ao servidor antes da
  finalização. O rascunho local passa a valer para as duas telas.
- **"Fechar a página" é explícito.** Não é só recarregar. Isso torna o
  `beforeunload` obrigatório, e não opcional, nas duas telas: aviso ao sair com
  alterações pendentes, além do autossalvamento.

Custo: **+1 d na E8**, sobre o +0,5 d que ela já tinha para os query params.

## L4 — Sem tutorial permanente de primeiro acesso

**Evidência.** Zero ocorrências de `localStorage` nas quatro telas — logo, não há
marcador de "já viu" por usuário/navegador.

**O que a constitution exige.** Módulo novo mantém onboarding permanente de
primeiro acesso. Além disso, função nova entra com a campanha de novidade
temporária: card centrado no estilo Driver.js, marcador em `localStorage` e
expiração global exatamente 10 dias após a data de implementação.

**Observação.** O filtroAPP já tem `driver.js` nas dependências do frontend, então
a peça existe. O que falta é o roteiro — e o roteiro depende do inventário desta
etapa e da baseline clicável da E0-7.

**Destravada em 31/07/2026.** O `baseline/roteiro.md` foi escrito e revisado. O
script do tutorial se apoia em dois achados dele:

1. **A cadeia do rodapé de `/custos`** (`app/custos/page.tsx:595-604`): o botão
   primário já muda de texto e de destino conforme o que falta — mão de obra →
   materiais e insumos → mob./desmob. → comissões → salvar. O app já conhece o
   caminho; o tutorial só precisa narrá-lo. O mantenedor confirmou que é assim
   que se usa na prática.
2. **A armadilha do e-mail/CNPJ** da etapa 1 da proposta — ver a subseção de
   estados da L1.

Fica em aberto, de propósito: *o que todo mundo erra na primeira vez* não tem
resposta hoje (*"ainda não tenho essa informação"*). É pergunta para refazer
depois de algumas semanas de uso real do módulo, e pode acrescentar passos ao
roteiro sem invalidar os dois acima.

## L5 — Login sem estado de campo inválido

**Evidência.** `app/login/page.tsx`: 7 controles, 0 `aria-invalid`.

**Nota.** É a lacuna de menor impacto: o formulário tem dois campos e o erro de
credencial é global, não por campo. Ainda assim, campo obrigatório vazio precisa
do estado compartilhado — validação nativa do navegador não basta.

## L6 — Paleta em `:root` duplicado e sem prefixo

**Evidência.** `app/globals.css` tem **dois** blocos `:root`, nas linhas 26 e 56,
que redefinem os mesmos sete nomes de token com valores diferentes:

```css
/* linha 26 — paleta azul/marinho */
:root{--navy:#12284b;--blue:#1f5790;--ink:#172033;--muted:#687386;--line:#dce2ea;--bg:#f4f6f9;--green:#198754}

/* linha 56 — paleta verde */
:root{--navy:#214b35;--blue:#2f6446;--ink:#1f2923;--muted:#66736b;--line:#d9e2dc;--bg:#f3f6f4;--green:#2f6446;...}
```

Mesma especificidade, então o segundo vence: **o app renderiza em verde, e a
paleta azul da linha 26 é código morto**. Os nomes `--navy` e `--blue` seguem
apontando para tons de verde, o que torna o CSS enganoso de ler.

**Por que é grave.** A alínea (b) do Princípio VI exige que a paleta seja
declarada como custom properties **prefixadas**, **em um bloco único**, sem
redefinir tokens globais. A referência viola as três coisas de uma vez. Pior:
nomes genéricos como `--ink`, `--line`, `--bg` e `--muted` em `:root` colidem
com os tokens globais do `variables.css` do filtroAPP — copiar este CSS como
está vaza a paleta do módulo para o app inteiro.

**O que o porte precisa fazer.** Um bloco único sob `.comercial-app`, com nomes
`--com-*` escolhidos **pela função e não pela cor** — o plano já previu isso na
§5.6, e a duplicação encontrada aqui reforça: `--navy` valendo verde é
exatamente o sintoma de nome escolhido por cor.

**Cuidado ao portar:** a paleta correta é a da linha 56. Copiar a da linha 26
por ela vir primeiro no arquivo muda a identidade visual inteira, e é um erro
que não gera nenhum aviso.

### Nota sobre a tipografia (não é lacuna)

`app/layout.tsx:51` aplica as variáveis do Geist ao `<body>`, mas
`globals.css:26` fixa `body{font-family:Arial,Helvetica,sans-serif}`. A regra
de `font-family` vence a variável, que ninguém consome. **As fontes Geist são
baixadas e nunca usadas.** Isso confirma a decisão já registrada na §5.6 do
plano: Geist não entra no porte, o chrome herda a fonte do filtroAPP e o
documento mantém Arial.

## L7 — Sem layout mobile: scroll horizontal de página

**Evidência.** Verificação visual do mantenedor na baseline (E0-7): em largura de
celular a página **carrega o layout de desktop e gera rolagem horizontal**. Não
foi possível capturar uma versão mobile porque ela não existe.

**Não é ausência total de CSS responsivo.** O `globals.css` tem 13 breakpoints
(`max-width` de 520 a 1320 px), então houve trabalho de responsividade. O que
quebra são **pisos de largura fixa**: 39 regras com `min-width` em pixel, das
quais a mais grave é `.preview{min-width:390px}` — sozinha ela garante overflow
em qualquer viewport de 390 px, porque não sobra espaço para padding nenhum.
Outras: `min-width:370px`, `320px`, `300px`, `280px`, `260px`, e quatro de
`190px` em `input`, além de `select{min-width:180px!important}`.

Ou seja: a intenção responsiva existe, e os pisos fixos a anulam.

**O que a constitution exige.** É explícito e a exceção de identidade portada
**não dispensa**: UI mobile-first, tabela larga com alternativa mobile, modal com
rodapé fixo, **ausência de scroll horizontal de página**, grade de cards caindo
na largura útil de celular (`minmax(min(100%, ...), 1fr)`), filho de flex/grid
podendo encolher (`min-width: 0`), e aba/filtro que envolve, rola internamente
ou vira select no mobile — sem alargar a página.

### Decisão do mantenedor: mobile fica para o fim

Registrado: o app é majoritariamente de desktop, então a revisão mobile foi
adiada para o fim do porte, mantendo a padronização visual do desktop.

Isso é **sequenciamento, não dispensa** — segue sendo condição de aceite do
módulo. Duas consequências que precisam estar no `tasks.md`:

1. **Vira gate de release.** O `architecture-check.mjs` já cobra contrato visual,
   e o módulo não pode ser considerado pronto com scroll horizontal de página.
2. **Adiar não pode virar retrabalho.** Recriar layout responsivo no fim, sobre
   465 controles e 15 tabelas, custa muito mais que construir com primitivas
   seguras desde o começo.

**Recomendação para não pagar duas vezes:** adiar o *ajuste fino* mobile, não as
primitivas. Concretamente, ao escrever cada tela do porte (E4–E7):

- nunca portar `min-width` em pixel de container — os 39 do original são a causa
  raiz desta lacuna;
- `min-width: 0` em filho de flex/grid desde o início;
- tabela larga nascer dentro de container com `overflow-x: auto` próprio;
- grade de cards com `minmax(min(100%, Npx), 1fr)`, nunca `repeat(N, 1fr)` fixo.

Com isso a passada final de mobile é **ajuste de espaçamento e ordem**, não
reescrita de layout. Sem isso, é reescrita.

## O que já existe e pode ser copiado

Nem tudo é lacuna. `app/page.tsx:1187` tem um componente `Field` que já faz o
certo:

```tsx
<label className={`field${error ? " field-error" : ""}`}>
  <span>{label}{required && " *"}</span>
  <input aria-invalid={Boolean(error)} ... />
  {error && <small role="alert">{error}</small>}
</label>
```

É o único `aria-invalid` do app inteiro. O padrão está correto — o problema é que
ele não foi aplicado à tela de custos, que é onde mais faria falta. O porte
generaliza esse componente em vez de inventar outro.

## Efeito no planejamento

O plano trata as etapas E4–E7 como reescrita fiel de UI. As lacunas L1 a L4 são
**trabalho novo** e não estão nesse dimensionamento. L1 em particular toca 465
controles.

Isto precisa entrar como tarefa explícita no `/speckit-tasks` e como linha do
Complexity Tracking no `plan.md`, e a estimativa de 32–35,5 dias úteis da §8
merece revisão. Levar para a E0-8 junto com a lista de desvios.

> **Feito.** A revisão saiu na E0-8, aprovada em 31/07/2026:
> **32–35,5 d → 45,5–49,5 d**, com a etapa nova E8.5 para a L7. A conta de cada
> delta está em `e0-8-desvios-e-estimativa.md`, Parte B.
>
> As sete lacunas continuam sendo a maior fatia do acréscimo. Os últimos 1,5 d
> vieram da revisão do `baseline/roteiro.md` no mesmo dia, e são **decisão de
> produto, não exigência da constitution**: o menu de entrada do módulo (desvio
> nº 9) e o rascunho local estendido à proposta (que está descrito acima, na L3).
