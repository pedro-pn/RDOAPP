import { useMemo, useState } from 'react';

import type { PlanningCollaborator, PlanningJobRole } from '../../../api/efetivoPlanning';
import { filterMissionTeamCollaborators, toggleMissionCollaborator } from '../../../utils/missionTeam';

type TeamCollaborator = Pick<PlanningCollaborator, 'id' | 'name' | 'role' | 'jobRoleId' | 'isActive'>;

export function MissionTeamSelector({
  collaborators,
  roles,
  selectedIds,
  loading,
  disabled,
  error,
  onChange
}: {
  collaborators: TeamCollaborator[];
  roles: PlanningJobRole[];
  selectedIds: string[];
  loading: boolean;
  disabled: boolean;
  error?: string;
  onChange: (value: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const operationalRoleIds = useMemo(() => new Set(roles.filter(role => role.isOperational).map(role => role.id)), [roles]);
  const options = useMemo(() => collaborators
    .filter(collaborator => collaborator.isActive || selected.has(collaborator.id))
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')), [collaborators, selected]);
  const filtered = useMemo(() => filterMissionTeamCollaborators(options, search), [options, search]);
  const selectedPeople = options.filter(collaborator => selected.has(collaborator.id));
  const roleSummary = [...selectedPeople.reduce((summary, collaborator) => {
    const label = collaborator.role || 'Cargo não informado';
    summary.set(label, (summary.get(label) || 0) + 1);
    return summary;
  }, new Map<string, number>())].sort(([left], [right]) => left.localeCompare(right, 'pt-BR'));

  return (
    <fieldset className={`efetivo-team-fieldset efetivo-form-wide ${error ? 'field-invalid' : ''}`}>
      <legend>Selecionar colaboradores</legend>
      <div className="efetivo-team-toolbar">
        <div>
          <strong>{selectedIds.length} {selectedIds.length === 1 ? 'colaborador selecionado' : 'colaboradores selecionados'}</strong>
          <span>As quantidades por cargo serão calculadas automaticamente.</span>
        </div>
        <label className="efetivo-team-search" htmlFor="mission-team-search">
          <span>Buscar por nome ou cargo</span>
          <input id="mission-team-search" type="search" value={search} disabled={disabled || loading} placeholder="Ex.: mantenedor ou nome" onChange={event => setSearch(event.target.value)} />
        </label>
      </div>
      {roleSummary.length ? <div className="efetivo-team-summary" aria-label="Resumo da equipe por cargo">{roleSummary.map(([role, count]) => <span key={role}>{role} <strong>{count}</strong></span>)}</div> : null}
      <div className="efetivo-team-list" aria-busy={loading}>
        {loading ? <p className="placeholder-copy">Carregando colaboradores…</p>
          : filtered.length ? filtered.map(collaborator => {
            const isSelected = selected.has(collaborator.id);
            const hasOperationalRole = Boolean(collaborator.jobRoleId && operationalRoleIds.has(collaborator.jobRoleId));
            const selectable = collaborator.isActive && hasOperationalRole;
            return (
              <label className={`efetivo-team-option ${isSelected ? 'selected' : ''} ${!selectable ? 'unavailable' : ''}`} key={collaborator.id}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={disabled || (!selectable && !isSelected)}
                  onChange={event => onChange(toggleMissionCollaborator(selectedIds, collaborator.id, event.target.checked))}
                />
                <span><strong>{collaborator.name}</strong><small>{collaborator.role || 'Cargo não informado'}</small></span>
                {!selectable ? <em>{collaborator.isActive ? 'Sem função operacional vinculada' : 'Colaborador inativo'}</em> : null}
              </label>
            );
          }) : <p className="placeholder-copy">Nenhum colaborador encontrado para esta busca.</p>}
      </div>
      {error ? <span className="field-error" role="alert">{error}</span> : null}
    </fieldset>
  );
}
