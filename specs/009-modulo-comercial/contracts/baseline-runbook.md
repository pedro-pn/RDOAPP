# Runbook da baseline visual (E0-7)

Como colocar a referência congelada de pé e capturar a baseline contra a qual a
paridade visual do porte vai ser conferida.

## Estado atual

A referência **já está rodando**. O que foi feito e fica registrado aqui para
poder ser refeito:

| Passo | Situação |
|---|---|
| `.openai/hosting.json` criado | Feito |
| Dependências instaladas | Feito (pnpm 11.18.0, 47 s) |
| `pnpm dev` de pé | Feito — `http://localhost:3000` |
| Usuário de acesso local | Feito — `baseline` / `baseline-e0` |
| Proposta semeada | Feito — número **4418**, levantamento cheio |
| Capturas de tela | **Pendente — precisa de você** |
| Roteiro clicável gravado | **Pendente — precisa de você** |

As três telas respondem autenticadas: `/` (29,5 KB), `/custos` (23,6 KB) e
`/historico` (19,6 KB), com as cinco abas de custos e as etapas da proposta
presentes no HTML.

## Obstáculos encontrados e como foram resolvidos

### `.openai/hosting.json` ausente

`vite.config.ts:3` importa `./.openai/hosting.json` e o arquivo não existe no
rascunho, então nada compila. Criado com o stub previsto no plano:

```json
{ "d1": "DB", "r2": "SCOPE_ASSETS" }
```

É o único arquivo acrescentado à referência congelada. Não tem segredo nem
`project_id`: só declara os nomes lógicos dos bindings, que é o que o
`vite.config.ts` consome para montar o D1 e o R2 locais do miniflare.

### Corepack quebrado neste ambiente

`corepack pnpm install` falha com `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING` — o
corepack empacotado pelo Debian (`/usr/share/nodejs/corepack`) é incompatível
com o Node 22.22 daqui. O pnpm em si baixa normalmente; só o wrapper quebra.

Contorno — chamar o pnpm baixado direto:

```bash
node ~/.cache/node/corepack/pnpm/11.18.0/bin/pnpm.cjs install
node ~/.cache/node/corepack/pnpm/11.18.0/bin/pnpm.cjs dev
```

### Login sem a senha real

`db/auth.ts` semeia `Aliander` e `Erike` com hashes PBKDF2 fixos e **reescreve a
senha dos dois a cada boot** (`db/auth.ts:112-118`). Trocar o hash no banco não
adianta: o próximo boot desfaz.

Solução — um **terceiro** usuário, que o seed não toca:

```bash
npx --yes tsx@4.23.1 specs/009-modulo-comercial/contracts/criar-usuario-baseline.mjs
```

O script gera o hash com a própria `hashPassword` da referência (mesmo
algoritmo, iterações e formato) e insere direto no D1 local do miniflare.
**Nenhum arquivo de código da referência é alterado** — só o banco local, que já
é descartável e está no `.gitignore`. Login verificado: `POST /api/auth/login`
devolve 200 e a sessão abre as três telas.

Credencial: **`baseline` / `baseline-e0`**. Local, descartável, nunca vai para
produção.

> Se o banco local for apagado, rode `pnpm dev`, faça uma tentativa de login
> qualquer (para o app criar as tabelas) e rode o script de novo.

### "Nova proposta" exige o Nectar, e não tem fallback

Com a sessão aberta as telas abrem, mas **vazias**: sem proposta no banco não há
o que mostrar. E criar a primeira esbarra em
`app/api/nectar/next-number/route.ts:24-30` — a numeração vem de uma chamada real
ao CRM Nectar e o endpoint devolve **503 "Token do Nectar não configurado."**
sem `NECTAR_API_TOKEN`. Não há caminho local.

O caminho **"Revisar proposta"**, porém, não toca o Nectar: lê `proposal_history`
por `base` e `cost_estimates` por `proposalCode`, ambos locais
(`app/custos/page.tsx:250-252`). Semeando essas duas tabelas, a revisão abre as
telas com dados de verdade:

```bash
node specs/009-modulo-comercial/contracts/semear-proposta-baseline.mjs
```

