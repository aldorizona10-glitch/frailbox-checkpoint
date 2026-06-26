import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatPercent,
  formatPrice,
  formatQuantity,
  formatVolume,
} from '../src/utils/formatters.js';

describe('number formatters', () => {
  it('formats non-finite prices as a dash fallback', () => {
    assert.equal(formatPrice(Infinity), ' - ');
    assert.equal(formatPrice(Number.NaN), ' - ');
  });

  it('selects price decimals from the documented magnitude thresholds', () => {
    assert.equal(formatPrice(12_345.6789), '12345.68');
    assert.equal(formatPrice(123.456789), '123.4568');
    assert.equal(formatPrice(1.23456789), '1.2346');
    assert.equal(formatPrice(0.0123456789), '0.012346');
    assert.equal(formatPrice(0.000123456789), '0.00012346');
    assert.equal(formatPrice(0.0000123456789), '0.0000123457');
  });

  it('formats quantity suffixes and zero handling', () => {
    assert.equal(formatQuantity(0), '0');
    assert.equal(formatQuantity(1_500), '1.5K');
    assert.equal(formatQuantity(2_500_000), '2.50M');
    assert.equal(formatQuantity(Number.POSITIVE_INFINITY), ' - ');
  });

  it('formats volume suffixes and zero fallback', () => {
    assert.equal(formatVolume(0), ' - ');
    assert.equal(formatVolume(950), '950');
    assert.equal(formatVolume(12_500), '12.5K');
    assert.equal(formatVolume(3_250_000), '3.25M');
    assert.equal(formatVolume(4_500_000_000), '4.50B');
  });

  it('formats percent signs with positive, negative, and zero sign prefixes', () => {
    assert.equal(formatPercent(1.234), '+1.23%');
    assert.equal(formatPercent(-1.234), '-1.23%');
    assert.equal(formatPercent(0), '+0.00%');
  });
});
