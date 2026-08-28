import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useEffect } from 'react';
import { z } from 'zod';

import type { MissionInput, PendingMissionProject, PlanningCoordinator, PlanningJobRole, PlanningMission } from '../../../api/efetivoPlanning';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { SearchCombobox } from '../../../components/ui/SearchCombobox';
import { prefillDatesFromProject } from '../../../utils/missionPendencies';
import { selectedMissionCollaboratorIds } from '../../../utils/missionTeam';
import { MissionTeamSelector } from './MissionTeamSelector';

const schema = z.object({
  projectId: z.string().min(1, 'Selecione o projeto.'),
  scheduleStatus: z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED']),
  headquartersResponsibleUserId: z.string().min(1, 'Vincule uma conta de líder.'),
  mobilizationDate: z.string().min(1, 'Informe a mobilização.'),
  executionStartDate: z.string().min(1, 'Informe o início.'),
  executionEndDate: z.string().min(1, 'Informe o fim.'),
  returnDate: z.string(),
  collaboratorIds: z.array(z.string()).max(500, 'Selecione no máximo 500 colaboradores.')
}).refine(value => value.mobilizationDate <= value.executionStartDate && value.executionStartDate <= value.executionEndDate, { path: ['executionEndDate'], message: 'Use a ordem mobilização ≤ início ≤ fim.' })
  .refine(value => !value.returnDate || value.executionEndDate <= value.returnDate, { path: ['returnDate'], message: 'A desmobilização não pode ser anterior ao fim da execução.' })
  .refine(value => value.scheduleStatus !== 'CONFIRMED' || value.collaboratorIds.length > 0, { path: ['collaboratorIds'], message: 'Selecione ao menos um colaborador para confirmar.' });

type FormValues = z.infer<typeof schema>;

function initialValues(mission: PlanningMission | null, project: PendingMissionProject | null, planId?: string): FormValues & { planId?: string } {
  const suggested = project ? prefillDatesFromProject(project) : null;
  return {
    planId,
    projectId: mission?.projectId || project?.id || '',
    scheduleStatus: mission?.scheduleStatus || 'DRAFT',
    headquartersResponsibleUserId: mission?.headquartersResponsibleUserId || '',
    mobilizationDate: mission?.mobilizationDate?.slice(0, 10) || suggested?.mobilizationDate || '',
    executionStartDate: mission?.executionStartDate?.slice(0, 10) || suggested?.executionStartDate || '',
    executionEndDate: mission?.executionEndDate?.slice(0, 10) || suggested?.executionEndDate || '',
    returnDate: mission?.returnDate?.slice(0, 10)
      || mission?.project.demobilizationDate?.slice(0, 10)
      || project?.demobilizationDate?.slice(0, 10)
      || '',
    collaboratorIds: selectedMissionCollaboratorIds(mission)
  };
}

export function MissionFormModal({ open, mission, project, planId, roles, rolesLoading, coordinators, coordinatorsLoading, saving, onClose, onSubmit }: {
  open: boolean;
  mission: PlanningMission | null;
  project: PendingMissionProject | null;
  planId?: string;
  roles: PlanningJobRole[];
  rolesLoading: boolean;
  coordinators: PlanningCoordinator[];
  coordinatorsLoading: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: MissionInput) => void;
}) {
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: initialValues(mission, project, planId) });
  const [teamStartDate, executionEndDate, demobilizationDate] = useWatch({ control, name: ['mobilizationDate', 'executionEndDate', 'returnDate'] });
  useEffect(() => { if (open) reset(initialValues(mission, project, planId)); }, [mission, open, planId, project, reset]);
  const identity = mission?.project || project;
  const leaderAccounts = coordinators.filter(item => item.collaborator?.isActive && item.collaborator.role);
  return (
    <Modal open={open} onClose={onClose} ariaLabelledBy="mission-form-title" panelClassName="modal-card efetivo-detail-modal efetivo-modal">
      <form className="efetivo-modal-layout" noValidate onSubmit={handleSubmit(values => onSubmit({ ...values, returnDate: values.returnDate || null, planId }))}>
        <header className="efetivo-modal-header"><div><h3 id="mission-form-title">{mission ? 'Editar programação' : 'Completar programação da missão'}</h3><p>A missão permanece em Stand by até receber líder, datas, equipe e confirmação.</p></div><button className="icon-button" type="button" aria-label="Fechar" onClick={onClose}>×</button></header>
        <div className="efetivo-modal-body efetivo-form-grid">
          <input type="hidden" {...register('projectId')} />
          <div className="field-group efetivo-form-wide efetivo-mission-identity"><span className="efetivo-eyebrow">Projeto/missão</span><strong>{identity ? `${identity.code} · ${identity.name}` : 'Projeto não identificado'}</strong><span className="field-hint">{identity ? `${identity.clientName || 'Sem cliente'} · ${identity.location || 'Sem local'}` : 'Selecione a missão pela lista de projetos.'}</span>{errors.projectId ? <span className="field-error">{errors.projectId.message}</span> : null}</div>
          <p className="efetivo-form-wide efetivo-form-section-title">Liderança</p>
          <Controller name="headquartersResponsibleUserId" control={control} render={({ field }) => <SearchCombobox id="mission-leader-user" label="Vincular líder" required value={field.value} loading={coordinatorsLoading} disabled={saving} error={errors.headquartersResponsibleUserId?.message} emptyText="Nenhuma conta com colaborador e cargo vinculados." options={leaderAccounts.map(item => ({ value: item.id, label: item.collaborator?.name || item.name, description: `${item.collaborator?.role || ''} · conta ${item.name}` }))} onChange={field.onChange} />} />
          <p className="efetivo-form-wide efetivo-form-section-title">Programação</p>
          <div className="field-group"><label htmlFor="mission-status">Situação da programação *</label><select id="mission-status" disabled={saving} {...register('scheduleStatus')}><option value="DRAFT">Rascunho</option><option value="CONFIRMED">Confirmada</option><option value="CANCELLED">Cancelada</option></select></div>
          {([['mobilizationDate', 'Previsão de mobilização'], ['executionStartDate', 'Início da execução'], ['executionEndDate', 'Fim da execução']] as const).map(([name, label]) => <div className={`field-group ${errors[name] ? 'field-invalid' : ''}`} key={name}><label htmlFor={`mission-${name}`}>{label} *</label><input id={`mission-${name}`} type="date" disabled={saving} aria-invalid={Boolean(errors[name])} {...register(name)} />{errors[name] ? <span className="field-error">{errors[name]?.message}</span> : null}</div>)}
          <div className={`field-group ${errors.returnDate ? 'field-invalid' : ''}`}><label htmlFor="mission-returnDate">Desmobilização</label><input id="mission-returnDate" type="date" disabled={saving} aria-invalid={Boolean(errors.returnDate)} {...register('returnDate')} /><span className="field-hint">Opcional. Informe somente a data em que a desmobilização de fato ocorreu.</span>{errors.returnDate ? <span className="field-error">{errors.returnDate.message}</span> : null}</div>
          <Controller name="collaboratorIds" control={control} render={({ field }) => <MissionTeamSelector mission={mission} planId={planId} roles={roles} selectedIds={field.value} startDate={teamStartDate || ''} endDate={demobilizationDate || executionEndDate || ''} loading={rolesLoading} disabled={saving} error={errors.collaboratorIds?.message} onChange={field.onChange} />} />
        </div>
        <footer className="efetivo-modal-footer"><Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar programação'}</Button></footer>
      </form>
    </Modal>
  );
}
