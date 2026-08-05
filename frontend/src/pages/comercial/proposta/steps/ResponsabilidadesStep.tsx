import { useState } from 'react';

import { AvisoPendencia } from '../../custos/ConfirmacaoEscopo';
import {
  RESPONSAVEIS,
  acrescentarCategoria,
  linhaVazia,
  removerCategoria,
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
 *
 * **A categoria é lista, não campo livre.** Ela vira subtítulo agrupador no
 * documento, então "Logística", "LOGISTICA " e "LOGÍSTICA" digitadas em linhas
 * diferentes produziriam três subtítulos onde deveria haver um. A lista é
 * editável — dá para acrescentar o que faltar e remover o que não se usa —, mas
 * escolher é sempre escolher de uma lista.
 */

export function ResponsabilidadesStep({
  linhas,
  onLinhas,
  categorias,
  onCategorias,
  mostrarErros
}: {
  linhas: LinhaResponsabilidade[];
  onLinhas: (atualizar: (atual: LinhaResponsabilidade[]) => LinhaResponsabilidade[]) => void;
  categorias: string[];
  onCategorias: (proximas: string[]) => void;
  mostrarErros: boolean;
}) {
  const preenchidas = linhas.filter(linha => linha.item.trim()).length;
  const [novaCategoria, setNovaCategoria] = useState('');
  const [recado, setRecado] = useState('');
  const [gerenciando, setGerenciando] = useState(false);

  type CampoDeTexto = 'item' | 'owner' | 'note' | 'categoria';

  function editar(indice: number, campo: CampoDeTexto, valor: string) {
    onLinhas(atual =>
      atual.map((linha, i) => (i === indice ? { ...linha, [campo]: valor } : linha))
    );
  }

  function adicionar() {
    const resultado = acrescentarCategoria(categorias, novaCategoria);
    setRecado(resultado.erro || '');
    if (resultado.erro) return;
    onCategorias(resultado.lista);
    setNovaCategoria('');
  }

  function remover(categoria: string) {
    const resultado = removerCategoria(categorias, categoria, linhas);
    setRecado(resultado.erro || '');
    if (!resultado.erro) onCategorias(resultado.lista);
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

      <div className="com-categorias">
        <button
          type="button"
          className="com-btn com-btn-fantasma"
          aria-expanded={gerenciando}
          onClick={() => setGerenciando(atual => !atual)}
        >
          {gerenciando ? 'Fechar categorias' : `Categorias (${categorias.length})`}
        </button>

        {gerenciando && (
          <div className="com-categorias-editor">
            <ul>
              {categorias.map(categoria => (
                <li key={categoria}>
                  <span>{categoria}</span>
                  <button
                    type="button"
                    className="com-remover"
                    aria-label={`Remover categoria ${categoria}`}
                    onClick={() => remover(categoria)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>

            <div className="com-categorias-nova">
              <div className="field-group">
                <label htmlFor="com-nova-categoria">Nova categoria</label>
                <input
                  id="com-nova-categoria"
                  value={novaCategoria}
                  placeholder="Ex.: TREINAMENTO"
                  onChange={evento => setNovaCategoria(evento.target.value)}
                  onKeyDown={evento => {
                    if (evento.key !== 'Enter') return;
                    // Enter num input solto submeteria o formulário da etapa.
                    evento.preventDefault();
                    adicionar();
                  }}
                />
              </div>
              <button type="button" className="com-btn com-btn-fantasma" onClick={adicionar}>
                Adicionar
              </button>
            </div>

            {recado && <p className="com-recado">{recado}</p>}
          </div>
        )}
      </div>

      {mostrarErros && preenchidas === 0 && (
        <AvisoPendencia>
          Informe ao menos uma responsabilidade com o item preenchido.
        </AvisoPendencia>
      )}

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
                /* Categoria vinda de rascunho antigo pode não estar mais na
                   lista. Sem esta opção o `select` mostraria a primeira da lista
                   e trocaria a categoria da linha sem ninguém pedir. */
                const foraDaLista =
                  linha.categoria && !categorias.includes(linha.categoria);

                return (
                  <tr key={indice}>
                    <td>
                      <select
                        aria-label={`Categoria da responsabilidade ${indice + 1}`}
                        value={linha.categoria}
                        onChange={evento => editar(indice, 'categoria', evento.target.value)}
                      >
                        <option value="">— sem categoria —</option>
                        {foraDaLista && (
                          <option value={linha.categoria}>{linha.categoria}</option>
                        )}
                        {categorias.map(categoria => (
                          <option key={categoria} value={categoria}>
                            {categoria}
                          </option>
                        ))}
                      </select>
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
