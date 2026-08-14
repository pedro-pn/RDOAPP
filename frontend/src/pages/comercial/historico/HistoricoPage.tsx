import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  baixarDocumento,
  listarPropostas,
  mensagemDeErro,
  type DocumentoEmitido,
  type PropostaSalva
} from '../../../api/comercial';
import { useAuth } from '../../../auth/AuthContext';
import { moduleRoutePath } from '../../../modules/registry';
import { LOGO_URL } from '../components/marca';
import { HistoricoTabela } from './HistoricoTabela';

export function HistoricoPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [busca, setBusca] = useState('');
  const [propostas, setPropostas] = useState<PropostaSalva[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [baixandoDocumentoId, setBaixandoDocumentoId] = useState('');

  const podeVerValores = Boolean(
    user?.moduleRoles?.some(role =>
      ['comercial:manager', 'comercial:seller'].includes(role)
    )
  );

  const carregar = useCallback(async (termo = '') => {
    setCarregando(true);
    setErro('');
    try {
      const resposta = await listarPropostas({ busca: termo });
      setPropostas(resposta.items);
    } catch (error) {
      setErro(mensagemDeErro(error, 'Falha ao consultar o histórico.'));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function sair() {
    await logout();
    navigate('/login', { replace: true });
  }

  async function baixar(documento: DocumentoEmitido) {
    setBaixandoDocumentoId(documento.id);
    setErro('');
    try {
      const blob = await baixarDocumento(documento.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = documento.fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErro(mensagemDeErro(error, 'Falha ao baixar o documento.'));
    } finally {
      setBaixandoDocumentoId('');
    }
  }

  return (
    <main className="com-root com-history-page">
      <header className="com-history-topbar">
        <button
          type="button"
          className="com-marca"
          aria-label="Filtrovali Engenharia"
          onClick={() => navigate(moduleRoutePath('comercial', 'index'))}
        >
          <img src={LOGO_URL} alt="Filtrovali Engenharia" />
        </button>
        <div className="com-history-topbar-actions">
          <span className="com-usuario">
            Orçamentista: <b className="com-quebrar">{user?.name || '—'}</b>
          </span>
          {/* "Voltar ao gerador" é `HIST-CTL-002`, portado, e leva ao gerador —
              que abre o diálogo "Como deseja começar?". Não serve de volta.
              O menu do módulo é desvio nº 9 e não existia na referência, então
              ganha botão próprio em vez de trocar o de lá. */}
          <button
            type="button"
            className="com-btn com-btn-fantasma"
            onClick={() => navigate(moduleRoutePath('comercial', 'index'))}
          >
            ← Menu do módulo
          </button>
          <button
            type="button"
            className="com-btn com-btn-fantasma"
            onClick={() => navigate(moduleRoutePath('comercial', 'propostas'))}
          >
            ← Voltar ao gerador
          </button>
          <button type="button" className="com-btn com-btn-fantasma" onClick={() => void sair()}>
            Sair
          </button>
        </div>
      </header>

      <section className="com-history-hero">
        <div>
          <span className="com-eyebrow">COMERCIAL / PROPOSTAS</span>
          <h1>Histórico de propostas</h1>
          <p>Consulte as propostas geradas, integrações e destinos de arquivamento.</p>
        </div>
        <div className="com-history-count">
          <strong>{propostas.length}</strong>
          <span>registros encontrados</span>
        </div>
      </section>

      <section className="com-history-content">
        <form
          className="com-history-search"
          onSubmit={event => {
            event.preventDefault();
            void carregar(busca);
          }}
        >
          <input
            value={busca}
            onChange={event => setBusca(event.target.value)}
            placeholder="Buscar por número, cliente, documento, responsável ou funil..."
            aria-label="Buscar no histórico"
          />
          <button type="submit" className="com-btn com-btn-primario">
            Buscar
          </button>
          {busca && (
            <button
              type="button"
              className="com-btn com-btn-fantasma"
              onClick={() => {
                setBusca('');
                void carregar();
              }}
            >
              Limpar
            </button>
          )}
        </form>

        {erro && (
          <div className="com-history-error-message" role="alert">
            {erro}
          </div>
        )}
        {carregando ? (
          <div className="com-history-empty" aria-live="polite">
            Carregando histórico...
          </div>
        ) : propostas.length === 0 ? (
          <div className="com-history-empty">
            Nenhuma proposta registrada ainda. As próximas finalizações aparecerão aqui.
          </div>
        ) : (
          <HistoricoTabela
            propostas={propostas}
            podeVerValores={podeVerValores}
            baixandoDocumentoId={baixandoDocumentoId}
            onBaixarDocumento={documento => void baixar(documento)}
          />
        )}
      </section>
    </main>
  );
}
