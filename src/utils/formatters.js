import { format, parse, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

// Parse Argentine money string like "$1.234.567,89" or "1234567.89" → number
export function parseArgMoney(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  const str = String(value)
    .replace(/\$/g, '')
    .trim();
  // Format: 1.234.567,89
  if (str.includes(',')) {
    return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
  }
  return parseFloat(str.replace(/\./g, '')) || 0;
}

// Format number as Argentine peso: 1234567.89 → "$1.234.567,89"
export function formatARS(value, compact = false) {
  const num = typeof value === 'number' ? value : parseArgMoney(value);
  if (isNaN(num)) return '$0';
  if (compact && Math.abs(num) >= 1_000_000) {
    return '$' + (num / 1_000_000).toFixed(1).replace('.', ',') + 'M';
  }
  if (compact && Math.abs(num) >= 1_000) {
    return '$' + (num / 1_000).toFixed(0) + 'k';
  }
  return '$' + num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Format percent
export function formatPct(value) {
  const num = typeof value === 'number' ? value : parseArgMoney(value);
  if (isNaN(num)) return '0%';
  return num.toFixed(1).replace('.', ',') + '%';
}

// Parse "dd/MM/yyyy" string → Date object
export function parseDate(str) {
  if (!str) return null;
  try {
    const d = parse(str, 'dd/MM/yyyy', new Date());
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
}

// Format Date → "dd/MM/yyyy"
export function formatDate(date) {
  if (!date) return '';
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (!isValid(d)) return String(date);
    return format(d, 'dd/MM/yyyy');
  } catch {
    return String(date);
  }
}

// Format Date → "enero 2026"
export function formatMonthYear(date) {
  if (!date) return '';
  return format(date, 'MMMM yyyy', { locale: es });
}

// Days between two dates (positive = overdue)
export function daysDiff(from, to = new Date()) {
  if (!from) return null;
  const d = from instanceof Date ? from : parseDate(from);
  if (!d) return null;
  return Math.floor((to - d) / (1000 * 60 * 60 * 24));
}

export const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
