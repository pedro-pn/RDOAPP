/** Rodapé-guia da proposta: voltar, contagem de pendências e ação principal. */
export function PropostaFooter({
  primeiraEtapa,
  aviso,
  rotulo,
  ocupado,
  onVoltar,
  onAvancar
}: {
  primeiraEtapa: boolean;
  aviso: string;
  rotulo: string;
  ocupado: boolean;
  onVoltar: () => void;
  onAvancar: () => void;
}) {
  return (
    <footer className="com-rodape">
      <button type="button" className="com-btn com-btn-fantasma" onClick={onVoltar}>
        {primeiraEtapa ? 'Cancelar e voltar' : '← Voltar'}
      </button>

      <span className="com-faltando">{aviso}</span>

      <button
        type="button"
        className="com-btn com-btn-primario"
        disabled={ocupado}
        onClick={onAvancar}
      >
        {rotulo}
      </button>
    </footer>
  );
}
