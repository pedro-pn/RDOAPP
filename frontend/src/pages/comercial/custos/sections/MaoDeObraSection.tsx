import { HOTEL_SITE_COMMUTE_EXPENSE_CODE } from '../../../../../../shared/comercial/dist/cost-model.js';
import { AvisoPendencia, ConfirmacaoEscopo } from '../ConfirmacaoEscopo';
import { number, numberValue, people } from '../formato';
import type { Levantamento } from '../useLevantamento';
import { FaseCard } from './FaseCard';

/**
 * Seção 2 — Mão de obra por fases.
 *
 * É a maior das cinco: `CUSTO-CTL-039..137`, 99 controles. Porte de
 * `LaborSection` (`app/custos/page.tsx:639-1038`).
 *
 * **Este passo entrega a moldura da seção**: confirmação de escopo, os quatro
 * avisos de pendência, o resumo de três indicadores e a lista de fases com o
 * que cada uma exige. A edição por alocação — cargo, salário, turno, horas,
 * despesas — é o grosso dos 99 controles e vem no passo seguinte.
 *
 * O que já é real aqui: a **pendência** que alimenta o rodapé-guia. Com esta
 * seção no ar, o botão do rodapé passa a dizer "Preencher itens obrigatórios
 * da mão de obra →" de verdade, e levar até aqui.
 */

type AnyRecord = Record<string, unknown>;

function registros(valor: unknown): AnyRecord[] {
  return Array.isArray(valor) ? (valor as AnyRecord[]) : [];
}

export function MaoDeObraSection({ levantamento }: { levantamento: Levantamento }) {
  const { draft, result, setDraft } = levantamento;

  const confirmacoes = (draft.scopeConfirmations as AnyRecord) || {};
  const semMaoDeObra = confirmacoes.noLabor === true;
  const fases = registros(draft.laborContexts);

  function definirSemMaoDeObra(valor: boolean) {
    setDraft(atual => ({
      ...atual,
      scopeConfirmations: { ...((atual.scopeConfirmations as AnyRecord) || {}), noLabor: valor }
    }));
  }

  // Os quatro avisos da referência, na mesma ordem. Eles são por SEÇÃO, não
  // por campo — dizem que existe fase incompleta, e a marcação vermelha por
  // campo (L1) diz qual. Os dois convivem.
  const faseSemCondicao = fases.some(f => !f.workCondition || !f.workConditionConfirmed);
  const faseSemVeiculo = fases.some(f => !f.vehicleType);
  const faseSemDistancia = fases.some(
    f => f.workCondition === 'travel'
      && f.vehicleType !== 'none'
      && numberValue(f.hotelSiteDistanceKmPerDay) <= 0
  );
  const faseSemCombustivel = fases.some(f => {
    if (f.workCondition !== 'travel' || f.vehicleType === 'none') return false;
    const combustivel = registros(f.expenses).find(
      d => d.code === HOTEL_SITE_COMMUTE_EXPENSE_CODE
    );
    return (
      !combustivel ||
      combustivel.included === false ||
      numberValue(combustivel.quantity) <= 0 ||
      numberValue(combustivel.unitValue) <= 0
    );
  });

  return (
    <section className="com-painel">
      <div className="com-secao-titulo">
        <div>
          <h2>Mão de obra por fases</h2>
          <p>
            Cada fase usa exclusivamente os cargos e a composição salarial do LEC. Informe a
            condição da obra e separe jornada normal, HE 70% e HE 100%.
          </p>
        </div>
        <button type="button" className="com-btn-add">
          {semMaoDeObra ? 'Incluir mão de obra' : '+ Adicionar fase'}
        </button>
      </div>

      <ConfirmacaoEscopo
        confirmado={semMaoDeObra}
        tituloPendente="Revisão obrigatória da mão de obra"
        tituloConfirmado="Sem mão de obra confirmado"
        descricaoPendente="Se realmente não houver colaboradores neste escopo, confirme para evitar uma omissão acidental."
        descricaoConfirmada="As fases ficam preservadas, mas não entram neste levantamento."
        rotulo="Confirmo que não haverá mão de obra"
        onChange={definirSemMaoDeObra}
      />

      {!semMaoDeObra && faseSemCondicao && (
        <AvisoPendencia>
          Selecione obrigatoriamente a condição de trabalho em todas as fases: Sede, Em viagem
          ou Offshore.
        </AvisoPendencia>
      )}
      {!semMaoDeObra && faseSemVeiculo && (
        <AvisoPendencia>
          Selecione o veículo obrigatório em todas as fases para liberar o salvamento do
          levantamento.
        </AvisoPendencia>
      )}
      {!semMaoDeObra && faseSemDistancia && (
        <AvisoPendencia>
          Informe a distância diária entre hotel e obra nas fases em viagem.
        </AvisoPendencia>
      )}
      {!semMaoDeObra && faseSemCombustivel && (
        <AvisoPendencia>
          O combustível do deslocamento hotel ↔ obra é obrigatório nas fases em viagem.
        </AvisoPendencia>
      )}

      {!semMaoDeObra && (
        <>
          <div className="com-visao-geral" aria-label="Resumo geral da mão de obra">
            <article>
              <span>Pico simultâneo</span>
              <strong>
                {people(numberValue(result.peakHeadcount), 'colaborador', 'colaboradores')}
              </strong>
              <small>Maior equipe ativa no mesmo período</small>
            </article>
            <article>
              <span>Pessoa-dias</span>
              <strong>{number(numberValue(result.totalPersonDays))}</strong>
              <small>Somatório das alocações nas fases</small>
            </article>
            <article>
              <span>HH total</span>
              <strong>{number(numberValue(result.totalLaborHours))} HH</strong>
              <small>Jornada normal e horas extras</small>
            </article>
          </div>

          <div className="com-nota-regra">
            <strong>Regra para fases em viagem</strong>
            <span>
              O padrão considera 50 km diários no trajeto hotel ↔ obra e R$ 50 de combustível
              por veículo a cada dia trabalhado. Sábados, domingos e feriados informados
              também entram no cálculo.
            </span>
          </div>

          <div className="com-fases">
            {fases.map((fase, indice) => (
              <FaseCard
                key={String(fase.id ?? indice)}
                fase={fase}
                indice={indice}
                total={fases.length}
                levantamento={levantamento}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
