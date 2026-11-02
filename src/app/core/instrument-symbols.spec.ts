import { instrumentSymbols } from './instrument-symbols';

describe('instrumentSymbols', () => {
  it('returns an empty array for count 0', () => {
    expect(instrumentSymbols(0)).toEqual([]);
  });

  it('returns the first five base symbols in fixed order for count 5', () => {
    expect(instrumentSymbols(5)).toEqual(['ALFA', 'BETA', 'GAMA', 'DELTA', 'OMEGA']);
  });

  it('returns 50 unique symbols for count 50', () => {
    const result = instrumentSymbols(50);
    expect(result.length).toBe(50);
    expect(new Set(result).size).toBe(50);
  });

  it('keeps the same symbol for index 0 across different counts (stability across count)', () => {
    expect(instrumentSymbols(1)[0]).toBe(instrumentSymbols(10)[0]);
    expect(instrumentSymbols(10)[0]).toBe(instrumentSymbols(50)[0]);
  });

  it('is deterministic for the same count', () => {
    expect(instrumentSymbols(25)).toEqual(instrumentSymbols(25));
  });

  it('cycles past the base list with a numeric suffix', () => {
    expect(instrumentSymbols(26)[25]).toBe('ALFA2');
  });
});
