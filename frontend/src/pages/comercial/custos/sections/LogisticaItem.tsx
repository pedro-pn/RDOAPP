import { MoneyField, NumberField, SelectField } from '../../components/Field';
import { money, numberValue } from '../formato';
import { itemPrecisaAtencao, transporteDispensado } from '../logistica';
import type { Levantamento } from '../useLevantamento';

/**
 * Um deslocamento de mobilização ou desmobilização.
 *
 * **O modo de cálculo decide quais campos aparecem.** Frete externo pede
 * quantidade, viagens e custo; veículo de equipe pede vínculo com a fase,
 * viajantes, capacidade e distância; passagem pede dias de viagem. Mostrar
 * todos os campos sempre pediria dado que não se aplica — e é o caminho mais
 * curto para o usuário preencher qualquer coisa só para o aviso sumir.
 *
 * A marcação de pendência usa `itemPrecisaAtencao`, **a mesma função que o
 * rodapé-guia consulta**. Duas implementações da mesma regra divergiriam, e a
 * tela diria uma coisa enquanto o rodapé diz outra.
 */

type AnyRecord = Record<string, unknown>;

const MODOS = [
  { value: 'external_freight', label: 'Frete externo (transportadora)' },
  { value: 'company_crew_vehicle', label: 'Veículo próprio com a equipe' },
  { value: 'rental_crew_vehicle', label: 'Veículo alugado com a equipe' },
  { value: 'bus_crew_transport', label: 'Ônibus (passagem)' },
  { value: 'air_crew_transport', label: 'Aéreo (passagem)' },
  { value: 'company_truck_driver', label: 'Caminhão próprio com motorista' }
];

const MODO_CONTAGEM = [
  { value: 'automatic', label: 'Automática pela equipe' },
  { value: 'manual', label: 'Informada manualmente' }
];

function registros(valor: unknown): AnyRecord[] {
  return Array.isArray(valor) ? (valor as AnyRecord[]) : [];
}

