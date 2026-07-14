# Motor de Calculo - Impostos de Servicos

Este documento descreve o motor de simulacao de impostos usado no modulo
Acompanhamento de Projetos.

## Objetivo

Mostrar no acompanhamento a contribuicao tributaria de cada projeto a partir do
valor que sera faturado, usando a mesma logica da planilha comercial:

```text
c:/Users/relat/Downloads/IMPOSTO - PARA SERVICOS.xlsx
```

O motor tem duas fases:

1. Antes do faturamento: usa a venda prevista do comercial.
2. Depois do faturamento no Omie: usa o valor real das contas a receber/NF.

## Separacao principal

Nem todo imposto da planilha vira custo adicional no acompanhamento.

Impostos previstos na NF:

- ISS;
- PIS;
- COFINS.

Eles continuam sendo calculados para previsao e conferencia com o Omie, mas nao
sao somados como custo extra fora da nota.

Impostos fora da NF:

- IRPJ basico;
- CSLL;
- adicional de IRPJ.

Esses sao os valores somados gerencialmente ao projeto como `IRPJ/CSLL fora da
NF`, porque aparecem como guias gerais/trimestrais e nao como imposto destacado
na NF do projeto.

## Onde o calculo entra

Motor:

- `backend/src/lib/acompanhamento/presumed-profit-taxes.js`

Dados de acompanhamento:

- `backend/src/lib/acompanhamento/access-import.js`
- `backend/src/lib/acompanhamento/project-cards.js`
- `backend/src/lib/acompanhamento/project-detail.js`

Sincronizacao Omie:

- `backend/src/lib/omie/sync.js`
- `backend/scripts/omie-sync.js`

Banco:

- `OmieReceivable`: contas a receber/faturamento real por projeto.

Frontend:

- cards da aba Projetos: `IRPJ/CSLL fora da NF`;
- detalhe do projeto: gastos do projeto em um bloco e impostos em um bloco
  retratil separado;
- quando ha NF sincronizada, a tela mostra o faturamento real e o ISS real do
  Omie, sem mostrar previsoes de ISS/PIS/COFINS do app;
- quando nao ha NF sincronizada, a tela mostra a previsao da planilha;
- dashboard: metricas `IRPJ/CSLL fora da NF`, `ISS Omie`, `Impostos NF
  previstos` e `Faturado no Omie`.

## Fonte da base de calculo

O motor escolhe a base nesta ordem:

1. `OmieReceivable.valor`: soma real das contas a receber/NF vinculadas ao
   projeto, quando houver faturamento sincronizado.
2. `ProjectBudget.salePrice`: venda prevista escolhida no acompanhamento.
3. `CommercialProposal.salePrice`: venda prevista da ultima revisao comercial.

O retorno informa a origem em `basisSource`:

- `OMIE_INVOICED`: calculo sobre faturamento real do Omie;
- `EXPECTED_SALE`: calculo sobre venda prevista.

## Sincronizacao do faturamento real

A integracao usa a chamada read-only do Omie:

```text
/financas/contareceber/ - ListarContasReceber
```

Campos principais gravados:

- `codigo_lancamento_omie` -> `OmieReceivable.omieId`;
- `codigo_projeto` -> vinculo com `OmieProject.codigo`;
- `valor_documento` -> valor real faturado/recebivel;
- `valor_iss` -> ISS informado pelo Omie;
- `codigo_tipo_documento`, `numero_documento_fiscal`, datas e status.

O comando manual e:

```bash
npm run omie:sync receitas
```

O job geral `syncOmieAll` tambem passou a sincronizar receitas.

Na validacao local, a sincronizacao leu 1.578 registros e gravou 306 contas a
receber vinculadas a 36 projetos. A soma local gravada ficou em:

```text
Faturamento vinculado: R$ 7.517.214,68
ISS Omie vinculado:    R$   185.090,82
```

## Codigo fiscal da venda

A planilha traz blocos para:

- `14.01`;
- `7.05`.

Por regra informada, `7.02` usa a mesma regra de `7.05`.

O banco comercial importado hoje nao traz o codigo fiscal da venda. O motor
aceita codigo fiscal quando ele aparecer em componentes futuros, mas usa `7.05`
como padrao operacional enquanto esse dado nao estiver disponivel.

## Formula da planilha

O motor usa os blocos `+ 10% Tributacao 2026`.

Aliquotas comuns:

```text
ISS    = 3,00% da base
PIS    = 0,65% da base
COFINS = 3,00% da base
IRPJ   = 15,00% sobre a base presumida de IRPJ
CSLL   = 9,00% sobre a base presumida de CSLL
Adic. IRPJ = 10,00% sobre a base presumida de IRPJ
```

Para `7.05` e `7.02`:

```text
base IRPJ = base * 8,80%
base CSLL = base * 13,20%

ISS/PIS/COFINS na NF = 6,65%
IRPJ/CSLL fora da NF = 3,388%
Total da planilha    = 10,038%
```

Para `14.01`:

```text
base IRPJ = base * 35,00%
base CSLL = base * 35,00%

ISS/PIS/COFINS na NF = 6,65%
IRPJ/CSLL fora da NF = 11,90%
Total da planilha    = 18,55%
```

