const RATES = {
  USD: { symbol: '$', rate: 1 },
  CNY: { symbol: '¥', rate: 6.8 },
  TWD: { symbol: 'NT$', rate: 31.5 },
  HKD: { symbol: 'HK$', rate: 7.8 }
};

export function formatNumber(value) {
  return Math.round(Number(value || 0)).toLocaleString('en-US');
}

export function formatCompact(value) {
  const n = Math.round(Number(value || 0));
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return formatNumber(n);
}

export function formatCost(value, currency = 'USD') {
  const code = RATES[currency] ? currency : 'USD';
  const amount = Number(value || 0) * RATES[code].rate;
  const digits = code === 'USD'
    ? (Math.abs(amount) >= 10 ? 2 : 4)
    : (Math.abs(amount) >= 1 ? 2 : 4);
  return `${RATES[code].symbol}${amount.toFixed(digits)}`;
}

export function formatRelative(iso, locale = 'en') {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return '—';
  const delta = Date.now() - ts;
  const abs = Math.abs(delta);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (abs < 60_000) return rtf.format(-Math.round(delta / 1000), 'second');
  if (abs < 3_600_000) return rtf.format(-Math.round(delta / 60_000), 'minute');
  if (abs < 86_400_000) return rtf.format(-Math.round(delta / 3_600_000), 'hour');
  return rtf.format(-Math.round(delta / 86_400_000), 'day');
}

export function formatReset(iso, locale = 'en') {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function toDatetimeLocalValue(date = new Date()) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
