import { formatPrice, formatQuantity, formatVolume, formatPercent } from './formatters.js';
import assert from 'assert';

// formatPrice tests
function testFormatPrice() {
    // Infinity and NaN
    assert.strictEqual(formatPrice(Infinity), ' - ');
    assert.strictEqual(formatPrice(NaN), ' - ');
    // Thresholds
    assert.strictEqual(formatPrice(10000), '10000.00'); // decimals=2
    assert.strictEqual(formatPrice(100), '100.0000'); // decimals=4
    assert.strictEqual(formatPrice(1), '1.0000');
    assert.strictEqual(formatPrice(0.1), '0.100000'); // >=0.01 -> 6
    assert.strictEqual(formatPrice(0.00005), '0.0000000000'); // <0.0001 -> 10
    console.log('[formatPrice] passed');
}

// formatQuantity tests
function testFormatQuantity() {
    assert.strictEqual(formatQuantity(Infinity), ' - ');
    assert.strictEqual(formatQuantity(NaN), ' - ');
    assert.strictEqual(formatQuantity(0), '0');
    assert.strictEqual(formatQuantity(1500000), '1.50M'); // >=1M
    assert.strictEqual(formatQuantity(1500), '1.5K'); // >=1K
    assert.strictEqual(formatQuantity(100), '100.0000'); // between 1 and 1000
    assert.strictEqual(formatQuantity(0.5), '0.500000'); // between 0.01 and 1
    assert.strictEqual(formatQuantity(0.00005), '0.0000000000'); // <0.0001 -> 10
    console.log('[formatQuantity] passed');
}

// formatVolume tests
function testFormatVolume() {
    assert.strictEqual(formatVolume(Infinity), ' - ');
    assert.strictEqual(formatVolume(NaN), ' - ');
    assert.strictEqual(formatVolume(0), ' - ');
    assert.strictEqual(formatVolume(1_500_000_000), '1.50B');
    assert.strictEqual(formatVolume(1_500_000), '1.50M');
    assert.strictEqual(formatVolume(1500), '1.5K');
    assert.strictEqual(formatVolume(123), '123');
    console.log('[formatVolume] passed');
}

// formatPercent tests
function testFormatPercent() {
    assert.strictEqual(formatPercent(Infinity), ' - ');
    assert.strictEqual(formatPercent(NaN), ' - ');
    assert.strictEqual(formatPercent(0), '+0.00%');
    assert.strictEqual(formatPercent(1.234), '+1.23%');
    assert.strictEqual(formatPercent(-0.567), '-0.57%');
    console.log('[formatPercent] passed');
}

// Run all
testFormatPrice();
testFormatQuantity();
testFormatVolume();
testFormatPercent();
console.log('All formatter tests passed');
