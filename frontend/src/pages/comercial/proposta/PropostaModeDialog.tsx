import { useState } from 'react';

import { BotaoFecharDialogo } from '../components/FecharDialogo';
import { LOGO_URL } from '../components/marca';
import { MarcaDeOpcao } from '../components/MarcaDeOpcao';

/** Entrada da proposta: nova ou revisão de um número existente (PROP-CTL-001..005). */
export function PropostaModeDialog({
  recado,
  onNova,
  onRevisao,
  onFechar
}: {
  recado: string;
  onNova: () => void;
  onRevisao: (codigo: string) => Promise<boolean>;
  /** Fechar sem escolher volta ao menu do módulo. */
  onFechar: () => void;
}) {
  const [mostrarRevisao, setMostrarRevisao] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function carregar() {
    const procurado = codigo.trim();
    if (!procurado || carregando) return;
    setCarregando(true);
    try {
      await onRevisao(procurado);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div
      className="com-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="com-proposta-modo-titulo"
    >
      <section className="com-painel com-modo-card">
        <BotaoFecharDialogo fechar={onFechar} />
        <img className="com-modo-logo" src={LOGO_URL} alt="Filtrovali" />
        <span className="com-eyebrow">PROPOSTA TÉCNICA E COMERCIAL</span>
        <h1 id="com-proposta-modo-titulo">Como deseja começar?</h1>
        <p>
          Crie uma proposta com numeração nova ou carregue uma existente para gerar
          a próxima revisão.
        </p>

        <div className="com-modo-opcoes">
          <button type="button" onClick={onNova}>
            <MarcaDeOpcao tipo="nova" />
            <strong>Nova proposta</strong>
            <span>Gera o conjunto técnico e comercial com novo número.</span>
          </button>
          <button type="button" onClick={() => setMostrarRevisao(true)}>
            <MarcaDeOpcao tipo="revisao" />
            <strong>Revisar proposta</strong>
            <span>Carrega os dados salvos e calcula a próxima revisão.</span>
          </button>
        </div>

        {mostrarRevisao && (
          <div className="com-revisao-entrada">
            <div className="field-group">
              <label htmlFor="com-proposta-revisao">Número da proposta existente</label>
              <input
                id="com-proposta-revisao"
                autoFocus
                inputMode="numeric"
                value={codigo}
                placeholder="Ex.: 4418"
                onChange={evento => setCodigo(evento.target.value.replace(/\D/g, ''))}
                onKeyDown={evento => {
                  if (evento.key === 'Enter') carregar();
                }}
              />
            </div>
            <button
              type="button"
              className="com-btn com-btn-fantasma"
              disabled={carregando || !codigo.trim()}
              onClick={carregar}
            >
              {carregando ? 'Carregando...' : 'Carregar revisão'}
            </button>
          </div>
        )}

        {recado && <p className="com-recado">{recado}</p>}
      </section>
    </div>
  );
}