export function LogisticaItem({
  item,
  levantamento
}: {
  item: AnyRecord;
  levantamento: Levantamento;
}) {
  const { draft, result, updateCollection, removeCollection, errosVisiveis, erroSe } =
    levantamento;
  const id = String(item.id);
  const confirmacoes = (draft.scopeConfirmations as AnyRecord) || {};
  const fases = registros(draft.laborContexts);
  const destinos = registros(draft.logisticsDestinations);

  const dispensado = transporteDispensado(item, confirmacoes);
  // A marcação do card segue a mesma regra do vermelho nos campos: só
  // depois que o usuário tenta avançar. Antes disso quem avisa é o rodapé.
  const pendente =
    errosVisiveis && !dispensado && itemPrecisaAtencao(item, fases);

  const calculado =
    registros(result.logisticsResults).find(r => r.id === id) || {};

  const modo = String(item.calculationMode || '');
  const veiculoRodoviario =
    modo === 'company_crew_vehicle' ||
    modo === 'rental_crew_vehicle' ||
    modo === 'company_truck_driver';
  const comPassagem = modo === 'bus_crew_transport' || modo === 'air_crew_transport';
  const transporteDeEquipe =
    modo === 'company_crew_vehicle' ||
    modo === 'rental_crew_vehicle' ||
    comPassagem ||
    modo === 'company_truck_driver';
  const veiculoDeEquipe =
    modo === 'company_crew_vehicle' || modo === 'rental_crew_vehicle';

  function editar(patch: AnyRecord) {
    updateCollection('logistics', id, patch);
  }

  return (
    <article className={`com-fase-card${pendente ? ' com-item-pendente' : ''}`}>
      <header className="com-fase-card-topo">
        <div className="com-fase-identidade">
          <label>
            <small>Descrição do deslocamento</small>
            <input
              aria-label="Descrição do deslocamento"
              value={String(item.description || '')}
              onChange={event => editar({ description: event.target.value })}
            />
          </label>
        </div>
        <div className="com-fase-acoes">
          {dispensado && <span className="com-etiqueta">Dispensado</span>}
          {pendente && <span className="com-etiqueta com-etiqueta-alerta">Incompleto</span>}
          <span className="com-volume-badge">{money(numberValue(calculado.total))}</span>
          <label className="com-incluir">
            <input
              type="checkbox"
              checked={item.included !== false}
              onChange={event => editar({ included: event.target.checked })}
            />
            Incluir
          </label>
          <button
            type="button"
            className="com-btn com-btn-perigo"
            /* Slot obrigatório não se remove — ele existe porque o fluxo o
               exige. O caminho é desmarcar "incluir" e confirmar a dispensa. */
            disabled={item.requiredSlot === true}
            title={
              item.requiredSlot === true
                ? 'Deslocamento obrigatório: desmarque "incluir" em vez de remover'
                : 'Remover deslocamento'
            }
            onClick={() => removeCollection('logistics', id)}
          >
            Remover
          </button>
        </div>
      </header>

      <div className="com-form-grid">
        <SelectField
          label="Modo de cálculo"
          required
          value={item.calculationModeConfirmed ? modo : ''}
          emptyLabel="Selecione como este deslocamento é calculado"
          options={MODOS}
          error={erroSe(!(item.calculationModeConfirmed && modo), 'Campo obrigatório')}
          /* Mesmo padrão da condição de trabalho: o valor só aparece depois de
             confirmado, para forçar a escolha em vez de aceitar um padrão. */
          onChange={valor =>
            editar({ calculationMode: valor, calculationModeConfirmed: true })
          }
        />

        <SelectField
          label="Destino"
          value={String(item.destinationId || '')}
          emptyLabel="Sem destino"
          options={destinos.map(destino => ({
            value: String(destino.id),
            label: String(destino.name || 'Destino')
          }))}
          onChange={valor => editar({ destinationId: valor })}
        />

        <NumberField
          label="Viagens"
          value={item.trips}
          min={0}
          step={1}
          error={erroSe(numberValue(item.trips) <= 0, 'Informe ao menos uma viagem')}
          onChange={valor => editar({ trips: valor })}
        />
      </div>

      {modo === 'external_freight' && (
        <div className="com-form-grid">
          <NumberField
            label="Quantidade"
            value={item.quantity}
            min={0}
            step={0.01}
            error={erroSe(numberValue(item.quantity) <= 0, 'Campo obrigatório')}
            onChange={valor => editar({ quantity: valor })}
          />
          <MoneyField
            label="Custo unitário"
            value={item.unitCost}
            error={erroSe(numberValue(item.unitCost) <= 0, 'Campo obrigatório')}
            onChange={valor => editar({ unitCost: valor })}
          />
        </div>
      )}

      {transporteDeEquipe && (
        <div className="com-form-grid">
          <SelectField
            label="Fase vinculada"
            required
            value={String(item.contextId || '')}
            emptyLabel="Selecione a fase"
            options={fases.map(fase => ({
              value: String(fase.id),
              label: String(fase.name || 'Fase')
            }))}
            error={erroSe(!item.contextId, 'Campo obrigatório')}
            /* Sem fase não há equipe, e sem equipe não há quem transportar. */
            onChange={valor => editar({ contextId: valor })}
          />

          <SelectField
            label="Contagem de viajantes"
            value={String(item.travelerCountMode || 'automatic')}
            options={MODO_CONTAGEM}
            onChange={valor => editar({ travelerCountMode: valor })}
          />

          {item.travelerCountMode === 'manual' && (
            <NumberField
              label="Viajantes"
              value={item.travelerCount}
              min={0}
              step={1}
              onChange={valor => editar({ travelerCount: valor })}
            />
          )}
        </div>
      )}

      {veiculoRodoviario && (
        <div className="com-form-grid">
          <NumberField
            label="Distância por veículo (km)"
            value={item.distanceKmPerVehicle}
            min={0}
            step={1}
            error={erroSe(numberValue(item.distanceKmPerVehicle) <= 0, 'Campo obrigatório')}
            onChange={valor => editar({ distanceKmPerVehicle: valor })}
          />

          <NumberField
            label="Limite diário de rodagem (km)"
            value={item.dailyDistanceLimitKm}
            min={0}
            step={1}
            hint="Define em quantos dias o trajeto é feito"
            onChange={valor => editar({ dailyDistanceLimitKm: valor })}
          />

          <SelectField
            label="Contagem de veículos"
            value={String(item.vehicleCountMode || 'automatic')}
            options={MODO_CONTAGEM}
            onChange={valor => editar({ vehicleCountMode: valor })}
          />

          {item.vehicleCountMode === 'manual' && (
            <NumberField
              label="Nº de veículos"
              value={item.vehicleCount}
              min={0}
              step={1}
              error={erroSe(numberValue(item.vehicleCount) <= 0, 'Campo obrigatório')}
              onChange={valor => editar({ vehicleCount: valor })}
            />
          )}

          {veiculoDeEquipe && (
            <NumberField
              label="Passageiros por veículo"
              value={item.passengersPerVehicle}
              min={1}
              step={1}
              onChange={valor => editar({ passengersPerVehicle: valor })}
            />
          )}
        </div>
      )}

      {comPassagem && (
        <div className="com-form-grid">
          <NumberField
            label="Dias corridos por viagem"
            value={item.travelCalendarDaysPerTrip}
            min={0}
            step={1}
            onChange={valor => editar({ travelCalendarDaysPerTrip: valor })}
          />
          <MoneyField
            label="Passagem por pessoa/viagem"
            value={item.ticketPerPersonPerTrip}
            onChange={valor => editar({ ticketPerPersonPerTrip: valor })}
          />
        </div>
      )}

      {transporteDeEquipe && (
        <div className="com-form-grid">
          <NumberField
            label="Sábados em viagem"
            value={item.travelSaturdayDays}
            min={0}
            step={1}
            onChange={valor => editar({ travelSaturdayDays: valor })}
          />
          <NumberField
            label="Domingos e feriados em viagem"
            value={item.travelSundayDays}
            min={0}
            step={1}
            onChange={valor => editar({ travelSundayDays: valor })}
          />
        </div>
      )}

      {!modo && (
        <p className="com-nota">
          Escolha o modo de cálculo para ver os campos que este deslocamento exige.
        </p>
      )}
    </article>
  );
}
