interface ReportDdsSummaryBlock {
  label: string;
  inicio: string;
  termino: string;
  temas: string[];
}

interface ReportDdsSummarySectionProps {
  blocks: ReportDdsSummaryBlock[];
}

export function ReportDdsSummarySection({ blocks }: ReportDdsSummarySectionProps) {
  if (!blocks.length) return null;

  return (
    <section className="page-card">
      <div className="section-title">DDS — Diálogo Diário de Segurança</div>
      <div className="detail-grid">
        {blocks.map(block => (
          <div key={block.label}>
            <span className="detail-label">{block.label}</span>
            <span className="detail-value">
              {[block.inicio && block.termino ? `${block.inicio} às ${block.termino}` : block.inicio || block.termino, block.temas.join(', ')]
                .filter(Boolean)
                .join(' — ') || '-'}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
