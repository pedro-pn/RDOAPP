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

## Implementado — `backend/src/lib/comercial/distancias.js`

Rodado contra a API real em 11/08, com a chave da empresa:

| Digitado | Resultado | Confiança | Aviso |
|---|---|---|---|
| `UHE São Manoel` | **2.706 km** | `exata` | — |
| `Unidade de Cubatão` | 595 km | `parcial` | "Não achei exatamente o que foi digitado. Usei *Cubatão, SP*" |
| `Cubatão` | 595 km | `regiao` | "Achei apenas a cidade… A distância é até o centro dela" |
| `nao existe zzz 999` | *sem número* | `nenhuma` | "Não encontrei… Confira o endereço ou informe a distância" |

O `partial_match` da Geocoding é o sinal que a Routes não dá — e é o que separa
"não achei o que você pediu" de "achei a cidade, que era o que você pediu".

**O adaptador nunca lança.** Endereço ruim, serviço fora do ar, chave sem
permissão e cota estourada são a mesma coisa para quem está na tela: o campo
continua editável e a pessoa digita. Um erro subindo dali faria a tela parecer
quebrada com o trabalho podendo seguir. O motivo técnico vai no `aviso` —
quem lê "chave não autorizada" sabe a quem avisar; "não consegui calcular" não
diz nada.

## Uma proteção que o tier gratuito torna necessária

Franquia gratuita generosa esconde um risco novo: **um defeito que dispare
chamadas em laço passa dos 10.000 sem ninguém notar**, e aí começa a custar. Duas
medidas baratas, na implementação:

- **cota de segurança no adaptador** — um teto de chamadas por dia, recusando
  além dele com o caminho de digitar;
- **restringir a chave de API** no console do Google, por API e por IP do
  servidor. Chave sem restrição que vaze é conta de outra pessoa gastando a
  franquia da empresa.

## A origem saiu do `.env` — 12/08/2026 (T131)

O endereço da sede era `COMERCIAL_SEDE_ENDERECO`. **A variável deixou de
existir**, e o endereço passou a ser configuração do módulo: uma linha em
`comercial.ComercialSettings`, editável por gestor em `/comercial/configuracoes`.

Decisão do mantenedor, e a razão é o ciclo de vida do dado: endereço de sede é
dado de negócio. Muda quando a empresa muda de prédio, quem sabe o endereço novo
é o gestor, e até aqui trocá-lo exigia editar arquivo no servidor e reiniciar o
container.

Três consequências que valem registro, porque cada uma foi um defeito evitado:

1. **A sede é geocodificada na hora de salvar, e o `placeId` fica gravado.** É o
   mesmo cuidado que o destino já tinha, agora na origem: com texto, a Routes
   reinterpreta o endereço a cada cálculo. Um "Unidade de Cubatão" do lado da
   origem seria pior que do lado do destino — ninguém confere a origem, porque a
   tela mostra o destino.

2. **Não conseguir localizar não impede de salvar.** `GOOGLE_MAPS_MODE=off` é o
   padrão do ambiente; exigir o `placeId` deixaria a tela de configuração inútil
   na instalação mais comum. Sem ele, a rota usa o texto — que é como funcionava
   antes.

3. **A chave do cache de distâncias passou a incluir a sede.** Com a chave só do
   destino, mudar a sede deixaria o cache respondendo a distância do prédio
   antigo, em silêncio e só nos processos que já tinham a resposta guardada.
   Invalidar ao salvar resolveria em um processo; a chave composta resolve em
   todos, sem ninguém precisar lembrar de chamar nada.

O campo em branco continua sendo estado normal: sem sede configurada, o cálculo
responde `km: null` e diz onde configurar — e a distância continua digitada, que
é o caminho de sempre.

## Sugestões enquanto se digita — 12/08/2026 (T134)

Pedido do mantenedor depois de configurar a sede à mão: o campo não sugeria nada,
e quem digita não tem como saber se escreveu o endereço de um jeito que o Google
reconhece.

Resolvido com **Places Autocomplete (New)**, `POST
https://places.googleapis.com/v1/places:autocomplete`. **Exige a `Places API
(New)` habilitada no console** — é outra API, não vem junto com a Geocoding nem
com a Routes, e sem ela a resposta vem com erro (que o adaptador transforma em
aviso na tela, não em tela quebrada).

### O custo, verificado antes de escrever

`Autocomplete Requests` é SKU **Essentials**: 10.000 chamadas grátis por mês,
contadas à parte das outras duas.

**Não usamos token de sessão, e é decisão.** O modelo de sessão do Google cobra
normalmente as **12 primeiras** requisições e só isenta da 13ª em diante — e
apenas se a sessão *fechar* numa chamada de Place Details. Aqui a escolha não
termina em Place Details: a sugestão **já traz** `placeId` e o endereço
formatado, que é tudo o que a sede precisa. Abrir uma sessão sem fechá-la
reverteria para cobrança por requisição de qualquer forma — exatamente onde já
estamos, com uma peça a mais para manter.

Como efeito colateral, escolher da lista **economiza** uma chamada de Geocoding
na hora de salvar: o `placeId` já veio resolvido, e `salvarSede` não regeocodifica.

### O que de fato segura o consumo

Autocompletar é o caso em que uma tela dispara uma chamada **por tecla digitada**.
Sem freio, "Rua Rosa Orsi Dalçoquio, 930" são 28 chamadas em vez de 3 ou 4.

| Freio | Onde | Por quê |
|---|---|---|
| Mínimo de 4 caracteres | adaptador **e** campo | abaixo disso a resposta é meia cidade |
| Espera de 350 ms sem digitar | campo | é o que corta 28 chamadas para 3 |
| Resposta atrasada é descartada | campo | senão a lista de "Rua" chega depois da de "Rua Rosa" e sobrescreve a certa |
| Cota diária **própria**, 300/dia | adaptador | somada à da distância, o autocompletar comeria em três endereços a franquia que o cálculo usa o dia inteiro |
| Máscara de campos na requisição | adaptador | campo a mais na resposta pode subir o SKU da chamada |

### Por que passa pelo servidor

A chave do Google é restrita por **IP do servidor**. Deixar o navegador falar
direto com o Google exigiria uma segunda chave, restrita por origem — pública por
natureza, visível a qualquer um que abra a aba de rede, e fora do alcance da cota
diária. O salto a mais custa alguns milissegundos num campo que já espera 350 ms.

### A lista sugere, não obriga

Digitar o endereço inteiro à mão continua valendo, e aí o servidor geocodifica na
hora de salvar, como antes. É o que mantém a tela utilizável com a Places
desabilitada, com a cota do dia estourada ou com o Maps em `off` — que é o padrão
do ambiente.
