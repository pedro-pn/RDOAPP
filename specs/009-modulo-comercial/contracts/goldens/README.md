# Goldens do motor de custos — módulo comercial

Arquivos de referência da etapa **E0-5** do `docs/PLANO_MODULO_COMERCIAL.md`.

São o **oráculo numérico do porte**: a implementação em `shared/comercial/cost-model.ts`
(etapa E2) tem de reproduzir estes valores dígito a dígito. Divergência aqui significa
proposta com preço errado, que é o risco de maior severidade do projeto (§7 do plano) —
porque ninguém percebe: o número sai, só sai errado.

## Origem

| | |
|---|---|
| Referência | `~/comercialAPP`, congelada em `6f5b072` |
| Entrada | `lib/cost-model.ts` :: `calculateEstimate` e `validateCostEstimate` |
| Cenários | 16 |
| Invariantes | 40 |

O motor da referência é TypeScript puro sem nenhum import, então roda isolado — sem
`pnpm install`, sem build e sem o app de pé. É por isso que esta etapa não depende da
E0-7.

## Regerar

```bash
npx --yes tsx@4.23.1 specs/009-modulo-comercial/contracts/goldens/generate-goldens.mjs
```

`COMERCIAL_REF_DIR` sobrescreve o caminho da referência.

> **Regerar só faz sentido se a referência congelada mudar.** Se o porte divergir do
> golden, o bug é do porte. Regerar para "fazer passar" destrói justamente a prova que
> estes arquivos existem para dar.

O commit da referência fica gravado em `manifest.json`. Se ele não bater com o `HEAD` de
`~/comercialAPP`, os goldens estão desatualizados.

## O que cada arquivo contém

Cada `NN-nome.golden.json` guarda o caso inteiro, não só o resultado:

- `intent` — por que o cenário existe;
- `proves` — as invariantes que ele garante exercitar;
- `payload` — a entrada completa e normalizada;
- `validation` — erros e avisos que o motor levanta para essa entrada;
- `result` — o `CostEstimateResultV2` inteiro.

Guardar o payload junto é o que torna o golden reexecutável: o porte alimenta
`payload` no motor novo e compara com `result`, sem precisar reconstruir o caso.

`validation` também é contrato. As mensagens de erro são texto visível ao usuário e
entram no inventário de UI — o porte tem de reproduzir a mesma mensagem no mesmo campo,
não só o mesmo número.

## Cobertura

| Cenário | Cobre |
|---|---|
| 01 | Estado inicial do formulário. **Único deliberadamente inválido**: fixa a lista de erros que o app cobra antes de deixar salvar |
| 02 | Sede, jornada normal — piso de comparação de 03 a 05 |
| 03 | HE 70 abaixo do teto mensal de 30 h |
| 04 | HE 70 acima do teto → conversão do excedente para 100% |
| 05 | HE 100 por domingo/feriado, sem passar pelo teto |
| 06 | Viagem, com despesas de contexto por dia-calendário e veículo dimensionado |
| 07 | Offshore (escala e jornada próprias) |
| 08 | Volume de tubulação → produto químico dosado por percentual |
| 09 | Mesmo volume, químicos desligados, material avulso no lugar |
| 10 | Mobilização e desmobilização rodoviárias com combustível e pernoite |
| 11 | Escopo sem logística confirmado → mob/desmob zerados |
| 12 | Precificação `filtrovali_net_revenue_v1` (produção) |
| 13 | Precificação `legacy_lec` — o par 12/13 prova os dois denominadores |
| 14 | Preço global imposto pelo comercial, margem recalculada por diferença |
| 15 | Comissão de representante com gross-up + bônus de indicação |
| 16 | "Sem insumos" confirmado **zera o volume inteiro**, mesmo com tubo no payload |

As três condições de trabalho, os dois modelos de precificação e os dois buckets de hora
extra exigidos pelo plano estão cobertos.

## Armadilhas que estes goldens fixaram

Coisas que o motor faz e que não estão em documentação nenhuma — cada uma custou uma
rodada de erro de validação para descobrir, e cada uma é candidata a sumir no porte:

1. **`noInputs: true` zera o ramo inteiro de insumos, volume incluído.** Confirmar "sem
   insumos" com uma tubulação preenchida no payload devolve `volumeResults: []` e
   `totalVolumeLiters: 0`. É o cenário 16, e foi o que fez a primeira versão do cenário 09
   virar cópia silenciosa do 02.
2. **Dois transportes na mesma fase exigem seleção manual de viajante nos dois.** No modo
   automático o motor recusa (`erro`, não aviso), porque não teria como evitar contar a
   mesma pessoa no carro e no caminhão.
3. **A escala offshore tem teto de 21 dias consecutivos.**
4. **`calculationMode` inválido é normalizado para `""` em silêncio**, e o item de
   logística passa a custar zero sem erro nenhum. Foi assim que a primeira versão do
   cenário 10 saiu numericamente idêntica ao 08.

## Invariantes

Cada cenário declara em `proves` o que precisa exercitar, e o gerador **falha com código
1** se alguma invariante deixar de valer. Sem isso um cenário pode virar peso morto: passa
no porte sem provar nada. Foi essa trava que pegou o item 1 e o item 4 acima.
