import { Field, SelectField } from '../../components/Field';
import { formatarCnpj } from '../etapas';

/**
 * Etapa 1 — Cliente e responsáveis (`PROP-CTL-011..025`).
 *
 * Porte de `app/page.tsx:867-914`.
 *
 * Duas coisas que a referência faz aqui e que valem preservar:
 *
 * 1. **O orçamentista é somente-leitura**, preenchido pelo login. Não é comodidade:
 *    é quem responde pelo levantamento, e deixar digitável abriria a porta para
 *    assinar proposta em nome de outro.
 *
 * 2. **O erro de formato só aparece com o campo preenchido** — `form.cnpj && !valido`.
 *    Campo vazio é "obrigatório", não "inválido". Trocar os dois faz o usuário
 *    procurar erro de digitação num campo que ele não preencheu.
 */

type AnyRecord = Record<string, unknown>;

export function ClienteStep({
  form,
  editar,
  erroDe,
  orcamentista,
  consultores,
  podeEscolherConsultor
}: {
  form: AnyRecord;
  editar: (patch: AnyRecord) => void;
  erroDe: (campo: string) => string | undefined;
  orcamentista: string;
  consultores: Array<{ id: string; nome: string }>;
  podeEscolherConsultor: boolean;
}) {
  const valor = (campo: string) => String(form[campo] ?? '');

  return (
    <section className="com-painel">
      <div className="com-secao-titulo">
        <div>
          <h2>Cliente e responsáveis</h2>
          <p>Selecione os dados oficiais que aparecerão nos dois documentos.</p>
        </div>
      </div>

      {/* Busca no CRM (`PROP-CTL-012..015`). A integração com o Nectar é a T076;
          até lá o controle existe e diz por que não responde, em vez de tentar,
          falhar e parecer defeito. */}
      <div className="com-crm-busca">
        <input
          aria-label="Buscar empresa no Nectar"
          placeholder="Buscar empresa no Nectar..."
          disabled
        />
        <button type="button" disabled title="Integração com o Nectar ainda não ligada">
          Buscar no CRM
        </button>
      </div>
      <p className="com-nota">
        A busca no CRM entra junto com a integração do Nectar. Por ora os dados do
        cliente são digitados.
      </p>

      <div className="com-form-grid">
        <SelectField
          label="Consultor de Vendas"
          required
          value={valor('seller')}
          emptyLabel={podeEscolherConsultor ? 'Selecione o consultor' : undefined}
          options={consultores.map(item => ({ value: item.id, label: item.nome }))}
          /* Vendedor vê só o próprio nome, já escolhido: ele não emite em nome de
             outro, e a restrição vem da API, não daqui. */
          disabled={!podeEscolherConsultor}
          error={erroDe('seller')}
          onChange={novo => editar({ seller: novo })}
        />

        <div className="field-group">
          <label htmlFor="com-orcamentista">
            Orçamentista<span className="survey-required-marker">*</span>
          </label>
          <input id="com-orcamentista" value={orcamentista} readOnly aria-readonly="true" />
          <small className="field-hint">Preenchido automaticamente pelo seu login.</small>
        </div>

        <Field
          label="Data de emissão"
          type="date"
          required
          value={valor('date')}
          error={erroDe('date')}
          onChange={novo => editar({ date: novo })}
        />
      </div>

      <div className="com-form-grid">
        <Field
          label="Cliente"
          required
          value={valor('client')}
          error={erroDe('client')}
          onChange={novo => editar({ client: novo })}
        />

        <Field
          label="CNPJ"
          required
          inputMode="numeric"
          value={valor('cnpj')}
          error={erroDe('cnpj')}
          onChange={novo => editar({ cnpj: formatarCnpj(novo) })}
        />
      </div>

      <div className="com-form-grid">
        <Field
          label="Contato / A/C"
          required
          value={valor('contact')}
          error={erroDe('contact')}
          onChange={novo => editar({ contact: novo })}
        />

        <Field
          label="E-mail"
          type="email"
          required
          inputMode="email"
          value={valor('email')}
          error={erroDe('email')}
          onChange={novo => editar({ email: novo.trim() })}
        />

        <Field
          label="Departamento"
          value={valor('department')}
          onChange={novo => editar({ department: novo })}
        />
      </div>

      <Field
        label="Local da obra"
        required
        value={valor('site')}
        placeholder="Ex.: Rua, número, cidade/UF ou unidade industrial"
        error={erroDe('site')}
        onChange={novo => editar({ site: novo })}
      />
    </section>
  );
}
