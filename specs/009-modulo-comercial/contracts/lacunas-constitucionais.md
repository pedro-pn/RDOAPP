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
| L3 | Estado de navegação fora da URL | `CUSTO`, `PROP` | Média |
| L4 | Sem tutorial permanente de primeiro acesso | todas | Média |
| L5 | Login sem estado de campo inválido | `LOGIN` | Baixa |
| L6 | Paleta em `:root` duplicado e sem prefixo | CSS | Alta |

## L1 — Validação por campo inexistente na tela de custos

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
ao seu campo com `.field-group` + `.field-invalid`, `aria-invalid` e `.field-error`,
no padrão do filtroAPP. **Isto é trabalho novo, não porte**, e não está
dimensionado nas etapas E4–E7 do plano.

## L2 — Reordenação por botão ↑/↓ em vez de drag and drop

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

**O que o porte precisa fazer.** Substituir os três pares de ↑/↓ pelo padrão
compartilhado. Vale conferir antes se o componente de drag and drop já existente
no filtroAPP atende a constitution atual — o `plan-template.md` exige essa
checagem antes de reusar, e manda corrigir a origem se ela tiver dívida visual.

## L3 — Estado de navegação fora da URL

**Evidência.** `app/custos/page.tsx:67`:

```ts
const [activeSection, setActiveSection] = useState<CostSection>("premises");
```

São cinco seções (`premises`, `labor`, `inputs`, `logistics`, `summary`). Nenhuma
ocorrência de `useSearchParams`, `pushState`, `replaceState` ou `location.hash` em
nenhuma das quatro telas.

**Consequência.** Recarregar a página joga o usuário de volta em "Premissas",
no meio de um levantamento longo. E não há como mandar link para uma seção.

**O que o porte precisa fazer.** Representar seção em query param, limpando
params incompatíveis na troca, como manda o princípio de persistência de
navegação.

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
