import {
  LEC_CONTEXT_EXPENSES,
  offshoreWorkSchedule
} from '../../../../../../shared/comercial/dist/cost-model.js';
import { NumberField, SelectField } from '../../components/Field';
import { money, number, numberValue } from '../formato';
import type { Levantamento } from '../useLevantamento';

/**
 * Cartão de uma fase de mão de obra.
 *
 * Porte de `.phase-card` (`app/custos/page.tsx:729-...`). Cada fase tem
 * período, jornada, local, deslocamento e as alocações de pessoal.
 *
 * O painel "Local e deslocamento" é o que destrava a pendência da seção: sem
 * condição de trabalho confirmada e sem veículo, o rodapé-guia manda para cá.
 */

type AnyRecord = Record<string, unknown>;

const CONDICOES = [
  { value: 'headquarters', label: 'Sede / Itajaí' },
  { value: 'travel', label: 'Em viagem' },
  { value: 'offshore', label: 'Offshore' }
];

const VEICULOS = [
  { value: 'sedan', label: 'Carro sedan · 3 pessoas' },
  { value: 'pickup', label: 'Pickup · 2 pessoas' },
  { value: 'hr', label: 'HR · 2 pessoas' }
];

const MODO_VEICULOS = [
  { value: 'automatic', label: 'Automática pela equipe' },
  { value: 'manual', label: 'Informada manualmente' }
];

function registros(valor: unknown): AnyRecord[] {
  return Array.isArray(valor) ? (valor as AnyRecord[]) : [];
}

