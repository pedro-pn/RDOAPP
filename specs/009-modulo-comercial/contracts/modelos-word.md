# Os modelos Word e o gerador de documentos

> **Decidido em 05/08.** Onde o texto fixo diverge, **o `.docx` vence** — virou o
> desvio 12. Hidrojateamento vira **modelo próprio, escolhido na criação** —
> desvio 13. Entram junto: prazo de integração, bloco de stand-by e categoria na
> matriz (T071a–T071f). **Ficam de fora, conscientemente:** os três serviços do
> catálogo e os quatro códigos de relatório da seção "Divergências", item 2 e 3.
> A tensão é que o texto do Word vence mas essas seções dele não terão como ser
> selecionadas, e hidrojateamento e passagem de PIG sairão sem citar o RH e o
> RTPP que o documento promete. É pendência registrada, não esquecimento.

Fonte: `Modelos/definitivos/Comercial/` — quatro `.docx` entregues em 05/08/2026.

| Arquivo | O que é | Estado |
|---|---|---|
| `Proposta Comercial - Preenchida.docx` | Comercial padrão (qualquer serviço) | Cabeçalho preenchido, **tabela de preços vazia** (5 linhas em branco) |
| `Proposta técnica - Preenchida.docx` | Técnica padrão (qualquer serviço) | Cabeçalho preenchido, escopo técnico com lacunas (`em aproximadamente ___ litros`) |
| `Proposta comercial hidrojateamento - preenchido.docx` | Comercial de hidrojateamento | Preenchido de verdade — duas tabelas de preço (ONSHORE e OFFSHORE) e 14 comentários do Aliander |
| `Proposta técnica hidrojateamento - Modelo.docx` | Técnica de hidrojateamento | Cabeçalho preenchido, dois comentários do Aliander |

## Achado que muda o enquadramento da tarefa

**Estes `.docx` não são consumidos por nenhum código — nem na referência, nem no
plano do porte.** O `comercialAPP` gera o PDF programaticamente em
`app/proposal-pdf.ts` (908 linhas, jsPDF), e a T072 já prevê portar esse arquivo
para `pdf-lib` no backend. Não existe mail-merge em runtime.

A prova de que os dois lados são a mesma coisa é o índice. O `TECHNICAL_INDEX` do
`proposal-pdf.ts` e o ÍNDICE da proposta técnica Word são idênticos, palavra por
palavra, nos dez itens. O mesmo vale para os treze itens do comercial. Os `.docx`
são **a origem editorial** do gerador, não uma entrada dele.

Consequência prática: **um modelo em branco não serve de insumo para o código.**
O que o gerador precisa dos documentos é o *texto fixo* e a *estrutura das
seções* — e isso já está extraído abaixo. Se você quiser o `.docx` em branco
mesmo assim, para uso humano (revisão jurídica, envio a quem não usa o app), eu
gero; só não é o caminho para a próxima etapa.

## Mapa dos MERGEFIELDs → campos do app

Os quatro documentos usam o mesmo conjunto. Comercial tem 23; técnica tem 15
(não tem os 8 de dinheiro e pagamento).

### Cabeçalho — cobertura total

| MERGEFIELD | Rótulo no documento | Campo do app | Coluna |
|---|---|---|---|
| `nome_vendedor` | Consultor de Vendas | `form.seller` | `Proposal.sellerName` |
| `elaborador_proposta` | Orçamentista | `form.estimator` | `Proposal.estimatorName` |
| `cod_prop` | PROPOSTA N° | `form.proposal` | `Proposal.proposalCode` |
| `n_rev` | REV - | revisão | `Proposal.revisionNumber` |
| `nome_cliente` | CLIENTE | `form.client` | `Proposal.clientName` |
| `contato_cliente` | A/C | `form.contact` | `Proposal.contact` |
| `email_cliente` | E-mail do solicitante | `form.email` | `Proposal.email` |
| `dpto_solicitante` | Departamento | `form.department` | `Proposal.department` |
| `local_obra` | Local da obra | `form.site` | `Proposal.site` |
| `cnpj_texto` | CNPJ | `form.cnpj` | `Proposal.cnpj` |
| — (cabeçalho da página) | data por extenso | `form.date` | — |

