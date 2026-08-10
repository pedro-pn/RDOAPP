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

Se for copiá-la para a máquina nova, o caminho esperado é `~/comercialAPP`.

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
| **T051, T052, T054** | `proposals.js` e as rotas de proposta — criar, revisar, vincular ao levantamento. **Nada disso existe ainda**: hoje a proposta só vive no formulário e no rascunho local. |
| **T074** | `storage.js` — gravar e ler documento sob `COMERCIAL_DIR`. |
| **T075** | `POST /propostas/documentos` — gera os dois PDFs e **grava antes de qualquer integração**. |
| **T076–T076f** | `jobs.js` — Nectar e SharePoint, planilha de custos, anexos, limite agregado. |
| **T077** | Contrato de falha: integração que falha depois dos documentos prontos responde erro **mas informa que eles continuam baixáveis**. |
| **T079a, T079b, T110a** | Exclusividade da finalização e aviso de escrita concorrente. |
| **T084** | Tela de histórico — `frontend/src/pages/comercial/historico/`, ainda não existe. |

Depois disso: L2 (arrastar, T068–T071), L4 (tutorial, T096–T097), mobile
(T103–T107) e a matriz de permissões (T108–T111).

**94 tarefas fechadas, 61 abertas.**

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
cd backend  && npm test                      # 899/900
cd frontend && npm test && npm run lint      # 213/213
cd .. && npm run architecture:check
```

**Uma falha é esperada e pré-existente:** `sendSignatureRequestEmails fails
synchronously when SMTP config is missing`, em
`backend/test/internal-report-signatures.test.js`. Não tem relação com o módulo
Comercial — confirmei com `git stash`. Se aparecer **outra** falha, é regressão.

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
- **Desvio 11** — tela de custos sem `react-hook-form` — continua **proposto,
  pendente de decisão**.
- **`prisma migrate dev` exige reset do banco** por drift pré-existente em duas
  migrations. O caminho usado foi `migrate diff` → revisão → `db execute` →
  `migrate resolve --applied`. **Não rode `migrate dev` sem backup.**
