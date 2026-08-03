import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { moduleRoutePath } from '../../../modules/registry';
import { ComercialChrome } from '../components/ComercialChrome';
import { footerAction, type CostSection } from './footerChain';

// Mesma origem que o `TopBar` do filtroAPP usa — a marca é a mesma, e a
// referência também abre o diálogo com o logotipo.
const assetsBaseUrl = (import.meta.env.VITE_ASSETS_BASE_URL || '').replace(/\/$/, '');
const LOGO_URL = `${assetsBaseUrl}/assets/Logo/LOGO_HEADER.png`;

/**
 * Levantamento de custos — container das cinco seções.
 *
 * É a maior tela do porte: 465 controles. Este arquivo é só o esqueleto — a
 * tira de seções, o diálogo de modo, o rodapé-guia e o modal de confirmação.
 * Cada seção vem em componente próprio, porque o repositório reprova página
 * acima de 700-900 linhas e a referência tem 3.382 num arquivo só.
 *
 * L3 desde já: modo, base e seção ativa vivem no ENDEREÇO. Na referência o F5
 * reabre o diálogo de modo e apaga o levantamento inteiro — 465 controles de
 * trabalho, sem aviso e sem confirmação de saída.
 */

const SECOES: Array<{ value: CostSection; label: string }> = [
  { value: 'premises', label: 'Premissas' },
  { value: 'labor', label: 'Mão de obra' },
  { value: 'inputs', label: 'Materiais e insumos' },
  { value: 'logistics', label: 'Mob. e desmob.' },
  { value: 'summary', label: 'Resumo e QQP' }
];

type EstimateMode = 'new' | 'revision';

