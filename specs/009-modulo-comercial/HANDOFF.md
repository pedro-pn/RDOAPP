# Passagem de ambiente — módulo Comercial

Estado em **10/08/2026**, branch `feat/modulo-comercial`, no commit
`060518f`. Escrito para quem retoma o desenvolvimento em outra máquina.

Leia a Parte 1 antes de rodar qualquer coisa: há quatro coisas que **não viajam
com o `git clone`**, e sem elas o módulo parece quebrado sem estar.

---

## Parte 1 — O que não vem no clone

### 1. `shared/comercial/dist/` é gerado, e está no `.gitignore`

O frontend e o backend importam de `shared/comercial/dist/*.js`, não do
`src/*.ts`. Sem compilar, **nada do módulo carrega** — e o erro aparece como
"módulo não encontrado" em vinte arquivos ao mesmo tempo.

```bash
cd shared/comercial
../../frontend/node_modules/.bin/tsc -p tsconfig.json
```

O `npm run build` do pacote chama `tsc` direto e falha, porque o pacote não tem
`typescript` instalado — ele usa o do frontend. É uma pendência conhecida, não
um defeito do seu ambiente.

**Recompile sempre que mexer em `shared/comercial/src/`.** Esquecer isso produz
o sintoma mais confuso do repositório: o teste passa e a tela usa a versão
antiga.

### 2. `~/comercialAPP` — a referência congelada

É o app original (Next.js/Cloudflare) de onde o módulo foi portado. **Não está
no repositório** e não deve entrar: é referência de leitura, congelada, sem
desenvolvimento novo.

Um teste depende dela: `backend/test/comercial-modelo-documento.test.js` compara
os índices dos documentos com os do `app/proposal-pdf.ts` da referência. Se a
pasta não existir, **o teste some em silêncio** em vez de inventar uma resposta —
foi escrito assim de propósito. Você não precisa da referência para desenvolver;
precisa dela para provar fidelidade.

**Leve-a para o ambiente novo.** A maior parte do que falta é porte a partir
dela: as rotas de proposta (T051/T052), a finalização com Nectar e SharePoint
(T075/T076, que vivem em `app/api/finalize/route.ts`), a tela de histórico
(T084, que sai de `app/historico/page.tsx` e ainda não tem esqueleto) e a
comparação lado a lado da validação final (T113/T114).

O caminho esperado é `~/comercialAPP`. São **27 MB sem as dependências**:

```bash
rsync -a --exclude node_modules --exclude .next --exclude dist --exclude build \
  ~/comercialAPP/ /destino/comercialAPP/

cd /destino/comercialAPP && sha256sum -c MANIFESTO-SHA256.txt | grep -v ': OK$'
```

A referência traz um `MANIFESTO-SHA256.txt` com 192 hashes. **Rode a conferência
depois de copiar** — silêncio é o resultado bom. Um byte perdido na cópia
enfraquece em silêncio toda verificação de fidelidade, e o teste dos índices
continuaria passando enquanto compara com um arquivo corrompido.

Verificado em 10/08/2026 e de novo em 11/08/2026: 192/192 batem. A referência
nunca foi tocada.

**O caminho é literal, e o teste não avisa quando erra.** `comercial-modelo-documento.test.js`
monta `homedir() + '/comercialAPP'`. Na máquina de 11/08 a referência estava em
`~/apps/comercialAPP`, e o teste sumia em silêncio — como foi escrito para fazer.
Onde ela não estiver na raiz do `$HOME`, um link resolve:

```bash
ln -sfn ~/apps/comercialAPP ~/comercialAPP
```

Para **ler e portar**, esses 27 MB bastam. Para **rodar** — necessário só na
comparação visual da T113/T114 — precisa de `pnpm install` e do setup de
D1/wrangler, documentado no `DEPLOY-OUTRO-SERVIDOR.md` dela.

### 3. LibreOffice só existe dentro da imagem do backend

O `backend/Dockerfile` instala `libreoffice-writer`. **O host não tem `soffice`**,
então a conversão `.docx → PDF` não roda fora do container. Consequência prática:

- os testes de preenchimento do `.docx` rodam em qualquer lugar;
- o download do PDF **só funciona com o backend em Docker**.

Foi por isso que eu nunca consegui verificar a conversão ponta a ponta daqui.

### 4. `backend/assets` entra na imagem em tempo de *build*

