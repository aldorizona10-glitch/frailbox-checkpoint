import { describe, it, expect } from 'vitest';
import {
  formatPrice,
  formatQuantity,
  formatVolume,
  formatPercent,
} from './formatters';

describe('formatPrice', () => {
  it('returns dash for Infinity', () => {
    expect(formatPrice(Infinity)).toBe(' - ');
  });

  it('returns dash for NaN', () => {
    expect(formatPrice(NaN)).toBe(' - ');
  });

  it('uses 2 decimals for values >= 10000', () => {
    expect(formatPrice(50000)).toBe('50000.00');
  });

  it('uses 4 decimals for values >= 100', () => {
    expect(formatPrice(123.45)).toBe('123.4500');
  });

  it('uses 4 decimals for values >= 1', () => {
    expect(formatPrice(5.5)).toBe('5.5000');
  });

  it('uses 6 decimals for values >= 0.01', () => {
    expect(formatPrice(0.05)).toBe('0.050000');
  });

  it('uses 8 decimals for values >= 0.0001', () => {
    expect(formatPrice(0.0005)).toBe('0.00050000');
  });

  it('uses 10 decimals for very small values < 0.0001', () => {
    expect(formatPrice(0.00001)).toBe('0.0000100000');
  });
});

describe('formatQuantity', () => {
  it('returns dash for Infinity', () => {
    expect(formatQuantity(Infinity)).toBe(' - ');
  });

  it('returns 0 for zero', () => {
    expect(formatQuantity(0)).toBe('0');
  });

  it('formats millions with M suffix', () => {
    expect(formatQuantity(2500000)).toBe('2.50M');
  });

  it('formats thousands with K suffix', () => {
    expect(formatQuantity(5500)).toBe('5.5K');
  });

  it('formats small decimals', () => {
    expect(formatQuantity(0.5)).toBe('0.5000');
  });
});

describe('formatVolume', () => {
  it('returns dash for Infinity', () => {
    expect(formatVolume(Infinity)).toBe(' - ');
  });

  it('returns dash for zero', () => {
    expect(formatVolume(0)).toBe(' - ');
  });

  it('formats billions with B suffix', () => {
    expect(formatVolume(1_500_000_000)).toBe('1.50B');
  });

  it('formats millions with M suffix', () => {
    expect(formatVolume(5_000_000)).toBe('5.00M');
  });

  it('formats thousands with K suffix', () => {
    expect(formatVolume(12_000)).toBe('12.0K');
  });

  it('formats small numbers without suffix', () => {
    expect(formatVolume(999)).toBe('999');
  });
});

describe('formatPercent', () => {
  it('returns dash for Infinity', () => {
    expect(formatPercent(Infinity)).toBe(' - ');
  });

  it('formats positive value with + sign', () => {
    expect(formatPercent(3.5)).toBe('+3.50%');
  });

  it('formats negative value with - sign', () => {
    expect(formatPercent(-2.1)).toBe('-2.10%');
  });

  it('formats zero with + sign', () => {
    expect(formatPercent(0)).toBe('+0.00%');
  });

  it('respects custom decimals', () => {
    expect(formatPercent(1.2345, 4)).toBe('+1.2345%');
  });
});
