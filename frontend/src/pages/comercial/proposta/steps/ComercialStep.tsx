import { Area, Field } from '../../components/Field';
import { AvisoPendencia } from '../../custos/ConfirmacaoEscopo';
import {
  tabelasDePrecoDoModelo,
  type LocalOperacao,
  type ModeloProposta
} from '../../../../../../shared/comercial/dist/modelo-documento.js';
// O MESMO leitor de moeda do servidor e do gerador do documento. Um leitor
// próprio aqui mostraria ao vendedor um total que o CRM não confirma.
import { moeda, somarDinheiro } from '../../../../../../shared/comercial/dist/dinheiro.js';
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

/** Os quatro valores da tabela "Condições de Stand by e Mobilização Adicional". */
const CAMPOS_STANDBY: Array<{ campo: string; label: string }> = [
  { campo: 'overtimeRate', label: 'Homem/hora fora do horário previsto' },
  { campo: 'standbyTeam', label: 'Stand-by de equipe (diária)' },
  { campo: 'standbyEquipment', label: 'Stand-by de equipamentos (diária)' },
  { campo: 'extraMobilization', label: 'Mobilização extra (por evento ida e volta)' }
];

/**
 * O cenário pré-selecionado.
 *
 * ONSHORE porque é o mais comum, apurado pelo mantenedor em 12/08. Pré-selecionar
 * não é decidir pelo vendedor: as duas somas ficam à vista lado a lado, e é
 * justamente ver os dois números que faz notar quando o caso é o outro.
 */
const PADRAO_DE_CENARIO: LocalOperacao = 'ONSHORE';

type Props = {
  form: AnyRecord;
  editar: (patch: AnyRecord) => void;
  precos: ItemDePreco[];
  onPrecos: (atualizar: (atual: ItemDePreco[]) => ItemDePreco[]) => void;
  incluirUnitario: boolean;
  onIncluirUnitario: (valor: boolean) => void;
  erroDe: (campo: string) => string | undefined;
  mostrarErros: boolean;
  modelo: ModeloProposta;
};

