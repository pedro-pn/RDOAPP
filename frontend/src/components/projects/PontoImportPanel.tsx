import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  deletePontoImport,
  getPontoColaboradores,
  getPontoImports,
  getPontoLinkCollaborators,
  getPontoMaisExternalEmployees,
  getPontoMaisIntegrationStatus,
  getPontoMaisPending,
  getPontoMaisReconciliationProjects,
  getPontoMaisSyncRuns,
  getPontoPendencyCounts,
  linkPontoMaisExternalEmployee,
  linkPontoMaisProjectTag,
  linkPontoName,
  pontoMaisBootstrapStatusLabel,
  pontoMaisSyncTriggerLabel,
  setPontoMaisDayProjectOverride,
  setPontoMaisDayProjectOverridesBatch,
  setPontoMaisExternalEmployeeIgnored,
  type PontoImportRow,
  type PontoMaisPending
} from '../../api/acompanhamentoPonto';
import { useAuth } from '../../auth/AuthContext';
import { useUrlParamState } from '../../hooks/useUrlParamState';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useToast } from '../ui/ToastContext';
import { acompanhamentoRefreshQueryOptions } from './acompanhamentoRefresh';
import { PontoMaisSyncNovelty } from './PontoMaisSyncNovelty';
import { UnallocatedDaysPanel } from './UnallocatedDaysPanel';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime())
    ? fmtDate(iso)
    : parsed.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function collaboratorOptionLabel(collaborator: { name: string; role: string | null; isActive?: boolean }) {
  const label = `${collaborator.name}${collaborator.role ? ` — ${collaborator.role}` : ''}`;
  return collaborator.isActive === false ? `${label} (inativo)` : label;
}

function importSourceLabel(item: PontoImportRow) {
  return item.source === 'PONTOMAIS_API' ? 'API Ponto Mais' : 'Planilha XLSX';
}

type PontoDetailTab = 'sync' | 'unallocated' | 'missing-projects' | 'employees';

function parsePontoDetailTab(value: string | null): PontoDetailTab {
  if (value === 'missing-projects') return 'missing-projects';
  if (value === 'unallocated') return 'unallocated';
  return value === 'employees' ? 'employees' : 'sync';
}

