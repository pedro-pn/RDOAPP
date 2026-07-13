import type { Collaborator } from '../../types/domain';

export interface ManualReportOperationalFieldsValue {
  arrivalTime: string;
  departureTime: string;
  lunchBreak: string;
  collaboratorIds: string[];
  noturno: boolean;
  noturnoStart: string;
  noturnoEnd: string;
  noturnoInterval: string;
  noturnoCollaboratorIds: string[];
  standby: boolean;
  standbyDuration: string;
  standbyMotivo: string;
}

interface ManualReportOperationalFieldsProps {
  value: ManualReportOperationalFieldsValue;
  collaborators: Collaborator[];
  disabled?: boolean;
  defaultOpen?: boolean;
  embedded?: boolean;
  showNightShift?: boolean;
  showStandby?: boolean;
  summaryLabel?: string;
  onChange: (patch: Partial<ManualReportOperationalFieldsValue>) => void;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function collaboratorName(collaborators: Collaborator[], id: string) {
  const collaborator = collaborators.find(item => item.id === id);
  if (!collaborator) return id;
  return [collaborator.name, collaborator.role].filter(Boolean).join(' - ');
}

export function ManualReportOperationalFields({
  value,
  collaborators,
  disabled = false,
  defaultOpen = false,
  embedded = false,
  showNightShift = false,
  showStandby = false,
  summaryLabel = 'Dados operacionais (opcional)',
  onChange
}: ManualReportOperationalFieldsProps) {
  function renderSelected(ids: string[], field: 'collaboratorIds' | 'noturnoCollaboratorIds') {
    if (!ids.length) return <div className="colab-empty">Nenhum colaborador adicionado.</div>;

    return ids.map(id => (
      <span className="colab-tag" key={`${field}-${id}`}>
        <span>{collaboratorName(collaborators, id)}</span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ [field]: ids.filter(item => item !== id) })}
          aria-label="Remover colaborador"
        >
          x
        </button>
      </span>
    ));
  }

  function renderPicker(ids: string[], field: 'collaboratorIds' | 'noturnoCollaboratorIds', label: string) {
    return (
      <>
        <div className="manual-operational-team-label">{label}</div>
        <div className="colab-list">
          {renderSelected(ids, field)}
        </div>
        <div className="cadd manual-operational-add">
          <select
            value=""
            disabled={disabled}
            onChange={event => {
              const id = event.target.value;
              if (!id) return;
              onChange({ [field]: unique([...ids, id]) });
            }}
          >
            <option value="">Adicionar...</option>
            {collaborators
              .filter(item => item.isActive !== false)
              .filter(item => !ids.includes(item.id))
              .map(item => (
                <option key={item.id} value={item.id}>
                  {[item.name, item.role].filter(Boolean).join(' - ')}
                </option>
              ))}
          </select>
        </div>
      </>
    );
  }

  const body = (
    <div className="manual-operational-body">
        <div className="manual-operational-grid">
          <div className="field-group">
            <label>Entrada</label>
            <input
              type="time"
              value={value.arrivalTime}
              disabled={disabled}
              onChange={event => onChange({ arrivalTime: event.target.value })}
            />
          </div>
          <div className="field-group">
            <label>Saída</label>
            <input
              type="time"
              value={value.departureTime}
              disabled={disabled}
              onChange={event => onChange({ departureTime: event.target.value })}
            />
          </div>
          <div className="field-group">
            <label>Intervalo de almoço</label>
            <input
              type="time"
              step={1}
              value={value.lunchBreak}
              disabled={disabled}
              onChange={event => onChange({ lunchBreak: event.target.value })}
            />
          </div>
        </div>

        {renderPicker(value.collaboratorIds, 'collaboratorIds', 'Equipe diurna')}

        {showNightShift ? (
          <div className="manual-operational-night">
            <label className="manual-operational-toggle">
              <span>Turno noturno</span>
              <input
                type="checkbox"
                checked={value.noturno}
                disabled={disabled}
                onChange={event => onChange({ noturno: event.target.checked })}
              />
            </label>
            {value.noturno ? (
              <div className="collapse-section manual-operational-night-fields">
                <div className="manual-operational-grid">
                  <div className="field-group">
                    <label>Início</label>
                    <input
                      type="time"
                      value={value.noturnoStart}
                      disabled={disabled}
                      onChange={event => onChange({ noturnoStart: event.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label>Término</label>
                    <input
                      type="time"
                      value={value.noturnoEnd}
                      disabled={disabled}
                      onChange={event => onChange({ noturnoEnd: event.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label>Intervalo noturno</label>
                    <input
                      type="time"
                      step={1}
                      value={value.noturnoInterval}
                      disabled={disabled}
                      onChange={event => onChange({ noturnoInterval: event.target.value })}
                    />
                  </div>
                </div>
                {renderPicker(value.noturnoCollaboratorIds, 'noturnoCollaboratorIds', 'Equipe noturna')}
              </div>
            ) : null}
          </div>
        ) : null}

        {showStandby ? (
          <div className="manual-operational-standby">
            <label className="manual-operational-toggle">
              <span>Stand-by</span>
              <input
                type="checkbox"
                checked={value.standby}
                disabled={disabled}
                onChange={event => onChange({ standby: event.target.checked })}
              />
            </label>
            {value.standby ? (
              <div className="collapse-section manual-operational-standby-fields">
                <div className="manual-operational-grid">
                  <div className="field-group">
                    <label>Tempo total</label>
                    <input
                      type="time"
                      step={1}
                      value={value.standbyDuration}
                      disabled={disabled}
                      onChange={event => onChange({ standbyDuration: event.target.value })}
                    />
                  </div>
                  <div className="field-group manual-operational-wide">
                    <label>Motivo</label>
                    <input
                      value={value.standbyMotivo}
                      disabled={disabled}
                      onChange={event => onChange({ standbyMotivo: event.target.value })}
                      placeholder="Motivo do stand-by"
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
  );

  if (embedded) {
    return <div className="manual-operational-fields manual-operational-fields-embedded">{body}</div>;
  }

  return (
    <details className="manual-operational-fields" {...(defaultOpen ? { open: true } : {})}>
      <summary>{summaryLabel}</summary>
      {body}
    </details>
  );
}
