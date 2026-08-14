import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import {
  ComercialValidationError,
  criarLevantamento,
  mensagemDeErro,
  obterLevantamento,
  prepararRevisaoDaProposta,
  reservarProximoNumero
} from '../../../api/comercial';
import { moduleRoutePath } from '../../../modules/registry';
import { ComercialChrome } from '../components/ComercialChrome';
import { useAuth } from '../../../auth/AuthContext';
import { FaixaIndicadores } from './FaixaIndicadores';
import { footerAction, saveBlockedByContent, type CostSection } from './footerChain';
import { numberValue } from './formato';
import { pendenciasDe } from './pendencias';
import { primeiraSecaoPendente } from './secaoDoCaminho';
import { InsumosSection } from './sections/InsumosSection';
import { LogisticaSection } from './sections/LogisticaSection';
import { MaoDeObraSection } from './sections/MaoDeObraSection';
import { PremissasSection } from './sections/PremissasSection';
import { ResumoSection } from './sections/ResumoSection';
import { useLevantamento } from './useLevantamento';
import { useRascunhoLocal } from '../useRascunhoLocal';
import { LOGO_URL } from '../components/marca';
import { TutorialDoModulo } from '../TutorialDoModulo';
import { ROTEIRO_DOS_CUSTOS } from '../roteiroDoTutorial';
import { BotaoFecharDialogo } from '../components/FecharDialogo';


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

/**
 * Mensagem legível de um erro de rede.
 *
 * O `503` da numeração é traduzido em texto próprio: ele **não** é falha, é o
 * ambiente dizendo que a numeração ainda não foi semeada. Quem lê "erro do servidor"
 * abre chamado; quem lê o que falta chama o operador.
 */
