import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';

const schema = z.object({ name: z.string().trim().min(1, 'Informe o nome do cenário.').max(120), objective: z.string().max(1000) });
type Values = z.infer<typeof schema>;

export function ScenarioFormModal({ open, saving, onClose, onSubmit }: { open: boolean; saving: boolean; onClose: () => void; onSubmit: (payload: { name: string; objective?: string | null }) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', objective: '' } });
  return <Modal open={open} onClose={onClose} ariaLabelledBy="scenario-form-title" panelClassName="modal-card efetivo-modal"><form className="efetivo-modal-layout" noValidate onSubmit={handleSubmit(values => onSubmit({ name: values.name.trim(), objective: values.objective.trim() || null }))}><header className="efetivo-modal-header"><div><h3 id="scenario-form-title">Novo cenário</h3><p>Uma cópia isolada do planejamento oficial será criada.</p></div><button className="icon-button" type="button" aria-label="Fechar" onClick={onClose}>×</button></header><div className="efetivo-modal-body efetivo-form-grid"><div className={`field-group efetivo-form-wide ${errors.name ? 'field-invalid' : ''}`}><label htmlFor="scenario-name">Nome *</label><input id="scenario-name" aria-invalid={Boolean(errors.name)} disabled={saving} {...register('name')} />{errors.name ? <span className="field-error">{errors.name.message}</span> : null}</div><div className={`field-group efetivo-form-wide ${errors.objective ? 'field-invalid' : ''}`}><label htmlFor="scenario-objective">Objetivo</label><textarea id="scenario-objective" rows={5} aria-invalid={Boolean(errors.objective)} disabled={saving} {...register('objective')} />{errors.objective ? <span className="field-error">{errors.objective.message}</span> : null}</div></div><footer className="efetivo-modal-footer"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? 'Criando…' : 'Criar cenário'}</Button></footer></form></Modal>;
}
