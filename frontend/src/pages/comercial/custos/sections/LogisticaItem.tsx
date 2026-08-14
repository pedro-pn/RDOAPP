import { FieldPanel, MoneyField, NumberField, SelectField } from '../../components/Field';
import {
  LOGISTICS_RETURN_MIRROR_FIELDS,
  LOGISTICS_TRAVEL_DEFAULTS
} from '../../../../../../shared/comercial/dist/cost-model.js';
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

const RETORNOS = [
  { value: 'mirrored', label: 'Repetir a composição da mobilização' },
  { value: 'custom', label: 'Preencher a desmobilização separadamente' }
];

const PERNOITES_DE_ONIBUS = [
  { value: 'continuous', label: 'Viagem direta, sem parada para dormir' },
  { value: 'hotel_stop', label: 'Parada com hospedagem' }
];

const USOS_DO_CARRO_ALUGADO = [
  { value: 'mobilization_only', label: 'Somente no deslocamento' },
  { value: 'mobilization_and_site', label: 'Deslocamento e uso durante a obra' }
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
  const todosOsItens = registros(draft.logistics);

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

  function definirRetorno(valor: string) {
    if (valor !== 'mirrored') {
      editar({ returnSetup: valor, autoSyncedFromMobilization: false });
      return;
    }

    const origem = todosOsItens.find(
      candidato =>
        candidato.direction === 'mobilization' &&
        candidato.slotType === item.slotType &&
        candidato.destinationId === item.destinationId
    );
    const espelho: AnyRecord = {};
    for (const campo of LOGISTICS_RETURN_MIRROR_FIELDS) {
      if (origem?.[campo] !== undefined) espelho[campo] = origem[campo];
    }
    editar({
      ...espelho,
      returnSetup: 'mirrored',
      autoSyncedFromMobilization: true
    });
  }

  const faseVinculada = fases.find(fase => fase.id === item.contextId);
  const alocacoes = registros(faseVinculada?.assignments);

  function editarViajante(assignmentId: string, quantidade: number) {
    const atuais = registros(item.travelerAssignments).filter(
      viajante => viajante.assignmentId !== assignmentId
    );
    editar({
      travelerAssignments: quantidade > 0
        ? [...atuais, { assignmentId, quantity: quantidade }]
        : atuais,
      travelerAssignmentsConfirmed: true
    });
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
        {item.direction === 'demobilization' && item.requiredSlot === true && (
          <SelectField
            label="Composição do retorno"
            required
            value={item.returnSetup === 'pending' ? '' : String(item.returnSetup || '')}
            emptyLabel="Escolha como será a desmobilização"
            options={RETORNOS}
            error={erroSe(item.returnSetup === 'pending', 'Campo obrigatório')}
            onChange={definirRetorno}
          />
        )}

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
          required
          value={String(item.destinationId || '')}
          emptyLabel="Sem destino"
          options={destinos.map(destino => ({
            value: String(destino.id),
            label: String(destino.name || 'Destino')
          }))}
          error={erroSe(
            !item.destinationId || !destinos.some(destino => destino.id === item.destinationId),
            'Campo obrigatório'
          )}
          onChange={valor => editar({ destinationId: valor })}
        />

        <NumberField
          label="Viagens"
          required
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
            required
            value={item.quantity}
            min={0}
            step={0.01}
            error={erroSe(numberValue(item.quantity) <= 0, 'Campo obrigatório')}
            onChange={valor => editar({ quantity: valor })}
          />
          <MoneyField
            label="Custo unitário"
            required
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
            required={modo === 'company_truck_driver'}
            value={String(item.travelerCountMode || 'automatic')}
            options={MODO_CONTAGEM}
            error={erroSe(
              modo === 'company_truck_driver' && item.travelerCountMode !== 'manual',
              'Selecione a contagem manual para indicar o motorista'
            )}
            onChange={valor => editar({ travelerCountMode: valor })}
          />

          {item.travelerCountMode === 'manual' && (
            <FieldPanel
              label="Viajantes por cargo"
              required
              error={erroSe(
                registros(item.travelerAssignments).reduce(
                  (total, viajante) => total + numberValue(viajante.quantity),
                  0
                ) <= 0,
                'Selecione ao menos um colaborador da fase'
              )}
            >
              {alocacoes.length > 0 ? (
                <div className="com-viajantes-cargos">
                  {alocacoes.map(alocacao => {
                    const assignmentId = String(alocacao.id);
                    const selecionado = registros(item.travelerAssignments).find(
                      viajante => viajante.assignmentId === assignmentId
                    );
                    const disponiveis = Math.ceil(
                      (numberValue(alocacao.quantity) *
                        numberValue(alocacao.allocationPercent)) /
                        100
                    );
                    return (
                      <label key={assignmentId}>
                        <span>{String(alocacao.role || 'Cargo')}</span>
                        <input
                          type="number"
                          min={0}
                          max={disponiveis}
                          step={1}
                          aria-label={`Viajantes de ${String(alocacao.role || 'cargo')}`}
                          value={numberValue(selecionado?.quantity) || ''}
                          onChange={evento =>
                            editarViajante(assignmentId, Number(evento.target.value) || 0)
                          }
                        />
                        <small>de {disponiveis}</small>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <small className="com-nota">Selecione primeiro uma fase com equipe.</small>
              )}
            </FieldPanel>
          )}
        </div>
      )}

      {veiculoRodoviario && (
        <div className="com-form-grid">
          <NumberField
            label="Distância por veículo (km)"
            required
            value={item.distanceKmPerVehicle}
            min={0}
            step={1}
            error={erroSe(numberValue(item.distanceKmPerVehicle) <= 0, 'Campo obrigatório')}
            onChange={valor => editar({ distanceKmPerVehicle: valor })}
          />

          <NumberField
            label="Limite diário de rodagem (km)"
            required
            value={item.dailyDistanceLimitKm}
            min={0}
            step={1}
            hint="Define em quantos dias o trajeto é feito"
            error={erroSe(
              numberValue(item.dailyDistanceLimitKm) <= 0 ||
                numberValue(item.dailyDistanceLimitKm) >
                  LOGISTICS_TRAVEL_DEFAULTS.dailyDistanceLimitKm,
              `Informe um valor entre 1 e ${LOGISTICS_TRAVEL_DEFAULTS.dailyDistanceLimitKm} km`
            )}
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
              required
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
              required
              value={item.passengersPerVehicle}
              min={1}
              max={LOGISTICS_TRAVEL_DEFAULTS.passengersPerCompanyCar}
              step={1}
              error={erroSe(
                numberValue(item.passengersPerVehicle) < 1 ||
                  numberValue(item.passengersPerVehicle) >
                    LOGISTICS_TRAVEL_DEFAULTS.passengersPerCompanyCar,
                `Informe de 1 a ${LOGISTICS_TRAVEL_DEFAULTS.passengersPerCompanyCar} pessoas`
              )}
              onChange={valor => editar({ passengersPerVehicle: valor })}
            />
          )}

          <NumberField
            label="Horas de viagem por dia"
            required
            value={item.travelHoursPerDay}
            min={0}
            max={10}
            step={0.5}
            error={erroSe(
              numberValue(item.travelHoursPerDay) <= 0 ||
                numberValue(item.travelHoursPerDay) >
                  LOGISTICS_TRAVEL_DEFAULTS.travelHoursPerDay,
              `Informe um valor entre 1 e ${LOGISTICS_TRAVEL_DEFAULTS.travelHoursPerDay} horas`
            )}
            onChange={valor => editar({ travelHoursPerDay: valor })}
          />

          <MoneyField
            label="Hospedagem por pessoa/dia"
            required
            value={item.lodgingPerPersonDay}
            error={erroSe(numberValue(item.lodgingPerPersonDay) <= 0, 'Campo obrigatório')}
            onChange={valor => editar({ lodgingPerPersonDay: valor })}
          />

          <NumberField
            label="Rendimento do combustível (km/L)"
            required
            value={item.fuelEfficiencyKmPerLiter}
            min={0}
            step={0.1}
            error={erroSe(numberValue(item.fuelEfficiencyKmPerLiter) <= 0, 'Campo obrigatório')}
            onChange={valor => editar({ fuelEfficiencyKmPerLiter: valor })}
          />

          <MoneyField
            label="Combustível (R$/L)"
            required
            value={item.fuelPricePerLiter}
            error={erroSe(numberValue(item.fuelPricePerLiter) <= 0, 'Campo obrigatório')}
            onChange={valor => editar({ fuelPricePerLiter: valor })}
          />

          <MoneyField
            label="Pedágio estimado (R$/km da frota)"
            value={item.tollPerVehicleKm}
            onChange={valor => editar({ tollPerVehicleKm: valor })}
          />
        </div>
      )}

      {modo === 'rental_crew_vehicle' && (
        <div className="com-form-grid">
          <SelectField
            label="Uso do carro alugado"
            required
            value={String(item.rentalUse || '')}
            emptyLabel="Selecione onde o carro será usado"
            options={USOS_DO_CARRO_ALUGADO}
            error={erroSe(!item.rentalUse, 'Campo obrigatório')}
            onChange={valor => editar({ rentalUse: valor })}
          />
          <MoneyField
            label="Diária do carro alugado"
            required
            value={item.rentalDailyRate}
            error={erroSe(numberValue(item.rentalDailyRate) <= 0, 'Campo obrigatório')}
            onChange={valor => editar({ rentalDailyRate: valor })}
          />
          {item.direction === 'mobilization' &&
            item.rentalUse === 'mobilization_and_site' && (
              <NumberField
                label="Dias corridos de locação na obra"
                required
                value={item.rentalSiteDays}
                min={0}
                step={1}
                error={erroSe(numberValue(item.rentalSiteDays) <= 0, 'Campo obrigatório')}
                onChange={valor => editar({ rentalSiteDays: valor })}
              />
            )}
        </div>
      )}

      {comPassagem && (
        <div className="com-form-grid">
          <NumberField
            label="Horas de viagem por dia"
            required
            value={item.travelHoursPerDay}
            min={0}
            max={24}
            step={0.5}
            error={erroSe(
              numberValue(item.travelHoursPerDay) <= 0 ||
                numberValue(item.travelHoursPerDay) > 24,
              'Informe um valor entre 1 e 24 horas'
            )}
            onChange={valor => editar({ travelHoursPerDay: valor })}
          />
          <NumberField
            label="Dias corridos por viagem"
            required
            value={item.travelCalendarDaysPerTrip}
            min={0}
            step={1}
            onChange={valor => editar({ travelCalendarDaysPerTrip: valor })}
          />
          <MoneyField
            label="Passagem por pessoa/viagem"
            required
            value={item.ticketPerPersonPerTrip}
            error={erroSe(numberValue(item.ticketPerPersonPerTrip) <= 0, 'Campo obrigatório')}
            onChange={valor => editar({ ticketPerPersonPerTrip: valor })}
          />
          <MoneyField
            label="Alimentação por pessoa/dia"
            required
            value={item.mealPerPersonDay}
            error={erroSe(numberValue(item.mealPerPersonDay) <= 0, 'Campo obrigatório')}
            onChange={valor => editar({ mealPerPersonDay: valor })}
          />
          {modo === 'bus_crew_transport' && (
            <SelectField
              label="Pernoite no trajeto de ônibus"
              required
              value={String(item.busOvernightMode || '')}
              emptyLabel="Selecione como será o pernoite"
              options={PERNOITES_DE_ONIBUS}
              error={erroSe(!item.busOvernightMode, 'Campo obrigatório')}
              onChange={valor => editar({ busOvernightMode: valor })}
            />
          )}
          {((modo === 'bus_crew_transport' && item.busOvernightMode === 'hotel_stop') ||
            (modo === 'air_crew_transport' &&
              numberValue(item.travelCalendarDaysPerTrip) > 1)) && (
            <>
              <NumberField
                label="Pernoites por viagem"
                required
                value={item.lodgingNightsPerTrip}
                min={0}
                step={1}
                error={erroSe(numberValue(item.lodgingNightsPerTrip) <= 0, 'Campo obrigatório')}
                onChange={valor => editar({ lodgingNightsPerTrip: valor })}
              />
              <MoneyField
                label="Hospedagem por pessoa/dia"
                required
                value={item.lodgingPerPersonDay}
                error={erroSe(numberValue(item.lodgingPerPersonDay) <= 0, 'Campo obrigatório')}
                onChange={valor => editar({ lodgingPerPersonDay: valor })}
              />
            </>
          )}
        </div>
      )}

      {transporteDeEquipe && !comPassagem && (
        <div className="com-form-grid">
          <MoneyField
            label="Alimentação por pessoa/dia"
            required
            value={item.mealPerPersonDay}
            error={erroSe(numberValue(item.mealPerPersonDay) <= 0, 'Campo obrigatório')}
            onChange={valor => editar({ mealPerPersonDay: valor })}
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
