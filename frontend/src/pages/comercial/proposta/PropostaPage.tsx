import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import {
  normalizeTechnicalServiceSelections,
  validateTechnicalServiceSelections,
  type TechnicalServiceSelection
} from '../../../../../shared/comercial/dist/technical-services.js';
import {
  createScopeServiceItem,
  type ScopeBlock,
  type ScopeServiceItem
} from '../../../../../shared/comercial/dist/scope-content.js';
import {
  atualizarProposta,
  baixarDocumento,
  baixarPreviaEmPdf,
  criarProposta,
  emitirDocumentos,
  listarConsultores,
  mensagemDeErro,
  obterProposta,
  reservarProximoNumero,
  type Consultor,
  type DocumentoEmitido
} from '../../../api/comercial';
import { useAuth } from '../../../auth/AuthContext';
import { moduleRoutePath } from '../../../modules/registry';
import { ComercialChrome } from '../components/ComercialChrome';
import { useRascunhoLocal } from '../useRascunhoLocal';
import {
  MODELOS_PROPOSTA,
  TEXTO_IMPOSTOS,
  TEXTO_OBSERVACOES_GERAIS,
  textoCondicoesPagamento,
  textoJornada as jornadaEmTexto,
  type ModeloProposta
} from '../../../../../shared/comercial/dist/modelo-documento.js';
import { LOGO_URL } from '../components/marca';
import {
  ETAPAS,
  indiceDaEtapa,
  avisoDePendencias,
  indiceDePendencias,
  CATEGORIAS_RESPONSABILIDADE,
  matrizInicial,
  type ItemDePreco,
  type LinhaResponsabilidade,
  pendenciasDaEtapa,
  rotuloDoAvanco,
  type EtapaProposta
} from './etapas';
import {
  dadosDaProposta,
  entradaDaProposta,
  precisaDeNumero,
  type ConteudoDaProposta
} from './salvamento';
import { DocumentoPrevia, type TipoDeDocumento } from './DocumentoPrevia';
import { ClienteStep } from './steps/ClienteStep';
import { EscopoStep } from './steps/EscopoStep';
import { PrazosStep } from './steps/PrazosStep';
import { ComercialStep } from './steps/ComercialStep';
import { ResponsabilidadesStep } from './steps/ResponsabilidadesStep';
import { RevisaoStep, type EscolhaDeDownload } from './steps/RevisaoStep';
import { TecnicaStep } from './steps/TecnicaStep';

/**
 * Montagem da proposta — container das 7 etapas (`PROP-CTL-001..010`, `PROP-H-001..003`).
 *
 * Porte de `app/page.tsx`. Como na tela de custos, este arquivo é só o esqueleto: o
 * stepper, o rodapé com a trava e o rascunho local. Cada etapa vem em componente
 * próprio.
 *
 * **A trava é o oposto da tela de custos, e a diferença é deliberada.** Lá as abas são
 * livres porque o levantamento é uma calculadora e o orçamentista vai e volta o tempo
 * todo. Aqui a proposta é um documento montado em ordem: não se avança com a etapa
 * incompleta, e o stepper só volta para etapa já visitada.
 *
 * L3 desde já (T087): a etapa ativa vive no ENDEREÇO, e o conteúdo é guardado
 * localmente com oferta de recuperação.
 */

type AnyRecord = Record<string, unknown>;

function formularioInicial(): AnyRecord {
  return {
    seller: '',
    date: new Date().toISOString().slice(0, 10),
    client: '',
    cnpj: '',
    contact: '',
    email: '',
    department: '',
    site: '',
    title: '',
    attendance: '',
    mobilization: '',
    permanence: '',
    integration: '',
    execution: '',
    workday: '',
    technicalObservations: '',
    // Os textos nascem do documento, não em branco (desvio 12). São editáveis:
    // o vendedor ajusta a condição negociada, mas parte do que a empresa
    // pratica — em vez de reescrever cinco parágrafos jurídicos a cada proposta.
    payment: textoCondicoesPagamento({
      adiantamento: '35%',
      prazoPagamento: '21',
      formaPagamento: 'Depósito em conta'
    }),
    observations: TEXTO_OBSERVACOES_GERAIS,
    taxes: TEXTO_IMPOSTOS,
    // Os quatro da tabela de stand-by (T071d).
    overtimeRate: '',
    standbyTeam: '',
    standbyEquipment: '',
    extraMobilization: '',
    validity: '10'
  };
}

