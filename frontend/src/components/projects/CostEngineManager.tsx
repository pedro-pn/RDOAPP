import { useState } from 'react';

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

export function CostEngineManager() {
  const [tab, setTab] = useState<CostTab>('cargos');

  return (
    <div data-acp-custo>
      <div className="acp-seg" role="tablist" aria-label="Seções de custo" style={{ marginBottom: 12 }}>
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`acp-seg-btn ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'cargos' ? <><EpiConfigCard /><CargoProfilesPanel /></>
        : tab === 'ponto' ? <PontoImportPanel />
        : tab === 'rates' ? <LaborRateTable />
        : <CostSimulatorPanel />}
    </div>
  );
}
