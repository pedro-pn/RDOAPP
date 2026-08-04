import {
  MAX_SCOPE_PHOTOS,
  MAX_SCOPE_TABLE_CELL_CHARACTERS,
  MAX_SCOPE_TABLE_COLUMNS,
  MAX_SCOPE_TABLE_ROWS,
  MAX_SCOPE_TABLES,
  countScopePhotos,
  countScopeTables,
  createScopeTableBlock,
  type ScopeBlock,
  type ScopeTableBlock
} from '../../../../../../shared/comercial/dist/scope-content.js';

/**
 * Blocos de conteúdo de um item de escopo — tabelas e fotos (`PROP-CTL-113..128`).
 *
 * Porte de `ScopeContentEditor` (`app/page.tsx:1319`).
 *
 * **Este subsistema quase se perdeu no planejamento**, e vale lembrar por quê: o
 * componente é *definido* depois da prévia no fonte, então os 16 controles caíam na
 * faixa de ID que a tabela de cobertura mandava para a prévia. Estavam "cobertos" por
 * uma tarefa que fala de abas e contador de páginas. Cobertura por faixa prova que
 * ninguém esqueceu de listar o controle — não prova que alguém entendeu o que ele faz.
 *
 * **Os limites são por PROPOSTA, não por item** (`allBlocks`, não `blocks`). Oito
 * tabelas espalhadas em quatro serviços já esgotam a cota. Contar por item deixaria
 * uma proposta com 32 tabelas passar, e o gerador de PDF não aguenta.
 *
 * As fotos entram numa passada própria, com a cadeia de recusa do servidor (T074a).
 * Até lá o controle existe e diz por quê — um botão que some é indistinguível de um
 * botão que nunca existiu.
 */

type Props = {
  itemId: string;
  /** Os blocos deste item, na ordem em que aparecem. */
  blocks: ScopeBlock[];
  /** Todos os blocos da proposta — é neles que os limites são contados. */
  allBlocks: ScopeBlock[];
  onChange: (atualizar: (atual: ScopeBlock[]) => ScopeBlock[]) => void;
};

