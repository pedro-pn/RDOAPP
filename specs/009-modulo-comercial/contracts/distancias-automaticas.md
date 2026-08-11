# Cálculo automático de distâncias — opções

**Tarefa T126** · levantamento pedido pelo mantenedor em 11/08/2026, antes de
escrever código. Sugestão de um colaborador do comercial: *"calcular distâncias
automaticamente"*, sobre o campo **Distância sede → obra (km)**.

---

## Antes de escolher fornecedor: o que exatamente seria calculado

O módulo tem **três** campos de distância, e eles não têm o mesmo problema:

| Campo | Onde | Dá para calcular? |
|---|---|---|
| `oneWayDistanceKm` — sede → obra | destinos da logística | **Sim.** Origem fixa (Itajaí) e destino com endereço digitado. É o da sugestão. |
| `distanceKmPerVehicle` — km por veículo/viagem | item de deslocamento | **Em parte.** Costuma ser a mesma distância do destino, mas pode divergir (rota de caminhão, desvio por carga). |
| `hotelSiteDistanceKmPerDay` — hotel ↔ obra | fase de mão de obra | **Não.** O hotel não é escolhido no levantamento; hoje o padrão é 50 km. |

Ou seja: o alvo real é **um** campo, e o segundo pode herdar dele com confirmação.

**A distância continua editável em qualquer cenário.** O número calculado é
sugestão, não verdade: a equipe pode ir por outra rota, e a premissa da
contratante às vezes manda usar uma distância contratual. Substituir o campo por
um valor travado trocaria um problema pequeno por um irreversível.

## Volume esperado

Poucos destinos por levantamento, poucos levantamentos por dia. A estimativa
honesta é de **dezenas de consultas por dia**, não milhares — e com cache por
endereço, menos ainda. **Isso muda tudo na comparação abaixo**: o que seria
decisivo em escala (preço por mil chamadas) aqui é quase irrelevante, e o que
pesa é a burocracia de cadastro e a dependência criada.

---

## DECISÃO — 11/08/2026: Google Routes API

O mantenedor apontou um tier gratuito de 10.000 chamadas, e **está confirmado na
fonte oficial**. Isso derruba a objeção de custo que sustentava a recomendação
anterior, e a decisão passa a ser o Google.

