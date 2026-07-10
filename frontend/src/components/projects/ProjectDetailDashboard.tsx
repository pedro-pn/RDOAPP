import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  getPlannedScope,
  getProjectDetail,
  type DayStatus,
  type PlannedScope
} from '../../api/acompanhamentoComercial';
import { HelpTip } from '../ui/HelpTip';
import { Modal } from '../ui/Modal';
import { PortalTip } from '../ui/PortalTip';
import { ProjectScheduleEditor, type ScheduleEditorHandle } from './ProjectScheduleEditor';

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
const fmtHours = (n?: number | null) =>
  n === null || n === undefined ? '—' : `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`;
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

function clampPct(value?: number | null, max = 100) {
  return Math.min(Math.max(value ?? 0, 0), max);
}

function Bar({ value, tone }: { value: number | null; tone?: 'cost' }) {
  const clamped = clampPct(value);
  return (
    <div className={`acp-prog-bar big ${tone === 'cost' && (value ?? 0) > 100 ? 'over' : ''}`}>
      <span style={{ width: `${clamped}%` }} />
    </div>
  );
}

function HoursBar({ normalPct, overtimePct }: { normalPct: number | null; overtimePct: number | null }) {
  const normalWidth = clampPct(normalPct);
  const overtimeWidth = clampPct(overtimePct, 100 - normalWidth);
  return (
    <div className="acp-prog-bar big acp-hours-bar">
      {normalWidth > 0 ? <span className="normal" style={{ width: `${normalWidth}%` }} /> : null}
      {overtimeWidth > 0 ? <span className="overtime" style={{ width: `${overtimeWidth}%` }} /> : null}
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

function WorkedHoursMetric({ data }: {
  data: {
    normalWorkedHours: number;
    overtimeWorkedHours: number;
    totalWorkedHours: number;
    plannedTotalHours: number | null;
    normalPct: number | null;
    overtimePct: number | null;
    totalPct: number | null;
    roleCounts?: Array<{ roleName: string; collaboratorCount: number; usedHours: number; pctOfPlannedTotal: number | null }>;
  };
}) {
  const roleCounts = data.roleCounts ?? [];
  return (
    <div className="acp-det-metric">
      <div className="acp-det-metric-top">
        <HelpTip help="Soma das horas trabalhadas dos RDOs, separando horas normais e horas extras, sobre o total previsto no cronograma. As horas previstas já incluem todos os colaboradores.">Horas trabalhadas</HelpTip>
        <span className="acp-det-metric-val">
          {fmtHours(data.totalWorkedHours)} / {fmtHours(data.plannedTotalHours)}
          {data.totalPct != null ? ` · ${data.totalPct}%` : ''}
        </span>
      </div>
      <HoursBar normalPct={data.normalPct} overtimePct={data.overtimePct} />
      <div className="acp-hours-split">
        <span>
          <i className="acp-hours-dot normal" />Normais {fmtHours(data.normalWorkedHours)}
          {data.normalPct != null ? ` · ${data.normalPct}%` : ''}
        </span>
        <span>
          <i className="acp-hours-dot overtime" />HE {fmtHours(data.overtimeWorkedHours)}
          {data.overtimePct != null ? ` · ${data.overtimePct}%` : ''}
        </span>
      </div>
      {roleCounts.length > 0 ? (
        <div className="acp-hours-roles" aria-label="Colaboradores por cargo previsto">
          {roleCounts.map(item => (
            <span key={item.roleName}>
              {item.roleName}: {item.collaboratorCount} colab. · {fmtHours(item.usedHours)}
              {item.pctOfPlannedTotal != null ? ` · ${fmtPct(item.pctOfPlannedTotal)}` : ''}
            </span>
          ))}
        </div>
      ) : null}
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
export function ProjectDetailDashboard({ projectId, canManage = false, onBack }: { projectId: string; canManage?: boolean; onBack: () => void }) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDirty, setScheduleDirty] = useState(false);
  const scheduleRef = useRef<ScheduleEditorHandle>(null);
  const { data, isLoading } = useQuery({ queryKey: ['project-detail', projectId], queryFn: () => getProjectDetail(projectId) });
  const { data: scope } = useQuery({ queryKey: ['planned-scope', projectId], queryFn: () => getPlannedScope(projectId) });

  function closeSchedule() {
    setScheduleOpen(false);
    setScheduleDirty(false);
  }

  if (isLoading || !data) {
    return (
      <div className="acp-det">
        <button type="button" className="mini-btn alt" onClick={onBack}>← Voltar</button>
        <div className="page-card placeholder-copy" style={{ marginTop: 12 }}>Carregando projeto…</div>
      </div>
    );
  }

  const h = data.header;
  const equipamentos = data.equipamentos ?? [];
  const workedHours = data.workedHours ?? {
    normalWorkedHours: 0,
    overtimeWorkedHours: 0,
    totalWorkedHours: 0,
    plannedTotalHours: null,
    normalPct: null,
    overtimePct: null,
    totalPct: null,
    roleCounts: []
  };
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
        {canManage ? (
          <button type="button" className="mini-btn" onClick={() => setScheduleOpen(true)}>
            Editar cronograma
          </button>
        ) : null}
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
              help="Dias de calendário desde o início da obra até a data de referência: hoje para projetos em andamento; último RDO para projetos arquivados."
              value={data.diasCorridos.pct}
              caption={`${data.diasCorridos.elapsed ?? '—'}/${data.diasCorridos.planned ?? '—'}${data.diasCorridos.pct != null ? ` · ${data.diasCorridos.pct}%` : ''}`}
            />
            <MetricBar
              label="Dias trabalhados"
              help="Dias com RDO registrado, sobre os dias trabalhados previstos no comercial."
              value={data.diasTrabalhados.pct}
              caption={`${data.diasTrabalhados.worked}/${data.diasTrabalhados.planned ?? '—'}${data.diasTrabalhados.pct != null ? ` · ${data.diasTrabalhados.pct}%` : ''}`}
            />
            <WorkedHoursMetric data={workedHours} />
          </div>

          <div className="page-card acp-det-block">
            {(() => {
              const mo = data.maoDeObra;
              const moCusto = mo?.custo ?? null;
              const totalRealizado = data.consumo.gasto + (moCusto ?? 0);
              const previsto = data.consumo.previsto;
              const totalPct = previsto && previsto > 0 ? Math.round((totalRealizado / previsto) * 100) : null;
              const omieCost = data.consumo.omie ?? Math.max(0, data.consumo.gasto - (data.consumo.estoque ?? 0));
              const stockCost = data.consumo.estoque ?? 0;
              const rowStyle = { display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 } as const;
              const hasOffshore = moCusto != null && mo.custoBase != null && Math.round(moCusto) !== Math.round(mo.custoBase);
              return (
                <>
                  <MetricBar
                    label="Consumo de gastos"
                    help="Total realizado (compras do Omie sem salários, consumo de químicos/filtros do estoque, + mão de obra do ponto) sobre o custo previsto no comercial."
                    value={totalPct}
                    tone="cost"
                    caption={`${brl(totalRealizado)} / ${brl(previsto)}${totalPct != null ? ` · ${totalPct}%` : ''}`}
                  />
                  <div style={{ margin: '8px 0' }}>
                    <div style={rowStyle}><span className="placeholder-copy">Compras (Omie)</span><span>{brl(omieCost)}</span></div>
                    {stockCost > 0 ? (
                      <div style={rowStyle}><span className="placeholder-copy">Estoque (químicos/filtros)</span><span>{brl(stockCost)}</span></div>
                    ) : null}
                    {moCusto != null ? (
                      <div style={rowStyle}>
                        <HelpTip help="Valor gasto com mão de obra deste projeto, calculado a partir do ponto (custo rateado por colaborador), incluindo o adicional offshore quando houver.">Mão de obra{hasOffshore ? ' c/ offshore' : ''}</HelpTip>
                        <span>{brl(moCusto)}</span>
                      </div>
                    ) : null}
                    {moCusto != null && hasOffshore ? (
                      <div style={rowStyle}><span className="placeholder-copy">Mão de obra sem offshore</span><span>{brl(mo.custoBase)}</span></div>
                    ) : null}
                    <div style={{ ...rowStyle, marginTop: 4, borderTop: '1px solid #eee', paddingTop: 4 }}><strong>Total realizado</strong><strong>{brl(totalRealizado)}</strong></div>
                  </div>
                  <div className="acp-det-sub"><HelpTip help="As 5 maiores categorias de despesa do projeto, somando Omie sem salários e consumo líquido de químicos/filtros do estoque.">Maiores gastos (Omie + estoque)</HelpTip></div>
                  {data.maioresGastos.length === 0 ? (
                    <div className="placeholder-copy">Sem gastos registrados.</div>
                  ) : (
                    <ul className="acp-det-rank">
                      {data.maioresGastos.map((g, i) => (
                        <li key={i}><span className="acp-det-rank-cat">{g.categoria}</span><span className="acp-det-rank-val">{brl(g.total)}</span></li>
                      ))}
                    </ul>
                  )}
                </>
              );
            })()}
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
                <PortalTip
                  key={i}
                  triggerClassName="acp-det-dot-wrap"
                  ariaLabel={`${fmtDate(d.date)}: ${DAY_META[d.status].label}`}
                  content={(
                    <>
                      <div className="acp-det-tip-date">{fmtDate(d.date)}</div>
                      <div className="acp-det-tip-status">
                        <span className={`acp-det-tip-dot ${DAY_META[d.status].cls}`} />{DAY_META[d.status].label}
                      </div>
                      <div className="acp-det-tip-row"><span>Trabalhado</span><strong>{fmtHM(d.workedMinutes)}</strong></div>
                      <div className="acp-det-tip-row"><span>Standby</span><strong>{fmtHM(d.standbyMinutes)}</strong></div>
                    </>
                  )}
                >
                  <span className={`acp-det-dot ${DAY_META[d.status].cls}`} />
                </PortalTip>
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
            <div className="acp-det-sub"><HelpTip help="Escopo vendido informado manualmente (aba Cronograma): serviços, sistemas e quantitativos, com o peso de cada serviço no avanço.">Escopo cadastrado</HelpTip></div>
            <PlannedScopeView scope={scope} />
          </div>
        </div>
      </div>

      <div className="page-card acp-det-block">
        <details className="acp-det-equips-details" open>
          <summary className="acp-det-collabs-summary">
            Equipamentos na obra ({equipamentos.length})
          </summary>
          {equipamentos.length === 0 ? (
            <div className="placeholder-copy" style={{ marginTop: 8 }}>Nenhum equipamento em obra.</div>
          ) : (
            <div className="acp-det-equips-grid" style={{ marginTop: 8 }}>
              {equipamentos.map((e, i) => (
                <div className="acp-det-equip-item" key={`${e.name}-${i}`}>
                  <span>{e.name}</span>
                  <strong>{e.days} dia{e.days === 1 ? '' : 's'}</strong>
                  <small>desde {fmtDate(e.since)}</small>
                </div>
              ))}
            </div>
          )}
        </details>
      </div>

      {/* Colaboradores em largura total, tabela retrátil: nome · cargo · valor gasto (custo/hora). */}
      <div className="page-card acp-det-block">
        <details className="acp-det-collabs-details" open>
          <summary className="acp-det-collabs-summary">
            Colaboradores na obra ({data.colaboradores.length})
          </summary>
          {data.colaboradores.length === 0 ? (
            <div className="placeholder-copy" style={{ marginTop: 8 }}>Nenhum colaborador nos RDOs.</div>
          ) : (
            <div className="acp-table-wrap" style={{ marginTop: 8 }}>
              <table className="acp-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Cargo</th>
                    <th style={{ textAlign: 'right' }}>Custo (HH)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.colaboradores.map((c, i) => (
                    <tr key={i}>
                      <td>{c.name}</td>
                      <td>{c.role}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {c.custo != null ? (
                          <>{brl(c.custo)}<span className="acp-det-collab-rate">{c.custoHora != null ? ` (${brl(c.custoHora)}/h)` : ''}</span></>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
      </div>

      <div className="page-card acp-det-footer">
        <div><span><HelpTip help="Data de mobilização, cadastrada manualmente no cronograma.">Mobilização</HelpTip></span><strong>{fmtDate(data.footer.mobilizationDate)}</strong></div>
        <div><span><HelpTip help="Data de início real, cadastrada manualmente no cronograma.">Início</HelpTip></span><strong>{fmtDate(data.footer.startDate)}</strong></div>
        <div><span><HelpTip help="Início + dias corridos previstos no comercial.">Previsão de término</HelpTip></span><strong>{fmtDate(data.footer.expectedEndDate)}</strong></div>
        <div><span><HelpTip help="Estimativa realista: projeta o término pela velocidade de avanço acumulada até a data de referência dos dias corridos.">Previsão pelo ritmo</HelpTip></span><strong>{fmtDate(data.footer.projectedEndByPace)}</strong></div>
      </div>

      <Modal open={scheduleOpen} onClose={closeSchedule} ariaLabelledBy="acp-detail-schedule-title" panelClassName="modal-card acp-manage-card">
        <div className="acp-manage">
          <div className="acp-manage-head">
            <div className="sec" id="acp-detail-schedule-title">Cronograma — Missão {h.code}</div>
            <button className="mini-btn alt" type="button" onClick={closeSchedule} aria-label="Fechar">✕</button>
          </div>
          <div className="acp-manage-body">
            <ProjectScheduleEditor
              key={projectId}
              ref={scheduleRef}
              projectId={projectId}
              canManage={canManage}
              onDirtyChange={setScheduleDirty}
            />
          </div>
          <div className="acp-manage-foot">
            <button type="button" className="mini-btn alt" onClick={closeSchedule}>Cancelar</button>
            <button type="button" className="mini-btn" disabled={!scheduleDirty} onClick={() => scheduleRef.current?.save()}>Salvar</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
