# Capturas da baseline visual (E0-7)

Coloque aqui os PNGs. Nome do arquivo: `<TELA>-<secao>-<largura>.png`.

Os prefixos de tela (`LOGIN`, `PROP`, `CUSTO`, `HIST`) são os mesmos IDs do
`../ui-inventory.md`, para as capturas cruzarem com o inventário.

## Antes de começar

Servidor: `http://localhost:3000` · Login: **`baseline`** / **`baseline-e0`**

Se estiver fora do ar:

```bash
cd ~/comercialAPP
node ~/.cache/node/corepack/pnpm/11.18.0/bin/pnpm.cjs dev
```

**Para as telas de proposta e custos terem conteúdo**, entre em `/custos` e use
**"Revisar proposta" → 4418**. Sem isso o formulário abre vazio e a baseline não
serve para conferir espaçamento nem quebra em mobile, que é o motivo dela
existir.

## Duas larguras

| Largura | Alvo | Por quê |
|---|---|---|
| **1440 × 900** | desktop | Layout de referência |
| **390 × 844** | iPhone 14 | Largura onde a constitution cobra ausência de scroll horizontal de página |

## Prioridade 1 — o mínimo que fecha a E0

15 capturas por largura, 30 no total.

### LOGIN — `/login`

- [ ] `LOGIN-limpo-1440.png` / `LOGIN-limpo-390.png`

### PROP — `/` (as 7 etapas do stepper)

- [ ] `PROP-cliente-1440.png` / `-390.png`
- [ ] `PROP-escopo-1440.png` / `-390.png`
- [ ] `PROP-responsabilidades-1440.png` / `-390.png`
- [ ] `PROP-prazos-1440.png` / `-390.png`
- [ ] `PROP-tecnica-1440.png` / `-390.png`
- [ ] `PROP-comercial-1440.png` / `-390.png`
- [ ] `PROP-revisao-1440.png` / `-390.png`

### CUSTO — `/custos` (as 5 abas, já com a revisão 4418 carregada)

- [ ] `CUSTO-modo-1440.png` / `-390.png` — a tela de escolha "Nova / Revisar", antes de carregar
- [ ] `CUSTO-premissas-1440.png` / `-390.png`
- [ ] `CUSTO-mao-de-obra-1440.png` / `-390.png`
- [ ] `CUSTO-materiais-1440.png` / `-390.png`
- [ ] `CUSTO-mob-desmob-1440.png` / `-390.png`
- [ ] `CUSTO-resumo-qqp-1440.png` / `-390.png`

### HIST — `/historico`

- [ ] `HIST-lista-1440.png` / `-390.png`

## Prioridade 2 — estados, se der tempo

São os que mais interessam para a lacuna **L1** (validação por campo), porque
mostram como o app hoje comunica erro.

- [ ] `LOGIN-erro-1440.png` — credencial inválida
- [ ] `CUSTO-erro-salvar-1440.png` — salvar levantamento com campo obrigatório
      vazio, mostrando o banner de erro
- [ ] `PROP-preview-1440.png` — o painel de pré-visualização do documento

## Quatro confirmações visuais

O `../lacunas-constitucionais.md` afirma essas quatro coisas a partir da leitura
do código. Afirmação negativa tirada de código merece olho na tela — se alguma
estiver errada, o documento precisa ser corrigido antes do spec-kit.

- [ ] **L1** — salvar levantamento vazio em `/custos`: o erro sai em **banner
      único** no topo, ou marca os campos individualmente?
- [ ] **L3** — trocar de aba em `/custos` e apertar **F5**: volta para
      "Premissas"?
- [ ] **L2** — as listas reordenáveis de `/` (etapa Escopo e etapa Técnica) só
      têm **↑/↓**, sem arrastar?
- [ ] **L6** — o app renderiza **verde**, e não azul?

## Resultado das confirmações

Capturas recebidas em 29/07/2026: 15 telas de desktop. Estão nesta pasta com o
nome normalizado.

