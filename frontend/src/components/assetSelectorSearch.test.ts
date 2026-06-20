import assert from 'node:assert/strict';
import test from 'node:test';
import { getAssetSearchScore } from './assetSelectorSearch.ts';

const assets = {
  bitcoin: { symbol: 'BTC', name: 'Bitcoin' },
  ethereum: { symbol: 'ETH', name: 'Ethereum' },
  microStrategy: { symbol: 'MSTR', name: 'MicroStrategy Incorporated' },
};

test('exact symbol matches keep the highest priority', () => {
  assert.equal(getAssetSearchScore(assets.bitcoin, 'BTC'), 100);
  assert.ok(getAssetSearchScore(assets.bitcoin, 'BTC') > getAssetSearchScore(assets.bitcoin, 'BT'));
});

test('symbol prefixes outrank symbol typo matches', () => {
  assert.equal(getAssetSearchScore(assets.bitcoin, 'BT'), 80);
  assert.ok(getAssetSearchScore(assets.bitcoin, 'BTX') > 0);
  assert.ok(getAssetSearchScore(assets.bitcoin, 'BT') > getAssetSearchScore(assets.bitcoin, 'BTX'));
});

test('common asset-name typos still find the intended asset', () => {
  assert.ok(getAssetSearchScore(assets.bitcoin, 'Bitocin') > 0);
  assert.ok(getAssetSearchScore(assets.ethereum, 'Etherum') > 0);
});

test('partial word queries match compacted asset names', () => {
  assert.equal(getAssetSearchScore(assets.microStrategy, 'micro strat'), 40);
});

test('very short unrelated queries do not introduce broad typo matches', () => {
  assert.equal(getAssetSearchScore(assets.ethereum, 'bt'), 0);
  assert.equal(getAssetSearchScore(assets.ethereum, 'bth'), 0);
  assert.equal(getAssetSearchScore(assets.microStrategy, 'zz'), 0);
});