export function CustosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();

  const modo = (params.get('modo') as EstimateMode | null) ?? null;
  const base = params.get('base') ?? '';
  const revisionNumber = Math.max(0, Number(params.get('revisao')) || 0);
  const levantamentoOrigemId = params.get('origem') ?? '';
  const secao = (params.get('secao') as CostSection | null) ?? 'premises';

  const [baseDigitada, setBaseDigitada] = useState('');
  const [mostrarRevisao, setMostrarRevisao] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [reservando, setReservando] = useState(false);
  const [carregandoRevisao, setCarregandoRevisao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [recado, setRecado] = useState('');
  const [salvo, setSalvo] = useState<string | null>(null);

  const levantamento = useLevantamento(user?.name || '');
  const { draft, setDraft, result, revelarErros, aplicarIssuesDoServidor } = levantamento;
  const origemCarregada = useRef('');

  /** No F5, recompõe o levantamento que originou a revisão. */
  useEffect(() => {
    if (
      modo !== 'revision' ||
      !levantamentoOrigemId ||
      origemCarregada.current === levantamentoOrigemId
    ) {
      return;
    }

    origemCarregada.current = levantamentoOrigemId;
    let vivo = true;
    obterLevantamento(levantamentoOrigemId)
      .then(anterior => {
        if (!vivo || !anterior.payload) return;
        setDraft({
          ...anterior.payload,
          estimatorName: user?.name || anterior.payload.estimatorName || ''
        });
      })
      .catch(error => {
        if (vivo) {
          setRecado(
            mensagemDeErro(error, 'Não foi possível recarregar o levantamento anterior.')
          );
        }
      });

    return () => {
      vivo = false;
    };
  }, [levantamentoOrigemId, modo, setDraft, user?.name]);

  /**
   * L3 — o trabalho não se perde num F5.
   *
   * Na referência, recarregar volta ao diálogo de modo e apaga 465 controles de
   * trabalho. Modo, código e seção já vivem no endereço; o que faltava era o
   * conteúdo. A recuperação é **oferecida**, nunca aplicada em silêncio.
   */
  const rascunho = useRascunhoLocal({
    tela: 'custos',
    modo,
    codigo: base,
    dados: draft,
    ativo: modo !== null,
    rotulo: `Custos ${base || '—'}`
  });

  // A cadeia do rodapé está completa: as quatro seções sabem dizer se pendem.
  const pendencias = pendenciasDe(draft, result);
  const guardas = {
    saving: salvando,
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

  /**
   * "Nova proposta" **reserva o número antes de abrir a tela**, como na referência.
   *
   * Reservar depois pareceria mais econômico — só gasta número quem salva. Mas o
   * código aparece no título e no rodapé desde o primeiro instante, e o orçamentista
   * o dita ao cliente enquanto monta o levantamento. Um número que só existe no fim
   * é um número em que não se pode confiar no meio.
   *
   * O preço disso é buraco na sequência quando alguém desiste. É aceitável: buraco
   * não confunde ninguém, número repetido sim.
   */
  async function iniciarNova() {
    setReservando(true);
    setRecado('Reservando o próximo número...');
    try {
      const numero = await reservarProximoNumero();
      setRecado('');
      iniciarModo('new', String(numero));
    } catch (error) {
      setRecado(mensagemDeErro(error, 'Não foi possível obter a numeração.'));
    } finally {
      setReservando(false);
    }
  }

  async function iniciarRevisao() {
    const procurado = baseDigitada.trim();
    if (!procurado || carregandoRevisao) return;

    setCarregandoRevisao(true);
    setRecado('Carregando o levantamento anterior...');
    try {
      const revisao = await prepararRevisaoDaProposta(procurado);
      let anterior = null;
      if (revisao.costEstimateId) {
        anterior = await obterLevantamento(revisao.costEstimateId);
        if (anterior.payload) {
          setDraft({
            ...anterior.payload,
            estimatorName: user?.name || anterior.payload.estimatorName || ''
          });
        }
        origemCarregada.current = revisao.costEstimateId;
      }

      const proximos = new URLSearchParams();
      proximos.set('modo', 'revision');
      proximos.set('base', String(revisao.base_number));
      proximos.set('revisao', String(revisao.nextRevision));
      proximos.set('secao', 'premises');
      if (revisao.costEstimateId) proximos.set('origem', revisao.costEstimateId);
      setParams(proximos, { replace: true });

      setMostrarRevisao(false);
      setRecado(
        anterior
          ? 'Levantamento anterior carregado por completo.'
          : 'A proposta não tem levantamento anterior; a revisão foi iniciada em branco com o número calculado.'
      );
    } catch (error) {
      setRecado(mensagemDeErro(error, 'Não foi possível carregar a revisão.'));
    } finally {
      setCarregandoRevisao(false);
    }
  }

  /**
   * Salva o levantamento.
   *
   * Os totais **não** vão no corpo: o servidor recalcula com `calculateEstimate` e
   * grava os seus. É o que impede forjar margem, e é por isso que o contrato Zod
   * recusa `salePrice` vindo do cliente.
   *
   * No `422`, as pendências do servidor viram vermelho **no campo** e a tela salta
   * para a primeira seção atingida — na ordem da tela, não na ordem em que o servidor
   * validou. O app já sabe o caminho; o que faltava era dizer.
   */
  async function salvar() {
    if (salvando) return;
    setSalvando(true);
    setRecado('Validando e salvando o levantamento...');

    try {
      const gravado = await criarLevantamento({
        proposalCode: base,
        revisionNumber: modo === 'revision' ? revisionNumber : 0,
        title: String(draft.title || ''),
        mode: modo === 'revision' ? 'REVISAO' : 'NOVA',
        payload: draft
      });

      // T091: gravado no servidor, o rascunho local não pode sobrar para
      // reaparecer depois como se fosse trabalho não salvo.
      rascunho.limparTudo();
      setMostrarConfirmacao(false);
      setSalvo(gravado.id);
      setRecado('');
      navigate(
        `${moduleRoutePath('comercial', 'propostas')}?levantamento=${gravado.id}` +
          `&proposta=${encodeURIComponent(gravado.proposalCode)}` +
          `&modo=${modo === 'revision' ? 'revision' : 'new'}` +
          `&revisao=${gravado.revisionNumber}&etapa=cliente`
      );
    } catch (error) {
      setMostrarConfirmacao(false);

      if (error instanceof ComercialValidationError) {
        aplicarIssuesDoServidor(error.issues);
        const destino = primeiraSecaoPendente(
          error.issues.map(item => item.path || '').filter(Boolean)
        );
        if (destino) trocarSecao(destino);
        setRecado(
          error.issues.length === 1
            ? 'Há 1 pendência. Ela está marcada no campo.'
            : `Há ${error.issues.length} pendências. Elas estão marcadas nos campos.`
        );
      } else {
        setRecado(mensagemDeErro(error, 'Falha ao salvar o levantamento.'));
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <ComercialChrome
      eyebrow="FILTROVALI / LEVANTAMENTO DE CUSTOS"
      titulo={`Custos ${codigo}`}
      descricao="Engenharia de custos Filtrovali: equipe, circuitos, materiais, logística e formação do preço em um só lugar."
      /* Não abre sozinho: quem chegou aqui já passou pela entrada. O botão
         replica o roteiro DESTA tela. */
      acoes={<TutorialDoModulo passos={ROTEIRO_DOS_CUSTOS} />}
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
              <BotaoFecharDialogo fechar={() => navigate(moduleRoutePath('comercial', 'index'))} />
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
                <button type="button" disabled={reservando} onClick={iniciarNova}>
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

              {recado && <p className="com-recado">{recado}</p>}

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
                    disabled={carregandoRevisao || !baseDigitada}
                    onClick={iniciarRevisao}
                  >
                    {carregandoRevisao ? 'Carregando...' : 'Carregar revisão'}
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
              {/* Aqui fechar volta ao levantamento, não ao menu: este diálogo
                  interrompe um trabalho em andamento, e o trabalho continua. */}
              <BotaoFecharDialogo
                fechar={() => setMostrarConfirmacao(false)}
                rotulo="Fechar e voltar ao levantamento"
              />
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
                <button type="button" disabled={salvando} onClick={salvar}>
                  <b aria-hidden="true">✓</b>
                  <strong>{salvando ? 'Salvando...' : `Confirmar ${codigo}`}</strong>
                  <span>
                    Salvar e abrir a criação das propostas.
                  </span>
                </button>

                <button
                  type="button"
                  disabled={salvando || reservando}
                  onClick={() => {
                    setMostrarConfirmacao(false);
                    iniciarNova();
                  }}
                >
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
            {/* L3 — a recuperação é OFERECIDA, nunca aplicada em silêncio.
                Restaurar sem perguntar é pior do que perder: o usuário abre a
                tela achando que começou do zero e digita por cima. */}
            {rascunho.oferta && (
              <section className="com-painel com-oferta-rascunho" role="alertdialog">
                <div>
                  <strong>Recuperar rascunho não salvo?</strong>
                  <p>
                    Há trabalho deste levantamento guardado neste navegador,{' '}
                    {rascunho.idadeDaOferta}. Ele não chegou a ser salvo no servidor.
                  </p>
                </div>
                <div className="com-oferta-acoes">
                  <button
                    type="button"
                    className="com-btn com-btn-primario"
                    onClick={() => {
                      const dados = rascunho.recuperar();
                      if (dados) setDraft(dados as Record<string, unknown>);
                    }}
                  >
                    Recuperar
                  </button>
                  <button
                    type="button"
                    className="com-btn com-btn-fantasma"
                    onClick={rascunho.descartarOferta}
                  >
                    Começar do zero
                  </button>
                </div>
              </section>
            )}

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

            {recado && (
              <p className="com-recado com-recado-tela" role="status">
                {recado}
              </p>
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
                /* Salvo uma vez, não salva de novo: um segundo POST criaria um
                   segundo levantamento com o MESMO código de proposta. Reabrir
                   para editar é `PUT`, e depende da tela de listagem. */
                disabled={acao.disabled || salvo !== null}
                onClick={() => {
                  // Tentar avançar é o gatilho: daqui em diante os campos
                  // obrigatórios que faltam ficam marcados, e passam a acender
                  // e apagar ao vivo enquanto o usuário corrige.
                  revelarErros();
                  if (acao.kind === 'goto') trocarSecao(acao.target);
                  else setMostrarConfirmacao(true);
                }}
              >
                {salvo ? 'Levantamento salvo' : acao.label}
              </button>
            </footer>
          </>
        )}
    </ComercialChrome>
  );
}
