import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  getAllocationAudit,
  getPontoLinkCollaborators,
  getPontoMaisReconciliationProjects,
  type AllocationAuditCollaborator,
  type AllocationDay
} from '../../api/acompanhamentoPonto';
import { useUrlParamState } from '../../hooks/useUrlParamState';
import { Button } from '../ui/Button';
import { allocationReasonLabel, fmtHours } from './allocationReasons';

type AuditMode = 'collaborator' | 'project';

function parseAuditMode(value: string | null): AuditMode {
  return value === 'project' ? 'project' : 'collaborator';
}

function fmtFullDate(dateKey: string): string {
  const [y, m, d] = dateKey.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : dateKey;
}

function projectList(refs: Array<{ code: string | null; projectId: string }>): string {
  return refs.map(ref => ref.code ?? ref.projectId).join(', ');
}

function allocationList(day: AllocationDay): string {
  if (!day.allocations.length) return '—';
  return day.allocations
    .map(item => (day.allocations.length > 1
      ? `${item.code ?? item.projectId} (${Math.round(item.weight * 100)}%)`
      : `${item.code ?? item.projectId}`))
    .join(' + ');
}

function toCsv(collaborators: AllocationAuditCollaborator[]): string {
  const header = [
    'Colaborador', 'Cargo', 'Data', 'Normais', 'HE70', 'HE100',
    'Etiquetas', 'Etiqueta->Projeto', 'RDO do dia', 'Seleção manual', 'Alocado', 'Motivo'
  ];
  const rows = collaborators.flatMap(collaborator => collaborator.days.map(day => [
    collaborator.name,
    collaborator.role ?? '',
    day.date,
    day.normalHours.toFixed(2),
    day.he70Hours.toFixed(2),
    day.he100Hours.toFixed(2),
    day.tags.join(' | '),
    projectList(day.tagProjects),
    day.rdoProjects.map(item => `${item.code ?? item.projectId}:${item.hours.toFixed(1)}h`).join(' '),
    projectList(day.manualProjects),
    allocationList(day),
    allocationReasonLabel(day.reason)
  ]));
  return [header, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    .join('\n');
}

function downloadCsv(content: string, fileName: string) {
  // BOM para o Excel abrir o CSV em UTF-8.
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AllocationAuditPanel() {
  const [mode, setMode] = useUrlParamState<AuditMode>({
    param: 'auditoria',
    defaultValue: 'collaborator',
    parse: parseAuditMode
  });
  const [collaboratorId, setCollaboratorId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [onlyUnallocated, setOnlyUnallocated] = useState(false);

  const { data: collaborators } = useQuery({
    queryKey: ['ponto-collaborators-link'],
    queryFn: getPontoLinkCollaborators
  });
  const { data: projects } = useQuery({
    queryKey: ['ponto-projects-link'],
    queryFn: getPontoMaisReconciliationProjects
  });

  const byProject = mode === 'project';
  const ready = byProject ? Boolean(projectId) : Boolean(collaboratorId);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['ponto-auditoria-alocacao', mode, collaboratorId, projectId, de, ate, onlyUnallocated],
    queryFn: () => getAllocationAudit({
      collaboratorId: byProject ? undefined : collaboratorId,
      projectId: byProject ? projectId : undefined,
      de: de || undefined,
      ate: ate || undefined,
      somenteNaoAlocados: onlyUnallocated
    }),
    enabled: ready
  });

  const rows = useMemo(() => data?.collaborators ?? [], [data]);
  const totals = useMemo(() => {
    const hours = rows.reduce((sum, item) => sum + item.totals.hours, 0);
    const unallocated = rows.reduce((sum, item) => sum + item.totals.unallocatedHours, 0);
    const days = rows.reduce((sum, item) => sum + item.days.length, 0);
    return { hours, unallocated, days };
  }, [rows]);

  return (
    <div className="page-card" data-acp-auditoria>
      <div className="sec">Auditoria da alocação do ponto</div>
      <p className="placeholder-copy ponto-panel-copy">
        Mostra, dia a dia, para onde foram as horas de cada colaborador e por qual motivo. É a mesma
        decisão que gera o custo de mão de obra dos cards de projeto.
      </p>

      <div className="acp-seg" role="tablist" aria-label="Visão da auditoria">
        <button
          type="button"
          role="tab"
          aria-selected={!byProject}
          className={`acp-seg-btn${!byProject ? ' active' : ''}`}
          onClick={() => setMode('collaborator')}
        >
          Por colaborador
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={byProject}
          className={`acp-seg-btn${byProject ? ' active' : ''}`}
          onClick={() => setMode('project')}
        >
          Por projeto
        </button>
      </div>

      <div className="field-row ponto-filter-row">
        {byProject ? (
          <div className="field">
            <label htmlFor="audit-project">Missão</label>
            <select id="audit-project" value={projectId} onChange={event => setProjectId(event.target.value)}>
              <option value="">Selecione a missão…</option>
              {(projects ?? []).map(project => (
                <option key={project.id} value={project.id}>{project.code} — {project.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="field">
            <label htmlFor="audit-collaborator">Colaborador</label>
            <select
              id="audit-collaborator"
              value={collaboratorId}
              onChange={event => setCollaboratorId(event.target.value)}
            >
              <option value="">Selecione o colaborador…</option>
              {(collaborators ?? []).map(collaborator => (
                <option key={collaborator.id} value={collaborator.id}>
                  {collaborator.name}{collaborator.role ? ` — ${collaborator.role}` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="audit-de">De</label>
          <input id="audit-de" type="date" value={de} onChange={event => setDe(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="audit-ate">Até</label>
          <input id="audit-ate" type="date" value={ate} onChange={event => setAte(event.target.value)} />
        </div>
        <label className="field-check" htmlFor="audit-only-unallocated">
          <input
            id="audit-only-unallocated"
            type="checkbox"
            checked={onlyUnallocated}
            onChange={event => setOnlyUnallocated(event.target.checked)}
          />
          Só dias não alocados
        </label>
        <Button
          variant="mini"
          disabled={!rows.length}
          onClick={() => downloadCsv(toCsv(rows), `auditoria-ponto-${byProject ? 'projeto' : 'colaborador'}.csv`)}
        >
          Exportar CSV
        </Button>
      </div>

      {!ready ? (
        <p className="placeholder-copy">
          {byProject ? 'Selecione uma missão para auditar.' : 'Selecione um colaborador para auditar.'}
        </p>
      ) : null}
      {ready && (isLoading || isFetching) ? <p className="placeholder-copy">Carregando…</p> : null}
      {ready && !isLoading && !rows.length ? (
        <p className="placeholder-copy">Nenhum dia de ponto no período selecionado.</p>
      ) : null}

      {rows.length ? (
        <div className="ponto-audit-summary">
          <span><strong>{totals.days}</strong> dia(s)</span>
          <span><strong>{fmtHours(totals.hours)}</strong> no ponto</span>
          <span><strong>{fmtHours(totals.unallocated)}</strong> sem alocação</span>
        </div>
      ) : null}

      {rows.map(collaborator => (
        <div key={collaborator.collaboratorId} className="det-section">
          <div className="sec ponto-subtitle">
            {collaborator.name}{collaborator.role ? ` · ${collaborator.role}` : ''}
          </div>
          <div className="ponto-audit-summary">
            {collaborator.totals.byProject.map(project => (
              <span key={project.projectId}>
                {project.code ?? project.projectId}: <strong>{fmtHours(project.normalHours)}</strong>
                {project.he70Hours + project.he100Hours > 0
                  ? ` (+${fmtHours(project.he70Hours + project.he100Hours)} HE)`
                  : ''}
              </span>
            ))}
            {collaborator.totals.unallocatedHours > 0 ? (
              <span>Sem alocação: <strong>{fmtHours(collaborator.totals.unallocatedHours)}</strong></span>
            ) : null}
          </div>
          <div className="ponto-audit-scroll">
            <table className="ponto-audit-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Normais</th>
                  <th>HE70</th>
                  <th>HE100</th>
                  <th>Etiquetas do Ponto Mais</th>
                  <th>RDO do dia</th>
                  <th>Manual</th>
                  <th>Alocado</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {collaborator.days.map(day => {
                  const isTarget = byProject && day.allocations.some(item => item.projectId === projectId);
                  const classes = [
                    !day.allocated ? 'ponto-audit-row-unallocated' : '',
                    isTarget ? 'ponto-audit-row-target' : ''
                  ].filter(Boolean).join(' ');
                  return (
                    <tr key={day.date} className={classes || undefined}>
                      <td>{fmtFullDate(day.date)}</td>
                      <td className="ponto-audit-num">{day.normalHours.toFixed(2)}</td>
                      <td className="ponto-audit-num">{day.he70Hours.toFixed(2)}</td>
                      <td className="ponto-audit-num">{day.he100Hours.toFixed(2)}</td>
                      <td>{day.tags.length ? day.tags.join(' | ') : '—'}</td>
                      <td>
                        {day.rdoProjects.length
                          ? day.rdoProjects.map(item => `${item.code ?? item.projectId} (${item.hours.toFixed(1)}h)`).join(', ')
                          : '—'}
                      </td>
                      <td>{day.manualProjects.length ? projectList(day.manualProjects) : '—'}</td>
                      <td>{allocationList(day)}</td>
                      <td>{allocationReasonLabel(day.reason)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
