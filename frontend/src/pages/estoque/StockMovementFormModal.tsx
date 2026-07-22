import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, type Resolver } from 'react-hook-form';
import { z } from 'zod';

import {
  createStockMovement,
  listStockBatches,
  listStockItems,
  type StockItem,
  type StockBatchSummary,
  type StockMovementReason,
  type StockMovementType,
  type StockMovementPayload
} from '../../api/estoque';
import { listProjects } from '../../api/projects';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/ToastContext';
import { makeEstoqueSchemas } from '../../../../shared/schemas/estoque.js';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface MovementFormValues {
  reason: Exclude<StockMovementReason, 'ESTORNO'>;
  movementType: StockMovementType;
  itemId: string;
  batchId: string;
  projectId: string;
  quantity: string;
  date: string;
  nfNumber: string;
  lotNumber: string;
  expiryDate: string;
  supplier: string;
  unitCost: string;
  requestedBy: string;
  notes: string;
}

const estoqueSchemas = makeEstoqueSchemas(z);

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function optionalValue(value: string) {
  const text = String(value || '').trim();
  return text || undefined;
}

function selectedItem(items: StockItem[], itemId: string) {
  return items.find(item => item.id === itemId) || null;
}

function formValuesToPayload(values: MovementFormValues): StockMovementPayload {
  if (values.reason === 'USO_EM_PROJETO' || values.reason === 'DEVOLUCAO_OBRA') {
    return {
      reason: values.reason,
      type: values.reason === 'USO_EM_PROJETO' ? 'SAIDA' : 'ENTRADA',
      itemId: values.itemId,
      batchId: values.batchId,
      projectId: values.projectId,
      quantity: values.quantity,
      date: values.date,
      requestedBy: optionalValue(values.requestedBy),
      notes: optionalValue(values.notes)
    };
  }

  if (values.reason === 'INVENTARIO') {
    return {
      reason: 'INVENTARIO',
      type: values.movementType,
      itemId: values.itemId,
      batchId: values.batchId,
      quantity: values.quantity,
      date: values.date,
      notes: optionalValue(values.notes)
    };
  }

  if (values.reason === 'PERDA' || values.reason === 'DESCARTE_VALIDADE') {
    return {
      reason: values.reason,
      type: 'SAIDA',
      itemId: values.itemId,
      batchId: values.batchId,
      quantity: values.quantity,
      date: values.date,
      notes: optionalValue(values.notes)
    };
  }

  return {
    reason: 'COMPRA',
    type: 'ENTRADA',
    itemId: values.itemId,
    quantity: values.quantity,
    date: values.date,
    nfNumber: values.nfNumber,
    lotNumber: optionalValue(values.lotNumber),
    expiryDate: optionalValue(values.expiryDate),
    supplier: optionalValue(values.supplier),
    unitCost: optionalValue(values.unitCost),
    notes: optionalValue(values.notes)
  };
}

function zodErrorToFormErrors(error: z.ZodError) {
  return error.issues.reduce<Record<string, { type: string; message: string }>>((acc, issue) => {
    const key = String(issue.path[0] || 'form');
    if (!acc[key]) acc[key] = { type: 'manual', message: issue.message };
    return acc;
  }, {});
}

function resolverFor(items: StockItem[]): Resolver<MovementFormValues> {
  return async values => {
    const item = selectedItem(items, values.itemId);
    const result = estoqueSchemas.movement({ itemType: item?.type }).safeParse(formValuesToPayload(values));
    if (result.success) return { values, errors: {} };
    return { values: {}, errors: zodErrorToFormErrors(result.error) };
  };
}

function batchLabel(batch: StockBatchSummary) {
  const lot = batch.lotNumber || 'Avulso';
  const expiry = batch.expiryDate ? ` · val. ${new Date(batch.expiryDate).toLocaleDateString('pt-BR')}` : '';
  return `${lot}${expiry} · saldo ${batch.balance}`;
}

function movementUnitLabel(item: StockItem | null) {
  return item?.unitLabel || '';
}

