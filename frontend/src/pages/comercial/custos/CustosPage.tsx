import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { moduleRoutePath } from '../../../modules/registry';
import { ComercialChrome } from '../components/ComercialChrome';
import { useAuth } from '../../../auth/AuthContext';
import { FaixaIndicadores } from './FaixaIndicadores';
import { footerAction, saveBlockedByContent, type CostSection } from './footerChain';
import { numberValue } from './formato';
import { pendenciasDe } from './pendencias';
import { InsumosSection } from './sections/InsumosSection';
import { LogisticaSection } from './sections/LogisticaSection';
import { MaoDeObraSection } from './sections/MaoDeObraSection';
import { PremissasSection } from './sections/PremissasSection';
import { ResumoSection } from './sections/ResumoSection';
import { useLevantamento } from './useLevantamento';
import { LOGO_URL } from '../components/marca';


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
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();

  const modo = (params.get('modo') as EstimateMode | null) ?? null;
  const base = params.get('base') ?? '';
  const secao = (params.get('secao') as CostSection | null) ?? 'premises';

  const [baseDigitada, setBaseDigitada] = useState('');
  const [mostrarRevisao, setMostrarRevisao] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);

  const levantamento = useLevantamento(user?.name || '');
  const { draft, result, revelarErros } = levantamento;

  // A cadeia do rodapé está completa: as quatro seções sabem dizer se pendem.
  const pendencias = pendenciasDe(draft, result);
  const guardas = {
    saving: false,
    title: String(draft.title || ''),
    validPricing: Boolean(result.validPricing),
    salePrice: numberValue(result.salePrice)
  };
  const acao = footerAction(pendencias, guardas);

  /**
   * Último degrau da cadeia com o salvamento travado: acende o vermelho sem
   * esperar clique.
   *
   * O botão desabilitado não tem para onde levar e não explica nada. Aqui o
   * usuário já percorreu as quatro seções — o que resta são campos, e é
   * exatamente o momento em que apontá-los ajuda.
   */
  const salvarTravadoPorConteudo = acao.kind === 'save' && saveBlockedByContent(guardas);

  useEffect(() => {
    if (salvarTravadoPorConteudo) revelarErros();
  }, [salvarTravadoPorConteudo, revelarErros]);

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
      heroExtra={
        modo !== null ? (
          <FaixaIndicadores
            levantamento={levantamento}
            modoLabel={modo === 'revision' ? `Revisão de ${base}` : 'Levantamento novo'}
          />
        ) : undefined
      }
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

            {secao === 'premises' ? (
              <PremissasSection levantamento={levantamento} />
            ) : secao === 'labor' ? (
              <MaoDeObraSection levantamento={levantamento} />
            ) : secao === 'inputs' ? (
              <InsumosSection levantamento={levantamento} />
            ) : secao === 'logistics' ? (
              <LogisticaSection levantamento={levantamento} />
            ) : (
              <ResumoSection levantamento={levantamento} />
            )}

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
                  // Tentar avançar é o gatilho: daqui em diante os campos
                  // obrigatórios que faltam ficam marcados, e passam a acender
                  // e apagar ao vivo enquanto o usuário corrige.
                  revelarErros();
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