export function ComercialStep({
  form,
  editar,
  precos,
  onPrecos,
  incluirUnitario,
  onIncluirUnitario,
  erroDe,
  mostrarErros,
  modelo
}: Props) {
  // Hidrojateamento apresenta DUAS tabelas, ONSHORE e OFFSHORE, cada uma com o
  // seu TOTAL GERAL (T071f). O modelo padrão tem uma só, e aí `local` é
  // indefinido em todos os itens.
  const locais = tabelasDePrecoDoModelo(modelo);
  const cenarioInformado = String(form.priceScenario ?? '').trim().toUpperCase();
  const cenarioEscolhido =
    locais?.find(local => local === cenarioInformado) ?? PADRAO_DE_CENARIO;
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

      {(locais ?? [undefined]).map(local => (
        <TabelaDePrecos
          key={local ?? 'unica'}
          local={local}
          precos={precos}
          onPrecos={onPrecos}
          incluirUnitario={incluirUnitario}
          mostrarErros={mostrarErros}
          editarPreco={editarPreco}
        />
      ))}

      {locais && locais.length > 1 && (
        <CenarioContratado
          locais={locais}
          precos={precos}
          escolhido={cenarioEscolhido}
          onEscolher={valor => editar({ priceScenario: valor })}
        />
      )}


      {/* Item 9 do documento intercala prosa e tabela: a frase da hora extra, o
          título do bloco, a TABELA, a explicação de cada linha e só então as
          observações gerais. Estes quatro são os MERGEFIELDs `valor_he`,
          `valor_standby`, `diaria_equipamento` e `valor_desmob_extra`, que não
          existiam em campo nenhum — T071d. */}
      <fieldset className="com-fieldset">
        <legend>Stand-by e mobilização adicional</legend>
        <p className="com-fieldset-nota">
          Saem na tabela do item 9 da proposta comercial.
        </p>
        <div className="com-form-grid">
          {CAMPOS_STANDBY.map(({ campo, label }) => (
            <Field
              key={campo}
              label={label}
              inputMode="numeric"
              placeholder="R$ 0,00"
              value={String(form[campo] ?? '')}
              onChange={valor => editar({ [campo]: formatarDinheiro(valor) })}
            />
          ))}
        </div>
      </fieldset>

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

/**
 * Uma tabela de preços.
 *
 * No modelo padrão há uma; no de hidrojateamento há duas, ONSHORE e OFFSHORE,
 * cada uma com o **seu** TOTAL GERAL (T071f). Somar as duas juntas apresentaria
 * ao cliente um total que ele não vai pagar: são cenários alternativos de
 * execução, não parcelas do mesmo serviço.
 *
 * O índice usado na edição é o do array COMPLETO, não o da fatia. Editar pelo
 * índice da fatia trocaria o item errado assim que a primeira tabela tivesse
 * mais de uma linha — e o erro seria silencioso.
 */
/**
 * Qual das duas tabelas o cliente vai contratar (T130).
 *
 * ONSHORE e OFFSHORE são cenários **alternativos**: o cliente contrata um ou o
 * outro. O documento leva as duas — é proposta, o cliente escolhe —, mas o
 * `totalValue` que vai ao CRM e ao histórico é de um só.
 *
 * Até aqui o servidor decidia pela **maior** das duas. Não era regra de negócio;
 * era um chute com cara de regra, e o número ia para fora sem ninguém conferir.
 *
 * As duas somas aparecem lado a lado de propósito: escolher entre "ONSHORE" e
 * "OFFSHORE" sem ver os valores é escolher no escuro, e é vendo os dois números
 * que se percebe quando o caso é o menos comum.
 */
function CenarioContratado({
  locais,
  precos,
  escolhido,
  onEscolher
}: {
  locais: readonly LocalOperacao[];
  precos: ItemDePreco[];
  escolhido: string;
  onEscolher: (valor: LocalOperacao) => void;
}) {
  return (
    <fieldset className="com-fieldset">
      <legend>Cenário contratado</legend>
      <p className="com-fieldset-nota">
        As duas tabelas vão no documento. Este é o valor que será registrado no CRM e no
        histórico — o cliente contrata um cenário, não os dois.
      </p>
      <div className="com-modo-opcoes">
        {locais.map(local => (
          <label
            key={local}
            className={escolhido === local ? 'com-modo-card com-modo-ativo' : 'com-modo-card'}
          >
            <input
              type="radio"
              name="cenario-contratado"
              value={local}
              checked={escolhido === local}
              onChange={() => onEscolher(local)}
            />
            <strong>{local}</strong>
            <span>{moeda(somarDinheiro(precos.filter(p => p.local === local).map(p => p.value)))}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function TabelaDePrecos({
  local,
  precos,
  onPrecos,
  incluirUnitario,
  mostrarErros,
  editarPreco
}: {
  local?: LocalOperacao;
  precos: ItemDePreco[];
  onPrecos: (atualizar: (atual: ItemDePreco[]) => ItemDePreco[]) => void;
  incluirUnitario: boolean;
  mostrarErros: boolean;
  editarPreco: (indice: number, campo: keyof ItemDePreco, valor: string) => void;
}) {
  const daTabela = precos
    .map((item, indice) => ({ item, indice }))
    .filter(({ item }) => (local ? item.local === local : true));

  return (
    <div className="com-tabela-precos">
      <div className="com-secao-titulo">
        {local ? <h3>{local}</h3> : <span />}
        <button
          type="button"
          className="com-btn-add"
          onClick={() =>
            onPrecos(atual => [
              ...atual,
              {
                description: '',
                unit: '',
                quantity: '1',
                unitValue: '',
                value: '',
                ...(local ? { local } : {})
              }
            ])
          }
        >
          + Adicionar item de preço
        </button>
      </div>

      {daTabela.length > 0 ? (
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
              {daTabela.map(({ item, indice }, ordem) => {
                const incompleto =
                  mostrarErros &&
                  (item.description.trim() || item.value.trim()) &&
                  !(item.description.trim() && item.unit.trim() && item.value.trim());
                const rotulo = `${ordem + 1}${local ? ` de ${local}` : ''}`;

                return (
                  <tr key={indice}>
                    <td>
                      <input
                        aria-label={`Descrição do item ${rotulo}`}
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
                        aria-label={`Unidade do item ${rotulo}`}
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
                        aria-label={`Quantidade do item ${rotulo}`}
                        value={item.quantity}
                        onChange={e => editarPreco(indice, 'quantity', e.target.value)}
                      />
                    </td>
                    {incluirUnitario && (
                      <td>
                        <input
                          inputMode="numeric"
                          aria-label={`Valor unitário do item ${rotulo}`}
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
                        aria-label={`Valor total do item ${rotulo}`}
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
                        aria-label={`Remover item ${rotulo}`}
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
    </div>
  );
}
