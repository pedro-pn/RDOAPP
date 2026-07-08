import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getPontoColaboradores, type CollaboratorRate, type IdleBucket } from '../../api/acompanhamentoPonto';
import { brl } from './costFields';

const MESES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}
function fmtMonth(month: string): string {
  const [y, m] = month.split('-');
  const idx = Number(m) - 1;
  return idx >= 0 && idx < 12 ? `${MESES_PT[idx]}/${y}` : month;
}
function fmtHoras(value: number) {
  return `${value.toFixed(0)}h`;
}

interface RateView {
  normalHoras: number;
  he70Horas: number;
  he100Horas: number;
  totalMensal: number | null;
  custoHora: number | null;
  idle: { sede: IdleBucket; folga: IdleBucket };
  hasCostProfile: boolean;
}

// Dados do colaborador para o mês selecionado (ou o somado, se 'todos'). null = sem dados no mês.
function viewFor(r: CollaboratorRate, month: string): RateView | null {
  if (month === 'todos') {
    return { normalHoras: r.normalHoras, he70Horas: r.he70Horas, he100Horas: r.he100Horas, totalMensal: r.totalMensal, custoHora: r.custoHora, idle: r.idle, hasCostProfile: r.hasCostProfile };
  }
  const m = r.months.find(x => x.month === month);
  if (!m) return null;
  return { normalHoras: m.normalHoras, he70Horas: m.he70Horas, he100Horas: m.he100Horas, totalMensal: m.totalMensal, custoHora: m.custoHora, idle: m.idle, hasCostProfile: true };
}

export function LaborRateTable() {
  const { data, isLoading } = useQuery({ queryKey: ['ponto-colaboradores'], queryFn: getPontoColaboradores });
  const [month, setMonth] = useState('todos');

  const rates = useMemo(() => [...(data?.rates ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [data]);
  const months = useMemo(() => [...new Set(rates.flatMap(r => r.months.map(m => m.month)))].sort(), [rates]);

  if (isLoading) return <div className="page-card placeholder-copy">Carregando custo/hora…</div>;
  if (!data?.importId) {
    return <div className="page-card placeholder-copy">Nenhum ponto importado ainda. Envie a planilha na aba Ponto.</div>;
  }

  const rows = rates.map(r => ({ r, view: viewFor(r, month) })).filter(x => x.view !== null) as Array<{ r: CollaboratorRate; view: RateView }>;
  const idleTotal = rows.reduce((sum, { view }) => sum + view.idle.sede.cost + view.idle.folga.cost, 0);
  const custoCell = (bucket: IdleBucket | undefined) =>
    bucket ? `${brl(bucket.cost)}${bucket.hours ? ` · ${fmtHoras(bucket.hours)}` : ''}` : '—';

  return (
    <div className="page-card">
      <div className="sec">Custo por colaborador</div>
      <p className="placeholder-copy" style={{ margin: '4px 0 12px' }}>
        Período do ponto vigente: <strong>{fmtDate(data.periodStart)} – {fmtDate(data.periodEnd)}</strong>.
        A folha é calculada <strong>por mês</strong> (o salário mensal sai 1× por mês; mês parcial tem o
        fixo proporcional aos dias cobertos). Use o filtro para ver um mês específico ou o total.
        <strong> Custo/hora = folha ÷ (horas do ponto + folga)</strong>. A sobra é quebrada em
        <strong> Sede</strong> (ponto batido, sem obra) e <strong>Folga</strong> (dia de semana sem ponto).
      </p>

      <div className="field-group" style={{ maxWidth: 220, marginBottom: 12 }}>
        <label htmlFor="rate-month">Mês</label>
        <select id="rate-month" value={month} onChange={e => setMonth(e.target.value)}>
          <option value="todos">Todos (somado)</option>
          {months.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
        </select>
      </div>

      <div className="acp-table-wrap">
        <table className="acp-table">
          <thead>
            <tr>
              <th>Colaborador</th><th>Cargo</th><th>Normais</th><th>HE 70%</th><th>HE 100%</th>
              <th>Custo mensal</th><th>Sede</th><th>Folga</th><th>Custo/hora</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ r, view }) => (
              <tr key={r.collaboratorId}>
                <td>{r.name}</td>
                <td>{r.role ?? '—'}</td>
                <td>{fmtHoras(view.normalHoras)}</td>
                <td>{fmtHoras(view.he70Horas)}</td>
                <td>{fmtHoras(view.he100Horas)}</td>
                <td>{view.hasCostProfile ? brl(view.totalMensal) : <span className="placeholder-copy">cargo sem custo</span>}</td>
                <td>{view.hasCostProfile ? custoCell(view.idle.sede) : '—'}</td>
                <td>{view.hasCostProfile ? custoCell(view.idle.folga) : '—'}</td>
                <td>{view.hasCostProfile ? <strong>{brl(view.custoHora)}</strong> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {idleTotal > 0 ? (
        <p className="placeholder-copy" style={{ marginTop: 10 }}>
          Ociosidade {month === 'todos' ? 'total no período' : `em ${fmtMonth(month)}`}: <strong>{brl(idleTotal)}</strong> (tempo pago não alocado a obras).
        </p>
      ) : null}
    </div>
  );
}
