import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getCargoCostProfiles,
  getCostProfiles,
  saveCargoCostParams,
  type CostProfile
} from '../../api/acompanhamentoCusto';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../ui/ToastContext';
import { brl, modelNumber } from './costFields';

function num(params: CostProfile['params'], key: string): number {
  const v = params?.[key];
  return typeof v === 'number' ? v : 0;
}
function frac(params: CostProfile['params'], key: string) {
  return `${(num(params, key) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}
function benefitsTotal(params: CostProfile['params']) {
  const b = (params?.beneficios as Record<string, number>) ?? {};
  return Object.values(b).reduce((sum, v) => sum + (Number(v) || 0), 0);
}

// Custo por cargo — "base viva": o cargo herda os adicionais do modelo escolhido e só define
// salário base e insalubridade. Editar o modelo (aba Simulador) reflete no custo do cargo.
export function CargoProfilesPanel() {
  const queryClient = useQueryClient();
  const showToast = useToast();
  const { user } = useAuth();
  const isManager = user?.accountType === 'ADMIN' || Boolean(user?.moduleRoles?.includes('acompanhamento:manager'));

  const { data: cargos, isLoading } = useQuery({ queryKey: ['cost-cargos'], queryFn: getCargoCostProfiles });
  const { data: modelsRaw } = useQuery({ queryKey: ['cost-profiles'], queryFn: getCostProfiles });

  const models = useMemo(() => {
    const list = [...(modelsRaw ?? [])];
    list.sort((a, b) => modelNumber(a.key, 99) - modelNumber(b.key, 99));
    return list;
  }, [modelsRaw]);

  const [selectedId, setSelectedId] = useState('');
  const [baseModel, setBaseModel] = useState('');
  const [salarioBase, setSalarioBase] = useState('');
  const [insalubridade, setInsalubridade] = useState('');

  const selectedCargo = (cargos ?? []).find(c => c.jobRoleId === selectedId) ?? null;
  const selectedModel = models.find(m => m.key === baseModel) ?? null;

  // Ao trocar de cargo, carrega o override salvo (ou os defaults do modelo).
  useEffect(() => {
    const list = cargos ?? [];
    if (!list.length || !models.length) return;
    const id = selectedId || list[0].jobRoleId;
    if (!selectedId) { setSelectedId(id); return; }
    const cargo = list.find(c => c.jobRoleId === id);
    const params = cargo?.params ?? null;
    const modelKey = params?.baseModel || models[0].key;
    const model = models.find(m => m.key === modelKey) ?? models[0];
    setBaseModel(model.key);
    setSalarioBase(String(params?.salarioBase ?? num(model.params, 'salarioBase')));
    setInsalubridade(String(params?.insalubridade ?? num(model.params, 'insalubridade')));
  }, [cargos, selectedId, models]);

  const saveMutation = useMutation({
    mutationFn: () => saveCargoCostParams(selectedId, {
      baseModel,
      salarioBase: Number(salarioBase) || 0,
      insalubridade: Number(insalubridade) || 0
    }),
    onSuccess: () => {
      showToast('Custo do cargo salvo (nova versão).');
      queryClient.invalidateQueries({ queryKey: ['cost-cargos'] });
      queryClient.invalidateQueries({ queryKey: ['ponto-colaboradores'] });
      queryClient.invalidateQueries({ queryKey: ['project-cards'] });
    },
    onError: () => showToast('Não foi possível salvar o custo do cargo.')
  });

  if (isLoading) return <div className="page-card placeholder-copy">Carregando cargos…</div>;
  if (!models.length) return <div className="page-card placeholder-copy">Configure os modelos base na aba Simulador primeiro.</div>;

  const list = cargos ?? [];
  const mp = selectedModel?.params ?? null;

  return (
    <div className="page-card">
      <div className="sec">Custo por cargo</div>
      <p className="placeholder-copy" style={{ margin: '4px 0 12px' }}>
        Cada cargo é calculado com base em um <strong>modelo</strong> (planilha base) e define apenas o
        <strong> salário base</strong> e a <strong>insalubridade</strong>. Os demais parâmetros
        (adicionais, encargos, benefícios) vêm do modelo — se você atualizar o modelo na aba Simulador,
        o custo dos cargos daquele modelo é recalculado. A periculosidade é integral (setor operacional).
      </p>

      <div className="admin-inline-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
        <div className="field-group">
          <label htmlFor="cargo-select">Cargo</label>
          <select id="cargo-select" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            {list.map(c => (
              <option key={c.jobRoleId} value={c.jobRoleId}>
                {c.name}{c.profileId ? ` (v${c.version})` : ' — sem custo'}
              </option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label htmlFor="cargo-model">Modelo base de cálculo</label>
          <select id="cargo-model" value={baseModel} disabled={!isManager} onChange={e => setBaseModel(e.target.value)}>
            {models.map((m, i) => (
              <option key={m.key} value={m.key}>Modelo {modelNumber(m.key, i + 1)} ({m.label})</option>
            ))}
          </select>
        </div>
        <div className="field-group">
          <label htmlFor="cargo-salario">Salário base (R$)</label>
          <input id="cargo-salario" type="number" step="any" disabled={!isManager} value={salarioBase} onChange={e => setSalarioBase(e.target.value)} />
        </div>
        <div className="field-group">
          <label htmlFor="cargo-insalub">Insalubridade (R$)</label>
          <input id="cargo-insalub" type="number" step="any" disabled={!isManager} value={insalubridade} onChange={e => setInsalubridade(e.target.value)} />
        </div>
      </div>

      {selectedCargo && !selectedCargo.profileId ? (
        <p className="placeholder-copy" style={{ margin: '8px 0 0', color: '#a06a00' }}>
          Este cargo ainda não tem custo salvo — os valores acima vêm do modelo selecionado.
        </p>
      ) : null}

      {mp ? (
        <div className="det-section" style={{ marginTop: 14 }}>
          <div className="sec" style={{ fontSize: 13 }}>Herdado do modelo (atualiza junto com o modelo)</div>
          <div className="det-row"><span className="det-label">Periculosidade</span><span className="det-val">{frac(mp, 'periculosidadePct')} (integral)</span></div>
          <div className="det-row"><span className="det-label">Produtividade / Gratificação</span><span className="det-val">{frac(mp, 'produtividadePct')}</span></div>
          <div className="det-row"><span className="det-label">Transferência / Viagem</span><span className="det-val">{frac(mp, 'transferenciaPct')}</span></div>
          <div className="det-row"><span className="det-label">HE 70% / 100%</span><span className="det-val">{frac(mp, 'he70Pct')} / {frac(mp, 'he100Pct')}</span></div>
          <div className="det-row"><span className="det-label">FGTS / INSS patronal</span><span className="det-val">{frac(mp, 'fgtsPct')} / {frac(mp, 'inssPatronalPct')}</span></div>
          <div className="det-row"><span className="det-label">Benefícios (total)</span><span className="det-val">{brl(benefitsTotal(mp))}</span></div>
        </div>
      ) : null}

      {isManager ? (
        <div style={{ marginTop: 12 }}>
          <button className="mini-btn" type="button" disabled={!selectedId || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? 'Salvando…' : 'Salvar custo do cargo'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
