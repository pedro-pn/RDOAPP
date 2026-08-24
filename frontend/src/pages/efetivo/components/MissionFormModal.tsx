import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { z } from 'zod';

import type { MissionInput, PendingMissionProject, PlanningCollaborator, PlanningCoordinator, PlanningJobRole, PlanningMission } from '../../../api/efetivoPlanning';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { SearchCombobox } from '../../../components/ui/SearchCombobox';
import { prefillDatesFromProject } from '../../../utils/missionPendencies';

const schema = z.object({
  projectId: z.string().min(1, 'Selecione o projeto.'),
  scheduleStatus: z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED']),
  stage: z.enum(['STANDBY', 'MOBILIZATION', 'EXECUTION', 'FINAL_MEASUREMENT', 'FINISHED']),
  headquartersResponsibleUserId: z.string().min(1, 'Selecione uma conta de coordenador.'),
  headquartersResponsibleName: z.string().trim().min(1, 'Informe o responsável.'),
  headquartersResponsibleRole: z.string().trim().min(1, 'Informe o cargo do responsável.'),
  headquartersResponsibleCollaboratorId: z.string(),
  mobilizationDate: z.string().min(1, 'Informe a mobilização.'),
  executionStartDate: z.string().min(1, 'Informe o início.'),
  executionEndDate: z.string().min(1, 'Informe o fim.'),
  returnDate: z.string().min(1, 'Informe o retorno.'),
  demands: z.record(z.string(), z.number().int().min(0).max(1000))
}).refine(value => value.mobilizationDate <= value.executionStartDate && value.executionStartDate <= value.executionEndDate && value.executionEndDate <= value.returnDate, { path: ['returnDate'], message: 'Use a ordem mobilização ≤ início ≤ fim ≤ retorno.' })
  .refine(value => value.scheduleStatus !== 'CONFIRMED' || Object.values(value.demands).some(count => count > 0), { path: ['demands'], message: 'Informe ao menos uma demanda para confirmar.' });

type FormValues = z.infer<typeof schema>;

function initialValues(mission: PlanningMission | null, project: PendingMissionProject | null, roles: PlanningJobRole[], coordinators: PlanningCoordinator[], planId?: string): FormValues & { planId?: string } {
  const demands = Object.fromEntries(roles.map(role => [role.id, mission?.demands.find(item => item.jobRoleId === role.id)?.requiredCount || 0]));
  const coordinator = mission
    ? coordinators.find(item => item.collaborator?.id === mission.headquartersResponsibleCollaboratorId)
      || coordinators.find(item => item.name === mission.headquartersResponsibleName)
    : null;
  const suggested = project ? prefillDatesFromProject(project) : null;
  return {
    planId,
    projectId: mission?.projectId || project?.id || '',
    scheduleStatus: mission?.scheduleStatus || 'DRAFT',
    stage: mission?.stage || 'STANDBY',
    headquartersResponsibleUserId: coordinator?.id || '',
    headquartersResponsibleName: mission?.headquartersResponsibleName || '',
    headquartersResponsibleRole: mission?.headquartersResponsibleRole || '',
    headquartersResponsibleCollaboratorId: mission?.headquartersResponsibleCollaboratorId || '',
    mobilizationDate: mission?.mobilizationDate?.slice(0, 10) || suggested?.mobilizationDate || '',
    executionStartDate: mission?.executionStartDate?.slice(0, 10) || suggested?.executionStartDate || '',
    executionEndDate: mission?.executionEndDate?.slice(0, 10) || suggested?.executionEndDate || '',
    returnDate: mission?.returnDate?.slice(0, 10) || suggested?.returnDate || '',
    demands
  };
}

