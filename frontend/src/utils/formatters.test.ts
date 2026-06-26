import { describe, expect, it } from 'vitest';
import {
  formatPercent,
  formatPrice,
  formatQuantity,
  formatVolume
} from './formatters';

describe('number formatters', () => {
  it('returns a dash for invalid prices', () => {
    expect(formatPrice(Infinity)).toBe(' - ');
    expect(formatPrice(-Infinity)).toBe(' - ');
    expect(formatPrice(Number.NaN)).toBe(' - ');
  });

  it('selects dynamic price decimals across thresholds', () => {
    expect(formatPrice(12345.6789)).toBe('12345.68');
    expect(formatPrice(123.456789)).toBe('123.4568');
    expect(formatPrice(1.234567)).toBe('1.2346');
    expect(formatPrice(0.01234567)).toBe('0.012346');
    expect(formatPrice(0.000123456)).toBe('0.00012346');
    expect(formatPrice(0.0000123456)).toBe('0.0000123456');
  });

  it('formats quantities with zero handling and K/M suffixes', () => {
    expect(formatQuantity(0)).toBe('0');
    expect(formatQuantity(1_250)).toBe('1.3K');
    expect(formatQuantity(2_500_000)).toBe('2.50M');
    expect(formatQuantity(0.01234567)).toBe('0.012346');
  });

  it('formats volume with B/M/K suffixes and zero fallback', () => {
    expect(formatVolume(0)).toBe(' - ');
    expect(formatVolume(999)).toBe('999');
    expect(formatVolume(12_500)).toBe('12.5K');
    expect(formatVolume(2_500_000)).toBe('2.50M');
    expect(formatVolume(3_250_000_000)).toBe('3.25B');
  });

  it('formats percent values with signs and custom decimals', () => {
    expect(formatPercent(0)).toBe('+0.00%');
    expect(formatPercent(1.2345)).toBe('+1.23%');
    expect(formatPercent(-1.2345)).toBe('-1.23%');
    expect(formatPercent(1.2345, 3)).toBe('+1.234%');
  });
});