| Item | Resultado |
|---|---|
| **L6** — paleta verde | **Confirmado.** Toda a interface em verde; a paleta azul do `:root` da linha 26 é código morto, como previsto |
| **L7** — mobile | **Confirmado, e pior que o previsto.** Não existe layout mobile: o desktop carrega no celular com rolagem horizontal. Virou lacuna L7 |
| Stepper de 7 etapas | **Refutado.** Cabe em uma linha só |
| **L1** — erro em banner | **Confirmado** (31/07). Banner único, campos não marcados. Decisão: campo obrigatório vazio fica destacado em vermelho, no padrão `.field-invalid` do filtroAPP |
| **L2** — só ↑/↓ | **Confirmado** (31/07). Não é possível arrastar. Decisão: arrastar igual ao filtroAPP, com fantasma e mostrando o novo local |
| **L3** — F5 | **Confirmado, e pior que o previsto** (31/07). Ver abaixo |

### L3: o F5 não volta para "Premissas" — volta para o começo

`L3-f5-perde-levantamento.png` mostra o que acontece de verdade: o F5 reabre o
diálogo **"Como deseja começar?"**. Não é a aba que se perde, é o levantamento
inteiro.

A causa está em `app/custos/page.tsx:64-72`: `estimateMode` nasce `null` (é o que
reabre o diálogo) e `draft` volta ao payload padrão. O arquivo não tem nenhuma
ocorrência de `localStorage`, `sessionStorage` ou `beforeunload` — não há
autossalvamento nem confirmação de saída.

Consequência: um F5 acidental no meio de um levantamento de 465 controles apaga
tudo o que não foi salvo. A L3 subiu de gravidade Média para **Alta** e ganhou um
segundo requisito (rascunho local), além do estado em URL que já estava previsto.

### Correção: o stepper não quebra

Eu havia levantado que `app/page.tsx:92` declara 7 etapas contra um
`grid-template-columns: repeat(6, 1fr)`. **Estava errado**, e o erro foi de
leitura minha: `globals.css` tem dois blocos `:root` conflitantes (lacuna L6) e a
regra `repeat(6, 1fr)` está no **bloco morto**. O bloco ativo, depois da linha
56, redefine `.stepper{grid-template-columns:repeat(7,1fr)}`.

Não há defeito e não há nada a registrar na lista de desvios. Fica como lembrete
de que, neste CSS, **toda regra tem de ser lida no bloco ativo** — a duplicação
da L6 já produziu uma conclusão errada.

## O que as capturas mostraram de novo

- **`PROP-cliente-1440.png`** — o rodapé do formulário traz contador de
  pendências ("Preencha 1 campo obrigatório") com o botão "Salvar e continuar"
  desabilitado, e o cabeçalho avisa "Campos com * são obrigatórios". Existe,
  portanto, bloqueio de avanço e contagem agregada — mas o campo pendente
  (`Consultor de Vendas *`, `CNPJ *`) **não fica marcado**. Reforça a L1: o app
  sabe o que falta e não mostra onde.
- **`CUSTO-mao-de-obra-1440.png`** — a faixa de KPIs tem 7 cartões em linha e as
  5 abas ficam numa tira horizontal. São os dois primeiros candidatos a overflow
  quando a L7 for atacada.
- A proposta semeada dispara a mensagem "Esta proposta foi gerada antes do
  armazenamento completo dos campos", porque o seed deixa `company_id` e contato
  vazios. É comportamento real da revisão de proposta antiga, útil de ter na
  baseline.

## Pendente

- [ ] Capturas mobile — **não existem para capturar** (lacuna L7). Serão
      produzidas pelo porte, não copiadas da referência.
- [ ] Prioridade 2: `LOGIN-erro`, `CUSTO-erro-salvar`, `PROP-preview`
- [x] Confirmar **L1**, **L2** e **L3** — feito em 31/07/2026
- [ ] `roteiro.md` com o caminho clicável

## Roteiro clicável

Junto com as capturas, anote o caminho que um levantamento real percorre: o que
se preenche primeiro, o que destrava o quê, onde o app exige confirmação.

Vira o teste de paridade de UX e o roteiro do tutorial de primeiro acesso
(lacuna L4). Pode ser texto corrido em `roteiro.md` nesta pasta — não precisa de
formato.
