import { formatImbalance, formatPriceCents, formatVolume } from './formatters';

describe('formatPriceCents', () => {
  it('formats whole-dollar and fractional cents amounts', () => {
    expect(formatPriceCents(10200)).toBe('$102.00');
    expect(formatPriceCents(10150)).toBe('$101.50');
  });

  it('pads sub-dollar amounts to two decimal places', () => {
    expect(formatPriceCents(4)).toBe('$0.04');
    expect(formatPriceCents(0)).toBe('$0.00');
  });

  it('returns an em dash for null', () => {
    expect(formatPriceCents(null)).toBe('—');
  });
});

describe('formatVolume', () => {
  it('formats volumes with thousands separators', () => {
    expect(formatVolume(0)).toBe('0');
    expect(formatVolume(40)).toBe('40');
    expect(formatVolume(1500)).toBe('1,500');
  });
});

describe('formatImbalance', () => {
  it('forces a sign on positive values and keeps negatives as-is', () => {
    expect(formatImbalance(-1)).toBe('-1.00');
    expect(formatImbalance(0)).toBe('0.00');
    expect(formatImbalance(0.2)).toBe('+0.20');
    expect(formatImbalance(1)).toBe('+1.00');
  });

  it('returns an em dash for null', () => {
    expect(formatImbalance(null)).toBe('—');
  });
});
