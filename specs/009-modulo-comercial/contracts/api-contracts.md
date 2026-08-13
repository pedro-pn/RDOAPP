# Phase 1 — Contratos de API: Módulo Comercial

**Feature**: `specs/009-modulo-comercial` · **Data**: 2026-07-31

> Esta pasta já continha os contratos da E0 — `ui-inventory.md` (oráculo de paridade
> visual), `goldens/` (oráculo numérico), `lacunas-constitucionais.md`,
> `e0-8-desvios-e-estimativa.md` e `baseline/`. **Nenhum deles foi alterado.** Este
> arquivo acrescenta o contrato HTTP.

Toda rota valida a entrada com Zod antes de tocar em regra de negócio ou banco
(Princípio III). Middlewares:

| Middleware | Quem passa |
|---|---|
| `requireComercialAccess` | os três papéis |
| `requireComercialEstimator` | `comercial:manager` e `comercial:seller` |
| `requireComercialManager` | só `comercial:manager` |

> **Middleware de papel não basta.** Ele sabe o papel, não sabe a autoria do registro
> alcançado. Toda rota que toca um registro específico passa também por
> `lib/comercial/access.js` (D14). Toda rota de listagem **filtra por autoria** quando
> o solicitante é `comercial:seller`.

---

## Levantamentos

### `GET /api/comercial/levantamentos`

`requireComercialEstimator`

**Filtro por autoria obrigatório**: `seller` recebe apenas `createdByUserId = self`;
`manager` recebe todos. Não é ordenação nem preferência — é a restrição.

Resposta: `{ items: [{ id, proposalCode, revisionNumber, title, salePrice, marginPercent, status, createdAt }], total }`

### `POST /api/comercial/levantamentos`

`requireComercialEstimator`

Corpo: o payload do levantamento. **Os totais enviados pelo cliente são ignorados** —
o servidor recalcula com `calculateEstimate` e grava os seus. Impede forjar margem.

Erros: `422` com `issues: [{ path, message, severity }]` — **um item por pendência,
com o endereço do campo**. É o que sustenta o FR-009 e a L1; a referência concatenava
tudo numa string só.

### `GET /api/comercial/levantamentos/:id`

`requireComercialEstimator` + autoria. `seller` pedindo levantamento de outro autor
recebe **403**, não `404` genérico nem tela vazia.

### `PUT /api/comercial/levantamentos/:id`

`requireComercialEstimator` + autoria. Cria `CostEstimateVersion` com hash do payload.

---

## Propostas

### `GET /api/comercial/propostas`

`requireComercialAccess`

**A resposta varia por papel** — e a variação acontece **na origem**, não na tela:

| Papel | Alcance | `totalValue` | Link do documento |
|---|---|---|---|
| `manager` | todas | presente | comercial + técnica |
| `seller` | só as suas | presente | comercial + técnica |
| `viewer` | todas | **ausente do JSON** | **só técnica** |

Para o `viewer`, os campos de valor, custo e margem **não existem na resposta**.
Omitir na serialização, não ocultar no cliente (D13).

### `POST /api/comercial/propostas`

`requireComercialEstimator`

### `GET|PUT /api/comercial/propostas/:id`

`requireComercialEstimator` + autoria. O `viewer` não alcança — sua superfície é a
listagem (FR-030).

### `POST /api/comercial/propostas/documentos`

`requireComercialEstimator` + autoria. Preenche os modelos `.docx` de
`Modelos/definitivos/Comercial/modelos/`, converte com o `convertDocxToPdf` dos
relatórios e grava sob `COMERCIAL_DIR` **antes** de qualquer tentativa de integração.

> Dizia "gera os dois PDFs com `pdf-lib`" até 13/08. O gerador programático existiu e
> foi removido em 05/08 (desvio nº 12): o documento passou a ser editável por quem o
> escreve, sem programador e sem deploy.

### `POST /api/comercial/propostas/finalizar`

`requireComercialEstimator` + autoria — o autor finaliza a sua, o manager finaliza
qualquer uma (FR-028).

JSON pequeno; dispara Nectar e SharePoint e depois atualiza `integrationStatus`.

