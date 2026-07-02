import { useQuery } from '@tanstack/react-query';

import {
  getPlannedScope,
  getProjectDetail,
  type DayStatus,
  type PlannedScope
} from '../../api/acompanhamentoComercial';
import { HelpTip } from '../ui/HelpTip';

const SERVICE_LABELS: Record<string, string> = {
  LIMPEZA_QUIMICA: 'Limpeza química',
  TESTE_PRESSAO: 'Teste de pressão',
  FLUSHING: 'Flushing',
  FILTRAGEM: 'Filtragem'
};
const SYSTEM_LABELS: Record<string, string> = { TUBULACAO: 'Tubulações', OLEO: 'Óleo' };
const UNIT_LABELS: Record<string, string> = { M: 'm', KG: 'kg', T: 't', UN: 'un', L: 'L' };
const DAY_META: Record<DayStatus, { cls: string; label: string }> = {
  TRABALHADO: { cls: 'green', label: 'Trabalhado' },
  STANDBY: { cls: 'yellow', label: 'Trabalhado com standby' },
  PARADO: { cls: 'red', label: 'Parado (jornada cheia)' }
};

const brl = (n?: number | null) =>
  n === null || n === undefined ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (n?: number | null) =>
  n === null || n === undefined ? '—' : `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}
function fmtHM(minutes?: number | null) {
  if (!minutes || minutes <= 0) return '0h';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

function Bar({ value, tone }: { value: number | null; tone?: 'cost' }) {
  const clamped = Math.min(Math.max(value ?? 0, 0), 100);
  return (
    <div className={`acp-prog-bar big ${tone === 'cost' && (value ?? 0) > 100 ? 'over' : ''}`}>
      <span style={{ width: `${clamped}%` }} />
    </div>
  );
}

function MetricBar({ label, value, caption, tone, help }: { label: string; value: number | null; caption: string; tone?: 'cost'; help: string }) {
  return (
    <div className="acp-det-metric">
      <div className="acp-det-metric-top">
        <HelpTip help={help}>{label}</HelpTip>
        <span className="acp-det-metric-val">{caption}</span>
      </div>
      <Bar value={value} tone={tone} />
    </div>
  );
}

function PlannedScopeView({ scope }: { scope?: PlannedScope }) {
  if (!scope || scope.services.length === 0) {
    return <div className="placeholder-copy">Nenhum escopo cadastrado.</div>;
  }
  return (
    <div className="acp-det-scope">
      {scope.services.map((svc, i) => (
        <div className="acp-det-scope-svc" key={i}>
          <div className="acp-det-scope-head">
            <span>{SERVICE_LABELS[svc.serviceType] ?? svc.serviceType}</span>
            <span className="acp-det-scope-weight">peso {Number(svc.weight ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>
          </div>
          <ul>
            {svc.systems.map((sys, j) => (
              <li key={j}>
                {SYSTEM_LABELS[sys.systemType] ?? sys.systemType}: {sys.quantity ?? '—'} {sys.unit ? UNIT_LABELS[sys.unit] ?? '' : ''}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// Dashboard detalhado de um projeto (aberto ao clicar num card da aba Projetos).
export function ProjectDetailDashboard({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['project-detail', projectId], queryFn: () => getProjectDetail(projectId) });
  const { data: scope } = useQuery({ queryKey: ['planned-scope', projectId], queryFn: () => getPlannedScope(projectId) });

  if (isLoading || !data) {
    return (
      <div className="acp-det">
        <button type="button" className="mini-btn alt" onClick={onBack}>← Voltar</button>
        <div className="page-card placeholder-copy" style={{ marginTop: 12 }}>Carregando projeto…</div>
      </div>
    );
  }

  const h = data.header;
  const headerBits = [
    `Missão ${h.code}`,
    h.clientName,
    h.proposalCode ? `Proposta ${h.proposalCode}` : null,
    `Última atualização ${fmtDate(h.lastRdoDate)}`,
    h.segment
  ].filter(Boolean);

  return (
    <div className="acp-det">
      <div className="acp-det-bar">
        <button type="button" className="mini-btn alt" onClick={onBack}>← Voltar</button>
      </div>

      <div className="page-card acp-det-header">
        <h2>{headerBits.join('  ·  ')}</h2>
        {data.alerts.length > 0 ? (
          <div className="acp-alerts">
            {data.alerts.map((a, i) => <span key={i} className={`acp-alert ${a.level}`}>⚠ {a.label}</span>)}
          </div>
        ) : null}
      </div>

      <div className="acp-det-cols">
        {/* Coluna 1 */}
        <div className="acp-det-col">
          <div className="page-card acp-det-block">
            <MetricBar
              label="Dias corridos"
              help="Dias de calendário desde o início da obra até hoje, sobre os dias corridos previstos no comercial."
              value={data.diasCorridos.pct}
              caption={`${data.diasCorridos.elapsed ?? '—'}/${data.diasCorridos.planned ?? '—'}${data.diasCorridos.pct != null ? ` · ${data.diasCorridos.pct}%` : ''}`}
            />
            <MetricBar
              label="Dias trabalhados"
              help="Dias com RDO registrado, sobre os dias trabalhados previstos no comercial."
              value={data.diasTrabalhados.pct}
              caption={`${data.diasTrabalhados.worked}/${data.diasTrabalhados.planned ?? '—'}${data.diasTrabalhados.pct != null ? ` · ${data.diasTrabalhados.pct}%` : ''}`}
            />
          </div>

          <div className="page-card acp-det-block">
            <MetricBar
              label="Consumo de gastos"
              help="Total gasto no Omie (pago + a pagar, sem salários) sobre o custo previsto no comercial. A mão de obra será calculada à parte na integração do ponto."
              value={data.consumo.pct}
              tone="cost"
              caption={`${brl(data.consumo.gasto)} / ${brl(data.consumo.previsto)}${data.consumo.pct != null ? ` · ${data.consumo.pct}%` : ''}`}
            />
            <div className="acp-det-sub"><HelpTip help="As 5 categorias de despesa do Omie com maior valor neste projeto (salários excluídos).">Maiores gastos (sem salários)</HelpTip></div>
            {data.maioresGastos.length === 0 ? (
              <div className="placeholder-copy">Sem gastos registrados no Omie.</div>
            ) : (
              <ul className="acp-det-rank">
                {data.maioresGastos.map((g, i) => (
                  <li key={i}><span className="acp-det-rank-cat">{g.categoria}</span><span className="acp-det-rank-val">{brl(g.total)}</span></li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Coluna 2 */}
        <div className="acp-det-col">
          <div className="page-card acp-det-block">
            <div className="acp-det-avanco">
              <div className="acp-det-metric-top">
                <HelpTip help="Quanto do escopo vendido já foi executado: cruza o realizado dos RDOs (metros de tubulação, litros de óleo) com o previsto, ponderado pelo peso de cada serviço. Sem escopo cadastrado, usa o avanço manual informado no cronograma.">Avanço do escopo{data.avancoMethod === 'MANUAL' ? ' (manual)' : ''}</HelpTip>
                <span className="acp-det-metric-val">{fmtPct(data.avancoPct)}</span>
              </div>
              <Bar value={data.avancoPct} />
            </div>

            <div className="acp-det-two">
              <div><span className="acp-det-kpi-label"><HelpTip help="Número de dias com parada (standby) registrada nos RDOs.">Standby</HelpTip></span><strong>{data.standby.count}</strong><span className="acp-det-kpi-sub">dia(s)</span></div>
              <div><span className="acp-det-kpi-label"><HelpTip help="Soma das horas de standby de todos os RDOs do projeto.">Hora total parada</HelpTip></span><strong>{fmtHM(data.standby.minutes)}</strong></div>
            </div>

            <div className="acp-det-sub"><HelpTip help="Status dos últimos 5 dias com RDO: verde = trabalhado, amarelo = trabalhado com standby, vermelho = totalmente parado (standby cobrindo a jornada). Passe o mouse para ver as horas.">Últimos dias</HelpTip></div>
            <div className="acp-det-dots">
              {data.ultimosDias.length === 0 ? (
                <span className="placeholder-copy">Sem RDOs.</span>
              ) : data.ultimosDias.map((d, i) => (
                <div className="acp-det-dot-wrap" key={i} tabIndex={0} aria-label={`${fmtDate(d.date)}: ${DAY_META[d.status].label}`}>
                  <span className={`acp-det-dot ${DAY_META[d.status].cls}`} />
                  <div className="acp-det-tip" role="tooltip">
                    <div className="acp-det-tip-date">{fmtDate(d.date)}</div>
                    <div className="acp-det-tip-status">
                      <span className={`acp-det-tip-dot ${DAY_META[d.status].cls}`} />{DAY_META[d.status].label}
                    </div>
                    <div className="acp-det-tip-row"><span>Trabalhado</span><strong>{fmtHM(d.workedMinutes)}</strong></div>
                    <div className="acp-det-tip-row"><span>Standby</span><strong>{fmtHM(d.standbyMinutes)}</strong></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="acp-det-two" style={{ marginTop: 10 }}>
              <div><span className="acp-det-kpi-label"><HelpTip help="Total de horas extras identificadas nos RDOs do projeto.">Horas extras</HelpTip></span><strong>{fmtHM(data.overtimeMinutes)}</strong></div>
            </div>
          </div>
        </div>

        {/* Coluna 3 */}
        <div className="acp-det-col">
          <div className="page-card acp-det-block">
            <div className="acp-det-sub"><HelpTip help="Pessoas distintas que aparecem em qualquer RDO do projeto (cada colaborador conta uma vez), com o cargo.">Colaboradores na obra ({data.colaboradores.length})</HelpTip></div>
            {data.colaboradores.length === 0 ? (
              <div className="placeholder-copy">Nenhum colaborador nos RDOs.</div>
            ) : (
              <ul className="acp-det-collabs">
                {data.colaboradores.map((c, i) => (
                  <li key={i}><span>{c.name}</span><span className="acp-det-collab-role">{c.role}</span></li>
                ))}
              </ul>
            )}
          </div>

          <div className="page-card acp-det-block">
            <div className="acp-det-sub"><HelpTip help="Escopo vendido informado manualmente (aba Cronograma): serviços, sistemas e quantitativos, com o peso de cada serviço no avanço.">Escopo cadastrado</HelpTip></div>
            <PlannedScopeView scope={scope} />
          </div>
        </div>
      </div>

      <div className="page-card acp-det-footer">
        <div><span><HelpTip help="Data de mobilização, cadastrada manualmente no cronograma.">Mobilização</HelpTip></span><strong>{fmtDate(data.footer.mobilizationDate)}</strong></div>
        <div><span><HelpTip help="Data de início real, cadastrada manualmente no cronograma.">Início</HelpTip></span><strong>{fmtDate(data.footer.startDate)}</strong></div>
        <div><span><HelpTip help="Início + dias corridos previstos no comercial.">Previsão de término</HelpTip></span><strong>{fmtDate(data.footer.expectedEndDate)}</strong></div>
        <div><span><HelpTip help="Estimativa realista: projeta o término pela velocidade atual (avanço acumulado por dia corrido desde o início).">Previsão pelo ritmo</HelpTip></span><strong>{fmtDate(data.footer.projectedEndByPace)}</strong></div>
      </div>
    </div>
  );
}
