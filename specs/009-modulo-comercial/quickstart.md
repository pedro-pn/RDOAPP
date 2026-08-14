# Phase 1 — Quickstart: validar o módulo Comercial

**Feature**: `specs/009-modulo-comercial` · **Data**: 2026-07-31

Roteiro de validação: como provar que o porte está certo. Não é guia de
implementação — isso é `tasks.md`.

O que torna esta feature verificável é ter **dois oráculos independentes**: os
goldens (números) e o inventário de UI (elementos). Nenhum dos dois é opinião.

---

## Pré-requisitos

### A referência congelada, de pé

```bash
cd ~/comercialAPP
node ~/.cache/node/corepack/pnpm/11.18.0/bin/pnpm.cjs dev
```

`http://localhost:3000` · login `baseline` / `baseline-e0`

> **`corepack` do Debian está quebrado** neste ambiente
> (`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`). A invocação direta acima é o caminho
> que funciona. O runbook completo está em `contracts/baseline-runbook.md`.

> **A referência é somente leitura.** Congelada em `6f5b072`. Nenhum
> desenvolvimento novo lá — os IDs do inventário derivam da ordem de linha, então
> qualquer mudança lá invalida em silêncio as tarefas que os citam.

Para as telas terem conteúdo: `/custos` → **"Revisar proposta" → 4418**.

### A credencial da baseline

`baseline` / `baseline-e0` é **local e descartável**. Nunca vai para produção.

---

## 1. Oráculo numérico — os 16 goldens

O portão mais barato e o mais decisivo. Roda sem app de pé e sem banco: o motor de
custos é TypeScript puro sem imports.

```bash
cd ~/filtroAPP
npm --prefix backend test
```

**Esperado**: os 16 cenários de `contracts/goldens/` reproduzidos **dígito a
dígito**, cobrindo os 40 invariantes.

> **Se um golden falhar, o defeito é do porte.** Regerar para "fazer passar"
> destrói exatamente a prova que estes arquivos existem para dar. Regerar só se
> justifica se a referência congelada mudar — e aí o commit em `manifest.json`
> deixa de bater com o `HEAD` de `~/comercialAPP`, que é como se detecta.

---

## 2. Oráculo de permissão — a matriz

```bash
npm --prefix backend test
```

**Esperado**: a matriz completa de `contracts/api-contracts.md` verde — 3 papéis ×
2 entidades × (criar, ler, editar, finalizar), mais os documentos.

**O caso que mais importa**: `seller` A pedindo a **listagem** enquanto existe
registro de `seller` B. Se a filtragem por autoria estiver só na rota de item e não
no índice, este é o único teste que pega — e é o vazamento mais provável.

**O segundo**: `viewer` pedindo o documento `COMERCIAL`. Tem de ser **403 na rota**,
não botão escondido.

---

## 3. Oráculo visual — paridade lado a lado

Referência de um lado, módulo novo do outro, percorrendo
`contracts/baseline/roteiro.md`.

| Passo | Onde |
|---|---|
| Menu de entrada → levantar custos | `/comercial` |
| As 5 seções e a cadeia do rodapé | `/comercial/custos` |
| As 7 etapas e a trava por etapa | `/comercial/propostas` |
| Finalização em 4 estágios | idem |
| Histórico | `/comercial/historico` |

**Critério**: cada divergência é classificada como **defeito** ou como um dos **9
desvios aprovados**. Divergência não listada é defeito, não escolha. O checklist de
paridade precisa estar 100% marcado — é item da Definição de Pronto, não conferência
informal.

Comparar as capturas de `contracts/baseline/*-1440.png` com as mesmas telas no
módulo. **Diferença esperada e aceita**: a fonte do chrome (desvio nº 5) e o reflow
que ela causa. A prévia do documento mantém Arial/Helvetica e **não tem desculpa
para divergir**.

---

## 4. Os comportamentos que a referência não tem (L1–L7)

Não estão na baseline — não há do que ser fiel. Conferir na tela:

| Lacuna | Como validar |
|---|---|
| **L1** | Salvar levantamento com campo obrigatório vazio → **cada** campo pendente em vermelho com mensagem, e o banner-resumo permanece |
| **L1** | Abrir um levantamento novo → nenhum campo começa vermelho; obrigatórios têm `*` vermelho e opcionais não; custos exibem máscara `R$` e números zerados aceitam a primeira digitação sem formar `01` |
| **L1** | Digitar e-mail inválido na etapa 1 → mensagem diz **"E-mail inválido"**, não "Campo obrigatório". Idem CNPJ |
| **L2** | Arrastar item de escopo pela alça → fantasma + espaço no destino; cancelar restaura; **as setas ↑/↓ continuam funcionando** |
| **L2** | Repetir em tela sensível ao toque |
| **L3** | F5 no meio do levantamento → volta no mesmo modo/base/seção, e o rascunho não salvo é **oferecido**, não restaurado em silêncio |
| **L3** | Avançar no levantamento → o rascunho incompleto é persistido na conta, o endereço ganha `id` e o início da nova seção volta à área visível; F5 nesse endereço recarrega o mesmo rascunho |
| **L3** | Avançar na proposta → o início da nova etapa volta à área visível |
| **L3** | Fechar a aba com alteração pendente → aviso do navegador. Vale para as duas telas |
| **L4** | Primeiro acesso → tutorial aparece; segundo acesso → não reaparece sozinho, mas é rechamável |
| **L5** | Login com campo vazio → estado de campo inválido, não só erro global |
| **L6** | Nenhum `--com-*` vazando para fora da raiz do módulo, e nenhum token global redefinido |
| **L7** | As 4 telas em 390 px → **zero** rolagem horizontal de página |

**L7 merece atenção nos dois pontos de estouro conhecidos**: a faixa de 7 indicadores
de custo e a tira de 5 seções.

---

## 5. Portões de CI

```bash
npm run architecture:check
npm --prefix frontend run lint
npm --prefix backend test
npm --prefix frontend test
```

Mais o cruzamento que pega o que sumiu em silêncio:

```
/speckit-analyze
```

**Nenhum item do inventário de UI pode ficar órfão** — sem tarefa que o cubra. É o
único mecanismo que pega campo perdido na reescrita, porque **ausência de campo não
gera erro: só some**.

---

## 6. Definição de pronto

- [ ] 16/16 goldens dígito a dígito
- [ ] Matriz de permissão verde, incluindo listagem cruzada entre dois `seller`
- [ ] 616 controles e 916 textos presentes, conferidos item a item
- [ ] Zero divergências fora dos 17 desvios
- [ ] Zero rolagem horizontal de página em 390 px nas 4 telas
- [ ] L1 a L7 validadas na tela
- [ ] `/speckit-analyze` sem item de inventário descoberto
- [ ] CSS do módulo escopado: nenhum vazamento nos dois sentidos
- [ ] Nenhum comando de servidor executado por agente — só documentado para o operador