**Contrato de falha (FR-034)**: se a integração falhar **depois** dos documentos
gravados, a resposta é erro **mas informa que os documentos continuam disponíveis
para download**, com os links. O trabalho não se perde — é comportamento da
referência e precisa sobreviver ao porte.

Os quatro estágios anunciados ao usuário vêm de `shared/comercial/finalization.ts`,
copiado sem alterar.

**Além dos dois PDFs, a finalização envia a planilha de custos** (FR-054):
`Levantamento de Custos - {código}.csv`, em **UTF-8 com BOM**, separador **ponto e
vírgula**, células entre aspas com aspas internas duplicadas. O conteúdo tem **dois
formatos**, escolhidos pelo `schemaVersion` do levantamento vinculado — esquema 2 em
diante, e legado (FR-055). Proposta antiga não pode quebrar a finalização.

### `GET /api/comercial/propostas/proximo-numero`

`requireComercialEstimator`. Consome a sequence do schema `comercial` (D5). Não toca
o Nectar.

---

## Documentos

### `GET /api/comercial/documentos/:id`

`requireComercialAccess` + autoria + **regra de papel**:

- `viewer` pedindo documento `COMERCIAL` → **403**. Não é ocultar o botão: a rota
  nega. Liberar o PDF comercial contornaria o FR-030 por outra porta, porque ele traz
  tabela de preços, condições de pagamento e valor total.
- `viewer` pedindo `TECNICA` → permitido.

---

## Arquivamento — **não se apaga registro**

> Decisão do mantenedor, 31/07: só arquivar. **Nenhuma rota do módulo apaga
> levantamento nem proposta.** A única exclusão do módulo é a do **anexo** antes da
> finalização (FR-078, T128) — arquivo que o vendedor acabou de juntar, não registro
> de negócio.

### `POST /api/comercial/levantamentos/:id/arquivar` · `.../desarquivar`
### `POST /api/comercial/propostas/:id/arquivar` · `.../desarquivar`

`requireComercialEstimator` + autoria (FR-061). Arquivado some da listagem padrão e
volta com `?arquivados=1`. Documentos, fotos e histórico **permanecem**.

---

## Anexos do cliente

`PROP-CTL-081` — "Arquivos adicionais do cliente (opcional)". Vão para **a mesma pasta
dos dois documentos** no destino externo.

### `POST /api/comercial/propostas/:id/anexos`

`requireComercialEstimator` + autoria. Um arquivo por requisição — a referência mandava
tudo junto no `finalize`, e separar evita estourar o limite de corpo em proposta com
muitos anexos.

**O limite é agregado** (FR-059): os dois PDFs + a planilha + todos os anexos, somados.
Validar cada anexo isoladamente deixa passar o conjunto.

### `DELETE /api/comercial/propostas/:id/anexos/:anexoId`

`requireComercialEstimator` + autoria. **O único `DELETE` do módulo** (FR-078, T128), e
só **antes de finalizar** — depois, o arquivo já foi ao CRM e ao SharePoint, e apagar
aqui deixaria o nosso registro dizendo uma coisa e o destino, outra. A ordem é
**registro primeiro, arquivo depois**: o que não pode sobrar é registro apontando para
arquivo que não existe.

### `POST /api/comercial/propostas/finalizar` — campo adicional

Aceita também a **pasta existente no OneDrive** (`PROP-CTL-080`, opcional): havendo
valor, grava dentro dela em vez de criar pasta nova.

---

## Configuração do módulo e endereços *(acrescentado em 12/08 — T131, T126, T134)*

Detalhes, contratos de resposta e as três armadilhas em
[`distancias-automaticas.md`](./distancias-automaticas.md).

### `GET /api/comercial/configuracao` — `requireComercialEstimator`

Devolve o endereço da sede em uso. É `estimator` e não `manager` de propósito: quem
levanta custo precisa **ver** a origem do cálculo; só mudar é que é do gestor.

### `PUT /api/comercial/configuracao/sede` — `requireComercialManager`

`{ sedeEndereco, sedePlaceId }`. Com `sedePlaceId` preenchido (veio de sugestão
escolhida), **não geocodifica** — o lugar já está identificado. Salvar com o Maps `off`
é caminho normal, não erro: o endereço digitado serve de origem sozinho.

