import { useMemo, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { z } from 'zod';

import type { PdfUpload, StockItem, StockItemPayload, StockItemType, StockItemUpdatePayload } from '../../api/estoque';
import { Modal } from '../../components/ui/Modal';
import { PdfDropzone } from '../../components/ui/PdfDropzone';
import { makeEstoqueSchemas } from '../../../../shared/schemas/estoque.js';

interface Props {
  open: boolean;
  item: StockItem | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: StockItemPayload | StockItemUpdatePayload) => void;
}

interface StockItemFormValues {
  type: StockItemType;
  code: string;
  name: string;
  manufacturer: string;
  description: string;
  unitLabel: 'kg' | 'L';
  minQuantity: string;
  location: string;
  filterModel: string;
  filterKind: string;
  filterMicron: string;
  unNumber: string;
  casNumber: string;
}

const estoqueSchemas = makeEstoqueSchemas(z);

function optionalValue(value: string) {
  const text = String(value || '').trim();
  return text || null;
}

function formValuesToPayload(values: StockItemFormValues): StockItemPayload | StockItemUpdatePayload {
  const base = {
    code: values.code,
    name: values.name,
    manufacturer: optionalValue(values.manufacturer),
    description: optionalValue(values.description),
    minQuantity: optionalValue(values.minQuantity),
    location: optionalValue(values.location)
  };

  if (values.type === 'FILTRO') {
    return {
      type: 'FILTRO',
      ...base,
      filterModel: optionalValue(values.filterModel),
      filterKind: optionalValue(values.filterKind),
      filterMicron: optionalValue(values.filterMicron)
    };
  }

  return {
    type: 'PRODUTO_QUIMICO',
    ...base,
    unitLabel: values.unitLabel,
    unNumber: optionalValue(values.unNumber),
    casNumber: optionalValue(values.casNumber)
  };
}

function zodErrorToFormErrors(error: z.ZodError) {
  return error.issues.reduce<Record<string, { type: string; message: string }>>((acc, issue) => {
    const key = String(issue.path[0] || 'form');
    if (!acc[key]) acc[key] = { type: 'manual', message: issue.message };
    return acc;
  }, {});
}