Semeia a proposta **4418** com o payload do **golden 12** (precificação
`filtrovali_net_revenue_v1` com mão de obra, insumos e logística — o caminho de
produção). O levantamento abre preenchido: 1 fase com 2 alocações, volume de
tubulação, 9 produtos químicos dosados e os 4 slots de logística.

Verificado ponta a ponta: `/api/proposals?base=4418` devolve a proposta com
`nextRevision: 1`, `/api/cost-estimates?proposalCode=4418` devolve o payload
completo, e `/historico` lista 1 proposta.

> **Cross-check dos goldens.** O servidor recalcula o levantamento a partir do
> payload e devolveu `salePrice` 129.660,62 e `totalCost` 46.840,16 — o mesmo
> valor, ao centavo, que o golden 12 fixou rodando o motor isolado. Dois
> caminhos independentes chegando ao mesmo número é evidência de que os goldens
> representam o comportamento real do app, e não só o da função pura.

**Limitação da baseline.** O fluxo "Nova proposta" (reserva de numeração) não
pode ser capturado sem um `NECTAR_API_TOKEN` válido. As telas de criação a
partir da revisão são idênticas — muda só o cabeçalho de modo — mas o passo de
reserva do número fica sem baseline. Se você tiver um token de teste do Nectar,
dá para capturar também; senão, isso entra como item conhecido na lista de
desvios (E0-8).

## O que falta — e por que preciso de você

Não tenho navegador neste ambiente. Consigo provar que o servidor responde e que
o HTML tem o conteúdo certo, mas **não consigo ver a tela renderizada** — e a
baseline existe justamente para pegar o que só aparece renderizado: espaçamento,
alinhamento, quebra em mobile, estado de foco.

### 1. Capturas

Com o servidor de pé e a sessão aberta, capturar em **duas larguras**:

- **Desktop:** 1440 × 900
- **Mobile:** 390 × 844 (iPhone 14) — a largura onde a constitution cobra
  ausência de scroll horizontal

| Tela | Rota | O que garantir na captura |
|---|---|---|
| Login | `/login` | Estado limpo e estado com erro de credencial |
| Proposta | `/` | Cada uma das etapas do stepper |
| Custos | `/custos` | Cada uma das 5 abas (Premissas, Mão de obra, Materiais e insumos, Mob. e desmob., Resumo e QQP) |
| Histórico | `/historico` | Lista com registro |

Para as telas de custos e proposta saírem com conteúdo, entre por
**"Revisar proposta" → 4418**. Sem isso o formulário abre vazio e a baseline não
serve para conferir espaçamento nem quebra em mobile, que é o motivo de ela
existir.

Salvar em `specs/009-modulo-comercial/contracts/baseline/` com o nome
`<TELA>-<secao>-<largura>.png` — por exemplo `CUSTO-premissas-390.png`. Os
prefixos de tela são os mesmos IDs do `ui-inventory.md`, para as capturas
cruzarem com o inventário.

### 2. Roteiro clicável

Anotar o caminho que um levantamento real percorre: o que se preenche primeiro,
o que destrava o quê, onde o app exige confirmação. É o que vai virar o teste de
paridade de UX e o roteiro do tutorial de primeiro acesso (lacuna L4).

### 3. Conferir os zeros

`lacunas-constitucionais.md` afirma, a partir do código, que não existe
`aria-invalid` na tela de custos, nem drag and drop, nem estado em URL, nem
tutorial. **Confirmar na tela**, porque afirmação negativa tirada de código
merece verificação visual:

- [ ] Salvar um levantamento vazio em `/custos` — o erro aparece em banner único
      ou marca os campos?
- [ ] Trocar de aba e recarregar (F5) — volta para "Premissas"?
- [ ] As listas reordenáveis de `/` só têm ↑/↓, sem arrastar?
- [ ] Primeiro acesso mostra algum tutorial?

### 4. Paleta

Conferir na tela que o app renderiza **verde**, e não azul. `globals.css` tem
dois `:root` conflitantes e o segundo vence (lacuna L6) — a confirmação visual
fecha qual paleta o porte tem de reproduzir.

## Para derrubar e subir de novo

```bash
cd ~/comercialAPP
node ~/.cache/node/corepack/pnpm/11.18.0/bin/pnpm.cjs dev
```

A sessão fica no cookie do navegador; o banco local persiste em
`.wrangler/state/`.
