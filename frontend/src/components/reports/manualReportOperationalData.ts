import type { ManualReportOperationalData } from '../../api/reports';
import type { ReportType } from '../../types/domain';
import type { ManualReportOperationalFieldsValue } from './ManualReportOperationalFields';

export function emptyManualReportOperationalFields(): ManualReportOperationalFieldsValue {
  return {
    arrivalTime: '',
    departureTime: '',
    lunchBreak: '01:00:00',
    collaboratorIds: [],
    noturno: false,
    noturnoStart: '',
    noturnoEnd: '',
    noturnoInterval: '01:00:00',
    noturnoCollaboratorIds: [],
    standby: false,
    standbyDuration: '',
    standbyMotivo: '',
    ddsDay: false,
    ddsDayStart: '',
    ddsDayEnd: '',
    ddsDayThemes: [],
    ddsNight: false,
    ddsNightStart: '',
    ddsNightEnd: '',
    ddsNightThemes: []
  };
}

function scopedMessage(message: string, label?: string) {
  return label ? `${message} em ${label}.` : `${message}.`;
}

export function validateManualReportOperationalFields(
  fields: ManualReportOperationalFieldsValue,
  options: { reportType?: ReportType | string; label?: string } = {}
) {
  const hasArrival = Boolean(fields.arrivalTime.trim());
  const hasDeparture = Boolean(fields.departureTime.trim());
  if (hasArrival !== hasDeparture) return scopedMessage('Informe entrada e saída', options.label);
  if (fields.noturno && (!fields.noturnoStart.trim() || !fields.noturnoEnd.trim())) {
    return scopedMessage('Informe início e término do turno noturno', options.label);
  }
  if (options.reportType === 'RDO' && fields.standby && (!fields.standbyDuration.trim() || !fields.standbyMotivo.trim())) {
    return scopedMessage('Informe tempo total e motivo do stand-by', options.label);
  }
  if (options.reportType === 'RDO' && fields.ddsDay && (!fields.ddsDayStart.trim() || !fields.ddsDayEnd.trim())) {
    return scopedMessage('Informe início e término do DDS', options.label);
  }
  if (options.reportType === 'RDO' && fields.ddsDay && !fields.ddsDayThemes.length) {
    return scopedMessage('Adicione ao menos um tema do DDS', options.label);
  }
  if (options.reportType === 'RDO' && fields.noturno && fields.ddsNight && (!fields.ddsNightStart.trim() || !fields.ddsNightEnd.trim())) {
    return scopedMessage('Informe início e término do DDS noturno', options.label);
  }
  if (options.reportType === 'RDO' && fields.noturno && fields.ddsNight && !fields.ddsNightThemes.length) {
    return scopedMessage('Adicione ao menos um tema do DDS noturno', options.label);
  }
  return null;
}

export function buildManualReportOperationalData(
  fields: ManualReportOperationalFieldsValue,
  reportType: ReportType | string,
  options: { reportDate?: string; includeStandbyClear?: boolean } = {}
): ManualReportOperationalData | undefined {
  const arrivalTime = fields.arrivalTime.trim();
  const departureTime = fields.departureTime.trim();
  const lunchBreak = fields.lunchBreak.trim();
  const collaboratorIds = Array.from(new Set(fields.collaboratorIds));
  const hasDayData = Boolean(arrivalTime || departureTime || collaboratorIds.length);
  const shouldSendStandby = reportType === 'RDO' && (fields.standby || options.includeStandbyClear);
  if (!hasDayData && !fields.noturno && !shouldSendStandby && !options.reportDate) return undefined;

  return {
    ...(options.reportDate ? { reportDate: options.reportDate } : {}),
    ...(arrivalTime ? { arrivalTime } : {}),
    ...(departureTime ? { departureTime } : {}),
    ...(hasDayData && (arrivalTime || departureTime || lunchBreak) ? { lunchBreak: lunchBreak || '01:00:00' } : {}),
    ...(collaboratorIds.length ? { collaboratorIds } : {}),
    ...(fields.noturno
      ? {
          noturno: {
            enabled: true,
            inicio: fields.noturnoStart.trim(),
            termino: fields.noturnoEnd.trim(),
            intervalo: fields.noturnoInterval.trim() || '01:00:00',
            collaboratorIds: Array.from(new Set(fields.noturnoCollaboratorIds))
          }
        }
      : {}),
    ...(shouldSendStandby
      ? {
          standby: fields.standby
            ? {
                enabled: true,
                total: fields.standbyDuration.trim(),
                motivo: fields.standbyMotivo.trim()
              }
            : { enabled: false }
        }
      : {})
  };
}
