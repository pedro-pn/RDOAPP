/**
 * Confirmação de escopo — "Confirmo que não haverá mão de obra".
 *
 * Porte de `.scope-confirmation` (`app/custos/page.tsx:680`). Reusada por mão
 * de obra, materiais e insumos, e logística.
 *
 * **Não é um checkbox de conveniência.** Um levantamento pode legitimamente
 * não ter mão de obra, e sem esta confirmação ele ficaria travado para sempre
 * no rodapé-guia — com a saída óbvia sendo preencher qualquer coisa, o que
 * produz preço errado. A confirmação transforma "está vazio" em "o usuário
 * disse que não se aplica", que são coisas diferentes.
 *
 * Por isso a caixa é âmbar quando pendente e verde quando confirmada: é um
 * aviso enquanto ninguém decidiu, e um registro depois.
 */

export function ConfirmacaoEscopo({
  confirmado,
  tituloPendente,
  tituloConfirmado,
  descricaoPendente,
  descricaoConfirmada,
  rotulo,
  onChange
}: {
  confirmado: boolean;
  tituloPendente: string;
  tituloConfirmado: string;
  descricaoPendente: string;
  descricaoConfirmada: string;
  rotulo: string;
  onChange: (valor: boolean) => void;
}) {
  return (
    <div className={`com-confirmacao${confirmado ? ' is-confirmada' : ''}`}>
      <div>
        <strong>{confirmado ? tituloConfirmado : tituloPendente}</strong>
        <span>{confirmado ? descricaoConfirmada : descricaoPendente}</span>
      </div>
      <label>
        <input
          type="checkbox"
          checked={confirmado}
          onChange={event => onChange(event.target.checked)}
        />
        <b>{rotulo}</b>
      </label>
    </div>
  );
}

/** Aviso de pendência dentro da seção. */
export function AvisoPendencia({ children }: { children: React.ReactNode }) {
  return (
    <div className="com-aviso" role="status">
      {children}
    </div>
  );
}