O Dockerfile faz `cp -R ./assets/. /data/assets/` **durante o build**, e o
bind-mount do compose não alcança `/data/assets`. Arquivo novo em
`backend/assets/` exige reconstruir:

```bash
docker compose -f docker-compose.local.yml up -d --build backend
```

Reiniciar o container **não** basta. Já custou uma rodada de confusão.

### Subir o ambiente

```bash
docker compose -f docker-compose.local.yml up -d
cd frontend && npm install && npm run dev
```

O `backend/.env.docker.local` tem `ASSETS_DIR=/data/assets`; o `backend/.env`
(fora do Docker) usa `./assets`.

**`COMERCIAL_DIR` é nova (11/08)** e é opcional: vazia, vale
`<REPORTS_DIR>/Comercial`, que é exatamente onde as fotos de escopo já estavam.
Não precisa configurar nada para o módulo funcionar. Ela existe para o dia em que
os documentos emitidos tiverem de morar noutro volume — e **apontá-la para outro
lugar sem mover o conteúdo deixa as fotos antigas para trás**. A pasta guarda o
PDF que foi ao cliente: entra no backup (T118).

---

## Parte 2 — Onde o trabalho parou

### Pronto e verificado

**Levantamento de custos (US1)** — as cinco seções, o cálculo vindo de
`shared/comercial` sem reimplementação, e os **16 goldens** que provam que o
porte não mudou nenhum número.

**Proposta em 7 etapas (US2)** — cliente, escopo com fotos, matriz, prazos,
técnica, comercial e revisão. A prévia lado a lado desenha o documento inteiro,
com paginação calculada.

**Documento (US3, parte)** — este foi o trecho mais reescrito, e a decisão está
na Parte 3.

### O que está aberto, por ordem de dependência

A emissão de verdade é o próximo bloco, e é o que falta para o módulo servir:

| Tarefa | O que é |
|---|---|
| ~~**T051, T052, T054**~~ | **Feitas em 11/08.** `proposals.js` e as rotas de proposta: criar, editar, listar, arquivar e vincular ao levantamento. `proximaRevisao` está na lib e testada; a rota dela é a T053a. |
| **T053a, T053b** | A rota de revisão e o reuso do card do CRM. **Dependem de schema**: `Proposal` não tem hoje nenhum campo de Nectar (`opportunityId`, `nectarPipelineId`), que a referência guarda no histórico. |
| ~~**T074, T075, T079**~~ | **Feitas em 11/08.** `storage.js`, a emissão e o download. Os dois PDFs saem do registro, vão para o disco sob `COMERCIAL_DIR`, viram `ProposalDocument` e são baixáveis com a regra de papel. |
| ~~**T076, T077, T078, T079a, T080, T085**~~ | **Feitas em 11/08.** `jobs.js`, a rota de finalização, o contrato de falha, a permissão, a exclusividade e a auditoria. **Só o Nectar** — SharePoint abaixo. |
| ~~**T076a, T076b, T076c**~~ | **Feitas em 11/08.** A planilha de custos, com os dois formatos por `schemaVersion`. Vão **três** arquivos ao CRM: as duas propostas e a memória de cálculo. |
| ~~**SharePoint, T076f**~~ | **Feito em 11/08.** Microsoft Graph com os mesmos três modos do Nectar e `off` por padrão. **Os dois destinos falham de forma independente**: SharePoint fora do ar não impede o card de entrar no CRM, e vice-versa. |
| ~~**T076d, T076e**~~ | **Feitos em 11/08.** Anexos do cliente, um por requisição, e o limite agregado conferido no upload e de novo na finalização. **Falta remover anexo** — T128, precisa de decisão. |
| **T079b, T110a** | Aviso de escrita concorrente (o 409 de finalização já existe). |
| **T084** | Tela de histórico — `frontend/src/pages/comercial/historico/`, ainda não existe. |

Depois disso: L2 (arrastar, T068–T071), L4 (tutorial, T096–T097), mobile
(T103–T107) e a matriz de permissões (T108–T111).

**141 tarefas fechadas, 37 abertas** (13/08/2026) — o crescimento do total vem das
sete sugestões do comercial (T121–T127, registradas em 11/08) e do bloco T128–T134
(12/08). Este número e o de [tasks.md](./tasks.md) precisam ser corrigidos **juntos**:
ficaram divergentes por três dias (117/47 aqui, 94/61 lá) e os dois foram lidos como
estado real numa revisão externa.