export function FaseCard({
  fase,
  indice,
  total,
  levantamento
}: {
  fase: AnyRecord;
  indice: number;
  total: number;
  levantamento: Levantamento;
}) {
  const { updateCollection, removeCollection, resultadoDaFase } = levantamento;
  const id = String(fase.id);
  const resumo = resultadoDaFase(id);
  const alocacoes = registros(fase.assignments);
  const emViagem = fase.workCondition === 'travel';
  const confirmada = fase.workConditionConfirmed === true;

  function editar(patch: AnyRecord) {
    updateCollection('laborContexts', id, patch);
  }

  return (
    <article className="com-fase-card">
      <header className="com-fase-card-topo">
        <div className="com-fase-identidade">
          <span className="com-fase-indice">{indice + 1}</span>
          <label>
            <small>Nome da fase</small>
            <input
              aria-label="Nome da fase"
              value={String(fase.name || '')}
              onChange={event => editar({ name: event.target.value })}
            />
          </label>
        </div>
        <div className="com-fase-acoes">
          <button type="button" className="com-btn com-btn-fantasma">
            Duplicar
          </button>
          <button
            type="button"
            className="com-btn com-btn-perigo"
            /* A última fase não pode ser removida: um levantamento com mão de
               obra e zero fases não é estado válido, e a referência trava. */
            disabled={total <= 1}
            onClick={() => removeCollection('laborContexts', id)}
          >
            Remover
          </button>
        </div>
      </header>

      <div className="com-fase-paineis">
        <section className="com-fase-painel">
          <header>
            <strong>Local e deslocamento</strong>
            <small>Informe a condição da equipe e o transporte diário.</small>
          </header>

          <div className="com-form-grid">
            <div className="com-form-wide">
              <SelectField
                label="Condição de trabalho"
                required
                /* O valor só aparece depois de CONFIRMADO. Enquanto não for,
                   o select mostra o vazio — é o que força a escolha
                   consciente em vez de aceitar um padrão silencioso. */
                value={confirmada ? String(fase.workCondition || '') : ''}
                emptyLabel="Selecione Sede, Em viagem ou Offshore"
                options={CONDICOES}
                error={
                  confirmada && fase.workCondition
                    ? undefined
                    : 'Campo obrigatório'
                }
                onChange={valor => {
                  // Offshore traz um calendário próprio de 21 dias — escolher
                  // a condição já preenche a escala, senão o usuário digitaria
                  // à mão uma regra que o LEC já conhece.
                  editar(
                    valor === 'offshore'
                      ? {
                          workCondition: valor,
                          workConditionConfirmed: true,
                          ...(offshoreWorkSchedule(21) as AnyRecord)
                        }
                      : { workCondition: valor, workConditionConfirmed: true }
                  );
                }}
              />
            </div>

            <SelectField
              label="Veículo obrigatório"
              required
              value={String(fase.vehicleType || '')}
              emptyLabel="Selecione o veículo"
              options={VEICULOS}
              error={fase.vehicleType ? undefined : 'Campo obrigatório'}
              onChange={valor => editar({ vehicleType: valor })}
            />

            <SelectField
              label="Quantidade de veículos"
              value={String(fase.vehicleCountMode || 'automatic')}
              options={MODO_VEICULOS}
              onChange={valor => editar({ vehicleCountMode: valor })}
            />

            <NumberField
              label="Deslocamento hotel ↔ obra / dia (km)"
              value={
                fase.hotelSiteDistanceKmPerDay ??
                (LEC_CONTEXT_EXPENSES as AnyRecord).hotelSiteDistanceKmPerDay
              }
              min={0}
              step={1}
              /* Só faz sentido em viagem, e só depois de confirmar a condição. */
              disabled={!confirmada || !emViagem}
              error={
                emViagem && numberValue(fase.hotelSiteDistanceKmPerDay) <= 0
                  ? 'Informe a distância diária entre hotel e obra'
                  : undefined
              }
              onChange={valor => editar({ hotelSiteDistanceKmPerDay: valor })}
            />

            {fase.vehicleCountMode === 'manual' && (
              <NumberField
                label="Nº de veículos"
                value={fase.vehicleCount || 0}
                min={0}
                step={1}
                onChange={valor => editar({ vehicleCount: valor })}
              />
            )}
          </div>
        </section>

        <section className="com-fase-painel">
          <header>
            <strong>Período e jornada</strong>
            <small>Defina quando a fase acontece e a carga horária normal.</small>
          </header>

          <div className="com-form-grid">
            <NumberField
              label="Início (dia do projeto)"
              value={fase.startOffsetDays}
              min={0}
              onChange={valor => editar({ startOffsetDays: valor })}
            />
            <NumberField
              label="Dias corridos"
              value={fase.durationDays}
              min={1}
              /* Offshore é limitado a 21 dias pelo próprio regime. */
              max={fase.workCondition === 'offshore' ? 21 : undefined}
              onChange={valor => editar({ durationDays: valor })}
            />
            <NumberField
              label="Jornada normal (h/dia)"
              value={fase.hoursPerDay}
              min={0}
              step={0.5}
              onChange={valor => editar({ hoursPerDay: valor })}
            />
            <NumberField
              label="HE 70% (h/dia)"
              value={fase.weekdayExtra70HoursPerDay}
              min={0}
              step={0.5}
              onChange={valor => editar({ weekdayExtra70HoursPerDay: valor })}
            />
            <NumberField
              label="Sábados"
              value={fase.saturdayCount}
              min={0}
              onChange={valor => editar({ saturdayCount: valor })}
            />
            <NumberField
              label="Domingos e feriados"
              value={fase.sundayCount}
              min={0}
              onChange={valor => editar({ sundayCount: valor })}
            />
          </div>
        </section>
      </div>

      <section className="com-fase-painel">
        <header>
          <strong>Equipe alocada</strong>
          <small>
            {alocacoes.length
              ? `${alocacoes.length} alocação(ões) · custo da fase ${money(
                  numberValue(resumo.totalCost)
                )}`
              : 'Nenhuma alocação nesta fase.'}
          </small>
        </header>

        {alocacoes.length > 0 && (
          <div className="com-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cargo</th>
                  <th>Pessoas</th>
                  <th>Salário base</th>
                  <th>Turno</th>
                  <th>HH</th>
                </tr>
              </thead>
              <tbody>
                {alocacoes.map(alocacao => {
                  const calculado =
                    registros(resumo.assignments).find(item => item.id === alocacao.id) || {};
                  return (
                    <tr key={String(alocacao.id)}>
                      <td className="com-quebrar">{String(alocacao.role || '—')}</td>
                      <td>{number(numberValue(alocacao.headcount))}</td>
                      <td>{money(numberValue(alocacao.monthlySalary))}</td>
                      <td>{alocacao.shift === 'night' ? 'Noturno' : 'Diurno'}</td>
                      <td>{number(numberValue(calculado.totalHours))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="com-nota">
          A edição de alocação — cargo, pessoas, salário e turno — entra no próximo passo.
          O que já vale: a condição de trabalho e o veículo destravam a pendência da seção.
        </p>
      </section>
    </article>
  );
}