function novoId(prefixo: string) {
  return `${prefixo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ScopeContentEditor({ itemId, blocks, allBlocks, onChange }: Props) {
  const tabelasNoLimite = countScopeTables(allBlocks) >= MAX_SCOPE_TABLES;

  function atualizarBloco(id: string, atualizar: (bloco: ScopeBlock) => ScopeBlock) {
    onChange(atual => atual.map(bloco => (bloco.id === id ? atualizar(bloco) : bloco)));
  }

  function atualizarTabela(id: string, atualizar: (t: ScopeTableBlock) => ScopeTableBlock) {
    atualizarBloco(id, bloco => (bloco.type === 'table' ? atualizar(bloco) : bloco));
  }

  function removerBloco(id: string) {
    onChange(atual => atual.filter(bloco => bloco.id !== id));
  }

  /**
   * Move dentro da lista **do item**, mas edita a lista **global**.
   *
   * Os blocos de todos os serviços vivem num array só. Trocar por índice local
   * moveria o bloco do serviço errado assim que houvesse mais de um serviço — por
   * isso a troca é feita pelos índices que os dois blocos ocupam no array global.
   */
  function moverBloco(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao;
    if (destino < 0 || destino >= blocks.length) return;

    onChange(atual => {
      const origemGlobal = atual.findIndex(b => b.id === blocks[indice]?.id);
      const destinoGlobal = atual.findIndex(b => b.id === blocks[destino]?.id);
      if (origemGlobal < 0 || destinoGlobal < 0) return atual;

      const proximo = [...atual];
      [proximo[origemGlobal], proximo[destinoGlobal]] = [
        proximo[destinoGlobal],
        proximo[origemGlobal]
      ];
      return proximo;
    });
  }

  function acrescentarTabela() {
    onChange(atual => [...atual, createScopeTableBlock(novoId('tabela'), itemId)]);
  }

  return (
    <section className="com-blocos" aria-label="Tabelas e fotos deste serviço">
      <div className="com-secao-titulo">
        <div>
          <strong>Tabelas e fotos deste serviço</strong>
          <span>
            Inclua apenas quando necessário. Sem upload, nenhuma foto será inserida
            neste item.
          </span>
        </div>
        <div className="com-blocos-acoes">
          <button
            type="button"
            className="com-btn-add"
            disabled={tabelasNoLimite}
            title={
              tabelasNoLimite
                ? `Limite de ${MAX_SCOPE_TABLES} tabelas por proposta atingido`
                : undefined
            }
            onClick={acrescentarTabela}
          >
            ＋ Inserir tabela
          </button>
          <button
            type="button"
            className="com-btn-add"
            disabled
            title={
              countScopePhotos(allBlocks) >= MAX_SCOPE_PHOTOS
                ? `Limite de ${MAX_SCOPE_PHOTOS} fotos por proposta atingido`
                : 'O envio de fotos entra junto com a gravação no servidor'
            }
          >
            ＋ Incluir fotos
          </button>
        </div>
      </div>

      <p className="com-nota">
        Até {MAX_SCOPE_TABLES} tabelas e {MAX_SCOPE_PHOTOS} fotos JPEG, PNG ou WebP por
        proposta. As imagens são otimizadas automaticamente e preservadas para futuras
        revisões.
      </p>

      {blocks.length === 0 ? (
        <div className="com-vazio">
          Nenhuma tabela ou foto adicionada. Use os botões acima quando o escopo
          precisar de conteúdo visual.
        </div>
      ) : (
        <div className="com-blocos-lista">
          {blocks.map((bloco, indice) => (
            <article className="com-bloco" key={bloco.id}>
              <div className="com-bloco-topo">
                <strong>
                  {bloco.type === 'table'
                    ? `Tabela ${blocks.slice(0, indice + 1).filter(b => b.type === 'table').length}`
                    : `Foto ${blocks.slice(0, indice + 1).filter(b => b.type === 'photo').length}`}
                </strong>
                <div className="com-bloco-ordem">
                  <button
                    type="button"
                    className="com-btn com-btn-fantasma"
                    aria-label="Mover conteúdo para cima"
                    disabled={indice === 0}
                    onClick={() => moverBloco(indice, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="com-btn com-btn-fantasma"
                    aria-label="Mover conteúdo para baixo"
                    disabled={indice === blocks.length - 1}
                    onClick={() => moverBloco(indice, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="com-remover"
                    aria-label={`Remover ${bloco.type === 'table' ? 'tabela' : 'foto'}`}
                    onClick={() => removerBloco(bloco.id)}
                  >
                    ×
                  </button>
                </div>
              </div>

              {bloco.type === 'table' ? (
                <TabelaDoEscopo
                  tabela={bloco}
                  onChange={atualizar => atualizarTabela(bloco.id, atualizar)}
                />
              ) : (
                <div className="com-bloco-foto">
                  <img src={bloco.src} alt={bloco.caption || bloco.fileName} />
                  <label className="field-group">
                    <span className="field-group-label">Legenda da foto</span>
                    <textarea
                      maxLength={240}
                      value={bloco.caption}
                      placeholder="Ex.: Condição inicial da tubulação"
                      onChange={evento =>
                        atualizarBloco(bloco.id, item =>
                          item.type === 'photo'
                            ? { ...item, caption: evento.target.value }
                            : item
                        )
                      }
                    />
                  </label>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function TabelaDoEscopo({
  tabela,
  onChange
}: {
  tabela: ScopeTableBlock;
  onChange: (atualizar: (t: ScopeTableBlock) => ScopeTableBlock) => void;
}) {
  return (
    <>
      <div className="field-group">
        <label htmlFor={`titulo-${tabela.id}`}>Título da tabela</label>
        <input
          id={`titulo-${tabela.id}`}
          maxLength={120}
          value={tabela.title}
          onChange={evento =>
            onChange(t => ({ ...t, title: evento.target.value }))
          }
        />
      </div>

      <div className="com-table-wrap">
        <table>
          <thead>
            <tr>
              {tabela.columns.map((coluna, c) => (
                <th key={`${tabela.id}-col-${c}`}>
                  <input
                    aria-label={`Cabeçalho ${c + 1}`}
                    maxLength={80}
                    value={coluna}
                    onChange={evento =>
                      onChange(t => ({
                        ...t,
                        columns: t.columns.map((item, i) =>
                          i === c ? evento.target.value : item
                        )
                      }))
                    }
                  />
                </th>
              ))}
              <th>
                <span className="com-sr">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {tabela.rows.map((linha, l) => (
              <tr key={`${tabela.id}-lin-${l}`}>
                {tabela.columns.map((_, c) => (
                  <td key={`${tabela.id}-cel-${l}-${c}`}>
                    <textarea
                      aria-label={`Linha ${l + 1}, coluna ${c + 1}`}
                      maxLength={MAX_SCOPE_TABLE_CELL_CHARACTERS}
                      value={linha[c] || ''}
                      onChange={evento =>
                        onChange(t => ({
                          ...t,
                          // A linha é reconstruída no comprimento das COLUNAS:
                          // uma coluna acrescentada depois deixa linhas curtas,
                          // e indexar direto gravaria `undefined` no meio.
                          rows: t.rows.map((item, i) =>
                            i === l
                              ? t.columns.map((__, ci) =>
                                  ci === c ? evento.target.value : item[ci] || ''
                                )
                              : item
                          )
                        }))
                      }
                    />
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="com-remover"
                    aria-label={`Remover linha ${l + 1}`}
                    onClick={() =>
                      onChange(t => ({ ...t, rows: t.rows.filter((_, i) => i !== l) }))
                    }
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="com-blocos-acoes">
        <button
          type="button"
          className="com-btn-add"
          disabled={tabela.rows.length >= MAX_SCOPE_TABLE_ROWS}
          title={
            tabela.rows.length >= MAX_SCOPE_TABLE_ROWS
              ? `Limite de ${MAX_SCOPE_TABLE_ROWS} linhas por tabela atingido`
              : undefined
          }
          onClick={() =>
            onChange(t => ({ ...t, rows: [...t.rows, t.columns.map(() => '')] }))
          }
        >
          ＋ Linha
        </button>

        <button
          type="button"
          className="com-btn-add"
          disabled={tabela.columns.length >= MAX_SCOPE_TABLE_COLUMNS}
          title={
            tabela.columns.length >= MAX_SCOPE_TABLE_COLUMNS
              ? `Limite de ${MAX_SCOPE_TABLE_COLUMNS} colunas por tabela atingido`
              : undefined
          }
          onClick={() =>
            onChange(t => ({
              ...t,
              columns: [...t.columns, `Coluna ${t.columns.length + 1}`],
              rows: t.rows.map(linha => [...linha, ''])
            }))
          }
        >
          ＋ Coluna
        </button>

        <button
          type="button"
          className="com-btn com-btn-fantasma"
          /* Duas colunas é o mínimo: uma tabela de uma coluna é uma lista, e o
             gerador de PDF a desenha como tabela mesmo assim. */
          disabled={tabela.columns.length <= 2}
          onClick={() =>
            onChange(t => ({
              ...t,
              columns: t.columns.slice(0, -1),
              rows: t.rows.map(linha => linha.slice(0, -1))
            }))
          }
        >
          Remover última coluna
        </button>
      </div>
    </>
  );
}