export function PropostaPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();

  const etapa = (params.get('etapa') as EtapaProposta | null) ?? 'cliente';
  const indice = indiceDaEtapa(etapa);
  const levantamentoId = params.get('levantamento') ?? '';
  const codigo = params.get('proposta') ?? '—';
  /* O id da proposta salva mora no ENDEREÇO, como a etapa e o modelo (L3): F5
     não pode transformar uma proposta já gravada numa segunda proposta. */
  const propostaId = params.get('id') ?? '';

  /* O modelo mora no endereço, como o modo do levantamento: recarregar não pode
     perguntar de novo, e o diálogo serve para ESCOLHER, não para confirmar. */
  const modeloNaUrl = params.get('modelo');
  const modelo: ModeloProposta | null =
    modeloNaUrl === 'padrao' || modeloNaUrl === 'hidrojateamento' ? modeloNaUrl : null;

  const [form, setForm] = useState<AnyRecord>(formularioInicial);
  // A proposta nasce com UM serviço. Zero serviços deixaria a etapa 2 sem nada
  // para preencher, e a trava pediria um item que não existe na tela.
  const [itensEscopo, setItensEscopo] = useState<ScopeServiceItem[]>(() => [
    createScopeServiceItem('escopo-inicial', 0)
  ]);
  const [blocos, setBlocos] = useState<ScopeBlock[]>([]);
  // A proposta nasce com a matriz do modelo, não em branco: são ~35 obrigações
  // que se repetem em toda obra, e digitá-las de novo a cada proposta é como o
  // erro entra. O vendedor apaga o que não se aplica.
  const [responsabilidades, setResponsabilidades] = useState<LinhaResponsabilidade[]>(
    () => matrizInicial(modelo ?? 'padrao')
  );
  /* A lista de categorias é editável e vive junto da proposta: acrescentar uma
     categoria numa obra não pode mudar o catálogo das outras. */
  const [categorias, setCategorias] = useState<string[]>(() => [
    ...CATEGORIAS_RESPONSABILIDADE
  ]);
  const [servicosTecnicos, setServicosTecnicos] = useState<TechnicalServiceSelection[]>(
    []
  );
  const [complementoRelatorios, setComplementoRelatorios] = useState('');
  const [precos, setPrecos] = useState<ItemDePreco[]>(() => [
    { description: '', unit: '', quantity: '1', unitValue: '', value: '' }
  ]);
  const [incluirUnitario, setIncluirUnitario] = useState(true);
  const [escolhaDownload, setEscolhaDownload] = useState<EscolhaDeDownload>('both');
  const [pastaOneDrive, setPastaOneDrive] = useState('');
  const [anexos, setAnexos] = useState<File[]>([]);
  const [documentoNaPrevia, setDocumentoNaPrevia] = useState<TipoDeDocumento>('commercial');

  // A validação técnica inteira vem de `shared/comercial` — é regra de
  // engenharia, e reescrevê-la aqui criaria a segunda verdade que o módulo
  // compartilhado existe para evitar.
  const errosTecnicos = validateTechnicalServiceSelections(servicosTecnicos);
  const [maiorVisitada, setMaiorVisitada] = useState(indice);
  const [tentouAvancar, setTentouAvancar] = useState(false);
  const [consultores, setConsultores] = useState<Consultor[]>([]);
  const [podeEscolher, setPodeEscolher] = useState(false);
  const [recado, setRecado] = useState('');
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [emitidos, setEmitidos] = useState<DocumentoEmitido[]>([]);

  const rascunho = useRascunhoLocal({
    tela: 'proposta',
    modo: levantamentoId ? 'levantamento' : 'avulsa',
    codigo: levantamentoId,
    dados: {
      form,
      itensEscopo,
      blocos,
      responsabilidades,
      categorias,
      servicosTecnicos,
      complementoRelatorios,
      precos,
      incluirUnitario
    },
    ativo: true,
    rotulo: 'Proposta'
  });

  /**
   * Consultores.
   *
   * O vendedor recebe **um** item e ele já vem escolhido — a lista completa é do
   * gestor. A restrição acontece na API; aqui só se reflete o que veio.
   */
  useEffect(() => {
    let vivo = true;
    listarConsultores()
      .then(resposta => {
        if (!vivo) return;
        setConsultores(resposta.items);
        setPodeEscolher(resposta.podeEscolher);
        // Um único consultor não é uma escolha: pré-seleciona.
        if (!resposta.podeEscolher && resposta.items.length === 1) {
          setForm(atual => ({ ...atual, seller: resposta.items[0].id }));
        }
      })
      .catch(() => {
        if (vivo) setRecado('Não foi possível carregar os consultores de vendas.');
      });
    return () => {
      vivo = false;
    };
  }, []);

  /**
   * Proposta já salva: recarrega o conteúdo do servidor.
   *
   * Sem isto, o `?id=` no endereço sobreviveria ao F5 mas o formulário voltaria
   * em branco — e o salvamento seguinte gravaria o vazio por cima do trabalho
   * inteiro. É o mesmo defeito da L3 que a tela de custos já corrigiu, na outra
   * ponta: lá o F5 apagava 465 controles, aqui apagaria a proposta.
   *
   * Roda uma vez por id. O que vem do servidor é a verdade — quem chegou aqui
   * por um endereço com id está reabrindo, não começando.
   */
  const idCarregado = useRef('');
  useEffect(() => {
    if (!propostaId || idCarregado.current === propostaId) return;
    idCarregado.current = propostaId;

    let vivo = true;
    obterProposta(propostaId)
      .then(proposta => {
        if (!vivo) return;
        const dados = (proposta.payload ?? {}) as AnyRecord;

        setForm(atual => ({ ...atual, ...dados }));
        if (Array.isArray(dados.scopeItems) && dados.scopeItems.length) {
          setItensEscopo(dados.scopeItems as ScopeServiceItem[]);
        }
        if (Array.isArray(dados.scopeBlocks)) setBlocos(dados.scopeBlocks as ScopeBlock[]);
        if (Array.isArray(dados.rows) && dados.rows.length) {
          setResponsabilidades(dados.rows as LinhaResponsabilidade[]);
        }
        if (Array.isArray(dados.categorias) && dados.categorias.length) {
          setCategorias(dados.categorias as string[]);
        }
        if (dados.technicalServices) {
          // Pelo normalizador, como no rascunho: a proposta pode ter sido salva
          // com uma versão anterior do catálogo técnico.
          setServicosTecnicos(normalizeTechnicalServiceSelections(dados.technicalServices));
        }
        if (typeof dados.technicalReports === 'string') {
          setComplementoRelatorios(dados.technicalReports);
        }
        if (Array.isArray(dados.prices) && dados.prices.length) {
          setPrecos(dados.prices as ItemDePreco[]);
        }
        if (typeof dados.includeUnitValue === 'boolean') {
          setIncluirUnitario(dados.includeUnitValue);
        }

        // O modelo mora no endereço. Reabrir sem ele mostraria o diálogo de
        // escolha por cima de uma proposta que já escolheu.
        const salvo = dados.modelo;
        if (!modeloNaUrl && (salvo === 'padrao' || salvo === 'hidrojateamento')) {
          trocarParametros({ modelo: salvo });
        }
        // Reabrir uma proposta é chegar depois do começo: as etapas já visitadas
        // continuam alcançáveis pelo stepper.
        setMaiorVisitada(ETAPAS.length - 1);
      })
      .catch(error => {
        if (vivo) setRecado(mensagemDeErro(error, 'Não foi possível carregar a proposta.'));
      });

    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propostaId]);

  useEffect(() => {
    setMaiorVisitada(atual => Math.max(atual, indice));
  }, [indice]);

  const pendencias = pendenciasDaEtapa(etapa, form, {
    itens: itensEscopo,
    responsabilidades,
    errosTecnicos,
    precos
  });
  const erros = indiceDePendencias(pendencias);
  const ultima = indice === ETAPAS.length - 1;

  function irPara(destino: EtapaProposta) {
    const proximos = new URLSearchParams(params);
    proximos.set('etapa', destino);
    setParams(proximos, { replace: true });
    setTentouAvancar(false);
  }

  /**
   * "Salvar e continuar" — e ele salva mesmo, desde a primeira etapa.
   *
   * A ordem importa: valida, **salva**, e só então avança. Avançar antes de
   * salvar faria o rodapé prometer uma coisa e entregar outra; avançar depois de
   * uma falha esconderia a falha atrás de uma etapa nova.
   */
  async function avancar() {
    // Mesma regra do vermelho na tela de custos: a marcação aparece quando o
    // usuário tenta avançar, não antes.
    setTentouAvancar(true);
    if (pendencias.length > 0) return;

    if (ultima) {
      await emitir();
      return;
    }

    const id = await salvar();
    if (!id) return;
    irPara(ETAPAS[indice + 1].value);
  }

  function editar(patch: AnyRecord) {
    setForm(atual => ({ ...atual, ...patch }));
  }

  /**
   * Escolher o modelo é o primeiro ato da proposta — ele troca a matriz, a
   * jornada e, no caso do hidrojateamento, o número de tabelas de preço.
   *
   * Só semeia a matriz quando ela ainda é a do modelo anterior **intocada**.
   * Alguém que já editou trinta linhas e volta para trocar o modelo perderia
   * tudo em silêncio; aí o modelo muda e a matriz fica, com o recado dizendo.
   */
  function escolherModelo(escolhido: ModeloProposta) {
    const anterior = modelo ?? 'padrao';
    const intocada =
      JSON.stringify(responsabilidades) === JSON.stringify(matrizInicial(anterior));

    if (intocada) {
      setResponsabilidades(matrizInicial(escolhido));
      setRecado('');
    } else if (escolhido !== anterior) {
      setRecado(
        'O modelo mudou, mas a matriz de responsabilidades foi preservada porque já ' +
          'tinha edições suas. Ajuste-a na etapa 3 se precisar.'
      );
    }

    editar({ workday: jornadaEmTexto(escolhido) });

    const proximos = new URLSearchParams(params);
    proximos.set('modelo', escolhido);
    setParams(proximos, { replace: true });
  }

  const erroDe = (campo: string) => (tentouAvancar ? erros.get(campo) : undefined);

  /** O estado da tela no formato que `salvamento.ts` consome. */
  function conteudo(codigoAtual = codigo): ConteudoDaProposta {
    return {
      form,
      codigo: codigoAtual,
      orcamentista: user?.name || '',
      modelo: modelo ?? 'padrao',
      itensEscopo,
      blocos,
      categorias,
      responsabilidades,
      precos,
      incluirUnitario,
      servicosTecnicos,
      complementoRelatorios
    };
  }

  function trocarParametros(mudancas: Record<string, string>) {
    const proximos = new URLSearchParams(params);
    for (const [chave, valor] of Object.entries(mudancas)) proximos.set(chave, valor);
    setParams(proximos, { replace: true });
  }

  /**
   * Salva a proposta no servidor — é o que o botão "Salvar e continuar" promete.
   *
   * Devolve o id, ou `null` quando não deu para salvar. Quem chama **não avança**
   * com `null`: passar de etapa depois de uma falha faria o usuário acreditar
   * que o trabalho está guardado.
   *
   * O número da proposta é reservado aqui, no primeiro salvamento, e não na
   * abertura da tela. Ele **consome** — abrir o assistente e desistir não pode
   * gastar um número, porque o próximo sairia com um buraco no meio.
   */
  async function salvar(): Promise<string | null> {
    if (salvando) return null;
    setSalvando(true);
    setRecado(propostaId ? 'Salvando...' : 'Salvando a proposta...');

    try {
      let codigoAtual = codigo;
      if (precisaDeNumero(codigoAtual)) {
        codigoAtual = String(await reservarProximoNumero());
        trocarParametros({ proposta: codigoAtual });
      }

      const entrada = entradaDaProposta(conteudo(codigoAtual), levantamentoId);

      const salva = propostaId
        ? await atualizarProposta(propostaId, entrada)
        : await criarProposta(entrada);

      // Gravada no servidor, o rascunho local não pode sobrar para reaparecer
      // depois como se fosse trabalho não salvo.
      rascunho.limparTudo();
      if (!propostaId) trocarParametros({ id: salva.id });
      setRecado('');
      return salva.id;
    } catch (error) {
      setRecado(mensagemDeErro(error, 'Não foi possível salvar a proposta.'));
      return null;
    } finally {
      setSalvando(false);
    }
  }

  /**
   * Emite os dois documentos e baixa o que o usuário escolheu.
   *
   * **Não é a finalização.** Nada é enviado ao Nectar nem ao SharePoint — essa
   * parte ainda não existe. O que acontece aqui é o que o servidor já garante:
   * os dois PDFs são gerados e **gravados** antes de qualquer integração.
   *
   * As duas propostas são sempre geradas; a escolha decide só o que é baixado.
   */
  async function emitir() {
    const id = await salvar();
    if (!id) return;

    setGerandoPdf(true);
    setRecado('Gerando a proposta técnica e a comercial...');
    try {
      const { documentos } = await emitirDocumentos(id);
      setEmitidos(documentos);

      const querer = (kind: DocumentoEmitido['kind']) =>
        escolhaDownload === 'both' ||
        (escolhaDownload === 'commercial' && kind === 'COMERCIAL') ||
        (escolhaDownload === 'technical' && kind === 'TECNICA');

      for (const documento of documentos) {
        if (querer(documento.kind)) await baixar(documento);
      }

      setRecado(
        'Documentos gerados e guardados no servidor. O envio ao Nectar e ao ' +
          'SharePoint ainda não está disponível.'
      );
    } catch (error) {
      setRecado(mensagemDeErro(error, 'Não foi possível gerar os documentos.'));
    } finally {
      setGerandoPdf(false);
    }
  }

  async function baixar(documento: DocumentoEmitido) {
    const blob = await baixarDocumento(documento.id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = documento.fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Baixa o PDF gerado no servidor — o documento de verdade, não a impressão da
   * tela.
   *
   * A URL do blob é revogada depois de usada: sem isso cada clique deixa os
   * bytes do PDF presos na memória da aba até ela ser fechada, e uma proposta
   * com fotos tem vários megabytes.
   */
  async function gerarPdf() {
    setGerandoPdf(true);
    setRecado('');
    try {
      const blob = await baixarPreviaEmPdf(documentoNaPrevia, dadosDaProposta(conteudo()));

      const url = URL.createObjectURL(blob);
      const nome = `Proposta ${documentoNaPrevia === 'technical' ? 'Técnica' : 'Comercial'} - ${codigo}.pdf`;
      const link = document.createElement('a');
      link.href = url;
      link.download = nome;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setRecado('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setGerandoPdf(false);
    }
  }

  return (
    <ComercialChrome
      variante="proposta"
      semContainer
      eyebrow="FILTROVALI / NOVA PROPOSTA"
      titulo="Propostas "
      tituloComplemento={codigo}
      descricao="Um cadastro, dois documentos: técnico e comercial."
      chips={
        <>
          <span className="com-chip">
            <i aria-hidden="true" /> Nectar pendente
          </span>
          <span className="com-chip">
            <i aria-hidden="true" /> Microsoft 365
          </span>
        </>
      }
      acoes={
        <button
          type="button"
          className="com-btn com-btn-fantasma"
          onClick={() => window.print()}
        >
          Imprimir prévia
        </button>
      }
      heroExtra={
        <div className="com-sequencia">
          <small>NUMERAÇÃO AUTOMÁTICA</small>
          <strong>{codigo}</strong>
          <span>Integração Nectar na etapa final</span>
        </div>
      }
      faixa={
        <nav className="com-stepper" aria-label="Etapas da proposta">
          {ETAPAS.map((item, i) => {
            const alcancavel = i <= maiorVisitada;
            return (
              <button
                key={item.value}
                type="button"
                className={
                  i === indice ? 'is-ativa' : i < maiorVisitada ? 'is-concluida' : undefined
                }
                aria-current={i === indice ? 'step' : undefined}
                /* Sem `disabled`: na referência o passo à frente fica cinza,
                   não apagado. Ele informa onde se está — e um controle
                   desabilitado parece defeito, não estado. O clique é que
                   respeita a ordem. */
                aria-disabled={!alcancavel || undefined}
                onClick={() => alcancavel && irPara(item.value)}
              >
                <b aria-hidden="true">{i < maiorVisitada ? '✓' : i + 1}</b>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      }
    >
      {/* Mesmo padrão do diálogo de custos: só aparece quando NÃO há modelo no
          endereço. Recarregar com `?modelo=` já definido volta direto ao
          trabalho — o diálogo serve para escolher, não para confirmar. */}
      {modelo === null && (
        <div
          className="com-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="com-modelo-titulo"
        >
          <section className="com-painel com-modo-card">
            <img className="com-modo-logo" src={LOGO_URL} alt="Filtrovali" />
            <span className="com-eyebrow">NOVA PROPOSTA</span>
            <h1 id="com-modelo-titulo">Qual modelo de documento?</h1>
            <p>
              O modelo define a matriz de responsabilidade, a jornada e as tabelas de
              preço que o documento vai trazer.
            </p>

            <div className="com-modo-opcoes">
              {MODELOS_PROPOSTA.map(opcao => (
                <button
                  key={opcao.id}
                  type="button"
                  onClick={() => escolherModelo(opcao.id)}
                >
                  <b aria-hidden="true">{opcao.id === 'padrao' ? '📄' : '💧'}</b>
                  <strong>{opcao.titulo}</strong>
                  <span>{opcao.descricao}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      <section className="com-workspace">
      <div className="com-form-panel">
      {rascunho.oferta && (
        <section className="com-painel com-oferta-rascunho" role="alertdialog">
          <div>
            <strong>Recuperar rascunho não salvo?</strong>
            <p>
              Há uma proposta em andamento guardada neste navegador,{' '}
              {rascunho.idadeDaOferta}. Ela não chegou a ser salva no servidor.
            </p>
          </div>
          <div className="com-oferta-acoes">
            <button
              type="button"
              className="com-btn com-btn-primario"
              onClick={() => {
                const dados = rascunho.recuperar() as
                  | {
                      form?: AnyRecord;
                      itensEscopo?: ScopeServiceItem[];
                      blocos?: ScopeBlock[];
                      responsabilidades?: LinhaResponsabilidade[];
                      categorias?: string[];
                      servicosTecnicos?: unknown;
                      complementoRelatorios?: string;
                      precos?: ItemDePreco[];
                      incluirUnitario?: boolean;
                    }
                  | undefined;
                if (!dados) return;
                if (dados.form) setForm(dados.form);
                if (dados.itensEscopo?.length) setItensEscopo(dados.itensEscopo);
                if (dados.blocos) setBlocos(dados.blocos);
                if (dados.responsabilidades?.length) {
                  // Rascunho guardado antes da categoria existir vem sem ela, e
                  // um `value` indefinido tornaria o campo não controlado no
                  // meio da digitação. Sem categoria, a linha só não ganha
                  // subtítulo — não some do documento.
                  setResponsabilidades(
                    dados.responsabilidades.map(linha => ({
                      ...linha,
                      categoria: linha.categoria ?? ''
                    }))
                  );
                }
                if (dados.categorias?.length) setCategorias(dados.categorias);
                if (dados.servicosTecnicos) {
                  // Passa pelo normalizador: o rascunho pode ter sido guardado
                  // com uma versão anterior do catálogo, e um serviço que mudou
                  // de forma entraria quebrado direto no estado.
                  setServicosTecnicos(
                    normalizeTechnicalServiceSelections(dados.servicosTecnicos)
                  );
                }
                if (typeof dados.complementoRelatorios === 'string') {
                  setComplementoRelatorios(dados.complementoRelatorios);
                }
                if (dados.precos?.length) setPrecos(dados.precos);
                if (typeof dados.incluirUnitario === 'boolean') {
                  setIncluirUnitario(dados.incluirUnitario);
                }
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


      {etapa === 'cliente' ? (
        <ClienteStep
          form={form}
          editar={editar}
          erroDe={erroDe}
          orcamentista={user?.name || ''}
          consultores={consultores}
          podeEscolherConsultor={podeEscolher}
        />
      ) : etapa === 'escopo' ? (
        <EscopoStep
          titulo={String(form.title ?? '')}
          onTitulo={valor => editar({ title: valor })}
          itens={itensEscopo}
          onItens={setItensEscopo}
          blocos={blocos}
          onBlocos={setBlocos}
          erroDe={erroDe}
        />
      ) : etapa === 'responsabilidades' ? (
        <ResponsabilidadesStep
          linhas={responsabilidades}
          categorias={categorias}
          onCategorias={setCategorias}
          onLinhas={setResponsabilidades}
          mostrarErros={tentouAvancar}
        />
      ) : etapa === 'prazos' ? (
        <PrazosStep form={form} editar={editar} erroDe={erroDe} />
      ) : etapa === 'tecnica' ? (
        <TecnicaStep
          selecoes={servicosTecnicos}
          onSelecoes={setServicosTecnicos}
          complemento={complementoRelatorios}
          onComplemento={setComplementoRelatorios}
          observacoes={String(form.technicalObservations ?? '')}
          onObservacoes={valor => editar({ technicalObservations: valor })}
          erros={errosTecnicos}
          mostrarErros={tentouAvancar}
        />
      ) : etapa === 'comercial' ? (
        <ComercialStep
          form={form}
          editar={editar}
          precos={precos}
          onPrecos={setPrecos}
          incluirUnitario={incluirUnitario}
          onIncluirUnitario={setIncluirUnitario}
          erroDe={erroDe}
          mostrarErros={tentouAvancar}
          modelo={modelo ?? 'padrao'}
        />
      ) : (
        <RevisaoStep
          form={form}
          codigo={codigo}
          escolha={escolhaDownload}
          onEscolha={setEscolhaDownload}
          pastaOneDrive={pastaOneDrive}
          onPastaOneDrive={setPastaOneDrive}
          anexos={anexos}
          onAnexos={setAnexos}
        />
      )}

      {recado && (
        <p className="com-recado com-recado-tela" role="status">
          {recado}
        </p>
      )}

      {/* Emitidos e guardados no servidor. Ficam à mão porque o download pode
          ter sido bloqueado pelo navegador, ou a pessoa pode ter escolhido só
          uma das duas e mudado de ideia — os arquivos continuam lá. */}
      {emitidos.length > 0 && (
        <section className="com-painel com-emitidos">
          <strong>Documentos emitidos</strong>
          <ul>
            {emitidos.map(documento => (
              <li key={documento.id}>
                <button
                  type="button"
                  className="com-btn com-btn-fantasma"
                  onClick={() => {
                    baixar(documento).catch(error =>
                      setRecado(mensagemDeErro(error, 'Não foi possível baixar o documento.'))
                    );
                  }}
                >
                  Baixar {documento.fileName}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="com-rodape">
        <button
          type="button"
          className="com-btn com-btn-fantasma"
          onClick={() =>
            indice === 0
              ? navigate(moduleRoutePath('comercial', 'index'))
              : irPara(ETAPAS[indice - 1].value)
          }
        >
          {indice === 0 ? 'Cancelar e voltar' : '← Voltar'}
        </button>

        {/* "Preencha N campo(s) obrigatório(s)" fica ao LADO do botão, em
            laranja, como na referência — não dentro dele. */}
        <span className="com-faltando">{avisoDePendencias(pendencias)}</span>

        <button
          type="button"
          className="com-btn com-btn-primario"
          /* NÃO desabilitado quando há pendência: o clique é o que revela onde
             ela está. Desabilitar esconderia a resposta de quem está perdido —
             é a mesma escolha do rodapé-guia da tela de custos.

             Durante a gravação ele trava, e por outro motivo: dois cliques
             seguidos criariam duas propostas com dois números. */
          disabled={salvando || gerandoPdf}
          onClick={avancar}
        >
          {salvando
            ? 'Salvando...'
            : gerandoPdf
              ? 'Gerando os documentos...'
              : rotuloDoAvanco(pendencias, ultima)}
        </button>
      </footer>
      </div>

      {/* A prévia é metade da tela na referência, e a razão dela é essa: o
          orçamentista não preenche um cadastro, monta um documento que vai ao
          cliente. Ver o documento se formar é o que faz alguém perceber que o
          escopo saiu vazio ANTES de gerar o PDF. */}
      <aside className="com-previa">
        <div className="com-previa-topo">
          <div>
            <strong>Prévia oficial Filtrovali</strong>
            <span>As duas saídas usam o mesmo cadastro</span>
          </div>
          <b>
            {indice + 1}/{ETAPAS.length}
          </b>
        </div>

        <div className="com-previa-abas" role="tablist" aria-label="Documento em prévia">
          <button
            type="button"
            role="tab"
            aria-selected={documentoNaPrevia === 'commercial'}
            className={documentoNaPrevia === 'commercial' ? 'is-ativa' : undefined}
            onClick={() => setDocumentoNaPrevia('commercial')}
          >
            Comercial
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={documentoNaPrevia === 'technical'}
            className={documentoNaPrevia === 'technical' ? 'is-ativa' : undefined}
            onClick={() => setDocumentoNaPrevia('technical')}
          >
            Técnica
          </button>
        </div>

        <div className="com-previa-rolagem">
          <DocumentoPrevia
            tipo={documentoNaPrevia}
            form={{ ...form, estimator: user?.name || '' }}
            codigo={codigo}
            itensEscopo={itensEscopo}
            blocos={blocos}
            responsabilidades={responsabilidades}
            precos={precos}
            incluirUnitario={incluirUnitario}
            servicosTecnicos={servicosTecnicos}
            complementoRelatorios={complementoRelatorios}
            modelo={modelo ?? 'padrao'}
          />
        </div>

        <div className="com-previa-acoes">
          <button
            type="button"
            className="com-previa-imprimir"
            disabled={gerandoPdf}
            onClick={gerarPdf}
          >
            {gerandoPdf ? 'Gerando…' : 'Baixar PDF'}
          </button>
          <button
            type="button"
            className="com-previa-imprimir com-previa-imprimir-secundario"
            onClick={() => window.print()}
          >
            Imprimir prévia
          </button>
        </div>
      </aside>
      </section>
    </ComercialChrome>
  );
}
