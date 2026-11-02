const BASE_SYMBOLS: readonly string[] = [
  'ALFA', 'BETA', 'GAMA', 'DELTA', 'OMEGA',
  'ZETA', 'THETA', 'IOTA', 'KAPPA', 'SIGMA',
  'TAU', 'PHI', 'CHI', 'PSI', 'RHO',
  'NU', 'XI', 'PI', 'ETA', 'MU',
  'LAMBDA', 'EPSILON', 'OMICRON', 'UPSILON', 'DIGAMMA',
];

/**
 * Deterministically generates `count` unique instrument symbols, in a fixed order.
 * instrumentSymbols(n)[i] always equals the same string for the same i, regardless of n
 * (as long as n > i), so a numeric instrumentId can be stably mapped to a symbol.
 * Supports count from 0 up to BASE_SYMBOLS.length * 2 (50).
 */
export function instrumentSymbols(count: number): string[] {
  const symbols: string[] = [];
  for (let i = 0; i < count; i++) {
    const base = BASE_SYMBOLS[i % BASE_SYMBOLS.length];
    const cycle = Math.floor(i / BASE_SYMBOLS.length);
    symbols.push(cycle === 0 ? base : `${base}${cycle + 1}`);
  }
  return symbols;
}
