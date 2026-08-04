import { Field } from '../../components/Field';
import { ETAPAS } from '../etapas';

/**
 * Etapa 7 — Revisão e integração (`PROP-CTL-072..085` e `129..130`).
 *
 * Porte de `app/page.tsx:1073-1140`.
 *
 * **A escolha de download não decide o que é gerado.** As duas propostas são sempre
 * geradas e salvas no banco, mesmo quando o usuário baixa só uma — e a tela diz isso
 * em voz alta, porque quem escolhe "somente comercial" naturalmente supõe que a
 * técnica não foi feita.
 *
 * O funil do Nectar e a escolha de card (`PROP-CTL-073..079`, `129..130`) dependem da
 * integração (T076) e aparecem aqui **desabilitados, dizendo por quê**. O mesmo
 * critério da busca de empresa na etapa 1: um controle que some é indistinguível de
 * um que nunca existiu.
 */

type AnyRecord = Record<string, unknown>;

export type EscolhaDeDownload = 'both' | 'commercial' | 'technical';

const DOWNLOADS: Array<{ value: EscolhaDeDownload; label: string }> = [
  { value: 'both', label: 'Técnica + comercial' },
  { value: 'commercial', label: 'Somente comercial' },
  { value: 'technical', label: 'Somente técnica' }
];

export function RevisaoStep({
  form,
  codigo,
  escolha,
  onEscolha,
  pastaOneDrive,
  onPastaOneDrive,
  anexos,
  onAnexos
}: {
  form: AnyRecord;
  codigo: string;
  escolha: EscolhaDeDownload;
  onEscolha: (valor: EscolhaDeDownload) => void;
  pastaOneDrive: string;
  onPastaOneDrive: (valor: string) => void;
  anexos: File[];
  onAnexos: (arquivos: File[]) => void;
}) {
  const cliente = String(form.client || '').trim() || 'CLIENTE';

  return (
    <section className="com-painel">
      <div className="com-secao-titulo">
        <div>
          <h2>Revisão e integração</h2>
          <p>Confira os dois documentos e defina o destino no Nectar.</p>
        </div>
      </div>

      <div className="com-nota-regra">
        <strong>Funil e card do Nectar</strong>
        <p>
          A escolha do funil e do card entra junto com a integração do CRM. Até lá os
          documentos são gerados e salvos normalmente, sem envio automático.
        </p>
      </div>

      {/* O visto marca as etapas percorridas — todas, já que só se chega aqui
          passando por elas. É confirmação, não navegação. */}
      <div className="com-checklist">
        {ETAPAS.slice(0, -1).map(etapa => (
          <div key={etapa.value}>
            <b aria-hidden="true">✓</b>
            <span>{etapa.label}</span>
          </div>
        ))}
      </div>

      <div className="com-form-grid">
        <article className="com-dado com-dado-destaque">
          <span>Documento comercial</span>
          <strong className="com-quebrar">
            Proposta Comercial - {codigo} - {cliente}.pdf
          </strong>
          <small>Valores, pagamento, impostos, know-how e aceite.</small>
        </article>

        <article className="com-dado com-dado-destaque">
          <span>Documento técnico</span>
          <strong className="com-quebrar">
            Proposta Técnica - {codigo} - {cliente}.pdf
          </strong>
          <small>Método, etapas, inspeção, liberação e relatórios.</small>
        </article>
      </div>

      <fieldset className="com-escolha-download">
        <legend>
          <strong>O que deseja baixar?</strong>
          <span>
            As duas propostas sempre serão geradas e salvas no banco, mesmo quando
            você baixar apenas uma.
          </span>
        </legend>
        <div className="com-escolha-opcoes">
          {DOWNLOADS.map(item => (
            <label
              key={item.value}
              className={escolha === item.value ? 'is-ativa' : undefined}
            >
              <input
                type="radio"
                name="com-download"
                value={item.value}
                checked={escolha === item.value}
                onChange={() => onEscolha(item.value)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label="Pasta existente no OneDrive (opcional)"
        value={pastaOneDrive}
        hint="Havendo valor, os arquivos são gravados dentro dela em vez de uma pasta nova."
        onChange={onPastaOneDrive}
      />

      <div className="field-group">
        <label htmlFor="com-anexos">Arquivos adicionais do cliente (opcional)</label>
        <input
          id="com-anexos"
          type="file"
          multiple
          onChange={evento => onAnexos(Array.from(evento.target.files || []))}
        />
        <small className="field-hint">
          Os anexos serão salvos na mesma pasta dos dois PDFs.
        </small>
        {anexos.length > 0 && (
          <ul className="com-lista-anexos">
            {anexos.map(arquivo => (
              <li key={arquivo.name}>{arquivo.name}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
