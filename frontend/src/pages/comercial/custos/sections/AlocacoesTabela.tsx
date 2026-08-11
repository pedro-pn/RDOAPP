import { MoneyInput } from '../../components/Field';
import {
  LEC_LABOR_ROLES,
  roleSalary
} from '../../../../../../shared/comercial/dist/cost-model.js';
import { money, number, numberValue } from '../formato';
import type { Levantamento } from '../useLevantamento';

/**
 * Tabela de alocações de uma fase — o coração do custo de mão de obra.
 *
 * Porte de `context.assignments.map(...)` (`app/custos/page.tsx:789-856`).
 *
 * Cada linha é um cargo alocado à fase, com quantidade de pessoas, salário
 * base, adicional e percentual de alocação. O custo sai do LEC v1.2, não de
 * conta feita aqui: o motor calcula e esta tabela mostra.
 *
 * **Trocar o cargo repõe o salário oficial do LEC.** É deliberado na
 * referência e importa: o salário é editável para casos excepcionais, mas
 * mudar de cargo sem repor deixaria o salário do cargo anterior colado no
 * novo — e o custo sairia plausível e errado, que é o pior modo de falhar
 * nesta tela.
 */

type AnyRecord = Record<string, unknown>;

const TURNOS = [
  { value: 'day', label: 'Diurno' },
  { value: 'night', label: 'Noturno' }
];

function registros(valor: unknown): AnyRecord[] {
  return Array.isArray(valor) ? (valor as AnyRecord[]) : [];
}

function novaAlocacao(): AnyRecord {
  const primeiro = (LEC_LABOR_ROLES as AnyRecord[])[0];
  const cargo = String(primeiro.role);
  return {
    id: `cargo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: cargo,
    quantity: 1,
    monthlySalary: roleSalary(cargo),
    adjustment: 0,
    allocationPercent: 100,
    shift: 'day',
    nightPremiumPercent: 35
  };
}

export function AlocacoesTabela({
  fase,
  levantamento
}: {
  fase: AnyRecord;
  levantamento: Levantamento;
}) {
  const { updateNested, removeNested, addNested, resultadoDaFase } = levantamento;
  const faseId = String(fase.id);
  const resumo = resultadoDaFase(faseId);
  const alocacoes = registros(fase.assignments);
  const calculados = registros(resumo.assignments);

  function editar(id: string, patch: AnyRecord) {
    updateNested('laborContexts', faseId, 'assignments', id, patch);
  }

  return (
    <section className="com-fase-painel">
      <header>
        <strong>Equipe alocada</strong>
        <small>
          Cargos e composição salarial do LEC v1.2. O salário é editável para casos
          excepcionais.
        </small>
      </header>

      {alocacoes.length > 0 ? (
        <div className="com-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Cargo</th>
                <th scope="col">Turno</th>
                <th scope="col">Pessoas</th>
                <th scope="col">Salário base</th>
                <th scope="col">Adicional</th>
                <th scope="col">Alocação (%)</th>
                <th scope="col">HH</th>
                <th scope="col">Custo</th>
                <th scope="col">
                  <span className="com-sr">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {alocacoes.map(alocacao => {
                const id = String(alocacao.id);
                const calculado = calculados.find(item => item.id === id) || {};

                return (
                  <tr key={id}>
                    <td>
                      <select
                        aria-label="Cargo"
                        value={String(alocacao.role || '')}
                        onChange={event => {
                          const cargo = event.target.value;
                          // Repõe o salário oficial ao trocar de cargo — ver
                          // o comentário no topo do arquivo.
                          editar(id, { role: cargo, monthlySalary: roleSalary(cargo) });
                        }}
                      >
                        {(LEC_LABOR_ROLES as AnyRecord[]).map(cargo => (
                          <option key={String(cargo.role)} value={String(cargo.role)}>
                            {String(cargo.role)}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <select
                        aria-label="Turno"
                        value={String(alocacao.shift || 'day')}
                        onChange={event => editar(id, { shift: event.target.value })}
                      >
                        {TURNOS.map(turno => (
                          <option key={turno.value} value={turno.value}>
                            {turno.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <input
                        type="number"
                        aria-label="Quantidade de pessoas"
                        value={(alocacao.quantity as number) ?? ''}
                        min={0}
                        onChange={event =>
                          editar(id, {
                            quantity: event.target.value === '' ? 0 : Number(event.target.value)
                          })
                        }
                      />
                    </td>

                    <td>
                      <MoneyInput
                        aria-label="Salário base"
                        value={(alocacao.monthlySalary as number) ?? ''}
                        onChange={valor =>
                          editar(id, {
                            monthlySalary:
                              valor
                          })
                        }
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        aria-label="Adicional"
                        value={(alocacao.adjustment as number) ?? ''}
                        min={0}
                        step={0.01}
                        onChange={event =>
                          editar(id, {
                            adjustment:
                              event.target.value === '' ? 0 : Number(event.target.value)
                          })
                        }
                      />
                    </td>

                    <td>
                      <input
                        type="number"
                        aria-label="Percentual de alocação"
                        value={(alocacao.allocationPercent as number) ?? ''}
                        min={0}
                        max={100}
                        step={1}
                        onChange={event =>
                          editar(id, {
                            allocationPercent:
                              event.target.value === '' ? 0 : Number(event.target.value)
                          })
                        }
                      />
                    </td>

                    <td className="com-calculado">
                      {number(numberValue(calculado.totalHours))}
                    </td>
                    <td className="com-calculado">
                      <strong>{money(numberValue(calculado.total))}</strong>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="com-remover"
                        aria-label={`Remover ${String(alocacao.role || 'alocação')}`}
                        onClick={() => removeNested('laborContexts', faseId, 'assignments', id)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="com-vazio">Nenhum cargo alocado nesta fase.</div>
      )}

      <button
        type="button"
        className="com-btn-add"
        onClick={() => addNested('laborContexts', faseId, 'assignments', novaAlocacao())}
      >
        + Adicionar cargo
      </button>
    </section>
  );
}
