import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getCostConfig, saveCostConfig } from '../../api/acompanhamentoCusto';
import { useToast } from '../ui/ToastContext';

// Custo de EPI (média fixa anual por colaborador) — entra no custo mensal → custo/hora e HH.
export function EpiConfigCard() {
  const queryClient = useQueryClient();
  const showToast = useToast();
  const { data } = useQuery({ queryKey: ['cost-config'], queryFn: getCostConfig });
  const [value, setValue] = useState('');

  useEffect(() => { if (data) setValue(String(data.epiAnnualCost)); }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => saveCostConfig(Number(value) || 0),
    onSuccess: () => {
      showToast('Custo de EPI salvo.');
      queryClient.invalidateQueries({ queryKey: ['cost-config'] });
      queryClient.invalidateQueries({ queryKey: ['ponto-colaboradores'] });
      queryClient.invalidateQueries({ queryKey: ['project-cards'] });
    },
    onError: () => showToast('Não foi possível salvar o custo de EPI.')
  });

  return (
    <div className="page-card" style={{ marginBottom: 12 }}>
      <div className="sec">Custo de EPI</div>
      <p className="placeholder-copy" style={{ margin: '4px 0 12px' }}>
        Média fixa anual de EPI por colaborador (igual para todos os cargos). Entra no custo mensal de
        cada colaborador → reflete no custo/hora e no HH por projeto.
      </p>
      <div className="field-group" style={{ maxWidth: 280 }}>
        <label htmlFor="epi-anual">EPI (R$/ano por colaborador)</label>
        <input id="epi-anual" type="number" step="any" value={value} onChange={e => setValue(e.target.value)} />
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="mini-btn" type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          {saveMutation.isPending ? 'Salvando…' : 'Salvar EPI'}
        </button>
      </div>
    </div>
  );
}
