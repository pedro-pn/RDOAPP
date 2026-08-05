import { useEffect, useState } from 'react';
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
import { listarConsultores, type Consultor } from '../../../api/comercial';
import { useAuth } from '../../../auth/AuthContext';
import { moduleRoutePath } from '../../../modules/registry';
import { ComercialChrome } from '../components/ComercialChrome';
import { useRascunhoLocal } from '../useRascunhoLocal';
import {
  TEXTO_IMPOSTOS,
  TEXTO_OBSERVACOES_GERAIS,
  textoCondicoesPagamento
} from '../../../../../shared/comercial/dist/modelo-documento.js';
import {
  ETAPAS,
  indiceDaEtapa,
  avisoDePendencias,
  indiceDePendencias,
  matrizInicial,
  type ItemDePreco,
  type LinhaResponsabilidade,
  pendenciasDaEtapa,
  rotuloDoAvanco,
  type EtapaProposta
} from './etapas';
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
    () => matrizInicial('padrao')
  );
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

  const rascunho = useRascunhoLocal({
    tela: 'proposta',
    modo: levantamentoId ? 'levantamento' : 'avulsa',
    codigo: levantamentoId,
    dados: {
      form,
      itensEscopo,
      blocos,
      responsabilidades,
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

  function avancar() {
    // Mesma regra do vermelho na tela de custos: a marcação aparece quando o
    // usuário tenta avançar, não antes.
    setTentouAvancar(true);
    if (pendencias.length > 0) return;
    if (!ultima) irPara(ETAPAS[indice + 1].value);
  }

  function editar(patch: AnyRecord) {
    setForm(atual => ({ ...atual, ...patch }));
  }

  const erroDe = (campo: string) => (tentouAvancar ? erros.get(campo) : undefined);

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
             é a mesma escolha do rodapé-guia da tela de custos. */
          onClick={avancar}
        >
          {rotuloDoAvanco(pendencias, ultima)}
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
          />
        </div>

        <button
          type="button"
          className="com-previa-imprimir"
          onClick={() => window.print()}
        >
          Imprimir prévia {documentoNaPrevia === 'commercial' ? 'comercial' : 'técnica'}
        </button>
      </aside>
      </section>
    </ComercialChrome>
  );
}
