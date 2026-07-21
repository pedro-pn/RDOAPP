# Research: Custos manuais no Acompanhamento

## Decision: Entidade própria para custo manual

**Rationale**: O custo manual precisa ter histórico, criador, soft delete e valor independente do Omie. Uma tabela própria evita misturar origem manual com dados sincronizados e permite recomputar totais.

**Alternatives considered**: Reaproveitar uma categoria Omie sintética foi descartado porque poderia confundir relatórios de origem Omie. Guardar apenas um valor agregado no projeto foi descartado porque perderia histórico e remoção individual.

## Decision: Somar manual ao realizado, preservando Omie separado

**Rationale**: O usuário quer considerar o custo gerencial no acompanhamento, mas a compra não existe no Omie. O total realizado precisa incluir manual + estoque + Omie; o campo Omie separado continua mostrando apenas dados sincronizados.

**Alternatives considered**: Alterar o total Omie foi descartado por quebrar rastreabilidade da integração.

## Decision: Mutação restrita a gestor do Acompanhamento

**Rationale**: O lançamento altera indicadores financeiros do projeto. Visualizadores podem consultar o total, mas criação e remoção devem ficar com gestores.

**Alternatives considered**: Permitir edição para qualquer usuário com acesso ao Acompanhamento foi descartado por risco financeiro.

## Decision: Soft delete para remoção

**Rationale**: A exclusão física dificultaria auditoria básica de erro operacional. Soft delete remove dos cálculos preservando o registro.

**Alternatives considered**: Exclusão física foi descartada por perda de rastreabilidade.

## Decision: Aviso Driver.js temporário

**Rationale**: A constitution exige divulgação temporária para função visível nova. O padrão existente usa Driver.js, localStorage por usuário/browser e expiração global.

**Alternatives considered**: Texto fixo em tela foi descartado porque criaria comunicação permanente e fora do padrão.
