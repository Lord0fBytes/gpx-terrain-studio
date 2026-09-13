import assert from 'node:assert/strict';
import test from 'node:test';
import { applyLightTerrainSmoothing } from './smoothing';

test('applies exactly one 3 by 3 smoothing pass without changing grid dimensions', () => {
  const smoothed = applyLightTerrainSmoothing([1, 2, 3, 4, 5, 6, 7, 8, 9], 3, 3);
  assert.deepEqual(smoothed, [3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7]);
});

test('rejects missing or non-finite DEM cells instead of inventing terrain', () => {
  assert.throws(() => applyLightTerrainSmoothing([1, 2, 3], 2, 2), /one finite elevation/);
  assert.throws(() => applyLightTerrainSmoothing([1, 2, 3, Number.NaN], 2, 2), /one finite elevation/);
});
