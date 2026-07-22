export type SedePeriodType = 'all' | 'month' | 'quarter' | 'semester' | 'year' | 'custom';

export interface SedePeriodRange {
  from: string;
  to: string;
}

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
];

const MONTH_SHORT_NAMES = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez'
];

export const SEDE_MONTH_OPTIONS = MONTH_NAMES.map((label, index) => ({
  value: String(index + 1).padStart(2, '0'),
  label
}));

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function monthNumber(monthKey: string) {
  return Number(monthKey.slice(5, 7));
}

function yearNumber(monthKey: string) {
  return Number(monthKey.slice(0, 4));
}

function monthKey(year: number | string, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeSedeAvailableMonths(availableMonths: string[]) {
  return [...new Set(availableMonths.filter(month => MONTH_PATTERN.test(month)))].sort();
}

export function currentSedeDate() {
  return dateKey(new Date());
}

export function currentSedeMonth() {
  return currentSedeDate().slice(0, 7);
}

export function yearFromMonth(month: string) {
  return String(yearNumber(month));
}

export function quarterFromMonth(month: string) {
  return String(Math.floor((monthNumber(month) - 1) / 3) + 1);
}

export function semesterFromMonth(month: string) {
  return monthNumber(month) <= 6 ? '1' : '2';
}

export function formatSedeMonthLabel(month: string) {
  return `${MONTH_NAMES[monthNumber(month) - 1]}/${yearNumber(month)}`;
}

export function formatSedeShortMonthLabel(month: string) {
  return `${MONTH_SHORT_NAMES[monthNumber(month) - 1]}/${yearNumber(month)}`;
}

export function formatSedeQuarterLabel(year: string, quarter: string) {
  return `${quarter}º trimestre ${year}`;
}

export function formatSedeSemesterLabel(year: string, semester: string) {
  return `${semester}º semestre ${year}`;
}

export function formatSedeCustomRangeLabel(from: string, to: string) {
  return from === to ? formatSedeMonthLabel(from) : `${formatSedeShortMonthLabel(from)} – ${formatSedeShortMonthLabel(to)}`;
}

export function sedeMonthRange(month: string): SedePeriodRange | null {
  return MONTH_PATTERN.test(month) ? { from: month, to: month } : null;
}

export function sedeMonthRangeFromParts(year: string, month: string): SedePeriodRange | null {
  return sedeMonthRange(`${year}-${month}`);
}

export function sedeQuarterRange(year: string, quarter: string): SedePeriodRange | null {
  const quarterNumber = Number(quarter);
  if (!/^\d{4}$/.test(year) || !Number.isInteger(quarterNumber) || quarterNumber < 1 || quarterNumber > 4) return null;
  const startMonth = (quarterNumber - 1) * 3 + 1;
  return {
    from: monthKey(year, startMonth),
    to: monthKey(year, startMonth + 2)
  };
}

export function sedeSemesterRange(year: string, semester: string): SedePeriodRange | null {
  const semesterNumber = Number(semester);
  if (!/^\d{4}$/.test(year) || !Number.isInteger(semesterNumber) || semesterNumber < 1 || semesterNumber > 2) return null;
  const startMonth = semesterNumber === 1 ? 1 : 7;
  return {
    from: monthKey(year, startMonth),
    to: monthKey(year, startMonth + 5)
  };
}

export function sedeYearRange(year: string): SedePeriodRange | null {
  if (!/^\d{4}$/.test(year)) return null;
  return {
    from: monthKey(year, 1),
    to: monthKey(year, 12)
  };
}

export function sedeCustomRange(from: string, to: string): SedePeriodRange | null {
  if (!MONTH_PATTERN.test(from) || !MONTH_PATTERN.test(to) || to < from) return null;
  return { from, to };
}

export function sedeCustomDateRange(fromDate: string, toDate: string): SedePeriodRange | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate) || toDate < fromDate) return null;
  return sedeCustomRange(fromDate.slice(0, 7), toDate.slice(0, 7));
}
