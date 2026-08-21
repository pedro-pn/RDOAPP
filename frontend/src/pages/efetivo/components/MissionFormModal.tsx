import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { z } from 'zod';

import type { MissionInput, PlanningCollaborator, PlanningJobRole, PlanningMission, ProjectOption } from '../../../api/efetivoPlanning';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { SearchCombobox } from '../../../components/ui/SearchCombobox';

const schema = z.object({
  projectId: z.string().min(1, 'Selecione o projeto.'),
  scheduleStatus: z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED']),
  stage: z.enum(['STANDBY', 'MOBILIZATION', 'EXECUTION', 'FINAL_MEASUREMENT', 'FINISHED']),
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

function initialValues(mission: PlanningMission | null, roles: PlanningJobRole[], planId?: string): FormValues & { planId?: string } {
  const demands = Object.fromEntries(roles.map(role => [role.id, mission?.demands.find(item => item.jobRoleId === role.id)?.requiredCount || 0]));
  return {
    planId,
    projectId: mission?.projectId || '',
    scheduleStatus: mission?.scheduleStatus || 'DRAFT',
    stage: mission?.stage || 'STANDBY',
    headquartersResponsibleName: mission?.headquartersResponsibleName || '',
    headquartersResponsibleRole: mission?.headquartersResponsibleRole || '',
    headquartersResponsibleCollaboratorId: mission?.headquartersResponsibleCollaboratorId || '',
    mobilizationDate: mission?.mobilizationDate?.slice(0, 10) || '',
    executionStartDate: mission?.executionStartDate?.slice(0, 10) || '',
    executionEndDate: mission?.executionEndDate?.slice(0, 10) || '',
    returnDate: mission?.returnDate?.slice(0, 10) || '',
    demands
  };
}

export function MissionFormModal({ open, mission, planId, projects, roles, collaborators, saving, onClose, onSubmit }: {
  open: boolean;
  mission: PlanningMission | null;
  planId?: string;
  projects: ProjectOption[];
  roles: PlanningJobRole[];
  collaborators: PlanningCollaborator[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: MissionInput) => void;
}) {
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: initialValues(mission, roles, planId) });
  useEffect(() => { if (open) reset(initialValues(mission, roles, planId)); }, [mission, open, planId, reset, roles]);
  return (
    <Modal open={open} onClose={onClose} ariaLabelledBy="mission-form-title" panelClassName="modal-card efetivo-detail-modal efetivo-modal">
      <form className="efetivo-modal-layout" noValidate onSubmit={handleSubmit(values => onSubmit({ ...values, planId, headquartersResponsibleCollaboratorId: values.headquartersResponsibleCollaboratorId || null, demands: Object.entries(values.demands).filter(([, requiredCount]) => requiredCount > 0).map(([jobRoleId, requiredCount]) => ({ jobRoleId, requiredCount })) }))}>
        <header className="efetivo-modal-header"><div><h3 id="mission-form-title">{mission ? 'Editar programação' : 'Nova programação de missão'}</h3><p>Cliente e local vêm do projeto canônico; aqui ficam equipe, etapas e datas operacionais.</p></div><button className="icon-button" type="button" aria-label="Fechar" onClick={onClose}>×</button></header>
        <div className="efetivo-modal-body efetivo-form-grid">
          <Controller name="projectId" control={control} render={({ field }) => <SearchCombobox id="mission-project" label="Projeto/missão" required value={field.value} onChange={field.onChange} disabled={Boolean(mission) || saving} error={errors.projectId?.message} options={projects.map(project => ({ value: project.id, label: `${project.code} · ${project.name}`, description: `${project.clientName || 'Sem cliente'} · ${project.location || 'Sem local'}` }))} />} />
          <div className="field-group"><label htmlFor="mission-status">Situação *</label><select id="mission-status" disabled={saving} {...register('scheduleStatus')}><option value="DRAFT">Rascunho</option><option value="CONFIRMED">Confirmada</option><option value="CANCELLED">Cancelada</option></select></div>
          <div className="field-group"><label htmlFor="mission-stage">Etapa *</label><select id="mission-stage" disabled={saving} {...register('stage')}><option value="STANDBY">Stand by</option><option value="MOBILIZATION">Mobilização</option><option value="EXECUTION">Execução</option><option value="FINAL_MEASUREMENT">Medição final</option><option value="FINISHED">Finalizada</option></select></div>
          <div className={`field-group ${errors.headquartersResponsibleName ? 'field-invalid' : ''}`}><label htmlFor="mission-responsible-name">Responsável da sede *</label><input id="mission-responsible-name" disabled={saving} aria-invalid={Boolean(errors.headquartersResponsibleName)} {...register('headquartersResponsibleName')} />{errors.headquartersResponsibleName ? <span className="field-error">{errors.headquartersResponsibleName.message}</span> : null}</div>
          <div className={`field-group ${errors.headquartersResponsibleRole ? 'field-invalid' : ''}`}><label htmlFor="mission-responsible-role">Cargo do responsável *</label><input id="mission-responsible-role" disabled={saving} aria-invalid={Boolean(errors.headquartersResponsibleRole)} {...register('headquartersResponsibleRole')} />{errors.headquartersResponsibleRole ? <span className="field-error">{errors.headquartersResponsibleRole.message}</span> : null}</div>
          <div className="field-group"><label htmlFor="mission-responsible-link">Vincular ao colaborador</label><select id="mission-responsible-link" disabled={saving} {...register('headquartersResponsibleCollaboratorId')}><option value="">Sem vínculo</option>{collaborators.map(item => <option value={item.id} key={item.id}>{item.name} · {item.role}</option>)}</select></div>
          {([['mobilizationDate', 'Mobilização'], ['executionStartDate', 'Início da execução'], ['executionEndDate', 'Fim da execução'], ['returnDate', 'Retorno']] as const).map(([name, label]) => <div className={`field-group ${errors[name] ? 'field-invalid' : ''}`} key={name}><label htmlFor={`mission-${name}`}>{label} *</label><input id={`mission-${name}`} type="date" disabled={saving} aria-invalid={Boolean(errors[name])} {...register(name)} />{errors[name] ? <span className="field-error">{errors[name]?.message}</span> : null}</div>)}
          <fieldset className={`efetivo-demand-fieldset efetivo-form-wide ${errors.demands ? 'field-invalid' : ''}`}><legend>Demanda por função</legend><div className="efetivo-demand-grid">{roles.filter(role => role.isOperational).map(role => <div className="field-group" key={role.id}><label htmlFor={`demand-${role.id}`}>{role.name}</label><input id={`demand-${role.id}`} type="number" min="0" disabled={saving} {...register(`demands.${role.id}`, { valueAsNumber: true })} /></div>)}</div>{typeof errors.demands?.message === 'string' ? <span className="field-error" role="alert">{errors.demands.message}</span> : null}</fieldset>
        </div>
        <footer className="efetivo-modal-footer"><Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar programação'}</Button></footer>
      </form>
    </Modal>
  );
}