### `POST /api/comercial/configuracao/sede/localizar` — `requireComercialManager`

Confere o endereço antes de salvar e devolve o que o Google encontrou, com a confiança.

### `GET /api/comercial/distancia?destino=` — `requireComercialEstimator`

Sede → destino. É `GET` e não `POST`: a consulta não cria nada, e o resultado é
cacheável pela chave composta `sede > destino`.

**Nunca lança**: sem resposta, devolve o motivo específico (limite diário, sem rota
rodoviária, sede não configurada) e a tela deixa digitar à mão.

### `GET /api/comercial/enderecos/sugestoes` — `requireComercialEstimator`

`?termo=` com no mínimo 4 caracteres. Cota diária **própria**, separada da de rotas.
Cada item traz `placeId`, `principal` e `secundario` — o `secundario` não é enfeite: é
o que separa cinco "Avenida Paulista, 1000" em cinco cidades diferentes.

---

## Revisão de proposta

### `GET /api/comercial/propostas/:codigo/revisao`

`requireComercialEstimator`. Devolve `base_number`, `nextRevision`, o vínculo com o CRM
se existir, e **`snapshotAvailable`**.

| `snapshotAvailable` | Mensagem ao usuário |
|---|---|
| `true` | "Proposta anterior carregada por completo." |
| `false` | "Dados disponíveis no histórico carregados." |

**Proposta antiga não pode falhar** — o caminho sem snapshot é normal, não erro
(FR-065). Havendo card salvo, ele é **reutilizado**, e a resposta diz qual e em que funil
(FR-066).

---

## Concorrência

### Finalização é exclusiva (FR-069)

`POST /propostas/finalizar` verifica o estado **antes de gerar qualquer coisa**. Se já
finalizada ou em finalização: **409**, informando **quando e por quem**.

Sem isso, dois usuários clicando com segundos de diferença produzem dois pares de
documentos, duas oportunidades no CRM e duas pastas — e as duas requisições respondem
sucesso.

### Escrita avisa antes de sobrescrever (FR-070)

`PUT` de levantamento e de proposta compara o `updatedAt` que o cliente carregou com o
atual. Divergiu: **409** nomeando quem alterou e quando. É **aviso, não trava** — o
cliente decide recarregar ou prosseguir.

---

## Fotos do escopo

Porte de `app/api/scope-assets/route.ts` da referência.

### `POST /api/comercial/escopo/fotos`

`requireComercialEstimator`. **Binário cru**: `Content-Type` é o tipo da imagem e o
nome original vai em `x-file-name`.

> **Mudou de `multipart/form-data` na implementação (04/08).** O repositório já recebe
> upload assim (`acompanhamento-comercial.js`), e o cliente envia uma foto por
> requisição — multipart pediria uma dependência nova para embrulhar um arquivo só.

**Cadeia de recusa**, na ordem, com mensagem própria para cada caso:

| Condição | Status | Mensagem |
|---|---|---|
| requisição acima de 2 MB | **413** | "A foto processada excedeu o limite de envio." |
| sem arquivo | **400** | "Selecione uma foto para o escopo." |
| tipo fora de JPEG/PNG/WebP | **415** | "Use uma imagem JPEG, PNG ou WebP." |
| arquivo vazio ou acima de 1,5 MB | **413** | "A foto processada deve ter no máximo 1,5 MB." |
| **assinatura de bytes** não bate com o tipo | **415** | "O conteúdo do arquivo não corresponde a uma imagem válida." |

A verificação de assinatura **não é opcional**: sem ela, qualquer arquivo renomeado para
`.jpg` entra. Confiar no `Content-Type` é confiar em quem envia.

Caminho de gravação no padrão da referência: `escopo/AAAA/MM/<uuid>.<ext>`, guardando o
nome original saneado.

### `GET /api/comercial/escopo/fotos/:id`

`requireComercialEstimator` + autoria da proposta a que a foto pertence. As fotos
**sobrevivem às revisões** (FR-051) — revisar não exige reenviar.