export function MissionFormModal({ open, mission, project, planId, roles, coordinators, coordinatorsLoading, collaborators, saving, onClose, onSubmit }: {
  open: boolean;
  mission: PlanningMission | null;
  project: PendingMissionProject | null;
  planId?: string;
  roles: PlanningJobRole[];
  coordinators: PlanningCoordinator[];
  coordinatorsLoading: boolean;
  collaborators: PlanningCollaborator[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: MissionInput) => void;
}) {
  const { register, control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: initialValues(mission, project, roles, coordinators, planId) });
  useEffect(() => { if (open) reset(initialValues(mission, project, roles, coordinators, planId)); }, [coordinators, mission, open, planId, project, reset, roles]);
  const identity = mission?.project || project;
  const responsibleUserId = watch('headquartersResponsibleUserId');
  const linkedLeaderId = watch('headquartersResponsibleCollaboratorId');
  const selectedCoordinator = coordinators.find(item => item.id === responsibleUserId);
  const selectedLeader = collaborators.find(item => item.id === linkedLeaderId)
    || (selectedCoordinator?.collaborator?.id === linkedLeaderId ? selectedCoordinator.collaborator : null);
  const leaderOptions = selectedCoordinator?.collaborator && !collaborators.some(item => item.id === selectedCoordinator.collaborator?.id)
    ? [selectedCoordinator.collaborator, ...collaborators]
    : collaborators;
  return (
    <Modal open={open} onClose={onClose} ariaLabelledBy="mission-form-title" panelClassName="modal-card efetivo-detail-modal efetivo-modal">
      <form className="efetivo-modal-layout" noValidate onSubmit={handleSubmit(values => onSubmit({ ...values, planId, headquartersResponsibleCollaboratorId: values.headquartersResponsibleCollaboratorId || null, demands: Object.entries(values.demands).filter(([, requiredCount]) => requiredCount > 0).map(([jobRoleId, requiredCount]) => ({ jobRoleId, requiredCount })) }))}>
        <header className="efetivo-modal-header"><div><h3 id="mission-form-title">{mission ? 'Editar programação' : 'Completar programação da missão'}</h3><p>A missão vem do projeto cadastrado; aqui ficam datas operacionais, responsável, etapa e equipe.</p></div><button className="icon-button" type="button" aria-label="Fechar" onClick={onClose}>×</button></header>
        <div className="efetivo-modal-body efetivo-form-grid">
          <input type="hidden" {...register('projectId')} />
          <div className="field-group efetivo-form-wide efetivo-mission-identity"><span className="efetivo-eyebrow">Projeto/missão</span><strong>{identity ? `${identity.code} · ${identity.name}` : 'Projeto não identificado'}</strong><span className="field-hint">{identity ? `${identity.clientName || 'Sem cliente'} · ${identity.location || 'Sem local'}` : 'Selecione a missão pela lista de projetos.'}</span>{errors.projectId ? <span className="field-error">{errors.projectId.message}</span> : null}</div>
          <input type="hidden" {...register('headquartersResponsibleName')} />
          <p className="efetivo-form-wide efetivo-form-section-title">Responsabilidade da sede</p>
          <Controller name="headquartersResponsibleUserId" control={control} render={({ field }) => <SearchCombobox id="mission-responsible-user" label="Responsável da sede" required value={field.value} loading={coordinatorsLoading} disabled={saving} error={errors.headquartersResponsibleUserId?.message} emptyText="Nenhuma conta de coordenador encontrada." options={coordinators.map(item => ({ value: item.id, label: item.name, description: item.collaborator ? `${item.collaborator.name} · ${item.collaborator.role}` : 'Sem colaborador vinculado' }))} onChange={value => {
            field.onChange(value);
            const coordinator = coordinators.find(item => item.id === value);
            setValue('headquartersResponsibleName', coordinator?.name || '', { shouldValidate: true });
            setValue('headquartersResponsibleCollaboratorId', coordinator?.collaborator?.id || '');
            setValue('headquartersResponsibleRole', coordinator?.collaborator?.role || '', { shouldValidate: Boolean(coordinator?.collaborator) });
          }} />} />
          <div className={`field-group ${errors.headquartersResponsibleRole ? 'field-invalid' : ''}`}><label htmlFor="mission-responsible-role">Cargo do responsável *</label><input id="mission-responsible-role" disabled={saving || Boolean(selectedLeader)} aria-invalid={Boolean(errors.headquartersResponsibleRole)} {...register('headquartersResponsibleRole')} />{errors.headquartersResponsibleRole ? <span className="field-error">{errors.headquartersResponsibleRole.message}</span> : selectedLeader ? <span className="field-hint">Preenchido pelo cargo do líder vinculado.</span> : null}</div>
          <Controller name="headquartersResponsibleCollaboratorId" control={control} render={({ field }) => <div className="field-group"><label htmlFor="mission-responsible-link">Vincular líder</label><select id="mission-responsible-link" value={field.value} disabled={saving || Boolean(selectedCoordinator?.collaborator)} onChange={event => {
            field.onChange(event.target.value);
            const leader = collaborators.find(item => item.id === event.target.value);
            setValue('headquartersResponsibleRole', leader?.role || '', { shouldValidate: Boolean(leader) });
          }}><option value="">Sem vínculo</option>{leaderOptions.map(item => <option value={item.id} key={item.id}>{item.name} · {item.role}</option>)}</select>{selectedCoordinator?.collaborator ? <span className="field-hint">Vínculo definido pela conta do coordenador.</span> : null}</div>} />
          <p className="efetivo-form-wide efetivo-form-section-title">Etapa e programação</p>
          <div className="field-group"><label htmlFor="mission-stage">Etapa *</label><select id="mission-stage" disabled={saving} {...register('stage')}><option value="STANDBY">Stand by</option><option value="MOBILIZATION">Mobilização</option><option value="EXECUTION">Execução</option><option value="FINAL_MEASUREMENT">Medição final</option><option value="FINISHED">Finalizada</option></select></div>
          <div className="field-group"><label htmlFor="mission-status">Situação da programação *</label><select id="mission-status" disabled={saving} {...register('scheduleStatus')}><option value="DRAFT">Rascunho</option><option value="CONFIRMED">Confirmada</option><option value="CANCELLED">Cancelada</option></select></div>
          {([['mobilizationDate', 'Previsão de mobilização'], ['executionStartDate', 'Início da execução'], ['executionEndDate', 'Fim da execução'], ['returnDate', 'Retorno']] as const).map(([name, label]) => <div className={`field-group ${errors[name] ? 'field-invalid' : ''}`} key={name}><label htmlFor={`mission-${name}`}>{label} *</label><input id={`mission-${name}`} type="date" disabled={saving} aria-invalid={Boolean(errors[name])} {...register(name)} />{errors[name] ? <span className="field-error">{errors[name]?.message}</span> : null}</div>)}
          <fieldset className={`efetivo-demand-fieldset efetivo-form-wide ${errors.demands ? 'field-invalid' : ''}`}><legend>Demanda por função</legend><div className="efetivo-demand-grid">{roles.filter(role => role.isOperational).map(role => <div className="field-group" key={role.id}><label htmlFor={`demand-${role.id}`}><i className="efetivo-role-dot" style={{ background: role.calendarColor || 'var(--mu)' }} aria-hidden="true" />{role.name}</label><input id={`demand-${role.id}`} type="number" min="0" disabled={saving} {...register(`demands.${role.id}`, { valueAsNumber: true })} /></div>)}</div>{typeof errors.demands?.message === 'string' ? <span className="field-error" role="alert">{errors.demands.message}</span> : null}</fieldset>
        </div>
        <footer className="efetivo-modal-footer"><Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar programação'}</Button></footer>
      </form>
    </Modal>
  );
}
