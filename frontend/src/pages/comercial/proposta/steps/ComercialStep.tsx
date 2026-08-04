import { Area, Field } from '../../components/Field';
import { AvisoPendencia } from '../../custos/ConfirmacaoEscopo';
import { formatarDinheiro, type ItemDePreco } from '../etapas';

/**
 * Etapa 6 — Conteúdo da proposta comercial (`PROP-CTL-058..071`).
 *
 * Porte de `app/page.tsx:1044-1071`.
 *
 * **"Incluir valor unitário" muda o documento, não só a tela.** Marcado, a tabela do
 * PDF ganha as colunas de preço unitário e quantidade; desmarcado, o cliente vê só o
 * total. É decisão comercial — há proposta em que abrir o unitário convida a
 * negociação linha a linha.
 *
 * Os valores são **texto**, não número, e isso é da referência: eles são digitados
 * com máscara de moeda e vão para o documento como foram escritos. O cálculo do preço
 * mora no levantamento de custos, não aqui — esta tabela é o que se imprime.
 */

type AnyRecord = Record<string, unknown>;

type Props = {
  form: AnyRecord;
  editar: (patch: AnyRecord) => void;
  precos: ItemDePreco[];
  onPrecos: (atualizar: (atual: ItemDePreco[]) => ItemDePreco[]) => void;
  incluirUnitario: boolean;
  onIncluirUnitario: (valor: boolean) => void;
  erroDe: (campo: string) => string | undefined;
  mostrarErros: boolean;
};

export function ComercialStep({
  form,
  editar,
  precos,
  onPrecos,
  incluirUnitario,
  onIncluirUnitario,
  erroDe,
  mostrarErros
}: Props) {
  const completos = precos.filter(
    item => item.description.trim() && item.unit.trim() && item.value.trim()
  ).length;

  function editarPreco(indice: number, campo: keyof ItemDePreco, valor: string) {
    onPrecos(atual =>
      atual.map((item, i) => (i === indice ? { ...item, [campo]: valor } : item))
    );
  }

  return (
    <section className="com-painel">
      <div className="com-secao-titulo">
        <div>
          <h2>Conteúdo da proposta comercial</h2>
          <p>Cadastre preços, condições, impostos e observações comerciais.</p>
        </div>
        <button
          type="button"
          className="com-btn-add"
          onClick={() =>
            onPrecos(atual => [
              ...atual,
              { description: '', unit: '', quantity: '1', unitValue: '', value: '' }
            ])
          }
        >
          + Adicionar item de preço
        </button>
      </div>

      <label className="com-incluir com-incluir-bloco">
        <input
          type="checkbox"
          checked={incluirUnitario}
          onChange={evento => onIncluirUnitario(evento.target.checked)}
        />
        <span>
          <strong>Incluir valor unitário</strong>
          <small>
            Exibe preço unitário, quantidade e total conforme o modelo oficial.
          </small>
        </span>
      </label>

      {mostrarErros && completos === 0 && (
        <AvisoPendencia>
          Informe ao menos um item de preço com descrição, unidade e valor total.
        </AvisoPendencia>
      )}

      {precos.length > 0 ? (
        <div className="com-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Descrição</th>
                <th scope="col">Unidade</th>
                <th scope="col">Qtd.</th>
                {incluirUnitario && <th scope="col">Valor unitário</th>}
                <th scope="col">Valor total</th>
                <th scope="col">
                  <span className="com-sr">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {precos.map((item, indice) => {
                const incompleto =
                  mostrarErros &&
                  (item.description.trim() || item.value.trim()) &&
                  !(item.description.trim() && item.unit.trim() && item.value.trim());

                return (
                  <tr key={indice}>
                    <td>
                      <input
                        aria-label={`Descrição do item ${indice + 1}`}
                        className={
                          incompleto && !item.description.trim()
                            ? 'com-campo-invalido'
                            : undefined
                        }
                        value={item.description}
                        onChange={e => editarPreco(indice, 'description', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Unidade do item ${indice + 1}`}
                        className={
                          incompleto && !item.unit.trim() ? 'com-campo-invalido' : undefined
                        }
                        value={item.unit}
                        onChange={e => editarPreco(indice, 'unit', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        inputMode="decimal"
                        aria-label={`Quantidade do item ${indice + 1}`}
                        value={item.quantity}
                        onChange={e => editarPreco(indice, 'quantity', e.target.value)}
                      />
                    </td>
                    {incluirUnitario && (
                      <td>
                        <input
                          inputMode="numeric"
                          aria-label={`Valor unitário do item ${indice + 1}`}
                          placeholder="R$ 0,00"
                          value={item.unitValue}
                          onChange={e =>
                            editarPreco(indice, 'unitValue', formatarDinheiro(e.target.value))
                          }
                        />
                      </td>
                    )}
                    <td>
                      <input
                        inputMode="numeric"
                        aria-label={`Valor total do item ${indice + 1}`}
                        placeholder="R$ 0,00"
                        className={
                          incompleto && !item.value.trim() ? 'com-campo-invalido' : undefined
                        }
                        value={item.value}
                        onChange={e =>
                          editarPreco(indice, 'value', formatarDinheiro(e.target.value))
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="com-remover"
                        aria-label={`Remover item ${indice + 1}`}
                        onClick={() => onPrecos(atual => atual.filter((_, i) => i !== indice))}
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
        <div className="com-vazio">Nenhum item de preço cadastrado.</div>
      )}

      <div className="com-form-grid">
        <Area
          label="Condições de pagamento"
          required
          value={String(form.payment ?? '')}
          error={erroDe('payment')}
          onChange={valor => editar({ payment: valor })}
        />
        <Area
          label="Observações comerciais"
          value={String(form.observations ?? '')}
          onChange={valor => editar({ observations: valor })}
        />
      </div>

      <Area
        label="Impostos"
        required
        value={String(form.taxes ?? '')}
        error={erroDe('taxes')}
        onChange={valor => editar({ taxes: valor })}
      />

      <Field
        label="Validade das propostas (dias)"
        required
        type="number"
        inputMode="numeric"
        value={String(form.validity ?? '')}
        error={erroDe('validity')}
        onChange={valor => editar({ validity: valor })}
      />
    </section>
  );
}