> **A otimização acontece no cliente, antes do envio** (FR-048): redimensionar para
> 1600 px no maior lado, achatar sobre fundo branco, recomprimir em 0,82 e, se ainda
> passar de 1,5 MB, em 0,64. O servidor **não confia nisso** — revalida tudo. O cliente
> otimiza para caber; o servidor verifica porque pode ser contornado.

---

## Consultores de vendas

> **Não há CRUD.** A lista é **derivada dos usuários** com o papel `comercial:seller`
> (decisão de 31/07, que revoga a decisão 4 da §12.5). Não existe `POST`, `PUT` nem
> `DELETE` — quem entra no quadro aparece, quem sai some.

### `GET /api/comercial/consultores`

`requireComercialEstimator`. Alimenta o campo `PROP-CTL-016` da etapa Cliente.

**A resposta varia por papel, e a decisão é do servidor** (FR-041b):

| Papel | Recebe |
|---|---|
| `comercial:manager` | todos os usuários ativos com `comercial:seller` |
| `comercial:seller` | **apenas ele mesmo** |

Filtrar no cliente não serve: um vendedor não deve nem receber os nomes dos outros.

A proposta grava `sellerUserId` **e** `sellerName`. Desativar ou renomear um usuário
**não altera proposta já emitida** (FR-041a) — o nome gravado é o do momento da
emissão, e o PDF já foi ao cliente com ele.

---

## Matriz de teste de permissão

Oráculo dos testes da E9. Cada célula é um caso:

| Rota | `manager` | `seller` (próprio) | `seller` (de outro) | `viewer` |
|---|---|---|---|---|
| `GET /levantamentos` | todos | só os seus | — | **403** |
| `POST /levantamentos` | 201 | 201 | — | **403** |
| `GET /levantamentos/:id` | 200 | 200 | **403** | **403** |
| `PUT /levantamentos/:id` | 200 | 200 | **403** | **403** |
| `GET /propostas` | todas | só as suas | — | todas, **sem valores** |
| `POST /propostas` | 201 | 201 | — | **403** |
| `PUT /propostas/:id` | 200 | 200 | **403** | **403** |
| `POST /propostas/finalizar` | 200 | 200 | **403** | **403** |
| `GET /documentos/:id` (técnica) | 200 | 200 | **403** | 200 |
| `GET /documentos/:id` (comercial) | 200 | 200 | **403** | **403** |
| `GET /consultores` | lista completa | **só ele mesmo** | — | **403** |
| `POST /escopo/fotos` | 201 | 201 | — | **403** |
| `GET /escopo/fotos/:id` | 200 | 200 | **403** | **403** |
| `POST /propostas/:id/anexos` | 201 | 201 | **403** | **403** |
| `POST /propostas/:id/arquivar` | 200 | 200 | **403** | **403** |
| `POST /propostas/finalizar` **já finalizada** | **409** | **409** | — | **403** |
| `PUT /propostas/:id` **alterada por outro** | **409** | **409** | **403** | **403** |
| `DELETE /propostas/:id/anexos/:anexoId` | 200 | 200 | **403** | **403** |
| `DELETE /propostas/:id/anexos/:anexoId` **já finalizada** | **409** | **409** | **403** | **403** |
| **qualquer outro `DELETE`** | **não existe** | **não existe** | **não existe** | **não existe** |
| `GET /configuracao` | 200 | 200 | — | **403** |
| `PUT /configuracao/sede` | 200 | **403** | — | **403** |
| `POST /configuracao/sede/localizar` | 200 | **403** | — | **403** |
| `POST /distancia` | 200 | 200 | — | **403** |
| `GET /enderecos/sugestoes` | 200 | 200 | — | **403** |

> A linha do `DELETE` mudou em 13/08. Ela dizia "qualquer `DELETE` — não existe", e
> deixou de ser verdade com a T128: o anexo é a **exceção nomeada** (FR-078). O teste
> da T110b foi reescrito para **enumerar** as rotas de exclusão e afirmar que só existe
> esta, em vez de afirmar que não existe nenhuma — assim ele pega tanto um `DELETE` novo
> de proposta quanto a perda do portão de "só antes de finalizar".

O caso que mais importa e que passa despercebido: **`seller` A lendo a listagem
enquanto existe registro de `seller` B**. Se a filtragem estiver só na rota de item e
não no índice, este teste é o único que pega.
