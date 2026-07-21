import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getCargoCostProfiles,
  getCostProfiles,
  saveCargoCostParams,
  type CargoCostHistoryEntry,
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
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function fmtDate(value?: string | null) {
  if (!value) return 'sem vigência registrada';
  const [y, m, d] = value.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : value;
}
function fmtDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fmtDate(value) : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
function modelLabel(key: string | undefined, models: CostProfile[]) {
  const model = key ? models.find(item => item.key === key) : models[0];
  if (!model) return key || '—';
  return `Modelo ${modelNumber(model.key, models.indexOf(model) + 1)} (${model.label})`;
}
function moneyParam(entry: CargoCostHistoryEntry, key: 'salarioBase') {
  const value = entry.params?.[key];
  return typeof value === 'number' ? brl(value) : '—';
}

// Custo por cargo: o cargo herda os adicionais do modelo escolhido e só define salário base.
// Cada alteração cria uma versão com data de vigência.
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
  const [effectiveDate, setEffectiveDate] = useState(todayKey());

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
    setEffectiveDate(todayKey());
  }, [cargos, selectedId, models]);

  const saveMutation = useMutation({
    mutationFn: () => saveCargoCostParams(selectedId, {
      baseModel,
      salarioBase: Number(salarioBase) || 0
    }, effectiveDate),
    onSuccess: () => {
      showToast('Custo do cargo salvo com nova vigência.');
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
  const history = selectedCargo?.history ?? [];

  return (
    <div className="page-card">
      <div className="sec">Custo por cargo</div>
      <p className="placeholder-copy" style={{ margin: '4px 0 12px' }}>
        Cada cargo é calculado com base em um <strong>modelo</strong> (planilha base) e define apenas o
        <strong> salário base</strong>. Os demais parâmetros (salário mínimo, adicionais, FGTS, multa rescisória,
        benefícios) vêm do modelo vigente na data calculada. Ao salvar, informe a data a partir da qual os novos
        valores passam a valer. A insalubridade é calculada por salário mínimo × 20%.
      </p>
      {selectedCargo?.effectiveDate ? (
        <p className="placeholder-copy" style={{ margin: '-6px 0 12px' }}>
          Última vigência salva para este cargo: <strong>{fmtDate(selectedCargo.effectiveDate)}</strong>.
        </p>
      ) : null}

      <div className="admin-inline-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
        <div className="field-group">
          <label htmlFor="cargo-select">Cargo</label>
          <select id="cargo-select" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            {list.map(c => (
              <option key={c.jobRoleId} value={c.jobRoleId}>
                {c.name}{c.profileId ? '' : ' — sem custo'}
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
          <label htmlFor="cargo-effective-date">Vigente a partir de</label>
          <input id="cargo-effective-date" type="date" required disabled={!isManager} value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
        </div>
      </div>

      {selectedCargo && !selectedCargo.profileId ? (
        <p className="placeholder-copy" style={{ margin: '8px 0 0', color: '#a06a00' }}>
          Este cargo ainda não tem custo salvo — os valores acima vêm do modelo selecionado.
        </p>
      ) : null}

      <div className="det-section" style={{ marginTop: 14 }}>
        <div className="sec" style={{ fontSize: 13 }}>Histórico de vigências do cargo</div>
        {history.length === 0 ? (
          <p className="placeholder-copy" style={{ margin: 0 }}>Nenhuma vigência salva para este cargo.</p>
        ) : (
          <div className="acp-table-wrap" style={{ marginTop: 8 }}>
            <table className="acp-table">
              <thead>
                <tr>
                  <th>Vigente desde</th>
                  <th>Modelo</th>
                  <th>Salário base</th>
                  <th>Salvo em</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry, index) => (
                  <tr key={`${entry.effectiveDate}-${entry.updatedAt ?? index}`}>
                    <td>{fmtDate(entry.effectiveDate)}</td>
                    <td>{modelLabel(entry.params?.baseModel, models)}</td>
                    <td>{moneyParam(entry, 'salarioBase')}</td>
                    <td>{fmtDateTime(entry.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {mp ? (
        <div className="det-section" style={{ marginTop: 14 }}>
          <div className="sec" style={{ fontSize: 13 }}>Herdado do modelo selecionado</div>
          <div className="det-row"><span className="det-label">Periculosidade</span><span className="det-val">{frac(mp, 'periculosidadePct')} (integral)</span></div>
          <div className="det-row"><span className="det-label">Produtividade / Gratificação</span><span className="det-val">{frac(mp, 'produtividadePct')}</span></div>
          <div className="det-row"><span className="det-label">Transferência / Viagem</span><span className="det-val">{frac(mp, 'transferenciaPct')}</span></div>
          <div className="det-row"><span className="det-label">Confinamento / Offshore</span><span className="det-val">{frac(mp, 'confinamentoPct')}</span></div>
          <div className="det-row"><span className="det-label">HE 70% / 100%</span><span className="det-val">{frac(mp, 'he70Pct')} / {frac(mp, 'he100Pct')}</span></div>
          <div className="det-row"><span className="det-label">FGTS</span><span className="det-val">{frac(mp, 'fgtsPct')}</span></div>
          <div className="det-row"><span className="det-label">Multa rescisória</span><span className="det-val">{frac(mp, 'multaPct')}</span></div>
          <div className="det-row"><span className="det-label">Benefícios (total)</span><span className="det-val">{brl(benefitsTotal(mp))}</span></div>
        </div>
      ) : null}

      {isManager ? (
        <div style={{ marginTop: 12 }}>
          <button className="mini-btn" type="button" disabled={!selectedId || !effectiveDate || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? 'Salvando…' : 'Salvar custo do cargo'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
