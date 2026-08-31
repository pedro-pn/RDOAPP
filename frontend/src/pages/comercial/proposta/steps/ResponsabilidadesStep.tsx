import { useState } from 'react';

import { EQUIPAMENTOS_E_FERRAMENTAS_PADRAO } from '../../../../../../shared/comercial/dist/modelo-documento.js';
import { AvisoPendencia } from '../../custos/ConfirmacaoEscopo';
import {
  RESPONSAVEIS,
  acrescentarCategoria,
  ehLinhaDeEquipamentosDaFiltrovali,
  linhaVazia,
  removerCategoria,
  type LinhaResponsabilidade
} from '../etapas';
import { equipamentosSugeridosPeloEscopo } from '../equipamentosDaProposta';

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
  servicos,
  categorias,
  onCategorias,
  erroDe,
  mostrarErros
}: {
  linhas: LinhaResponsabilidade[];
  onLinhas: (atualizar: (atual: LinhaResponsabilidade[]) => LinhaResponsabilidade[]) => void;
  servicos: Array<{ title?: string; description?: string }>;
  categorias: string[];
  onCategorias: (proximas: string[]) => void;
  /**
   * A pendência da etapa, vinda de `pendenciasDasResponsabilidades` (T067).
   *
   * A mensagem chega por aqui em vez de ser escrita no aviso abaixo porque
   * estava escrita nos dois lugares, palavra por palavra. Duas cópias da mesma
   * frase divergem na primeira vez que alguém melhora uma delas — e aí o
   * contador conta uma coisa e a tela diz outra.
   */
  erroDe: (campo: string) => string | undefined;
  mostrarErros: boolean;
}) {
  const [novaCategoria, setNovaCategoria] = useState('');
  const [novoEquipamento, setNovoEquipamento] = useState('');
  const [recado, setRecado] = useState('');
  const [recadoEquipamentos, setRecadoEquipamentos] = useState('');
  const [gerenciando, setGerenciando] = useState(false);

  const indiceDosEquipamentos = linhas.findIndex(ehLinhaDeEquipamentosDaFiltrovali);
  const linhaDosEquipamentos = linhas[indiceDosEquipamentos];
  const equipamentosSelecionados = (linhaDosEquipamentos?.subitens || []).filter(item =>
    item.trim()
  );
  const equipamentosPersonalizados = equipamentosSelecionados.filter(
    item => !EQUIPAMENTOS_E_FERRAMENTAS_PADRAO.includes(
      item as (typeof EQUIPAMENTOS_E_FERRAMENTAS_PADRAO)[number]
    )
  );
  const equipamentosSugeridos = equipamentosSugeridosPeloEscopo(servicos);
  const opcoesDeEquipamento = [
    ...equipamentosSugeridos,
    ...EQUIPAMENTOS_E_FERRAMENTAS_PADRAO.filter(
      equipamento => !equipamentosSugeridos.includes(equipamento)
    ),
    ...equipamentosPersonalizados
  ];
  const sugestoesNaoSelecionadas = equipamentosSugeridos.filter(
    equipamento => !equipamentosSelecionados.includes(equipamento)
  );

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

  function definirEquipamentos(proximos: string[]) {
    if (indiceDosEquipamentos < 0) return;
    onLinhas(atual =>
      atual.map((linha, indice) =>
        indice === indiceDosEquipamentos ? { ...linha, subitens: proximos } : linha
      )
    );
  }

  function alternarEquipamento(equipamento: string, selecionado: boolean) {
    setRecadoEquipamentos('');
    definirEquipamentos(
      selecionado
        ? [...equipamentosSelecionados, equipamento]
        : equipamentosSelecionados.filter(item => item !== equipamento)
    );
  }

  function adicionarEquipamento() {
    const novo = novoEquipamento.trim();
    if (!novo) {
      setRecadoEquipamentos('Informe o equipamento ou ferramenta adicional.');
      return;
    }
    if (
      equipamentosSelecionados.some(
        item => item.localeCompare(novo, 'pt-BR', { sensitivity: 'base' }) === 0
      )
    ) {
      setRecadoEquipamentos('Este equipamento já está selecionado.');
      return;
    }

    definirEquipamentos([...equipamentosSelecionados, novo]);
    setNovoEquipamento('');
    setRecadoEquipamentos('');
  }

  function selecionarSugestoes() {
    definirEquipamentos([
      ...equipamentosSelecionados,
      ...sugestoesNaoSelecionadas
    ]);
    setRecadoEquipamentos('');
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

      {linhaDosEquipamentos && (
        <section
          className={`com-equipamentos-proposta${
            mostrarErros && erroDe('equipamentos') ? ' is-invalid' : ''
          }`}
          aria-labelledby="com-equipamentos-titulo"
        >
          <div className="com-equipamentos-cabecalho">
            <div>
              <h3 id="com-equipamentos-titulo">Equipamentos e ferramentas desta proposta</h3>
              <p>
                Selecione somente o que será fornecido nesta obra. A relação escolhida
                será impressa no capítulo 3.
              </p>
            </div>
            <div>
              <strong>{equipamentosSelecionados.length} selecionado(s)</strong>
              {sugestoesNaoSelecionadas.length > 0 && (
                <button
                  type="button"
                  className="com-btn com-btn-fantasma"
                  onClick={selecionarSugestoes}
                >
                  Selecionar sugestões do escopo
                </button>
              )}
            </div>
          </div>

          {equipamentosSugeridos.length > 0 && (
            <p className="com-equipamentos-sugestao">
              {equipamentosSugeridos.length} equipamento(s) sugerido(s) pelos serviços do
              capítulo 2.
            </p>
          )}

          <div className="com-equipamentos-opcoes">
            {opcoesDeEquipamento.map(equipamento => (
              <label
                key={equipamento}
                className={
                  equipamentosSugeridos.includes(equipamento) ? 'is-sugerido' : undefined
                }
              >
                <input
                  type="checkbox"
                  checked={equipamentosSelecionados.includes(equipamento)}
                  onChange={evento =>
                    alternarEquipamento(equipamento, evento.target.checked)
                  }
                />
                <span>{equipamento}</span>
                {equipamentosSugeridos.includes(equipamento) && <small>Sugerido pelo escopo</small>}
              </label>
            ))}
          </div>

          <div className="com-equipamentos-adicional">
            <div className="field-group">
              <label htmlFor="com-novo-equipamento">Outro equipamento ou ferramenta</label>
              <input
                id="com-novo-equipamento"
                value={novoEquipamento}
                placeholder="Ex.: 2 mangueiras hidráulicas de 20 m"
                onChange={evento => setNovoEquipamento(evento.target.value)}
                onKeyDown={evento => {
                  if (evento.key !== 'Enter') return;
                  evento.preventDefault();
                  adicionarEquipamento();
                }}
              />
            </div>
            <button
              type="button"
              className="com-btn com-btn-fantasma"
              onClick={adicionarEquipamento}
            >
              Adicionar equipamento
            </button>
          </div>

          {recadoEquipamentos && <p className="com-recado">{recadoEquipamentos}</p>}
          {mostrarErros && erroDe('equipamentos') && (
            <AvisoPendencia>{erroDe('equipamentos')}</AvisoPendencia>
          )}
        </section>
      )}

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

      {mostrarErros && erroDe('responsabilidades') && (
        <AvisoPendencia>{erroDe('responsabilidades')}</AvisoPendencia>
      )}

      {linhas.length > 0 ? (
        <div className="com-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Categoria</th>
                <th scope="col">
                  Item / escopo<span className="survey-required-marker">*</span>
                </th>
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
