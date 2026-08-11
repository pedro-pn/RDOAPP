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

## As opções

### 1. OpenRouteService — *recomendada*

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

### 2. Google Distance Matrix / Routes

O mais preciso para rota rodoviária no Brasil, e o que o pessoal já confere no
celular.

- **Custo:** cobrado por elemento (origem × destino). As fontes de 2026
  divergem sobre o crédito mensal — [uma diz](https://mapatlas.eu/blog/google-maps-api-pricing-2026)
  que o crédito universal de US$ 200 foi **descontinuado**, outras ainda o
  mencionam. **Não confirmei**, e não vou afirmar. No volume previsto, a conta
  seria de poucos dólares/mês mesmo sem crédito.
- **Cadastro:** conta no Google Cloud **com faturamento e cartão**. É a maior
  diferença prática: é uma conta paga da empresa para um campo de formulário.
- **Atenção:** o Google marcou a Distance Matrix como **legada** e recomenda a
  Routes API para projetos novos — então o porte já nasceria numa API em fim de
  vida.

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

## Recomendação

**OpenRouteService**, com quatro condições que valem para qualquer fornecedor
escolhido:

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

## O que não foi confirmado

- O estado atual do crédito mensal do Google: as fontes de 2026 divergem, e a
  página oficial de preços não foi consultada com conta logada.
- A qualidade da geocodificação do ORS para **endereços industriais brasileiros**
  do tipo "Unidade de Cubatão". Isso só se sabe testando com os endereços reais
  que o comercial usa — e é o primeiro passo antes de escrever o adaptador.
