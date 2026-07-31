# Phase 0 — Research: Módulo Comercial

**Feature**: `specs/009-modulo-comercial` · **Data**: 2026-07-31

Consolidação das decisões técnicas. A investigação de fundo está em
`docs/PLANO_MODULO_COMERCIAL.md`, que é o insumo principal desta feature — este
arquivo registra **o que foi decidido, por quê, e o que foi rejeitado**, sem repetir
o plano.

Nenhum `NEEDS CLARIFICATION` permanece. As duas questões abertas do `spec.md` foram
respondidas pelo mantenedor em 31/07 e estão registradas na §12.5.1 do plano.

---

## D1 — Dois schemas Postgres na mesma instância

**Decisão**: `datasource db { schemas = ["public", "comercial"] }`, com `@@schema`
anotado em todos os models e enums existentes.

**Rationale**: `multiSchema` é GA desde o Prisma ORM 6.13 e o repositório usa 7.9 —
não precisa de `previewFeatures`. Nenhum dado se move: as tabelas já estão em
`public`, e a anotação apenas informa ao Prisma onde elas já estão. A migration
resultante é quase vazia — `CREATE SCHEMA comercial` mais as tabelas novas, sem
nenhum `ALTER` na operação.

**Alternativas rejeitadas**:
- *Tudo em `public` com `@@map("comercial_*")`* — fica como **plano B** se a migration
  revelar algo inesperado. Perde a listagem e o dump parciais por schema.
- *Banco separado* — inviabilizaria a E11, que precisa gravar `CommercialProposal` na
  mesma transação.

**Ressalva registrada**: a separação **não entrega isolamento de segurança hoje** — é
o mesmo processo Express com o mesmo usuário de banco alcançando os dois schemas.
Isso é intencional e é o que torna a E11 trivial.

---

## D2 — Anotação em massa de ~100 models e ~40 enums

**Decisão**: script mecânico que insere `@@schema("public")` em todo model/enum sem
anotação, seguido de revisão do SQL gerado pela migration.

**Rationale**: é edição mecânica de alto volume — exatamente o caso em que escrever à
mão introduz erro silencioso. O critério de aceite é o SQL: deve conter só
`CREATE SCHEMA` e `CREATE TABLE comercial.*`.

**Alternativa rejeitada**: anotação manual. 140 edições sem verificação automática.

---

## D3 — PDF gerado no backend com `pdf-lib`

**Decisão**: portar `app/proposal-pdf.ts` da referência para `pdf-lib` no backend,
com `sharp` para o preparo de imagens.

**Rationale**: a constitution fixa a stack; geração no cliente não é opção. As duas
dependências **já estão no `backend/package.json`** (`pdf-lib ^1.17.1`,
`sharp ^0.35.3`) — não entra dependência nova. As primitivas da referência traduzem
1:1; o que precisa de código próprio é o helper de quebra de linha sobre
`widthOfTextAtSize`.

**Consequência aceita (desvio nº 1)**: o download passa a ter uma ida ao servidor.

**Alternativa rejeitada**: manter a geração no cliente. Contraria a stack fixada e
duplicaria a lógica de layout entre a prévia e o documento final.

---

## D4 — `shared/comercial` com passo de build

**Decisão**: `shared/comercial/` em TypeScript, com `tsconfig` próprio gerando
`dist/` com `.js` + `.d.ts`.

**Rationale**: são 4.529 linhas com ~80 tipos exportados que precisam rodar no
backend (JS) e no frontend (TS). O motor de custos é copiado **sem alterar** — é o
que os goldens verificam.

**Alternativa rejeitada**: `.js` + `.d.ts` escritos à mão, como `shared/schemas/*`.
Nesse volume seria fonte dupla de verdade, e o drift entre as duas apareceria como
divergência de golden meses depois.

**Entra no Complexity Tracking.**

---

## D5 — Numeração da proposta vem do módulo, não do CRM

**Decisão**: sequence no schema `comercial`, semeada acima do maior número existente
**no CRM Nectar e em `CommercialProposal`**.

**Rationale**: §12.5, decisão 5. Simplifica o código — cai a varredura do Nectar em
`next-number` — e remove a dependência de credencial externa para criar proposta. O
valor de partida é levantado uma vez, na E4, e registrado na migration.

**Risco novo aceito**: se alguém criar oportunidade direto no Nectar, o número pode
colidir. Mitigado pela semeadura acima do máximo das duas origens, e coberto por
teste (`não regride, não colide`).

**Efeito colateral positivo**: o fluxo "Nova proposta", que na referência devolvia
503 sem `NECTAR_API_TOKEN`, passa a funcionar localmente. O desvio nº 8 continua
válido — ele registra a **ausência de captura de baseline**, que não muda.

---

## D6 — Reuso do drag and drop compartilhado

**Decisão**: usar `frontend/src/utils/reorderDrag.ts`, **precedido de auditoria**
contra a constitution.

**Rationale**: o utilitário já entrega alça, fantasma, placeholder e suporte a toque,
e está em uso em 4 telas (`QualityNaturesTab`, `CategoryManager`,
`TechnicalSchemaBuilder`, `GestorPage`). O `plan-template.md` exige checar se a fonte
ainda cumpre a constitution antes de reusar, e mandar corrigir a origem se houver
dívida.

**Contingência orçada**: se a auditoria reprovar, o conserto é no utilitário
compartilhado (+1 d) e beneficia as 4 telas que já o usam.

**Alternativa rejeitada**: escrever drag and drop próprio no módulo. Criaria um
segundo padrão de reordenação no app, que é exatamente o que a constitution proíbe.

---

## D7 — Padrão de campo inválido