Onze de onze. Nada falta aqui.

### Prazos (item 5) — falta um

| MERGEFIELD | Rótulo | Campo do app |
|---|---|---|
| `prev_atende` | Previsão de atendimento | `attendance` |
| `n_dias` | Permanência em obra (dias corridos) | `permanence` |
| `dias_treinamento` | **Prazo previsto para integração** | **nenhum** |
| `n_dias_trabalhados` | Execução (dias úteis) | `execution` |
| `dias_mob` | Deslocamento mob/desmob | `mobilization` |

`dias_treinamento` não existe no formulário, nem no `cost-model.ts`. É uma linha
que sai impressa no documento e hoje não teria de onde vir.

### Pagamento (item 8) — existe como texto livre, não como campo

`adto` (% antecipado na mobilização), `prazo_pgto` (dias) e `forma_pgto`
(Depósito em conta) são três variáveis dentro de um parágrafo que, no app, é o
campo livre `payment`.

E o `DEFAULT_PAYMENT` da referência **não é o texto do documento**. A referência
diz "Nota Fiscal emitida na entrega, pagamento em até 7 dias corridos". O Word
diz "35% antecipado na confirmação + medição quinzenal com 21 dias". Só a parte
de multa e juros coincide.

### Observações (item 9) — bloco inteiro ausente

Quatro MERGEFIELDs de dinheiro e a tabela que os exibe não têm equivalente
nenhum no app:

| MERGEFIELD | Onde aparece |
|---|---|
| `valor_he` | "Valor homem/hora para atividades fora do horário previsto é de R$ 250,00" |
| `valor_standby` | tabela "Stand-by de Equipe" — R$ 11.250,00 |
| `diaria_equipamento` | tabela "Stand-by de Equipamentos" — R$ 5.000,00 |
| `valor_desmob_extra` | tabela "Mobilização Extra (por evento ida e volta)" — R$ 21.900,00 |

A tabela de três linhas "Condições de Stand by e Mobilização Adicional" não é
gerada em lugar nenhum hoje.

## Divergências estruturais entre os documentos e o gerador

### 1. Matriz de responsabilidade

O Word agrupa as linhas sob subtítulos que ocupam a largura da tabela:
MÃO DE OBRA E EQUIPE TÉCNICA, EQUIPAMENTOS E FERRAMENTAS, MATERIAIS E
CONSUMÍVEIS E UTILIDADES, LOGÍSTICA, SEGURANÇA/DOCUMENTAÇÃO, UTILIDADES,
ACESSIBILIDADE E APOIO DE CAMPO, MEIO AMBIENTE.

O tipo `Row` da referência é `{ item, owner, note }` — **não tem categoria**, e o
`renderResponsibilityGroup` desenha uma tabela plana.

