import type { OfficialMissionContext } from '../../api/reports';

export function ReportWorkforceNotices({
  planningContext,
  absenceConflictCount,
  workforceJustification,
  invalid,
  onJustificationChange
}: {
  planningContext: OfficialMissionContext | null;
  absenceConflictCount: number;
  workforceJustification: string;
  invalid: boolean;
  onJustificationChange: (value: string) => void;
}) {
  return (
    <>
      {planningContext?.needsReplanning ? (
        <div className="form-hint" role="status">
          A missão oficial está marcada para replanejamento{planningContext.replanningReason ? `: ${planningContext.replanningReason}` : '.'}
        </div>
      ) : null}
      {absenceConflictCount ? (
        <div className={`field-group ${invalid ? 'field-invalid' : ''}`} data-invalid-target="header:workforceJustification" style={{ marginTop: 12 }}>
          <label htmlFor="rdo-workforce-justification">
            Justificativa de trabalho durante afastamento <span style={{ color: 'var(--rd)' }}>*</span>
          </label>
          <div className="form-hint" role="alert">
            {absenceConflictCount} conflito(s) de afastamento detectado(s). O registro real será preservado com esta justificativa.
          </div>
          <textarea
            id="rdo-workforce-justification"
            value={workforceJustification}
            onChange={event => onJustificationChange(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Explique por que houve trabalho durante o afastamento registrado."
          />
        </div>
      ) : null}
    </>
  );
}
