/** Formats integer cents as a dollar string, e.g. 10200 -> "$102.00", 4 -> "$0.04". Null -> "—". */
export function formatPriceCents(cents: number | null): string {
  if (cents === null) return '—';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainderCents = abs % 100;
  return `${sign}$${dollars}.${remainderCents.toString().padStart(2, '0')}`;
}

/** Formats a trading volume with thousands separators, e.g. 1500 -> "1,500". Always a number (0 before first trade). */
export function formatVolume(volume: number): string {
  return volume.toLocaleString('en-US');
}

/** Formats an order-book imbalance in [-1, 1] with a forced sign for positive values, e.g. 0.2 -> "+0.20", -1 -> "-1.00", 0 -> "0.00". Null -> "—". */
export function formatImbalance(value: number | null): string {
  if (value === null) return '—';
  const rounded = value.toFixed(2);
  return value > 0 ? `+${rounded}` : rounded;
}