function resolverFor(item: StockItem | null): Resolver<StockItemFormValues> {
  return async values => {
    const payload = formValuesToPayload(values);
    const schema = item
      ? estoqueSchemas.itemUpdateForType(item.type)
      : estoqueSchemas.itemCreate;
    const candidate = item ? payload : { ...payload, type: values.type };
    const result = schema.safeParse(candidate);
    if (result.success) return { values, errors: {} };
    return { values: {}, errors: zodErrorToFormErrors(result.error) };
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function pdfUpload(file: File | null): Promise<PdfUpload | undefined> {
  if (!file) return undefined;
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) throw new Error('A FISPQ deve ser enviada em PDF.');
  return { fileName: file.name, dataUrl: await fileToDataUrl(file) };
}

export function StockItemFormModal({ open, item, saving, onClose, onSubmit }: Props) {
  const [fispqFile, setFispqFile] = useState<File | null>(null);
  const [removeFispq, setRemoveFispq] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const defaultValues = useMemo<StockItemFormValues>(() => ({
    type: item?.type || 'FILTRO',
    code: item?.code || '',
    name: item?.name || '',
    manufacturer: item?.manufacturer || '',
    description: item?.description || '',
    unitLabel: item?.unitLabel === 'L' ? 'L' : 'kg',
    minQuantity: item?.minQuantity || '',
    location: item?.location || '',
    filterModel: item?.filterModel || '',
    filterKind: item?.filterKind || '',
    filterMicron: item?.filterMicron || '',
    unNumber: item?.unNumber || '',
    casNumber: item?.casNumber || ''
  }), [item]);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<StockItemFormValues>({
    defaultValues,
    resolver: resolverFor(item)
  });
  const type = watch('type');

  async function submit(values: StockItemFormValues) {
    setSubmitError(null);
    try {
      const payload = formValuesToPayload(values);
      if (values.type === 'PRODUTO_QUIMICO') {
        const fispq = await pdfUpload(fispqFile);
        if (fispq) {
          Object.assign(payload, { fispq });
        } else if (removeFispq) {
          Object.assign(payload, { fispq: null });
        }
      }
      if (item) {
        const updatePayload = { ...(payload as StockItemPayload) } as StockItemUpdatePayload & { type?: StockItemType };
        delete updatePayload.type;
        onSubmit(updatePayload);
      } else {
        onSubmit(payload as StockItemPayload);
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Não foi possível preparar o anexo.');
    }
  }

  return (
    <Modal open={open} onClose={onClose} ariaLabelledBy="stock-item-form-title" panelClassName="modal-card equip-modal stock-modal">
      <button
        className="equip-modal-close-float icon-button"
        type="button"
        aria-label="Fechar cadastro do item"
        title="Fechar"
        onClick={onClose}
        disabled={saving}
      >
        ×
      </button>
      <form className="equip-form" onSubmit={handleSubmit(submit)}>
        <header className="equip-form-head has-float-close">
          <h3 id="stock-item-form-title">{item ? 'Editar item' : 'Novo item'}</h3>
          <span className="equip-form-sub">Estoque</span>
        </header>

        <div className="field-group">
          <label htmlFor="stock-item-type">Tipo *</label>
          <select id="stock-item-type" disabled={!!item || saving} {...register('type')}>
            <option value="FILTRO">Filtro</option>
            <option value="PRODUTO_QUIMICO">Produto químico</option>
          </select>
        </div>

        <div className="field-group">
          <label htmlFor="stock-item-code">Código *</label>
          <input id="stock-item-code" type="text" disabled={saving} {...register('code')} />
          {errors.code ? <small className="field-error">{errors.code.message}</small> : null}
        </div>
        <div className="field-group">
          <label htmlFor="stock-item-name">Nome *</label>
          <input id="stock-item-name" type="text" disabled={saving} {...register('name')} />
          {errors.name ? <small className="field-error">{errors.name.message}</small> : null}
        </div>
        <div className="field-group">
          <label htmlFor="stock-item-manufacturer">Fabricante</label>
          <input id="stock-item-manufacturer" type="text" disabled={saving} {...register('manufacturer')} />
        </div>
        <div className="field-group">
          <label htmlFor="stock-item-description">Descrição</label>
          <textarea id="stock-item-description" disabled={saving} {...register('description')} />
        </div>

        <div className="equip-toggle-fields">
          <div className="field-group">
            <label htmlFor="stock-item-min">Estoque mínimo</label>
            <input id="stock-item-min" type="number" step="0.001" min="0" disabled={saving} {...register('minQuantity')} />
            {errors.minQuantity ? <small className="field-error">{errors.minQuantity.message}</small> : null}
          </div>
          <div className="field-group">
            <label htmlFor="stock-item-location">Localização</label>
            <input id="stock-item-location" type="text" disabled={saving} {...register('location')} />
          </div>
        </div>

        {type === 'FILTRO' ? (
          <>
            <div className="field-group">
              <label htmlFor="stock-filter-model">Modelo</label>
              <input id="stock-filter-model" type="text" disabled={saving} {...register('filterModel')} />
            </div>
            <div className="equip-toggle-fields">
              <div className="field-group">
                <label htmlFor="stock-filter-kind">Tipo do filtro</label>
                <input id="stock-filter-kind" type="text" disabled={saving} {...register('filterKind')} />
              </div>
              <div className="field-group">
                <label htmlFor="stock-filter-micron">Micragem</label>
                <input id="stock-filter-micron" type="text" disabled={saving} {...register('filterMicron')} />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="equip-toggle-fields">
              <div className="field-group">
                <label htmlFor="stock-chemical-unit">Unidade *</label>
                <select id="stock-chemical-unit" disabled={saving} {...register('unitLabel')}>
                  <option value="kg">kg</option>
                  <option value="L">L</option>
                </select>
                {errors.unitLabel ? <small className="field-error">{errors.unitLabel.message}</small> : null}
              </div>
              <div className="field-group">
                <label htmlFor="stock-chemical-un">Número ONU</label>
                <input id="stock-chemical-un" type="text" disabled={saving} {...register('unNumber')} />
              </div>
            </div>
            <div className="field-group">
              <label htmlFor="stock-chemical-cas">Número CAS</label>
              <input id="stock-chemical-cas" type="text" disabled={saving} {...register('casNumber')} />
              {errors.casNumber ? <small className="field-error">{errors.casNumber.message}</small> : null}
            </div>
            <PdfDropzone
              id="stock-fispq"
              label="FISPQ (PDF)"
              file={fispqFile}
              onFile={setFispqFile}
              currentName={item?.fispqUrl ? 'FISPQ cadastrada' : undefined}
              currentUrl={item?.fispqUrl || undefined}
              currentRemoved={removeFispq}
              onCurrentRemovedChange={setRemoveFispq}
              disabled={saving}
            />
          </>
        )}

        {submitError ? <p className="equip-form-error">{submitError}</p> : null}
        {errors.form ? <p className="equip-form-error">{errors.form.message}</p> : null}

        <div className="admin-form-actions equip-form-actions">
          <button className="mini-btn alt" type="button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="mini-btn" type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </Modal>
  );
}