export function PontoImportPanel() {
  const queryClient = useQueryClient();
  const showToast = useToast();
  const { user } = useAuth();
  const isManager = user?.accountType === 'ADMIN' || Boolean(user?.moduleRoles?.includes('acompanhamento:manager'));
  const [detailTab, setDetailTab] = useUrlParamState<PontoDetailTab>({
    param: 'pontoDetalhe',
    defaultValue: 'sync',
    parse: parsePontoDetailTab
  });
  const [links, setLinks] = useState<Record<string, string>>({});
  const [externalEmployeeLinks, setExternalEmployeeLinks] = useState<Record<string, string>>({});
  const [projectTagLinks, setProjectTagLinks] = useState<Record<string, string>>({});
  const [dayProjectOverrides, setDayProjectOverrides] = useState<Record<string, string[]>>({});
  const [deleteTarget, setDeleteTarget] = useState<PontoImportRow | null>(null);

  const { data: imports } = useQuery({
    queryKey: ['ponto-imports'],
    queryFn: getPontoImports,
    ...acompanhamentoRefreshQueryOptions
  });
  const { data: integrationStatus } = useQuery({
    queryKey: ['ponto-integration-status'],
    queryFn: getPontoMaisIntegrationStatus,
    ...acompanhamentoRefreshQueryOptions
  });
  const { data: colaboradores } = useQuery({
    queryKey: ['ponto-colaboradores'],
    queryFn: getPontoColaboradores,
    ...acompanhamentoRefreshQueryOptions
  });
  const { data: linkCollaborators } = useQuery({
    queryKey: ['ponto-collaborators-link'],
    queryFn: getPontoLinkCollaborators,
    enabled: isManager
  });
  const { data: pending } = useQuery({
    queryKey: ['ponto-pontomais-pending'],
    queryFn: getPontoMaisPending,
    enabled: isManager && integrationStatus?.configured === true
  });
  const { data: syncRuns } = useQuery({
    queryKey: ['ponto-pontomais-sync-runs'],
    queryFn: () => getPontoMaisSyncRuns(20),
    enabled: isManager && integrationStatus?.configured === true,
    ...acompanhamentoRefreshQueryOptions
  });
  const { data: projects } = useQuery({
    queryKey: ['ponto-projects-link'],
    queryFn: getPontoMaisReconciliationProjects,
    enabled: isManager && integrationStatus?.configured === true
  });
  const { data: pendencyCounts } = useQuery({
    queryKey: ['ponto-pendencias-contagem'],
    queryFn: getPontoPendencyCounts,
    enabled: isManager && integrationStatus?.configured === true,
    ...acompanhamentoRefreshQueryOptions
  });
  const { data: externalEmployees } = useQuery({
    queryKey: ['ponto-external-employees'],
    queryFn: getPontoMaisExternalEmployees,
    enabled: isManager && integrationStatus?.configured === true,
    ...acompanhamentoRefreshQueryOptions
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['ponto-imports'] });
    queryClient.invalidateQueries({ queryKey: ['ponto-integration-status'] });
    queryClient.invalidateQueries({ queryKey: ['ponto-colaboradores'] });
    queryClient.invalidateQueries({ queryKey: ['ponto-pontomais-pending'] });
    queryClient.invalidateQueries({ queryKey: ['ponto-pontomais-sync-runs'] });
    queryClient.invalidateQueries({ queryKey: ['ponto-external-employees'] });
    queryClient.invalidateQueries({ queryKey: ['project-cards'] });
  };

  const linkMutation = useMutation({
    mutationFn: (payload: { normalizedName: string; collaboratorId: string }) => linkPontoName(payload),
    onSuccess: () => { showToast('Nome vinculado.'); invalidate(); },
    onError: () => showToast('Não foi possível vincular o nome.')
  });
  const externalEmployeeLinkMutation = useMutation({
    mutationFn: linkPontoMaisExternalEmployee,
    onSuccess: result => {
      queryClient.setQueryData<PontoMaisPending>(['ponto-pontomais-pending'], current => (
        current
          ? {
              ...current,
              employees: current.employees.filter(item => item.externalEmployeeId !== result.externalEmployeeId)
            }
          : current
      ));
      setExternalEmployeeLinks(previous => {
        const next = { ...previous };
        delete next[result.externalEmployeeId];
        return next;
      });
      showToast(`Colaborador vinculado em ${result.relinked} resumo(s) de jornada.`);
      invalidate();
    },
    onError: () => showToast('Não foi possível vincular o colaborador do Ponto Mais.')
  });
  const projectTagLinkMutation = useMutation({
    mutationFn: linkPontoMaisProjectTag,
    onSuccess: () => {
      showToast('Etiqueta vinculada ao projeto.');
      invalidate();
    },
    onError: () => showToast('Não foi possível vincular a etiqueta ao projeto.')
  });
  const dayProjectOverrideMutation = useMutation({
    mutationFn: setPontoMaisDayProjectOverride,
    onSuccess: () => {
      showToast('Projeto do dia confirmado. O custo foi recalculado.');
      invalidate();
    },
    onError: () => showToast('Não foi possível confirmar o projeto deste dia.')
  });
  const dayProjectOverridesBatchMutation = useMutation({
    mutationFn: setPontoMaisDayProjectOverridesBatch,
    onSuccess: result => {
      showToast(`Projetos confirmados em ${result.updated} pendência(s). O custo foi recalculado.`);
      invalidate();
    },
    onError: () => showToast('Não foi possível aplicar a seleção às pendências equivalentes.')
  });
  const ignoreExternalEmployeeMutation = useMutation({
    mutationFn: setPontoMaisExternalEmployeeIgnored,
    onSuccess: employee => {
      showToast(employee.ignored
        ? 'Colaborador ignorado na jornada e no cálculo de custo.'
        : 'Colaborador voltou a ser considerado na jornada e no cálculo de custo.');
      invalidate();
    },
    onError: () => showToast('Não foi possível atualizar o colaborador do Ponto Mais.')
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePontoImport(id),
    onSuccess: () => { setDeleteTarget(null); showToast('Importação excluída.'); invalidate(); },
    onError: () => showToast('Não foi possível excluir a importação.')
  });

  const unmatched = colaboradores?.unmatched ?? [];
  const integrationConfigured = integrationStatus?.configured === true;
  const actionablePendingCount = pending
    ? pending.employees.length + pending.ambiguousDays.length
    : 0;
  const missingProjectsCount = pending
    ? pending.missingProjects.projectTags.length + pending.missingProjects.ambiguousDays.length
    : 0;

  return (
    <>
      <div className="page-card" data-pontomais-panel>
        <div className="sec">Ponto (jornada)</div>
        <p className="placeholder-copy ponto-panel-copy">
          {integrationConfigured
            ? 'A jornada é sincronizada automaticamente pelo backend. A primeira carga percorre continuamente todo o histórico até hoje e, depois, os 31 dias anteriores são atualizados diariamente para incorporar correções.'
            : 'A integração automática com o VR Ponto Mais ainda não está configurada neste ambiente. Configure PONTOMAIS_API_TOKEN no backend para iniciar a carga histórica; não é necessário enviar planilhas.'}
        </p>

        {integrationConfigured && isManager ? (
          <div className="acp-seg ponto-detail-tabs" role="tablist" aria-label="Detalhes da integração do Ponto Mais">
            <button
              type="button"
              role="tab"
              aria-selected={detailTab === 'sync'}
              className={`acp-seg-btn${detailTab === 'sync' ? ' active' : ''}`}
              onClick={() => setDetailTab('sync')}
            >
              Sincronização e pendências
              <span className="acp-seg-count">{actionablePendingCount}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={detailTab === 'unallocated'}
              className={`acp-seg-btn${detailTab === 'unallocated' ? ' active' : ''}`}
              onClick={() => setDetailTab('unallocated')}
              data-pontomais-unallocated-tab
            >
              Dias sem alocação
              <span className="acp-seg-count">{pendencyCounts?.unallocatedDays ?? 0}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={detailTab === 'missing-projects'}
              className={`acp-seg-btn${detailTab === 'missing-projects' ? ' active' : ''}`}
              onClick={() => setDetailTab('missing-projects')}
              data-pontomais-missing-projects-tab
            >
              Projetos não encontrados
              <span className="acp-seg-count">{missingProjectsCount}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={detailTab === 'employees'}
              className={`acp-seg-btn${detailTab === 'employees' ? ' active' : ''}`}
              onClick={() => setDetailTab('employees')}
              data-pontomais-employees-tab
            >
              Colaboradores encontrados
              <span className="acp-seg-count">{externalEmployees?.length ?? 0}</span>
            </button>
          </div>
        ) : null}

        {!integrationConfigured || !isManager || detailTab === 'sync' ? (
          <>

        {integrationConfigured && integrationStatus?.automation ? (
          <div className="ponto-sync-status" data-pontomais-automation-status>
            <strong>
              {pontoMaisBootstrapStatusLabel(
                integrationStatus.automation.bootstrapStatus,
                integrationStatus.running
              )}
            </strong>
            <span>
              Cobertura: {fmtDate(integrationStatus.automation.historyStart)} a {fmtDate(integrationStatus.automation.historyThrough)}
              {integrationStatus.automation.nextPeriodStart
                ? integrationStatus.automation.bootstrapStatus === 'FAILED'
                  ? ` · retomada automática a partir de ${fmtDate(integrationStatus.automation.nextPeriodStart)}`
                  : ` · processamento contínuo a partir de ${fmtDate(integrationStatus.automation.nextPeriodStart)}`
                : ''}
            </span>
            <span>
              Atualização diária às {integrationStatus.automation.scheduledTime} ({integrationStatus.automation.timeZone})
              {integrationStatus.automation.lastDailySyncDate
                ? ` · dados revisados até ${fmtDate(integrationStatus.automation.lastDailySyncDate)}`
                : ''}
            </span>
            {integrationStatus.automation.lastSuccessfulAt ? (
              <span>Último lote concluído em {fmtDateTime(integrationStatus.automation.lastSuccessfulAt)}</span>
            ) : null}
            {integrationStatus.automation.lastErrorMessage ? (
              <span className="field-error">{integrationStatus.automation.lastErrorMessage} A rotina tentará novamente.</span>
            ) : null}
          </div>
        ) : null}

        {integrationStatus?.lastSuccessfulRun ? (
          <p className="placeholder-copy ponto-section-copy">
            Última sincronização: {fmtDate(integrationStatus.lastSuccessfulRun.completedAt)} · período {fmtDate(integrationStatus.lastSuccessfulRun.periodStart)} a {fmtDate(integrationStatus.lastSuccessfulRun.periodEnd)}
            {integrationStatus.lastSuccessfulRun.pendingCount ? ` · ${integrationStatus.lastSuccessfulRun.pendingCount} pendência(s)` : ' · sem pendências'}
          </p>
        ) : null}

        {integrationConfigured && isManager && pending ? (
          <div className="det-section ponto-pending-section">
            <div className="sec ponto-subtitle">
              Pendências da integração ({actionablePendingCount})
            </div>
            <div
              className="ponto-local-scroll"
              role="region"
              aria-label="Lista de pendências da integração"
              tabIndex={0}
            >

            {pending.employees.map(item => {
              const fieldId = `pontomais-employee-${encodeURIComponent(item.externalEmployeeId)}`;
              return (
                <div key={item.externalEmployeeId} className="field-row ponto-link-row">
                  <div className="ponto-link-copy">
                    <strong>{item.externalName}</strong>
                    <span>{item.registrationNumber ? `Matrícula ${item.registrationNumber}` : 'Sem matrícula conciliada'}</span>
                  </div>
                  <div className="field-group ponto-link-field">
                    <label htmlFor={fieldId}>Vincular ao colaborador</label>
                    <select
                      id={fieldId}
                      value={externalEmployeeLinks[item.externalEmployeeId] ?? ''}
                      onChange={event => setExternalEmployeeLinks(previous => ({
                        ...previous,
                        [item.externalEmployeeId]: event.target.value
                      }))}
                    >
                      <option value="">Selecione o colaborador…</option>
                      {(linkCollaborators ?? []).map(collaborator => (
                        <option key={collaborator.id} value={collaborator.id}>{collaboratorOptionLabel(collaborator)}</option>
                      ))}
                    </select>
                  </div>
                  <Button
                    variant="mini"
                    disabled={!externalEmployeeLinks[item.externalEmployeeId] || externalEmployeeLinkMutation.isPending}
                    onClick={() => externalEmployeeLinkMutation.mutate({
                      externalEmployeeId: item.externalEmployeeId,
                      collaboratorId: externalEmployeeLinks[item.externalEmployeeId]
                    })}
                  >
                    Vincular
                  </Button>
                </div>
              );
            })}

            {pending.ambiguousDays.map(item => {
              const pendingKey = `${item.externalEmployeeId}:${item.date}`;
              const fieldId = `pontomais-day-${encodeURIComponent(pendingKey)}`;
              const candidateProjects = (projects ?? []).filter(project => item.projectCodes.includes(project.code));
              const selectedProjectIds = dayProjectOverrides[pendingKey] ?? [];
              const candidateSignature = [...item.projectCodes].sort().join('|');
              const equivalentItems = pending.ambiguousDays.filter(candidate => (
                [...candidate.projectCodes].sort().join('|') === candidateSignature
              ));
              const conflictCopy = item.reason === 'TAG_RDO_CONFLICT'
                ? `Ponto Mais: ${item.tagProjectCodes.join(', ') || 'sem projeto'} · RDO: ${item.rdoProjectCodes.join(', ') || 'sem projeto'}`
                : `Projetos candidatos: ${item.projectCodes.join(', ') || 'não identificados'}`;
              return (
                <div key={pendingKey} className="field-row ponto-link-row ponto-day-allocation-row">
                  <div className="ponto-link-copy">
                    <strong>{item.externalName} · {fmtDate(item.date)}</strong>
                    <span>{conflictCopy}. As horas permanecem em sede até a confirmação.</span>
                  </div>
                  <div className="field-group ponto-link-field" id={fieldId}>
                    <span className="field-label">Projetos trabalhados neste dia</span>
                    <div className="ponto-project-checks" role="group" aria-labelledby={`${fieldId}-label`}>
                      <span id={`${fieldId}-label`} className="sr-only">Selecione um ou mais projetos trabalhados</span>
                      {candidateProjects.map(project => {
                        const checked = selectedProjectIds.includes(project.id);
                        return (
                          <label key={project.id} className="ponto-project-check">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setDayProjectOverrides(previous => ({
                                ...previous,
                                [pendingKey]: checked
                                  ? selectedProjectIds.filter(id => id !== project.id)
                                  : [...selectedProjectIds, project.id]
                              }))}
                            />
                            <span>
                              {project.code} — {project.name}
                              {project.historical ? ' (histórico)' : project.isActive ? '' : ' (inativo)'}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="ponto-pending-actions">
                    <Button
                      variant="mini"
                      disabled={!selectedProjectIds.length || dayProjectOverrideMutation.isPending || dayProjectOverridesBatchMutation.isPending}
                      onClick={() => dayProjectOverrideMutation.mutate({
                        externalEmployeeId: item.externalEmployeeId,
                        date: item.date,
                        projectIds: selectedProjectIds
                      })}
                    >
                      Confirmar neste dia
                    </Button>
                    {equivalentItems.length > 1 ? (
                      <Button
                        variant="mini"
                        disabled={!selectedProjectIds.length || dayProjectOverrideMutation.isPending || dayProjectOverridesBatchMutation.isPending}
                        onClick={() => dayProjectOverridesBatchMutation.mutate({
                          items: equivalentItems.map(candidate => ({
                            externalEmployeeId: candidate.externalEmployeeId,
                            date: candidate.date,
                            projectIds: selectedProjectIds
                          }))
                        })}
                      >
                        Aplicar aos {equivalentItems.length} casos iguais
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {!pending.employees.length && !pending.ambiguousDays.length ? (
              <p className="placeholder-copy ponto-section-copy">Nenhuma pendência na última sincronização.</p>
            ) : null}
            </div>
          </div>
        ) : null}

        {unmatched.length ? (
          <div className="det-section ponto-pending-section">
            <div className="sec ponto-subtitle">Nomes não vinculados ({unmatched.length})</div>
            <p className="placeholder-copy ponto-section-copy">
              Estes nomes do ponto não casaram com nenhum colaborador. Vincule para que o custo entre no cálculo.
            </p>
            <div
              className="ponto-local-scroll"
              role="region"
              aria-label="Lista de nomes não vinculados"
              tabIndex={0}
            >
            {unmatched.map(item => (
              <div key={item.normalizedName} className="field-row ponto-link-row">
                <span>{item.rawName}</span>
                {isManager ? (
                  <>
                    <label className="sr-only" htmlFor={`ponto-link-${item.normalizedName}`}>Colaborador para {item.rawName}</label>
                    <select
                      id={`ponto-link-${item.normalizedName}`}
                      value={links[item.normalizedName] ?? ''}
                      onChange={event => setLinks(previous => ({ ...previous, [item.normalizedName]: event.target.value }))}
                    >
                      <option value="">Selecione o colaborador…</option>
                      {(linkCollaborators ?? []).map(collaborator => (
                        <option key={collaborator.id} value={collaborator.id}>{collaboratorOptionLabel(collaborator)}</option>
                      ))}
                    </select>
                    <Button
                      variant="mini"
                      disabled={!links[item.normalizedName] || linkMutation.isPending}
                      onClick={() => linkMutation.mutate({ normalizedName: item.normalizedName, collaboratorId: links[item.normalizedName] })}
                    >
                      Vincular
                    </Button>
                  </>
                ) : <span className="placeholder-copy">(gestor pode vincular)</span>}
              </div>
            ))}
            </div>
          </div>
        ) : null}

        {integrationConfigured && isManager && syncRuns?.length ? (
          <>
            <div id="ponto-sync-history-title" className="sec ponto-history-title">Histórico de sincronizações</div>
            <div
              className="acp-table-wrap ponto-history-table"
              role="region"
              aria-labelledby="ponto-sync-history-title"
              tabIndex={0}
            >
              <table className="acp-table">
                <thead>
                  <tr><th>Status</th><th>Origem</th><th>Período</th><th>Registros</th><th>Vínculos</th><th>Concluída</th></tr>
                </thead>
                <tbody>
                  {syncRuns.map(run => (
                    <tr key={run.id}>
                      <td data-label="Status"><strong>{run.status === 'SUCCEEDED' ? 'Concluída' : run.status === 'FAILED' ? 'Falhou' : 'Em andamento'}</strong>{run.errorMessage ? <span className="ponto-history-file">{run.errorMessage}</span> : null}</td>
                      <td data-label="Origem">{pontoMaisSyncTriggerLabel(run.trigger)}</td>
                      <td data-label="Período">{fmtDate(run.periodStart)} – {fmtDate(run.periodEnd)}</td>
                      <td data-label="Registros">{run.workDaysRead} jornadas · {run.timeCardsRead} batidas</td>
                      <td data-label="Vínculos">{run.collaboratorsMatched} vinculados · {run.pendingCount} pendência(s)</td>
                      <td data-label="Concluída">{fmtDateTime(run.completedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        <div id="ponto-current-data-history-title" className="sec ponto-history-title">Histórico de dados vigentes</div>
        {imports?.length ? (
          <div
            className="acp-table-wrap ponto-history-table"
            role="region"
            aria-labelledby="ponto-current-data-history-title"
            tabIndex={0}
          >
            <table className="acp-table">
              <thead>
                <tr><th>Origem</th><th>Período</th><th>Colab.</th><th>Linhas</th><th>Atualizado</th>{isManager ? <th /> : null}</tr>
              </thead>
              <tbody>
                {imports.map(item => {
                  const canDelete = isManager && item.source !== 'PONTOMAIS_API';
                  return (
                    <tr key={item.id}>
                      <td data-label="Origem"><strong>{importSourceLabel(item)}</strong><span className="ponto-history-file">{item.fileName}</span></td>
                      <td data-label="Período">{fmtDate(item.periodStart)} – {fmtDate(item.periodEnd)}</td>
                      <td data-label="Colab.">{item.collaboratorsMatched}/{item.collaboratorsTotal}</td>
                      <td data-label="Linhas">{item.rowsRead}</td>
                      <td data-label="Atualizado">{fmtDate(item.createdAt)}</td>
                      {isManager ? (
                        <td data-label="Ações" className="ponto-history-actions">
                          {canDelete ? <Button variant="danger" onClick={() => setDeleteTarget(item)}>Excluir</Button> : null}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="placeholder-copy">Nenhuma atualização ainda.</p>}
          </>
        ) : null}

        {detailTab === 'unallocated' && integrationConfigured && isManager ? (
          <UnallocatedDaysPanel projects={projects ?? []} enabled={isManager && integrationConfigured} />
        ) : null}

        {detailTab === 'missing-projects' && integrationConfigured && isManager && pending ? (
          <section className="det-section ponto-employee-section" aria-labelledby="ponto-missing-projects-title">
            <div id="ponto-missing-projects-title" className="sec ponto-subtitle">
              Projetos não encontrados ({missingProjectsCount})
            </div>
            <p className="placeholder-copy ponto-section-copy">
              Estes códigos e etiquetas vieram do Ponto Mais, mas não existem no cadastro do app. Eles podem ser de missões antigas e ficam separados das pendências operacionais. Vincule somente quando houver um projeto correspondente.
            </p>
            <div
              className="ponto-local-scroll"
              role="region"
              aria-labelledby="ponto-missing-projects-title"
              tabIndex={0}
            >
              {pending.missingProjects.projectTags.map(item => {
                const fieldId = `pontomais-missing-tag-${encodeURIComponent(item.normalizedTag)}`;
                return (
                  <div key={item.normalizedTag} className="field-row ponto-link-row">
                    <div className="ponto-link-copy">
                      <strong>{item.rawTag}</strong>
                      <span>Etiqueta de projeto não reconhecida</span>
                    </div>
                    <div className="field-group ponto-link-field">
                      <label htmlFor={fieldId}>Vincular ao projeto</label>
                      <select
                        id={fieldId}
                        value={projectTagLinks[item.normalizedTag] ?? ''}
                        onChange={event => setProjectTagLinks(previous => ({
                          ...previous,
                          [item.normalizedTag]: event.target.value
                        }))}
                      >
                        <option value="">Selecione o projeto…</option>
                        {(projects ?? []).map(project => (
                          <option key={project.id} value={project.id}>
                            {project.code} — {project.name}
                            {project.historical ? ' (histórico)' : project.isActive ? '' : ' (inativo)'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      variant="mini"
                      disabled={!projectTagLinks[item.normalizedTag] || projectTagLinkMutation.isPending}
                      onClick={() => projectTagLinkMutation.mutate({
                        rawTag: item.rawTag,
                        projectId: projectTagLinks[item.normalizedTag]
                      })}
                    >
                      Vincular
                    </Button>
                  </div>
                );
              })}

              {pending.missingProjects.ambiguousDays.map(item => {
                const pendingKey = `${item.externalEmployeeId}:${item.date}`;
                return (
                  <div key={pendingKey} className="field-row ponto-link-row ponto-missing-project-day-row">
                    <div className="ponto-link-copy">
                      <strong>{item.externalName} · {fmtDate(item.date)}</strong>
                      <span>
                        Projetos candidatos sem cadastro: {item.projectCodes.join(', ')}. As horas permanecem em sede enquanto nenhum desses projetos existir no app.
                      </span>
                    </div>
                  </div>
                );
              })}

              {!missingProjectsCount ? (
                <p className="placeholder-copy ponto-section-copy">Nenhum projeto não encontrado.</p>
              ) : null}
            </div>
          </section>
        ) : null}

        {detailTab === 'employees' && integrationConfigured && isManager ? (
          <section className="det-section ponto-employee-section" aria-labelledby="ponto-employees-title">
            <div id="ponto-employees-title" className="sec ponto-subtitle">
              Colaboradores encontrados ({externalEmployees?.length ?? 0})
            </div>
            <p className="placeholder-copy ponto-section-copy">
              Ignore pessoas fora da operação. A preferência é reversível e também retira seus dados históricos do cálculo vigente.
            </p>
            <div
              className="ponto-local-scroll ponto-employee-directory"
              role="region"
              aria-labelledby="ponto-employees-title"
              tabIndex={0}
            >
              {(externalEmployees ?? []).map(employee => (
                <div
                  key={employee.externalEmployeeId}
                  className={`ponto-employee-row${employee.ignored ? ' is-ignored' : ''}`}
                >
                  <div className="ponto-link-copy">
                    <strong>{employee.externalName}</strong>
                    <span>
                      {employee.registrationNumber ? `Matrícula ${employee.registrationNumber}` : 'Sem matrícula'}
                      {' · '}
                      {employee.isActive === true ? 'Ativo no Ponto Mais' : employee.isActive === false ? 'Inativo no Ponto Mais' : 'Situação não informada'}
                      {employee.ignored ? ' · ignorado no acompanhamento' : ''}
                    </span>
                  </div>
                  <Button
                    variant={employee.ignored ? 'secondary' : 'mini'}
                    disabled={ignoreExternalEmployeeMutation.isPending}
                    onClick={() => ignoreExternalEmployeeMutation.mutate({
                      externalEmployeeId: employee.externalEmployeeId,
                      ignored: !employee.ignored
                    })}
                  >
                    {employee.ignored ? 'Voltar a considerar' : 'Ignorar'}
                  </Button>
                </div>
              ))}
              {!externalEmployees?.length ? (
                <p className="placeholder-copy">Nenhum colaborador foi encontrado ainda.</p>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir importação de contingência?"
        description="Os dados de ponto desse envio manual serão removidos. Sincronizações da API não podem ser excluídas por esta tela."
        highlight={deleteTarget?.fileName}
        confirmLabel={deleteMutation.isPending ? 'Excluindo…' : 'Excluir importação'}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
      />
      <PontoMaisSyncNovelty
        user={user}
        enabled={isManager && integrationConfigured}
      />
    </>
  );
}
