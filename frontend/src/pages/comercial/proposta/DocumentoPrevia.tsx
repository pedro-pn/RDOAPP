import type { ScopeServiceItem } from '../../../../../shared/comercial/dist/scope-content.js';
import type { ItemDePreco, LinhaResponsabilidade } from './etapas';

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
  responsabilidades,
  precos,
  incluirUnitario
}: {
  tipo: TipoDeDocumento;
  form: AnyRecord;
  codigo: string;
  itensEscopo: ScopeServiceItem[];
  responsabilidades: LinhaResponsabilidade[];
  precos: ItemDePreco[];
  incluirUnitario: boolean;
}) {
  const tecnico = tipo === 'technical';
  const indice = tecnico ? INDICE_TECNICO : INDICE_COMERCIAL;
  const texto = (campo: string, padrao: string) =>
    String(form[campo] ?? '').trim() || padrao;

  const data = String(form.date ?? '');
  const responsabilidadesPreenchidas = responsabilidades.filter(linha => linha.item.trim());
  const precosPreenchidos = precos.filter(item => item.description.trim());

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

      <Pagina numero={4} data={data}>
        <h3>3. Matriz de responsabilidades</h3>
        {responsabilidadesPreenchidas.length > 0 ? (
          <table className="com-doc-tabela">
            <thead>
              <tr>
                <th>Item</th>
                <th>Responsável</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {responsabilidadesPreenchidas.map((linha, i) => (
                <tr key={i}>
                  <td>{linha.item}</td>
                  <td>{linha.owner}</td>
                  <td>{linha.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>Informe as responsabilidades na etapa Responsabilidades.</p>
        )}

        <h3>4. Prazos e jornada de trabalho</h3>
        <p>
          <b>Previsão de atendimento:</b> {texto('attendance', '—')}
          <br />
          <b>Mobilização após pedido:</b> {texto('mobilization', '—')}
          <br />
          <b>Permanência prevista em obra:</b> {texto('permanence', '—')}
          <br />
          <b>Prazo efetivo de execução:</b> {texto('execution', '—')}
        </p>
        <p>{texto('workday', 'Descreva a jornada na etapa Prazos.')}</p>
      </Pagina>

      {!tecnico && (
        <Pagina numero={5} data={data}>
          <h3>5. Preços</h3>
          {precosPreenchidos.length > 0 ? (
            <table className="com-doc-tabela">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Un.</th>
                  {incluirUnitario && <th>Qtd.</th>}
                  {incluirUnitario && <th>Valor unitário</th>}
                  <th>Valor total</th>
                </tr>
              </thead>
              <tbody>
                {precosPreenchidos.map((item, i) => (
                  <tr key={i}>
                    <td>{item.description}</td>
                    <td>{item.unit}</td>
                    {incluirUnitario && <td>{item.quantity}</td>}
                    {incluirUnitario && <td>{item.unitValue}</td>}
                    <td>{item.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>Cadastre os preços na etapa Comercial.</p>
          )}

          <h3>6. Condições de pagamento</h3>
          <p>{texto('payment', 'Informe as condições na etapa Comercial.')}</p>

          <h3>7. Impostos</h3>
          <p>{texto('taxes', 'Informe os impostos na etapa Comercial.')}</p>

          <h3>8. Validade da proposta</h3>
          <p>{texto('validity', '—')} dias a contar da data de emissão.</p>
        </Pagina>
      )}

      {tecnico && (
        <Pagina numero={5} data={data}>
          <h3>9. Observações técnicas</h3>
          <p>{texto('technicalObservations', 'Sem observações técnicas.')}</p>
        </Pagina>
      )}
    </div>
  );
}