export function StockMovementFormModal({ open, onClose }: Props) {
  const showToast = useToast();
  const queryClient = useQueryClient();
  const [expiredConfirmPayload, setExpiredConfirmPayload] = useState<StockMovementPayload | null>(null);
  const itemsQuery = useQuery({
    queryKey: ['estoque', 'itens', { movementOptions: true }],
    queryFn: () => listStockItems({ includeInactive: false })
  });
  const projectsQuery = useQuery({
    queryKey: ['estoque', 'projects', { active: true }],
    queryFn: () => listProjects(true)
  });
  const items = useMemo(() => itemsQuery.data || [], [itemsQuery.data]);
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<MovementFormValues>({
    defaultValues: {
      reason: 'COMPRA',
      movementType: 'ENTRADA',
      itemId: '',
      batchId: '',
      projectId: '',
      quantity: '',
      date: todayInputValue(),
      nfNumber: '',
      lotNumber: '',
      expiryDate: '',
      supplier: '',
      unitCost: '',
      requestedBy: '',
      notes: ''
    },
    resolver: resolverFor(items)
  });
  const reason = watch('reason');
  const itemId = watch('itemId');
  const item = selectedItem(items, watch('itemId'));
  const needsExistingBatch = reason !== 'COMPRA';
  const needsProject = reason === 'USO_EM_PROJETO' || reason === 'DEVOLUCAO_OBRA';
  const needsNotes = ['INVENTARIO', 'PERDA', 'DESCARTE_VALIDADE'].includes(reason);
  const batchesQuery = useQuery({
    queryKey: ['estoque', 'lotes', itemId],
    queryFn: () => listStockBatches(itemId),
    enabled: needsExistingBatch && !!itemId
  });
  const batches = useMemo(() => batchesQuery.data || [], [batchesQuery.data]);
  const selectedBatch = batches.find(batch => batch.id === watch('batchId')) || null;
  const savingMutation = useMutation({
    mutationFn: (payload: StockMovementPayload) => createStockMovement(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque'] });
      showToast('Entrada registrada.', 'success');
      onClose();
    },
    onError: error => showToast(error instanceof Error ? error.message : 'Não foi possível registrar.', 'error')
  });

  useEffect(() => {
    if (!needsExistingBatch) return;
    if (batches.length) setValue('batchId', batches[0].id);
  }, [batches, needsExistingBatch, setValue]);

  function submit(values: MovementFormValues) {
    const payload = formValuesToPayload(values);
    if (values.reason === 'USO_EM_PROJETO' && selectedBatch?.expired && !payload.confirmExpired) {
      setExpiredConfirmPayload(payload);
      return;
    }
    savingMutation.mutate(payload);
  }

  return (
    <>
      <Modal open={open} onClose={onClose} ariaLabelledBy="stock-movement-form-title" panelClassName="modal-card equip-modal stock-modal">
        <button
          className="equip-modal-close-float icon-button"
          type="button"
          aria-label="Fechar movimentação"
          title="Fechar"
          onClick={onClose}
          disabled={savingMutation.isPending}
        >
          ×
        </button>
        <form className="equip-form" onSubmit={handleSubmit(submit)}>
          <header className="equip-form-head has-float-close">
            <h3 id="stock-movement-form-title">Movimentação</h3>
            <span className="equip-form-sub">Estoque</span>
          </header>

          <div className="field-group">
            <label htmlFor="stock-move-reason">Movimentação *</label>
            <select id="stock-move-reason" disabled={savingMutation.isPending} {...register('reason')}>
              <option value="COMPRA">Entrada por compra</option>
              <option value="USO_EM_PROJETO">Saída para projeto</option>
              <option value="DEVOLUCAO_OBRA">Devolução de obra</option>
              <option value="INVENTARIO">Ajuste de inventário</option>
              <option value="PERDA">Perda</option>
              <option value="DESCARTE_VALIDADE">Descarte por validade</option>
            </select>
          </div>

          <div className="field-group">
            <label htmlFor="stock-move-item">Item *</label>
            <select id="stock-move-item" disabled={savingMutation.isPending || itemsQuery.isLoading} {...register('itemId')}>
              <option value="">Selecione</option>
              {items.map(option => (
                <option key={option.id} value={option.id}>
                  {option.code} — {option.name} ({option.unitLabel})
                </option>
              ))}
            </select>
            {errors.itemId ? <small className="field-error">{errors.itemId.message}</small> : null}
          </div>

          <div className="equip-toggle-fields">
            <div className="field-group">
              <label htmlFor="stock-move-quantity">Quantidade *</label>
              <input
                id="stock-move-quantity"
                type="number"
                min="0"
                step={item?.type === 'FILTRO' ? '1' : '0.001'}
                disabled={savingMutation.isPending}
                {...register('quantity')}
              />
              {errors.quantity ? <small className="field-error">{errors.quantity.message}</small> : null}
            </div>
            <div className="field-group stock-unit-field">
              <label htmlFor="stock-move-unit">Unidade</label>
              <select
                id="stock-move-unit"
                value={movementUnitLabel(item)}
                onChange={() => undefined}
                disabled
                aria-readonly="true"
              >
                {item ? <option value={item.unitLabel}>{item.unitLabel}</option> : <option value="">Selecione</option>}
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="stock-move-date">Data *</label>
              <input id="stock-move-date" type="date" disabled={savingMutation.isPending} {...register('date')} />
              {errors.date ? <small className="field-error">{errors.date.message}</small> : null}
            </div>
          </div>

          {reason === 'COMPRA' ? (
            <>
              <div className="field-group">
                <label htmlFor="stock-move-nf">Nota fiscal *</label>
                <input id="stock-move-nf" type="text" disabled={savingMutation.isPending} {...register('nfNumber')} />
                {errors.nfNumber ? <small className="field-error">{errors.nfNumber.message}</small> : null}
              </div>

              <div className="equip-toggle-fields">
                <div className="field-group">
                  <label htmlFor="stock-move-lot">Lote{item?.type === 'PRODUTO_QUIMICO' ? ' *' : ''}</label>
                  <input id="stock-move-lot" type="text" disabled={savingMutation.isPending} {...register('lotNumber')} />
                  {errors.lotNumber ? <small className="field-error">{errors.lotNumber.message}</small> : null}
                </div>
                <div className="field-group">
                  <label htmlFor="stock-move-expiry">Validade{item?.type === 'PRODUTO_QUIMICO' ? ' *' : ''}</label>
                  <input id="stock-move-expiry" type="date" disabled={savingMutation.isPending} {...register('expiryDate')} />
                  {errors.expiryDate ? <small className="field-error">{errors.expiryDate.message}</small> : null}
                </div>
              </div>

              <div className="equip-toggle-fields">
                <div className="field-group">
                  <label htmlFor="stock-move-supplier">Fornecedor</label>
                  <input id="stock-move-supplier" type="text" disabled={savingMutation.isPending} {...register('supplier')} />
                </div>
                <div className="field-group">
                  <label htmlFor="stock-move-cost">Custo unitário</label>
                  <input id="stock-move-cost" type="number" min="0" step="0.01" disabled={savingMutation.isPending} {...register('unitCost')} />
                  {errors.unitCost ? <small className="field-error">{errors.unitCost.message}</small> : null}
                </div>
              </div>
            </>
          ) : (
            <>
              {reason === 'INVENTARIO' ? (
                <div className="field-group">
                  <label htmlFor="stock-move-type">Tipo do ajuste *</label>
                  <select id="stock-move-type" disabled={savingMutation.isPending} {...register('movementType')}>
                    <option value="ENTRADA">Entrada</option>
                    <option value="SAIDA">Saída</option>
                  </select>
                </div>
              ) : null}
              <div className="field-group">
                <label htmlFor="stock-move-batch">Lote *</label>
                <select id="stock-move-batch" disabled={savingMutation.isPending || batchesQuery.isLoading || !itemId} {...register('batchId')}>
                  <option value="">Selecione</option>
                  {batches.map(batch => (
                    <option key={batch.id} value={batch.id}>{batchLabel(batch)}</option>
                  ))}
                </select>
                {errors.batchId ? <small className="field-error">{errors.batchId.message}</small> : null}
              </div>
              {needsProject ? (
                <div className="field-group">
                  <label htmlFor="stock-move-project">Projeto *</label>
                  <select id="stock-move-project" disabled={savingMutation.isPending || projectsQuery.isLoading} {...register('projectId')}>
                    <option value="">Selecione</option>
                    {(projectsQuery.data || []).map(project => (
                      <option key={project.id} value={project.id}>{project.code} — {project.name}</option>
                    ))}
                  </select>
                  {errors.projectId ? <small className="field-error">{errors.projectId.message}</small> : null}
                </div>
              ) : null}
              {reason === 'USO_EM_PROJETO' ? (
                <div className="field-group">
                  <label htmlFor="stock-move-requested">Solicitante</label>
                  <input id="stock-move-requested" type="text" disabled={savingMutation.isPending} {...register('requestedBy')} />
                </div>
              ) : null}
            </>
          )}

          <div className="field-group">
            <label htmlFor="stock-move-notes">Observações{needsNotes ? ' *' : ''}</label>
            <textarea id="stock-move-notes" disabled={savingMutation.isPending} {...register('notes')} />
            {errors.notes ? <small className="field-error">{errors.notes.message}</small> : null}
          </div>

          <div className="admin-form-actions equip-form-actions">
            <button className="mini-btn alt" type="button" onClick={onClose} disabled={savingMutation.isPending}>Cancelar</button>
            <button className="mini-btn" type="submit" disabled={savingMutation.isPending}>{savingMutation.isPending ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        open={!!expiredConfirmPayload}
        title="Lote vencido"
        description="Confirme a saída usando o lote selecionado."
        confirmLabel="Confirmar saída"
        danger={false}
        onConfirm={() => {
          if (expiredConfirmPayload) savingMutation.mutate({ ...expiredConfirmPayload, confirmExpired: true });
          setExpiredConfirmPayload(null);
        }}
        onCancel={() => setExpiredConfirmPayload(null)}
      />
    </>
  );
}
