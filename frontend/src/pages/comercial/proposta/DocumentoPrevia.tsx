import type {
  ScopeBlock,
  ScopeServiceItem
} from '../../../../../shared/comercial/dist/scope-content.js';
import type { TechnicalServiceSelection } from '../../../../../shared/comercial/dist/technical-services.js';
import type { ItemDePreco, LinhaResponsabilidade } from './etapas';
import {
  paginasDoEscopo,
  paginasTecnicas,
  tituloDoItemDeEscopo
} from './previaPaginacao';

/**
 * Prévia do documento, ao lado do formulário (`PROP-CTL-086..089`, `PROP-H-004..022`).
 *
 * Porte de `DocumentPreview` (`app/page.tsx`).
 *
 * **É metade da tela da referência, e a razão dela é essa mesma.** O orçamentista não
 * está preenchendo um cadastro: está montando um documento que vai ao cliente. Ver o
 * documento se formar enquanto se digita é o que faz alguém perceber que o título
 * ficou grande demais ou que o escopo saiu vazio — antes de gerar o PDF, não depois.
 *
 * As páginas têm proporção **1414/2000** e fundo de imagem: são o papel timbrado
 * oficial. A capa é só a imagem, sem texto por cima — o texto entra da página 2.
 */

type AnyRecord = Record<string, unknown>;

export type TipoDeDocumento = 'commercial' | 'technical';

const BASE = (import.meta.env.VITE_ASSETS_BASE_URL || '').replace(/\/$/, '');
const CAPA = {
  commercial: `${BASE}/assets/Comercial/proposta-capa-comercial.jpg`,
  technical: `${BASE}/assets/Comercial/proposta-capa-tecnica.jpg`
};
const PAGINA = `${BASE}/assets/Comercial/proposta-pagina.jpg`;

/** Os índices da referência: **13 itens no comercial, 10 no técnico**. */
const INDICE_COMERCIAL = [
  'Filtrovali é a escolha certa para a sua obra',
  'Descrição dos serviços que serão executados',
  'Matriz de responsabilidades',
  'Prazos e jornada de trabalho',
  'Preços',
  'Condições de pagamento',
  'Impostos',
  'Validade da proposta',
  'Know-how e confidencialidade',
  'Observações comerciais',
  'Segurança do trabalho',
  'Aceite da proposta',
  'Contatos'
];

const INDICE_TECNICO = [
  'Filtrovali é a escolha certa para a sua obra',
  'Descrição dos serviços que serão executados',
  'Matriz de responsabilidades',
  'Prazos e jornada de trabalho',
  'Método de execução',
  'Etapas operacionais',
  'Inspeção e critério de liberação',
  'Relatórios e evidências',
  'Observações técnicas',
  'Contatos'
];

const METRICAS = [
  'Desde 2005',
  '+700 projetos',
  '20 estados',
  'Equipe certificada',
  'Tecnologia própria'
];

function Pagina({
  numero,
  data,
  children
}: {
  numero: number;
  data: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="com-pagina"
      style={{ backgroundImage: `url(${PAGINA})` }}
      aria-label={`Página ${numero}`}
    >
      <div className="com-pagina-corpo">{children}</div>
      <footer className="com-pagina-rodape">
        <span>{data || '—'}</span>
        <span>{numero}</span>
      </footer>
    </section>
  );
}

