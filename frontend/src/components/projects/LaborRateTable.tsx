import { useQuery } from '@tanstack/react-query';

import { getPontoColaboradores } from '../../api/acompanhamentoPonto';
import { brl } from './costFields';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function fmtHoras(value: number) {
  return `${value.toFixed(1)}h`;
}

// Custo/hora por colaborador no período vigente do ponto.
export function LaborRateTable() {
  const { data, isLoading } = useQuery({ queryKey: ['ponto-colaboradores'], queryFn: getPontoColaboradores });

  if (isLoading) return <div className="page-card placeholder-copy">Carregando custo/hora…</div>;
  if (!data?.importId) {
    return <div className="page-card placeholder-copy">Nenhum ponto importado ainda. Envie a planilha na aba Ponto.</div>;
  }

  const rates = [...(data.rates ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  return (
    <div className="page-card">
      <div className="sec">Custo/hora por colaborador</div>
      <p className="placeholder-copy" style={{ margin: '4px 0 12px' }}>
        Período do ponto vigente: <strong>{fmtDate(data.periodStart)} – {fmtDate(data.periodEnd)}</strong>.
        custo/hora = custo mensal do cargo ÷ horas reais trabalhadas no período.
      </p>
      <div className="acp-table-wrap">
        <table className="acp-table">
          <thead>
            <tr>
              <th>Colaborador</th><th>Cargo</th><th>Horas</th><th>HE 70/100</th>
              <th>Dias fora</th><th>Dias offshore</th><th>Custo/hora s/ offshore</th><th>Custo/hora c/ offshore</th>
            </tr>
          </thead>
          <tbody>
            {rates.map(r => (
              <tr key={r.collaboratorId}>
                <td>{r.name}</td>
                <td>{r.role ?? '—'}</td>
                <td>{fmtHoras(r.totalHoras)}</td>
                <td>{fmtHoras(r.he70Horas)} / {fmtHoras(r.he100Horas)}</td>
                <td>{r.diasFora}</td>
                <td>{r.offshoreDays}</td>
                <td>{r.hasCostProfile ? brl(r.custoHoraBase) : <span className="placeholder-copy">cargo sem custo</span>}</td>
                <td>{r.hasCostProfile ? <strong>{brl(r.custoHora)}</strong> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
