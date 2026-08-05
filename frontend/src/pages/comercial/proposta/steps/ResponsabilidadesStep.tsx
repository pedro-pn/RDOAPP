import { AvisoPendencia } from '../../custos/ConfirmacaoEscopo';
import {
  CATEGORIAS_RESPONSABILIDADE,
  RESPONSAVEIS,
  linhaVazia,
  type LinhaResponsabilidade
} from '../etapas';

/**
 * Etapa 3 — Matriz de responsabilidades (`PROP-CTL-034..042`).
 *
 * Porte de `app/page.tsx:987-1007`.
 *
 * A trava: ao menos uma linha **com item preenchido**. A referência exigia só a
 * existência da linha, e uma linha em branco atravessa para o documento como uma
 * obrigação sem texto — pior do que a ausência dela, porque parece que alguém quis
 * dizer algo e não disse.
 *
 * "N/A" é uma resposta legítima, não um valor vazio: existe obrigação que não cabe a
 * ninguém no contrato e precisa constar assim mesmo, para não parecer esquecimento.
 */

export function ResponsabilidadesStep({
  linhas,
  onLinhas,
  mostrarErros
}: {
  linhas: LinhaResponsabilidade[];
  onLinhas: (atualizar: (atual: LinhaResponsabilidade[]) => LinhaResponsabilidade[]) => void;
  mostrarErros: boolean;
}) {
  const preenchidas = linhas.filter(linha => linha.item.trim()).length;

  type CampoDeTexto = 'item' | 'owner' | 'note' | 'categoria';

  function editar(indice: number, campo: CampoDeTexto, valor: string) {
    onLinhas(atual =>
      atual.map((linha, i) => (i === indice ? { ...linha, [campo]: valor } : linha))
    );
  }

  return (
    <section className="com-painel">
      <div className="com-secao-titulo">
        <div>
          <h2>Matriz de responsabilidades</h2>
          <p>As obrigações serão agrupadas por Filtrovali e Contratante.</p>
        </div>
        <button
          type="button"
          className="com-btn-add"
          onClick={() => onLinhas(atual => [...atual, linhaVazia()])}
        >
          + Adicionar responsabilidade
        </button>
      </div>

      {mostrarErros && preenchidas === 0 && (
        <AvisoPendencia>
          Informe ao menos uma responsabilidade com o item preenchido.
        </AvisoPendencia>
      )}

      <datalist id="com-categorias-responsabilidade">
        {CATEGORIAS_RESPONSABILIDADE.map(nome => (
          <option key={nome} value={nome} />
        ))}
      </datalist>

      {linhas.length > 0 ? (
        <div className="com-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Categoria</th>
                <th scope="col">Item / escopo</th>
                <th scope="col">Responsável</th>
                <th scope="col">Nota</th>
                <th scope="col">
                  <span className="com-sr">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha, indice) => {
                const semItem = mostrarErros && !linha.item.trim();
                return (
                  <tr key={indice}>
                    <td>
                      {/* O subtítulo que agrupa as linhas no documento. Editável
                          porque obra nenhuma usa as dez categorias, e porque há
                          proposta que precisa de uma que o catálogo não previu. */}
                      <input
                        aria-label={`Categoria da responsabilidade ${indice + 1}`}
                        list="com-categorias-responsabilidade"
                        value={linha.categoria}
                        onChange={evento => editar(indice, 'categoria', evento.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Item da responsabilidade ${indice + 1}`}
                        className={semItem ? 'com-campo-invalido' : undefined}
                        aria-invalid={semItem || undefined}
                        value={linha.item}
                        onChange={evento => editar(indice, 'item', evento.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        aria-label={`Responsável pelo item ${indice + 1}`}
                        value={linha.owner}
                        onChange={evento => editar(indice, 'owner', evento.target.value)}
                      >
                        {RESPONSAVEIS.map(nome => (
                          <option key={nome} value={nome}>
                            {nome}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        aria-label={`Nota do item ${indice + 1}`}
                        value={linha.note}
                        onChange={evento => editar(indice, 'note', evento.target.value)}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="com-remover"
                        aria-label={`Remover responsabilidade ${indice + 1}`}
                        onClick={() => onLinhas(atual => atual.filter((_, i) => i !== indice))}
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
        <div className="com-vazio">Nenhuma responsabilidade cadastrada.</div>
      )}
    </section>
  );
}