export function DocumentoPrevia({
  tipo,
  form,
  codigo,
  itensEscopo,
  blocos,
  responsabilidades,
  precos,
  incluirUnitario,
  servicosTecnicos,
  complementoRelatorios
}: {
  tipo: TipoDeDocumento;
  form: AnyRecord;
  codigo: string;
  itensEscopo: ScopeServiceItem[];
  blocos: ScopeBlock[];
  responsabilidades: LinhaResponsabilidade[];
  precos: ItemDePreco[];
  incluirUnitario: boolean;
  servicosTecnicos: TechnicalServiceSelection[];
  complementoRelatorios: string;
}) {
  const tecnico = tipo === 'technical';
  const indice = tecnico ? INDICE_TECNICO : INDICE_COMERCIAL;
  const texto = (campo: string, padrao: string) =>
    String(form[campo] ?? '').trim() || padrao;

  const data = String(form.date ?? '');
  const responsabilidadesPreenchidas = responsabilidades.filter(linha => linha.item.trim());

  /* A numeração das folhas é CALCULADA, não fixa: cada tabela ou foto do escopo
     empurra tudo o que vem depois. É o mesmo cálculo que o PDF fará. */
  const folhasDoEscopo = paginasDoEscopo(blocos);
  const folhasTecnicas = tecnico
    ? paginasTecnicas(servicosTecnicos, complementoRelatorios)
    : [];

  const numeroDasResponsabilidades = 4 + folhasDoEscopo.length;
  const numeroDosPrazos = numeroDasResponsabilidades + 1;
  const numeroDoFechamentoTecnico = numeroDosPrazos + folhasTecnicas.length + 1;

  return (
    <div className="com-documento">
      {/* A capa é só a imagem — o texto do documento começa na página 2. */}
      <section
        className="com-pagina com-pagina-capa"
        style={{ backgroundImage: `url(${CAPA[tipo]})` }}
        aria-label={`Capa da proposta ${tecnico ? 'técnica' : 'comercial'}`}
      />

      <Pagina numero={2} data={data}>
        <h2 className="com-doc-tipo">
          {tecnico ? 'Proposta Técnica' : 'Proposta Comercial'}
        </h2>

        <div className="com-doc-meta">
          <p>
            <b>Consultor de Vendas:</b> {texto('sellerName', 'Selecione')}
            <br />
            <b>Orçamentista:</b> {texto('estimator', 'Selecione')}
          </p>
          <h3>PROPOSTA Nº: {codigo}</h3>
          <p>
            <b>CLIENTE:</b> {texto('client', 'Nome do cliente')}
            <br />
            <b>A/C:</b> {texto('contact', 'Contato')}
            <br />
            <b>E-mail do solicitante:</b> {texto('email', 'email@cliente.com')}
            <br />
            <b>Departamento:</b> {texto('department', '-')}
            <br />
            <br />
            <b>Local da obra:</b> {texto('site', 'Local')}
            <br />
            <br />
            <b>CNPJ:</b> {texto('cnpj', '00.000.000/0000-00')}
          </p>
        </div>

        <h2 className="com-doc-indice-titulo">ÍNDICE</h2>
        <ol className="com-doc-indice">
          {indice.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </Pagina>

      <Pagina numero={3} data={data}>
        <h3>1. Filtrovali é a escolha certa para a sua obra</h3>
        <p>
          Desde 2005, a Filtrovali entrega soluções industriais com excelência,
          segurança, qualidade e eficiência.
        </p>

        <div className="com-doc-metricas">
          {METRICAS.map(item => (
            <span key={item}>{item}</span>
          ))}
        </div>

        <h3>1.1 Tradição e referência em serviços industriais</h3>
        <p>
          Limpeza química, flushing, filtragem absoluta, passagem de PIG, testes
          hidrostáticos, centrifugação e desidratação de óleo.
        </p>

        <h3>2. Descrição dos serviços que serão executados</h3>
        {itensEscopo.length > 0 ? (
          itensEscopo.map((item, i) => (
            <div className="com-doc-servico" key={item.id}>
              <h4>
                2.{i + 1} {item.title || `Serviço ${i + 1}`}
              </h4>
              {/* O texto de espera é instrução, não conteúdo: ele diz ONDE
                  preencher, senão o usuário vê a página vazia e não sabe de
                  qual etapa ela vem. */}
              <p>{item.description || 'Descreva este serviço na etapa Escopo.'}</p>
            </div>
          ))
        ) : (
          <p>Descreva os serviços na etapa Escopo.</p>
        )}
      </Pagina>

      {folhasDoEscopo.map((folha, i) => (
        <Pagina numero={4 + i} data={data} key={folha.chave}>
          <h3>{tituloDoItemDeEscopo(itensEscopo, folha.scopeItemId)}</h3>

          {folha.tipo === 'table' ? (
            <>
              <h4>
                {folha.rotulo}
                {folha.totalDePartes > 1
                  ? ` — parte ${folha.parte}/${folha.totalDePartes}`
                  : ''}
              </h4>
              <table className="com-doc-tabela">
                <thead>
                  <tr>
                    {folha.colunas.map((coluna, c) => (
                      <th key={`${folha.chave}-h-${c}`}>{coluna || `Coluna ${c + 1}`}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {folha.linhas.map((linha, l) => (
                    <tr key={`${folha.chave}-l-${l}`}>
                      {folha.colunas.map((_, c) => (
                        <td key={`${folha.chave}-c-${l}-${c}`}>{linha[c] || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <figure className="com-doc-foto">
              <img src={folha.bloco.src} alt={folha.bloco.caption || folha.bloco.fileName} />
              <figcaption>
                {folha.rotulo}
                {folha.bloco.caption ? ` — ${folha.bloco.caption}` : ''}
              </figcaption>
            </figure>
          )}
        </Pagina>
      ))}

      <Pagina numero={numeroDasResponsabilidades} data={data}>
        <h3>3. Matriz geral de responsabilidade</h3>
        {/* Separadas por dono, e limitadas a 6 cada: é como a folha comporta, e
            é como o documento oficial apresenta — não uma lista corrida. */}
        <BlocoDeResponsabilidade
          titulo="Responsabilidade da Filtrovali"
          linhas={responsabilidadesPreenchidas.filter(l => l.owner === 'Filtrovali').slice(0, 6)}
        />
        <BlocoDeResponsabilidade
          titulo="Responsabilidade da Contratante"
          linhas={responsabilidadesPreenchidas.filter(l => l.owner === 'Contratante').slice(0, 6)}
        />
      </Pagina>

      <Pagina numero={numeroDosPrazos} data={data}>
        <h3>4. Previsão de atendimento</h3>
        <p>
          {texto('attendance', 'A definir')} após o pedido ou contrato. Mobilização:{' '}
          {texto('mobilization', 'a definir')}.
        </p>

        <h3>5. Prazo para execução dos serviços</h3>
        <p>
          Permanência: {texto('permanence', 'a definir')}. Execução:{' '}
          {texto('execution', 'a definir')}.
        </p>

        <h3>6. Jornada de trabalho</h3>
        <p>{texto('workday', 'A definir')}</p>

        {!tecnico && (
          <>
            <h3>7. Descrição dos valores</h3>
            <table className="com-doc-tabela">
              <thead>
                <tr>
                  <th>ITEM</th>
                  <th>DESCRIÇÃO</th>
                  {incluirUnitario && <th>VALOR UNIT.</th>}
                  <th>QTD.</th>
                  <th>VALOR TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {precos.map((item, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{item.description || 'Item'}</td>
                    {incluirUnitario && <td>{item.unitValue || 'R$ -'}</td>}
                    <td>{item.quantity || '1'}</td>
                    <td>{item.value || 'R$ -'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="com-doc-total">
              <b>Total geral:</b> {somaDosPrecos(precos)}
            </p>

            <h3>8. Condições de pagamento</h3>
            <p>{texto('payment', 'A definir')}</p>
          </>
        )}
      </Pagina>

      {folhasTecnicas.map((folha, i) => (
        <Pagina numero={numeroDosPrazos + i + 1} data={data} key={folha.chave}>
          <h3>
            {folha.titulo}
            {folha.totalDePartes > 1 ? ` — ${folha.parte}/${folha.totalDePartes}` : ''}
          </h3>
          {/* `pre-wrap`: o texto técnico vem com quebras próprias, e colapsá-las
              transformaria a lista de etapas num parágrafo só. */}
          <p className="com-doc-tecnico">{folha.texto}</p>
        </Pagina>
      ))}

      {tecnico && (
        <Pagina numero={numeroDoFechamentoTecnico} data={data}>
          <h3>9. Validade da proposta</h3>
          <p>{texto('validity', '10')} dias após a emissão.</p>

          <h3>10. Observações</h3>
          <p>{texto('technicalObservations', 'Sem observações adicionais.')}</p>
        </Pagina>
      )}
    </div>
  );
}

function BlocoDeResponsabilidade({
  titulo,
  linhas
}: {
  titulo: string;
  linhas: LinhaResponsabilidade[];
}) {
  return (
    <div className="com-doc-responsabilidade">
      <h4>{titulo}</h4>
      <table className="com-doc-tabela">
        <thead>
          <tr>
            <th>ITEM</th>
            <th>ESCOPO</th>
            <th>NOTA</th>
          </tr>
        </thead>
        <tbody>
          {linhas.length > 0 ? (
            linhas.map((linha, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{linha.item}</td>
                <td>{linha.note}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3}>—</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Soma dos valores digitados.
 *
 * Os valores são texto com máscara ("R$ 38.000,00"), então a soma desfaz a
 * máscara antes: o ponto é separador de milhar e a vírgula é o decimal, ao
 * contrário do que `Number()` espera.
 */
function somaDosPrecos(precos: ItemDePreco[]): string {
  const total = precos.reduce((soma, item) => {
    const limpo = String(item.value || '').replace(/[^\d,.-]/g, '');
    const numero = Number(limpo.replace(/\./g, '').replace(',', '.'));
    return soma + (Number.isFinite(numero) ? numero : 0);
  }, 0);

  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total);
}
