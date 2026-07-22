# Quickstart: Validação — Dados Operacionais no Upload Manual

**Feature**: 003-upload-dados-operacionais

## Pré-requisitos

- Ambiente dev rodando (backend + frontend) com banco populado: ao menos 1 projeto ativo,
  2+ colaboradores ativos e 1 usuário gestor.
- Para o cenário de custo (US3): um import de ponto vigente cobrindo o mês do relatório de teste,
  com ponto batido dos colaboradores no dia, e cargos com perfil de custo configurado.
- Contratos e shapes: ver [contracts/manual-upload-api.md](./contracts/manual-upload-api.md) e
  [data-model.md](./data-model.md).

## Testes automatizados

```bash
cd backend && npm test
```

Suítes relevantes: `manual-report-upload.test.js` (novo), `acompanhamento-labor-cost.test.js`
(estendido). Esperado: paridade de minutos com `calculateReportOvertime`, vínculos criados,
upload sem dados idêntico ao comportamento atual, RDO manual entrando no rateio por projeto,
relatório somente serviço com horas entrando no rateio, derivação de horas pela união dos
intervalos dos serviços (sobreposição, virada de dia, precedência da jornada gravada), sem dupla
contagem no dia com RDO + serviço, e relatórios sem nenhuma fonte de horas fora do cálculo.

## Validação manual (fluxo real)

### US1 — Upload com dados operacionais

1. Logar como gestor → módulo Relatórios → "Upload manual".
2. Selecionar projeto, tipo RDO, anexar 1 PDF; abrir "Dados operacionais (opcional)".
3. Informar entrada `07:00`, saída `17:00`, almoço `01:00:00`, selecionar 2 colaboradores; enviar.
4. **Esperado**: relatório criado aprovado; detalhe exibe horários, 9h diurnas trabalhadas e os
   2 colaboradores — no mesmo formato de um RDO normal.

### US1b — Stand-by em RDO manual

1. Repetir o upload manual com tipo RDO e habilitar stand-by.
2. Informar tempo total `02:00:00` e motivo `Aguardando liberação da área`; enviar.
3. **Esperado**: detalhe e estatísticas exibem stand-by no mesmo formato de um RDO criado no app.
4. Tentar habilitar stand-by sem tempo ou sem motivo → **Esperado**: bloqueio com mensagem clara.
5. Fazer upload manual tipo RTP/RLQ e verificar que stand-by não aparece; por API direta, enviar
   `standby.enabled = true` para tipo não-RDO → **Esperado**: 400.

### US2 — Turno noturno

1. Novo upload manual, habilitar turno noturno: início `22:00`, término `05:00`, intervalo
   `01:00:00`, 1 colaborador noturno.
2. **Esperado**: 6h noturnas no relatório; bloco noturno igual ao dos RDOs normais.
3. Tentar enviar noturno habilitado sem início/término → **Esperado**: bloqueio com mensagem clara.

### US3 — Reflexo no Acompanhamento (objetivo de negócio)

1. Garantir ponto vigente cobrindo a data do relatório e ponto batido dos colaboradores no dia.
2. Antes do upload: anotar, no Acompanhamento (aba Custo/hora ou detalhe do projeto), o custo
   "Sede" do colaborador no mês.
3. Fazer o upload manual (US1) com data dentro do período do ponto.
4. **Esperado**: o dia migra de "Sede" para o projeto do relatório; horas do RDO manual somadas às
   horas de projeto sem distinção de origem.
5. Contra-prova: upload manual **sem** dados operacionais → nenhum efeito no custo.

### US3b — Relatório somente serviço com custo de mão de obra

1. Fazer upload manual de um relatório tipo RTP (ou outro somente serviço) com entrada `08:00`,
   saída `12:00` e 1 colaborador, em dia coberto pelo ponto e **sem** RDO do colaborador no dia.
2. **Esperado**: o dia e as 4h contabilizam para o projeto no Acompanhamento, como um RDO manual.
3. Repetir em um dia que **tem** RDO do mesmo colaborador (RDO com mais horas).
4. **Esperado**: o dia é contado uma única vez, prevalecendo o RDO (mais horas) — sem dupla
   contagem no custo.

### US3c — Relatório somente serviço criado pelo app (horários dos serviços)

1. Criar pelo fluxo normal do app um relatório somente serviço (só colaborador e data) com dois
   serviços: 08:00–12:00 e 10:00–14:00, em dia coberto pelo ponto e sem RDO do colaborador.
2. **Esperado**: o relatório contabiliza **6h** (união dos intervalos, não 8h da soma) para o
   projeto no Acompanhamento.
3. Verificar um relatório somente serviço **antigo** (criado antes da feature) com horários de
   serviço preenchidos: após a entrega, ele passa a contabilizar custo sem qualquer ação manual.
4. Contra-prova: relatório somente serviço sem horários nos serviços e sem jornada informada
   permanece fora do cálculo.
5. Atenção esperada: números históricos do Acompanhamento mudam (dias migram de "Sede" para
   projetos) — validar com o gestor que a variação corresponde aos relatórios de serviço antigos.

### US4 — Editar relatório manual em tela própria

1. Abrir um relatório manual enviado sem dados operacionais.
2. **Esperado**: não existe botão separado "Completar dados"; a própria página de edição manual
   mostra data, horários, turno, colaboradores e stand-by quando for RDO.
3. Preencher horários e colaboradores; em RDO, alterar também stand-by; salvar sem reenviar PDF.
4. **Esperado**: horas recalculadas, vínculos substituídos/criados, stand-by salvo quando aplicável,
   PDF inalterado, Acompanhamento reflete.
5. **Esperado**: campos de observação, anexos de fotos e adicionar serviço não aparecem nessa tela
   e não são enviados no payload de edição manual.

### Regressões obrigatórias

- Upload manual de tipo ≠ RDO **sem** dados operacionais: fluxo atual intacto (serviceData, assinatura, PDF).
- Upload em lote: cada arquivo tem seu próprio bloco de dados; lote misto (com/sem dados) funciona.
- Substituir PDF de relatório manual com dados → dados operacionais preservados.
- Relatório manual editado inline preserva status, assinatura, PDF, observação e fotos existentes.
- Mobile: modal de upload com bloco operacional rolável, sem estouro de viewport, rodapé fixo.
- Mobile: página de edição manual sem overflow horizontal e sem campos ocultos por botões fixos.

## Constitution gates (checagem final)

- [ ] UI pt-BR, mobile-first (modal e página de edição manual testados em viewport estreito)
- [X] Zod no backend para todos os campos novos (rejeições testadas por API direta)
- [X] Nenhuma migration (conferir `prisma/migrations/` sem novidade)
- [X] Testes de negócio em `backend/test` passando
- [X] Componentes do kit e tokens (sem dropdown cru, sem hex/px hardcoded)
