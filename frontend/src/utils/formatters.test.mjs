import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = resolve(__dirname, 'formatters.ts');
const outfile = resolve(__dirname, 'formatters.test.tmp.mjs');

await esbuild.build({
  entryPoints: [source],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  sourcemap: false,
  logLevel: 'silent',
});

try {
  const {
    formatPrice,
    formatQuantity,
    formatVolume,
    formatPercent,
  } = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);

  const tests = [];
  const test = (name, fn) => tests.push({ name, fn });

  test('formatPrice returns dash for non-finite values and preserves zero', () => {
    assert.equal(formatPrice(Infinity), ' - ');
    assert.equal(formatPrice(-Infinity), ' - ');
    assert.equal(formatPrice(Number.NaN), ' - ');
    assert.equal(formatPrice(0), '0.0000000000');
  });

  test('formatPrice applies dynamic decimal thresholds', () => {
    assert.equal(formatPrice(10000), '10000.00');
    assert.equal(formatPrice(100), '100.0000');
    assert.equal(formatPrice(1), '1.0000');
    assert.equal(formatPrice(0.01), '0.010000');
    assert.equal(formatPrice(0.0001), '0.00010000');
    assert.equal(formatPrice(0.00001), '0.0000100000');
  });

  test('formatQuantity applies K and M suffixes and zero handling', () => {
    assert.equal(formatQuantity(0), '0');
    assert.equal(formatQuantity(1_250), '1.3K');
    assert.equal(formatQuantity(2_500_000), '2.50M');
    assert.equal(formatQuantity(-1_250), '-1.3K');
  });

  test('formatVolume applies B, M, and K suffixes and hides zero', () => {
    assert.equal(formatVolume(0), ' - ');
    assert.equal(formatVolume(999), '999');
    assert.equal(formatVolume(1_250), '1.3K');
    assert.equal(formatVolume(2_500_000), '2.50M');
    assert.equal(formatVolume(3_750_000_000), '3.75B');
  });

  test('formatPercent includes sign prefixes, percent suffix, and zero sign', () => {
    assert.equal(formatPercent(1.234), '+1.23%');
    assert.equal(formatPercent(-1.234), '-1.23%');
    assert.equal(formatPercent(0), '+0.00%');
    assert.equal(formatPercent(Number.NaN), ' - ');
  });

  for (const { name, fn } of tests) {
    fn();
    console.log(`ok - ${name}`);
  }
  console.log(`${tests.length} formatter edge-case tests passed`);
} finally {
  await import('node:fs/promises').then(fs => fs.rm(outfile, { force: true }));
}