Pior: o `initialRows` da referência traz 17 linhas de **caldeiraria e solda**
("Qualificação de soldadores", "inspetor de solda", "máquinas de solda,
esmerilhadeira, retífica e talha"). Nenhuma delas aparece nos documentos Word,
que trazem ~15 linhas Filtrovali e ~20 do Contratante, de outro assunto.

### 2. Catálogo técnico — três serviços a menos

O catálogo tem 11 (`technical-services.ts`). Os documentos descrevem três que
não estão nele:

- **Flushing com água** (método distinto do primário e do secundário)
- **Remoção de verniz** (critério `<15 MCP`, filtros online)
- **Boroscopia**

E os textos que estão em ambos não coincidem: a limpeza química do Word tem
Objetivo + Métodos + sete etapas nomeadas (enxágue prévio, desengraxe, fase
ácida, neutralização, passivação, secagem, inspeção); a do catálogo são três
parágrafos que resumem isso.

### 3. Relatórios — quatro códigos a menos

`TechnicalReportCode` cobre RCPU, RTP, RLR, RLQ. Os documentos citam ainda:

| Código | Serviço | No app |
|---|---|---|
| RIB | Boroscopia | serviço nem existe |
| RTPP | Passagem de PIG | `reportCode: null` |
| RH | Hidrojateamento | `reportCode: null` |
| RFA | Flushing com água | serviço nem existe |

### 4. Hidrojateamento não é só "um serviço a mais"

Na referência, `hidrojateamento` é um dos 11 itens do catálogo — muda o texto do
escopo técnico e as imagens, nada mais. Os documentos Word de hidrojateamento
divergem do padrão em **cinco lugares**, não em um:

1. **Descrição dos serviços** — outro texto (tanque, tubulação, superfície
   metálica, caldeira; e a regra "em tubulações, máximo 20k — 40k é proibido").
2. **Matriz Filtrovali** — traz o efetivo por configuração (1 bico / 2 bicos ×
   ONSHORE / OFFSHORE, com hidrojatista, operador, anjo, assistente, vigia) e a
   lista de equipamentos por configuração (Power box, pistola penta 40k/pefal
   22k, mangueiras 8/8 e 5/6, destorcedor, bico safira, radial, "T", Dagger,
   Gladios, Scimitar, Tubo jet).
3. **EPI** — lista separada para com e sem espaço confinado.
4. **Jornada** — dois turnos: ONSHORE (seg–qui 9h, sex 8h) e OFFSHORE
   (seg–dom e feriados, 11h).
5. **Descrição de valores** — **duas tabelas de preço**, uma ONSHORE e uma
   OFFSHORE, cada uma com seu TOTAL GERAL. O gerador tem uma só.

### 5. Coluna de valor unitário — este bate

`ITEM | DESCRIÇÃO | VALOR UNIT. | QTD. | VALOR TOTAL` + linha TOTAL GERAL é
exatamente o que `renderPriceTable` desenha com `includeUnitValue = true`. E é
coerente que o comercial padrão esteja com a coluna vazia e o de hidrojateamento
preenchida: o toggle existe justamente para isso.

## Comentários do Aliander (regras de negócio embutidas)

Os `.docx` de hidrojateamento carregam 14 comentários que são regra, não recado:

- **#2, #3** — efetivo e configuração de equipamento "deverão ser definidos em
  reunião de acordo com a demanda", e o que for definido **permanece na
  proposta**. Ou seja: é campo editável por proposta, não texto fixo.
- **#4, #5** — os preços de equipe estão com **30% de margem**; na negociação a
  diária do hidrojato pode cair até R$ 4.000,00 e a da equipe até 20%.
- **#6, #7, #12** — **o preço de frete é só ida.** Considerar um frete para ir e
  outro para voltar, independentemente de o equipamento esperar em obra ou não.
- **#8 a #11, #13 a #15** — mobilização/desmobilização "calcular de acordo com a
  distância e premissas da contratante" (as linhas em R$/km).

O comentário #6 é o mais operacional: a tabela de preços do hidro tem linha
separada para mobilização e para desmobilização, cada uma com o mesmo valor
unitário por km. Isso é uma regra de composição, e hoje o app não a expressa.

## Erros de digitação nos documentos (não replicar sem confirmar)

- "remoção de **rezina**" → resina
- "**Descarregametno**" → Descarregamento
- "**Instaçãoes** e testes" → Instalações
- "hidrojatemento" (duas ocorrências) → hidrojateamento
- Proposta técnica padrão, item 8: a linha do **RFA aparece duplicada**
- Comercial hidro, tabela ONSHORE: seis linhas de "Evento de **des**mobilização
  de equipe" e só uma de mobilização — pelas notas #7/#12, três delas deveriam
  ser "mobilização"
- Técnica padrão usa **PGR**; comercial hidro e técnica hidro ainda usam **PPRA**
  (a norma antiga). Os dois textos convivem hoje.