**Decisão**: consumir `.field-invalid` / `.field-group` / `.field-error` de
`frontend/src/styles/base.css:4085-4102`, generalizando o componente `Field` da
referência (`app/page.tsx:1187`).

**Rationale**: as classes já existem e estão em uso em 10 arquivos. O `Field` da
referência já é o **único** lugar do app de origem que faz `aria-invalid` certo — o
trabalho é generalizá-lo, não inventá-lo. **As classes `.field-*` são de
comportamento, não de identidade visual**, então a exceção do Princípio VI não se
aplica a elas.

O custo real da L1 não são 465 edições manuais: é (a) generalizar o `Field`,
(b) escrever o resolvedor de `path` → id de campo e (c) ligar as 5 seções.
`validateCostEstimate` já devolve `{ path, message, severity }` por item — o `path`
é o endereço do campo, e a referência joga isso fora.

---

## D8 — `@hookform/resolvers` precisa ser instalado

**Decisão**: instalar `@hookform/resolvers` e usar `zodResolver` nos formulários do
módulo.

**Rationale**: o Princípio III exige "react-hook-form com resolver Zod". A
verificação mostrou que **o pacote não está instalado** e `zodResolver` não aparece
em nenhum arquivo do frontend, apesar de `react-hook-form ^7.81.0` estar em uso em
4 telas. É dependência nova, pequena, e sem ela o módulo não cumpre o Princípio III.

**Achado registrado, fora do escopo desta feature**: as 4 telas existentes que usam
`react-hook-form` sem resolver Zod estão em divergência com a constitution. Não é
trabalho desta feature corrigi-las — fica anotado para quem for tocá-las.

---

## D9 — Tutorial de primeiro acesso

**Decisão**: usar `driver.js ^1.7.0`, já presente no `frontend/package.json`.

**Rationale**: a peça existe; o que custava era o roteiro, e ele foi escrito e
revisado na E0-7 (`contracts/baseline/roteiro.md`). Módulo novo mantém **onboarding
permanente** de primeiro acesso — a campanha de novidade de 10 dias é para função
nova dentro de módulo existente.

**Fonte do roteiro**: a cadeia de prioridade do rodapé de `/custos`
(`app/custos/page.tsx:595-604`) e a armadilha de e-mail/CNPJ inválido da etapa 1
(`app/page.tsx:472-486`). Ambas confirmadas pelo mantenedor como o caminho real de
uso e o ponto de travamento provável.

---

## D10 — Armazenamento dos documentos em disco

**Decisão**: gravação e leitura em disco sob `COMERCIAL_DIR`, no padrão já usado pelo
filtroAPP, com a pasta incluída em `deploy/backup-prod.sh`.

**Rationale**: a referência usava R2 (Cloudflare), que não existe nesta
infraestrutura. Disco é o que o app já faz para anexos.

**Alternativa rejeitada**: armazenar o PDF como blob no Postgres. Incha o dump e o
backup, e o app já tem padrão de disco.

---

## D11 — Decomposição das duas telas grandes

**Decisão**: `app/page.tsx` (1.759 linhas) → container + 7 componentes de etapa +
prévia. `app/custos/page.tsx` (3.382 linhas) → container + 5 componentes de seção.

**Rationale**: o padrão do repositório reprova página acima de 700–900 linhas. **Não
é refatoração opcional, é requisito de CI.** A decomposição também é o que torna a
passada de mobile (E8.5) barata, porque isola o layout de cada seção.

---

## D12 — Recálculo ao vivo fora do ciclo padrão de formulário

**Decisão**: manter o recálculo a cada tecla, como na referência.

**Rationale**: `calculateEstimate` roda sobre ~40 coleções aninhadas e a tela é uma
calculadora, não um CRUD. É comportamento da referência e faz parte da paridade.

**Alternativa rejeitada**: validar e calcular só no submit. Esconderia margem
negativa e erro de dimensionamento até o fim do preenchimento — numa tela onde o
preço é formado.

**Entra no Complexity Tracking.**

---

## D13 — Supressão de valores para o papel de consulta

**Decisão**: suprimir valor, custo e margem **na origem da resposta**, por papel, e
não devolver o link da proposta comercial para `comercial:viewer`.

**Rationale**: valor que chega ao navegador e é escondido por CSS não está restrito —
está visível para qualquer um que abra as ferramentas do navegador. O documento
comercial traz tabela de preços, condições de pagamento e valor total; liberá-lo
contornaria a restrição por outra porta.

**Escopo confirmado pelo mantenedor em 31/07**: a superfície do viewer é a **listagem
do histórico**. Não há tela de detalhe de proposta em modo leitura, nem na referência
nem no porte — **nenhuma tela nova nasce por causa deste papel**.

---

## D14 — Autoria verificada em duas entidades

**Decisão**: `lib/comercial/access.js` verifica autoria em **levantamento e
proposta**, e a filtragem por autoria vale também nas **listagens**.

**Rationale**: §12.5.1. Com o papel `comercial:seller` podendo criar, a regra passa a
restringir de fato. Proteger só as rotas de escrita deixa o vazamento na listagem —
que é onde ele costuma acontecer: a rota nega o `GET /:id`, e o índice devolve tudo.

**Alternativa rejeitada**: middleware de role apenas. Middleware sabe o papel, não
sabe a autoria do registro que está sendo alcançado.

---

## D15 — Ferramenta de teste

**Decisão**: `node --test`, no padrão do repositório (`backend/test/*.test.js`,
`frontend/test/*.test.mjs`).

**Rationale**: é o que os dois pacotes já usam. Nenhuma dependência de teste nova.

**Oráculos**: os 16 goldens de `contracts/goldens/` para o motor de custos; a matriz
de permissão (3 papéis × 2 entidades) para o controle de acesso.