Desde **1º/03/2025** o Google [substituiu o crédito de US$ 200](https://developers.google.com/maps/billing-and-pricing/march-2025)
por uma **franquia mensal gratuita por SKU**, e não por conta:

| Tier | Grátis/mês por SKU |
|---|---|
| **Essentials** | **10.000** |
| Pro | 5.000 |
| Enterprise | 1.000 |

Os SKUs que interessam estão todos em **Essentials**, a US$ 5,00/1000 **depois**
dos 10.000 ([lista de preços](https://developers.google.com/maps/billing-and-pricing/pricing)):

- `Routes: Compute Routes Essentials` (9EFF-679A-9B16) — **o que o adaptador usa**
- `Routes: Compute Route Matrix Essentials` (9392-1087-2045)
- `Geocoding` — franquia própria de 10.000/mês

### APIs a habilitar no console

| API | Habilitar? | Por quê |
|---|---|---|
| **Routes API** | **sim** | calcula a distância e resolve o endereço sozinha |
| **Geocoding API** | **sim** | mostrar ao usuário **qual endereço foi encontrado**, para ele confirmar. A Routes devolve `placeId` e `type`, mas **não o endereço formatado** |
| Places API | **não** | resolveria nome de estabelecimento — mas a Routes já resolve. E o SKU de busca é **Pro** (5.000 grátis), não Essentials |

**No volume previsto — dezenas por dia, centenas por mês — o custo é zero**, com
uma ordem de grandeza de folga. Só passaria a custar se o uso decuplicasse.

### Duas correções ao que eu havia escrito

1. **A Distance Matrix API é legada**, e continua sendo. Mas o substituto não é
   outro fornecedor: é a **Routes API**, com o SKU `Compute Route Matrix`, mesmo
   preço e mesma franquia. É por ela que o adaptador deve entrar — a legada
   funciona e não recebe desenvolvimento novo.
2. **A franquia é por SKU.** Se o adaptador usar geocodificação e matriz como
   chamadas separadas, são duas franquias de 10.000 — melhor ainda. Vale
   confirmar na implementação se a Routes API aceita **endereço direto** no
   waypoint, o que resolveria tudo num SKU só.

**O que continua valendo do levantamento:** a conta do Google Cloud precisa de
**faturamento habilitado**, com meio de pagamento cadastrado, mesmo para usar só
a franquia gratuita. É a única fricção que sobra, e é de cadastro, não de custo.

---

## As opções avaliadas

### 1. OpenRouteService — *era a recomendação, antes da confirmação acima*

Faixa gratuita de **2.500 requisições/dia** e 40.000/mês, cobrindo os endpoints
que interessam: **geocodificação** (endereço → coordenada) e **matrix/directions**
(distância rodoviária). Fonte: [restrições](https://openrouteservice.org/restrictions/)
e [planos](https://openrouteservice.org/plans/).

- **Custo:** zero no volume previsto.
- **Cadastro:** conta e chave de API. Sem cartão de crédito.
- **Dados:** OpenStreetMap. Cobertura rodoviária brasileira é boa em rodovia e
  cidade; pode falhar em acesso industrial recém-aberto.
- **Saída:** se um dia não servir, é open source e pode ser **auto-hospedado** —
  a dependência externa é reversível.

### 2. Google Routes API — **escolhida**

O mais preciso para rota rodoviária no Brasil, e o que o pessoal já confere no
celular. Números confirmados no bloco de decisão acima.

- **Custo no volume previsto:** zero.
- **Cadastro:** conta no Google Cloud com faturamento habilitado.
- **Usar `Compute Route Matrix`**, não a Distance Matrix legada.

### 3. OSRM público

Sem chave, sem cadastro, sem custo.

- **Sem SLA e sem garantia de disponibilidade**: o servidor de demonstração pede
  que não seja usado em produção. Descartada por isso, não por qualidade.

### 4. Auto-hospedar (ORS ou OSRM no Docker)

Elimina a dependência externa por completo, e o projeto já roda Docker.

- **Custo real:** o recorte do Brasil no OSM exige memória de sobra para
  pré-processar e servir — bem acima do que a VPS atual reserva para o backend.
  **Desproporcional** para dezenas de consultas por dia.

---

## As quatro condições da implementação

Valiam para qualquer fornecedor, e continuam valendo para o Google:

1. **Adaptador de três modos** (`off` / `fake` / `real`), como Nectar e
   SharePoint. O padrão `off` mantém o comportamento atual — distância digitada —
   e nenhum ambiente sai para a rede sem alguém decidir.
2. **Cache por endereço normalizado.** A mesma obra é orçada várias vezes; sem
   cache, cada revisão gasta consulta e traz o risco de o número mudar entre uma
   e outra sem ninguém mexer no campo.
3. **O campo continua editável, e a origem do valor fica visível** — "calculado"
   ou "informado". Quem confere precisa saber se aquele 320 veio de um serviço ou
   de alguém que conhece o trecho.
4. **Falha não trava o levantamento.** Serviço fora do ar, endereço não
   encontrado ou endereço ambíguo caem no caminho de hoje: digitar. É o mesmo
   contrato de falha da finalização — o trabalho não se perde por causa de uma
   integração.

## Testes com a chave real — 11/08/2026

Feitos com endereços reais fornecidos pelo mantenedor. Origem: **Rua Rosa Orsi
Dalçoquio, 930, Cordeiros, Itajaí - SC**.

| Destino digitado | Resultado | `type` devolvido |
|---|---|---|
| `R. Duzentos e Quatro, 4, Paranaíta - MT` (endereço formal) | **2.706 km** | `street_address` |
| `UHE São Manoel` | **2.706 km** | `establishment`, `point_of_interest` |
| `Usina Hidrelétrica São Manoel, Paranaíta MT` | **2.706 km** | idem, mesmo `placeId` |
| `Cubatão` | 595 km | `locality`, `political` |
| `Unidade de Cubatão` | 595 km | `locality`, `political` |
| `asdkjhasd obra zzz 999` | **0 km** | *(vazio)* |

### O que isso resolve

**A Routes API aceita endereço livre E nome de estabelecimento**, e resolve
sozinha — sem chamada separada de geocodificação. "UHE São Manoel" caiu no mesmo
`placeId` e na mesma distância do endereço formal. **Um SKU só.**

### O que isso revela, e é o achado que importa

**Endereço ambíguo resolve em silêncio, com número plausível.** "Unidade de
Cubatão" **não** achou a unidade: achou a *cidade* de Cubatão, e devolveu 595 km
como se fosse resposta. Ninguém olhando o campo desconfiaria.

O `type` devolvido é o que separa os casos, e sai de graça na mesma chamada:

| `type` | Leitura | Conduta |
|---|---|---|
| `street_address`, `premise` | endereço exato | aceitar |
| `establishment`, `point_of_interest` | lugar nomeado encontrado | aceitar |
| `locality`, `political` | **só a cidade** | **avisar**: "achei apenas a cidade" |
| vazio, ou 0 km | não encontrado | cair no caminho de digitar |

Sem esse tratamento, o cálculo automático troca um campo em branco por um número
errado — que é pior, porque o branco alguém preenche e o número ninguém confere.

## O que ainda não foi confirmado

- Se a Routes API sinaliza correspondência parcial de outra forma além do `type`.
  A `Geocoding` tem `partial_match` explícito; a Routes não devolve equivalente
  no `geocodingResults`.

## Uma proteção que o tier gratuito torna necessária

Franquia gratuita generosa esconde um risco novo: **um defeito que dispare
chamadas em laço passa dos 10.000 sem ninguém notar**, e aí começa a custar. Duas
medidas baratas, na implementação:

- **cota de segurança no adaptador** — um teto de chamadas por dia, recusando
  além dele com o caminho de digitar;
- **restringir a chave de API** no console do Google, por API e por IP do
  servidor. Chave sem restrição que vaze é conta de outra pessoa gastando a
  franquia da empresa.
