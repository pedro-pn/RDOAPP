import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getCostProfiles, saveCostParams, simulateCost, type CostParams, type CostResult } from '../../api/acompanhamentoCusto';
import { useToast } from '../ui/ToastContext';
import { PARAM_FIELDS, BENEFIT_FIELDS, INPUT_FIELDS, brl, modelNumber } from './costFields';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function fmtDate(value?: string | null) {
  if (!value) return 'sem vigência registrada';
  const [y, m, d] = value.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : value;
}

// Editor dos perfis-modelo (operador/auxiliar) + simulador mensal de custo.
export function CostSimulatorPanel() {
  const queryClient = useQueryClient();
  const showToast = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['cost-profiles'], queryFn: getCostProfiles });

  const [selectedKey, setSelectedKey] = useState('');
  const [params, setParams] = useState<CostParams>({});
  const [effectiveDate, setEffectiveDate] = useState(todayKey());
  const [inputs, setInputs] = useState<Record<string, number>>({ diasCliente: 22, diasFora: 1, diasCasa: 22, he70Horas: 1, he100Horas: 1 });
  const [result, setResult] = useState<CostResult | null>(null);

  useEffect(() => {
    const profiles = data ?? [];
    if (!profiles.length) return;
    const key = selectedKey || profiles[0].key;
    if (!selectedKey) setSelectedKey(key);
    const profile = profiles.find(p => p.key === key);
    if (profile?.params) setParams(profile.params);
    setEffectiveDate(todayKey());
  }, [data, selectedKey]);

  const saveMutation = useMutation({
    mutationFn: () => saveCostParams(selectedKey, params, effectiveDate),
    onSuccess: () => {
      showToast('Parâmetros salvos com nova vigência.');
      queryClient.invalidateQueries({ queryKey: ['cost-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['cost-cargos'] });
      queryClient.invalidateQueries({ queryKey: ['ponto-colaboradores'] });
      queryClient.invalidateQueries({ queryKey: ['project-cards'] });
    },
    onError: () => showToast('Não foi possível salvar os parâmetros.')
  });

  const simulateMutation = useMutation({
    mutationFn: () => simulateCost({ params, inputs }),
    onSuccess: setResult,
    onError: () => showToast('Não foi possível simular.')
  });

  if (isLoading) return <div className="page-card placeholder-copy">Carregando motor de custo…</div>;

  const profiles = data ?? [];
  const selectedProfile = profiles.find(p => p.key === selectedKey) ?? null;
  const num = (key: string) => Number((params[key] as number) ?? 0);
  const benefits = (params.beneficios as Record<string, number>) ?? {};
  const setNum = (key: string, value: string) => setParams(current => ({ ...current, [key]: Number(value) }));
  const setBenefit = (key: string, value: string) => setParams(current => ({ ...current, beneficios: { ...((current.beneficios as Record<string, number>) ?? {}), [key]: Number(value) } }));

  return (
    <div className="page-card">
      <div className="sec">Modelos base e simulador</div>
      <p className="placeholder-copy" style={{ margin: '4px 0 12px' }}>
        Planilhas base de cálculo (Modelo 1 = Operador, Modelo 2 = Auxiliar). Os cargos herdam estes
        parâmetros pela data de vigência (aba <strong>Cargos</strong>). Salvar cria uma nova vigência que
        passa a valer a partir da data informada. Frações: 0,3 = 30%.
      </p>

      <div className="field-group" style={{ maxWidth: 320 }}>
        <label htmlFor="cost-profile">Modelo base</label>
        <select id="cost-profile" value={selectedKey} onChange={e => { setSelectedKey(e.target.value); setResult(null); }}>
          {profiles.map((p, i) => <option key={p.key} value={p.key}>Modelo {modelNumber(p.key, i + 1)} ({p.label})</option>)}
        </select>
      </div>
      {selectedProfile?.effectiveDate ? (
        <p className="placeholder-copy" style={{ margin: '8px 0 0' }}>
          Última vigência salva para este modelo: <strong>{fmtDate(selectedProfile.effectiveDate)}</strong>.
        </p>
      ) : null}

      <div className="admin-inline-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, marginTop: 12 }}>
        {PARAM_FIELDS.map(([key, label]) => (
          <div className="field-group" key={key}>
            <label htmlFor={`p-${key}`}>{label}</label>
            <input id={`p-${key}`} type="number" step="any" value={num(key)} onChange={e => setNum(key, e.target.value)} />
          </div>
        ))}
        {BENEFIT_FIELDS.map(([key, label]) => (
          <div className="field-group" key={key}>
            <label htmlFor={`b-${key}`}>{label} (R$)</label>
            <input id={`b-${key}`} type="number" step="any" value={Number(benefits[key] ?? 0)} onChange={e => setBenefit(key, e.target.value)} />
          </div>
        ))}
        <div className="field-group">
          <label htmlFor="p-effective-date">Vigente a partir de</label>
          <input id="p-effective-date" type="date" required value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <button className="mini-btn" type="button" disabled={!effectiveDate || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          {saveMutation.isPending ? 'Salvando…' : 'Salvar parâmetros do modelo'}
        </button>
      </div>

      <hr style={{ margin: '16px 0', border: 0, borderTop: '1px solid #eee' }} />

      <div className="sec">Simulador mensal</div>
      <div className="admin-inline-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, marginTop: 8 }}>
        {INPUT_FIELDS.map(([key, label]) => (
          <div className="field-group" key={key}>
            <label htmlFor={`i-${key}`}>{label}</label>
            <input id={`i-${key}`} type="number" step="any" value={inputs[key] ?? 0} onChange={e => setInputs(c => ({ ...c, [key]: Number(e.target.value) }))} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <button className="mini-btn" type="button" disabled={simulateMutation.isPending} onClick={() => simulateMutation.mutate()}>
          {simulateMutation.isPending ? 'Calculando…' : 'Simular custo'}
        </button>
      </div>

      {result ? (
        <div className="det-section" style={{ marginTop: 12 }}>
          <div className="det-row"><span className="det-label">Remuneração bruta</span><span className="det-val">{brl(result.remuneracaoBruta)}</span></div>
          <div className="det-row"><span className="det-label">Encargos (FGTS+INSS)</span><span className="det-val">{brl(result.encargos)}</span></div>
          <div className="det-row"><span className="det-label">Provisões (13º+férias)</span><span className="det-val">{brl(result.provisoes)}</span></div>
          <div className="det-row"><span className="det-label">Benefícios</span><span className="det-val">{brl(result.beneficios)}</span></div>
          <div className="det-row"><span className="det-label">Passivo rescisório</span><span className="det-val">{brl(result.passivoRescisorio)}</span></div>
          <div className="det-row"><span className="det-label"><strong>Custo total mensal</strong></span><span className="det-val"><strong>{brl(result.totalMensal)}</strong></span></div>
          <div className="det-row"><span className="det-label">Custo/hora (220h)</span><span className="det-val">{brl(result.custoHora220)}</span></div>
          <div className="det-row"><span className="det-label">Custo/dia útil</span><span className="det-val">{brl(result.custoDiaUtil)}</span></div>
        </div>
      ) : null}
    </div>
  );
}