export function CustosPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const modo = (params.get('modo') as EstimateMode | null) ?? null;
  const base = params.get('base') ?? '';
  const secao = (params.get('secao') as CostSection | null) ?? 'premises';

  const [baseDigitada, setBaseDigitada] = useState('');
  const [mostrarRevisao, setMostrarRevisao] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);

  // Placeholders até as seções existirem. As pendências reais saem dos
  // predicados de cada seção, que dependem do estado do levantamento.
  const pendencias = { labor: false, inputs: false, logistics: false, commercial: false };
  const acao = footerAction(pendencias, {
    saving: false,
    title: '',
    validPricing: false,
    salePrice: 0
  });

  const codigo = base || '—';

  function trocarSecao(destino: CostSection) {
    const proximos = new URLSearchParams(params);
    proximos.set('secao', destino);
    setParams(proximos, { replace: true });
  }

  function iniciarModo(novoModo: EstimateMode, numero?: string) {
    const proximos = new URLSearchParams();
    proximos.set('modo', novoModo);
    if (numero) proximos.set('base', numero);
    proximos.set('secao', 'premises');
    setParams(proximos, { replace: true });
  }

  return (
    <ComercialChrome
      eyebrow="FILTROVALI / LEVANTAMENTO DE CUSTOS"
      titulo={`Custos ${codigo}`}
      descricao="Engenharia de custos Filtrovali: equipe, circuitos, materiais, logística e formação do preço em um só lugar."
    >
        {/* O diálogo só aparece quando NÃO há modo no endereço (FR-044): ele
            serve para escolher o modo, não para confirmá-lo. Recarregar com
            `?modo=` já definido volta direto ao trabalho. */}
        {modo === null && (
          <div className="com-overlay" role="dialog" aria-modal="true" aria-labelledby="com-modo-titulo">
            <section className="com-painel com-modo-card">
              <img
                className="com-modo-logo"
                src={LOGO_URL}
                alt="Filtrovali"
              />
              <span className="com-eyebrow">LEVANTAMENTO DE CUSTOS</span>
              <h1 id="com-modo-titulo">Como deseja começar?</h1>
              <p>
                O levantamento será vinculado à proposta técnica e comercial com a mesma
                numeração.
              </p>

              <div className="com-modo-opcoes">
                <button type="button" onClick={() => iniciarModo('new')}>
                  <b aria-hidden="true">＋</b>
                  <strong>Nova proposta</strong>
                  <span>
                    Reserva o próximo número e inicia um levantamento por fases.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMostrarRevisao(true)}
                >
                  <b aria-hidden="true">↻</b>
                  <strong>Revisar proposta</strong>
                  <span>
                    Carrega o último levantamento e preserva toda a composição.
                  </span>
                </button>
              </div>

              {mostrarRevisao && (
                <div className="com-revisao-entrada">
                  <div className="field-group">
                    <label htmlFor="com-base-proposta">Número da proposta existente</label>
                    <input
                      id="com-base-proposta"
                      autoFocus
                      value={baseDigitada}
                      placeholder="Ex.: 4418"
                      onChange={event => setBaseDigitada(event.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                  <button
                    type="button"
                    className="com-btn com-btn-fantasma"
                    disabled={!baseDigitada}
                    onClick={() => iniciarModo('revision', baseDigitada)}
                  >
                    Carregar revisão
                  </button>
                </div>
              )}
            </section>
          </div>
        )}

        {mostrarConfirmacao && (
          <div
            className="com-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="com-confirmar-titulo"
          >
            <section className="com-painel com-modo-card">
              <img
                className="com-modo-logo"
                src={LOGO_URL}
                alt="Filtrovali"
              />
              <span className="com-eyebrow">VINCULAR LEVANTAMENTO</span>
              <h1 id="com-confirmar-titulo">Confirme a proposta</h1>
              <p>
                O levantamento, a proposta técnica e a comercial usarão o código{' '}
                <strong>{codigo}</strong>.
              </p>

              <div className="com-modo-opcoes com-modo-tres">
                <button type="button">
                  <b aria-hidden="true">✓</b>
                  <strong>Confirmar {codigo}</strong>
                  <span>
                    Salvar e abrir a criação das propostas.
                  </span>
                </button>

                <button type="button">
                  <b aria-hidden="true">＋</b>
                  <strong>Trocar para nova</strong>
                  <span>Reservar outra numeração.</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMostrarConfirmacao(false);
                    setParams(new URLSearchParams(), { replace: true });
                    setMostrarRevisao(true);
                  }}
                >
                  <b aria-hidden="true">↻</b>
                  <strong>Trocar para revisão</strong>
                  <span>Selecionar uma proposta existente.</span>
                </button>
              </div>
            </section>
          </div>
        )}

        {modo !== null && (
          <>
            {/* Tira de seções. As abas são LIVRES: dá para pular para qualquer
                uma a qualquer momento. A cadeia do rodapé guia, não prende. */}
            <nav className="com-workflow-nav" aria-label="Etapas do levantamento">
              {SECOES.map((item, indice) => (
                <button
                  key={item.value}
                  type="button"
                  className={secao === item.value ? 'is-ativa' : undefined}
                  aria-current={secao === item.value ? 'step' : undefined}
                  onClick={() => trocarSecao(item.value)}
                >
                  <b aria-hidden="true">{indice + 1}</b>
                  <span className="com-quebrar">{item.label}</span>
                </button>
              ))}
            </nav>

            <section className="com-painel com-secao-corpo">
              <div className="com-secao-titulo">
                <div>
                  <h2>{SECOES.find(item => item.value === secao)?.label}</h2>
                  <p>
                    {modo === 'revision'
                      ? `Revisão da proposta ${base}.`
                      : 'Levantamento novo.'}
                  </p>
                </div>
                <span className="com-obrigatorios">Campos com * são obrigatórios</span>
              </div>

              <p className="com-placeholder">
                Esta seção ainda não foi portada. O container, a navegação por endereço e o
                rodapé-guia já funcionam.
              </p>
            </section>

            <footer className="com-rodape">
              <button
                type="button"
                className="com-btn com-btn-fantasma"
                onClick={() => navigate(moduleRoutePath('comercial', 'index'))}
              >
                Cancelar e voltar
              </button>

              <div className="com-codigo-vinculado">
                <small>LEVANTAMENTO E PROPOSTA</small>
                <strong>{codigo}</strong>
              </div>

              <button
                type="button"
                className="com-btn com-btn-primario"
                disabled={acao.disabled}
                onClick={() => {
                  if (acao.kind === 'goto') trocarSecao(acao.target);
                  else setMostrarConfirmacao(true);
                }}
              >
                {acao.label}
              </button>
            </footer>
          </>
        )}
    </ComercialChrome>
  );
}
