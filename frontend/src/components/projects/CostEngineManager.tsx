import { useEffect, useState } from 'react';

import { CargoProfilesPanel } from './CargoProfilesPanel';
import { CostSimulatorPanel } from './CostSimulatorPanel';
import { EpiConfigCard } from './EpiConfigCard';
import { LaborRateTable } from './LaborRateTable';
import { PontoImportPanel } from './PontoImportPanel';

type CostTab = 'cargos' | 'ponto' | 'rates' | 'simulador';

const TABS: Array<[CostTab, string]> = [
  ['cargos', 'Cargos'],
  ['ponto', 'Ponto'],
  ['rates', 'Custo/hora'],
  ['simulador', 'Simulador']
];

export function CostEngineManager({ canManageCosts = true }: { canManageCosts?: boolean }) {
  const tabs = canManageCosts ? TABS : TABS.filter(([key]) => key === 'rates');
  const [tab, setTab] = useState<CostTab>(canManageCosts ? 'cargos' : 'rates');
  const activeTab = canManageCosts ? tab : 'rates';

  useEffect(() => {
    if (!canManageCosts && tab !== 'rates') setTab('rates');
  }, [canManageCosts, tab]);

  return (
    <div data-acp-custo>
      <div className="acp-seg" role="tablist" aria-label="Seções de custo" style={{ marginBottom: 12 }}>
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeTab === key}
            className={`acp-seg-btn ${activeTab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {canManageCosts && activeTab === 'cargos' ? <><EpiConfigCard /><CargoProfilesPanel /></>
        : activeTab === 'ponto' ? <PontoImportPanel />
        : activeTab === 'rates' ? <LaborRateTable />
        : <CostSimulatorPanel />}
    </div>
  );
}