### O Nectar não tem sandbox — e isso virou decisão de arquitetura

Pesquisado em 11/08. A [documentação](https://github.com/ColmeiaSolucoes/nectarcrm-api)
e a [central de ajuda](https://ajuda.nectarcrm.com.br/hc/pt-br/articles/20569162217619-API-Nectar)
publicam **uma URL só**, de produção. Não há homologação para onde apontar.
Três contenções:

1. **`NECTAR_MODE`** — `off` (padrão), `fake`, `real`. O padrão não pode ser
   "tenta", porque a única coisa que ele alcançaria é o CRM da empresa. O `fake`
   é o que torna a suíte possível.
2. **`NECTAR_PIPELINE_IDS`** — lista branca de funis; **vazia recusa tudo**.
   Aponte o ambiente de teste para um funil "ZZ — Testes".
3. **No CRM, não no código:** o token do Nectar **herda as permissões do usuário
   responsável** e tem validade. Crie um usuário restrito para os testes.

O caminho está fechado ponta a ponta na tela: **criar → salvar → emitir →
baixar**. O que falta para o módulo servir é a finalização (T076–T077) — o envio
ao Nectar e ao SharePoint.

> **O que NÃO foi verificado rodando.** A conversão `.docx → PDF` exige
> LibreOffice, que só existe dentro do contêiner, e o backend em Docker roda
> `node src/server.js` **sem `--watch`**. As rotas novas só entram no ar depois
> de reiniciar:
>
> ```bash
> docker compose -f docker-compose.local.yml restart backend
> ```
>
> Fora isso, `COMERCIAL_DIR` não está no `.env.docker.local` e não precisa
> estar: o padrão cai em `/data/relatorios/Comercial`, dentro do volume
> `filtrovali_local_relatorios` — os documentos sobrevivem ao contêiner.

> **A ligação da tela virou a T054a**, feita em 11/08. Ela não existia no plano —
> caiu entre a T067 (validação das etapas) e a T083 (painel de finalização) — e
> só apareceu quando o backend ficou pronto e nada o chamava.

---

## Parte 3 — As decisões que você precisa conhecer

Estão todas em [`contracts/e0-8-desvios-e-estimativa.md`](./contracts/e0-8-desvios-e-estimativa.md);
aqui vão as três que mudam o que fazer amanhã.

### O documento vem do `.docx`, não de código

**Desvio 12 e 13.** O gerador programático em `pdf-lib` chegou a existir, com 26
testes, e **foi removido**. O documento agora sai do `.docx` em
`Modelos/definitivos/Comercial/modelos/`, preenchido por
`backend/src/lib/comercial/proposta-docx.js` e convertido pelo LibreOffice.

A razão é de produto: trocar um parágrafo, corrigir uma cláusula ou mudar a
matriz padrão passou a ser **abrir o `.docx` e salvar** — sem programador e sem
deploy. É o mesmo caminho dos relatórios do filtroAPP.

**Não recrie o gerador programático.** Duas maneiras de desenhar a mesma
proposta divergem em silêncio, e o cliente recebe a que ninguém revisou.

Quando o comercial entregar um documento novo já preenchido:

```bash
cd backend && node scripts/comercial-gerar-modelos.mjs
```

O script converte os campos de mala direta em marcadores, prepara as
linhas-modelo, marca o escopo e padroniza a fonte. É idempetente.

### Hidrojateamento é um modelo próprio

Não é "mais um serviço do catálogo": diverge em cinco lugares, e o quinto é o que
decide — **duas tabelas de preço**, ONSHORE e OFFSHORE, cada uma com o seu TOTAL
GERAL. Somá-las mostraria ao cliente um número que ele não vai pagar, porque são
cenários alternativos de execução.

### Onde o `.docx` manda e onde a referência manda

A **referência** é autoridade sobre comportamento e cálculo — é o que os goldens
protegem. O **`.docx`** é autoridade sobre o conteúdo do documento. Onde
divergirem no texto, o documento vence: é ele que vai ao cliente.

---

## Parte 4 — Armadilhas que já custaram tempo

Cada uma destas produziu um arquivo que **abre normalmente e está errado**. Todas
têm teste agora, mas vale saber que existem.

1. **Marcador partido entre vários `w:t`.** O Word quebra `{{cliente}}` em
   `{{cli`, `en`, `te}}` por qualquer motivo. Um `replace` por nó não acha nada.
   Use `docx/template.js`, que concatena antes de procurar.

2. **Célula vazia não tem run nenhum.** Criar um do zero **sem copiar o `rPr` do
   parágrafo** faz o texto sair na fonte padrão do documento em vez da fonte da
   tabela — a linha muda de altura e a tabela entorta no papel, certinha no XML.

3. **Fórmula do Word não é recalculada na conversão.** `=SUM(ABOVE)` sairia com
   o valor em cache — o da proposta de exemplo. As fórmulas foram removidas e os
   totais são calculados por nós.

4. **Run com imagem não tem texto.** Uma regra "apaga o que está vazio" leva a
   arte do timbrado junto, porque ela é uma imagem **ancorada no parágrafo da
   data**. O documento sai branco e abre sem reclamar.

5. **Alinhamento por espaços não sobrevive à conversão.** A data do cabeçalho era
   empurrada por 109 espaços literais; a largura do espaço difere entre Word e
   LibreOffice, a linha estoura a margem e a data reaparece à esquerda. Use
   `w:jc`.

6. **`docDefaults` sem fonte.** Apagar as referências ao tema sem declarar
   `w:ascii` faz cada renderizador cair no padrão dele — Calibri no Word, Times
   no LibreOffice.

7. **Teste que olha só `word/document.xml`.** Foi assim que `{{data_texto}}`, que
   mora no **cabeçalho**, passou sem ser preenchido. Varra o pacote inteiro.

---

## Parte 5 — Como verificar

```bash
cd backend  && npm test                      # 931/931 em 11/08
cd frontend && npm test && npm run lint      # 213/213
cd .. && npm run architecture:check
```

**Uma falha pode aparecer, e é pré-existente:** `sendSignatureRequestEmails
fails synchronously when SMTP config is missing`, em
`backend/test/internal-report-signatures.test.js`. Depende do SMTP configurado
no ambiente — apareceu na máquina anterior e não apareceu na de 11/08. Não tem
relação com o módulo Comercial. Se aparecer **outra** falha, é regressão.

O `architecture:check` recusa arquivo novo solto em `backend/src/lib/`: código de
domínio vai para `backend/src/lib/<modulo>/`.

### O que os testes não cobrem

Posição no papel, sobreposição e enquadramento de imagem. Isso é olho no PDF, e é
onde os últimos quatro defeitos apareceram — todos reportados por quem olhou, não
por suíte vermelha.

---

## Parte 6 — Pendências registradas, não esquecidas

- **Três serviços e quatro relatórios do `.docx` fora do catálogo.** Flushing com
  água, remoção de verniz e boroscopia existem no documento e não no catálogo
  técnico; hidrojateamento e passagem de PIG saem sem citar o RH e o RTPP que o
  documento promete. Decisão consciente de ficar de fora — está no desvio 12.
- **PGR × PPRA.** O modelo padrão já migrou para PGR; os de hidrojateamento ainda
  dizem PPRA. Os dois textos convivem hoje. Unificar é decisão do mantenedor.
- **Erros de digitação nos documentos originais** (resina, instalações,
  hidrojateamento, RFA duplicado) estão listados em
  [`contracts/modelos-word.md`](./contracts/modelos-word.md). Não os corrigi por
  conta própria.
- **Desvio 11** — tela de custos sem `react-hook-form` — **aprovado em 12/08**.
  A lista de desvios não tem mais nenhum item sem resposta.
- **O `totalValue` do hidrojateamento** (11/08). O valor gravado e mandado ao CRM
  é a **maior** das duas tabelas, ONSHORE ou OFFSHORE. A referência somava todos
  os preços, mas lá não existiam duas tabelas: somá-las aqui produziria um número
  que nenhum cliente vai pagar, porque são cenários alternativos. A maior é a
  única das duas somas que corresponde a um cenário real. **Respondido em 12/08:
  o mais comum é ONSHORE, e o certo é perguntar ao vendedor** — vira a T130.
- **`prisma migrate dev` exige reset do banco** por drift pré-existente em duas
  migrations. O caminho usado foi `migrate diff` → revisão → `db execute` →
  `migrate resolve --applied`. **Não rode `migrate dev` sem backup.**