## Adicional de IRPJ

A planilha anota que o adicional real tem deducao de R$ 20.000 por mes ou
R$ 60.000 por trimestre. Nas formulas da planilha, porem, o desconto aparece
como `1` ou vazio, entao a simulacao comercial considera o adicional quase
integral.

Para previsao por projeto, o motor segue a planilha. Para fechamento real
trimestral, o correto e recalcular/ratear com base no faturamento total da
empresa no trimestre.

## Campos retornados

O objeto `presumedProfitTaxes` contem:

- `basisSource`: `EXPECTED_SALE` ou `OMIE_INVOICED`;
- `basisAmount`: valor usado no calculo;
- `expectedSalePrice`: venda prevista;
- `invoicedAmount`: faturamento real Omie, se houver;
- `serviceTaxCode`: `14.01`, `7.05` ou `7.02`;
- `invoiceTaxTotal`: ISS + PIS + COFINS previstos na NF;
- `iss`, `pis`, `cofins`: previsao por imposto;
- `omieIss`: ISS vindo do Omie, quando houver;
- `issDelta`: diferenca entre ISS Omie e ISS previsto;
- `irpjBasic`, `csll`, `additionalIrpjEstimated`;
- `outOfInvoiceTaxTotal`: IRPJ + CSLL + adicional, valor que entra como custo
  gerencial fora da NF;
- `estimatedProjectTaxCost`: alias de `outOfInvoiceTaxTotal`;
- `totalTax`/`probableTotal`: total completo da planilha, incluindo impostos
  previstos na NF;
- `netAfterOutOfInvoiceTaxes`: base menos IRPJ/CSLL fora da NF, apenas para
  analise interna. Nao e novo preco de venda;
- `netAfterTaxes`: base menos todos os impostos da planilha, apenas para
  analise interna. Nao e novo preco de venda.

O cliente paga a venda prevista ou o valor real faturado no Omie. IRPJ/CSLL
fora da NF e um custo da empresa calculado sobre essa receita, nao um acrescimo
ao faturamento do projeto.

## Prova real com Omie

A prova real possivel hoje e comparar os impostos que a NF traz explicitamente
no Omie. Pela chamada `ListarContasReceber`, o campo destacado disponivel na
amostra foi `valor_iss`.

Validacao local feita com NFs sincronizadas:

```text
Projetos com NFS vinculada: 29
NFs avaliadas:              99
Faturamento Omie:           R$ 7.164.491,94
ISS Omie:                   R$   185.090,82
ISS pela planilha (3%):     R$   214.934,76
Diferenca:                  R$   -29.843,94
Projetos que batem +/- R$1: 5
```

Conclusao: a base de faturamento real do Omie pode ser usada, inclusive em
projetos faturados em varias parcelas. Mas o ISS fixo de 3% da planilha nao
bate com todos os projetos no Omie; ha NFs com aliquotas efetivas como 0%, 1%,
2%, 3,3% e 5%. Por isso, quando ha NF sincronizada, a tela mostra o ISS real do
Omie e nao a previsao de ISS/PIS/COFINS feita pelo app.

PIS e COFINS nao vieram destacados em `ListarContasReceber` na amostra
consultada. Para provar esses valores contra o Omie, precisamos de outra fonte
do Omie que traga esses impostos por NF ou por apuracao.

## Cruzamento com contas a pagar

As categorias reais de impostos pagos no Omie continuam sendo contas a pagar:

```text
2.06.03 PIS
2.06.04 COFINS
2.06.05 IRPJ
2.06.06 Contribuicao Social
2.06.07 ISS
```

IRPJ e Contribuicao Social aparecem vinculados ao projeto `5000 - Filtrovali`,
ou seja, como guias gerais/administrativas. Por isso eles nao sao rastreaveis
diretamente ao projeto operacional pelo contas a pagar.

O caminho realista e:

1. Usar `OmieReceivable` para obter o faturamento real por projeto e trimestre.
2. Calcular a base presumida por projeto.
3. Somar a base presumida no trimestre da empresa.
4. Aplicar a regra real do adicional de IRPJ no trimestre.
5. Ratear IRPJ/CSLL pagos (`2.06.05` e `2.06.06`) entre os projetos pelo
   faturamento/base presumida.

## Informacoes para confirmar

Confirmar com financeiro/contabilidade:

1. Se o padrao sem codigo fiscal deve ser `7.05`.
2. Se `7.02` deve continuar usando exatamente a regra de `7.05`.
3. Como identificar `14.01`, `7.05` e `7.02` no Omie ou no comercial.
4. Se a base real deve considerar todas as contas a receber com NFS/documento
   fiscal ou apenas status especificos.
5. Se o trimestre real deve usar emissao, competencia, vencimento ou baixa.
6. Se `2.06.06 - Contribuicao Social` e sempre CSLL.
7. Se o adicional de IRPJ no acompanhamento deve seguir sempre a planilha ou
   deve ser recalculado com o limite trimestral quando houver fechamento real.
8. Se PIS/COFINS devem ser conferidos por outro relatorio Omie, ja que
   `ListarContasReceber` trouxe `valor_iss`, mas nao trouxe valores destacados
   de PIS/COFINS na amostra.
