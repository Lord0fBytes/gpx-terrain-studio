import assert from 'node:assert/strict';
import test from 'node:test';
import { generateTerrainStl } from './generate-terrain';

test('generates a millimeter STL from an injected DEM provider', async () => {
  const result = await generateTerrainStl({
    bounds: { west: 0, south: 0, east: 0.01, north: 0.01 },
    columns: 36,
    rows: 36,
    dataset: 'COP30',
    printedWidthMm: 100,
    baseThicknessMm: 3,
    verticalExaggeration: 1
  }, {
    async sampleGrid() {
      return { columns: 36, rows: 36, elevationsM: Array.from({ length: 36 * 36 }, (_, index) => 100 + index), source: 'opentopography' };
    }
  });
  assert.equal(result.terrainWidthMm, 100);
  assert.equal(result.printedWidthMm, 112);
  assert.ok(Math.abs(result.printedDepthMm - 96.9948) < 0.001);
  assert.equal(result.triangleCount, 8_820);
  assert.equal(new DataView(result.stl.buffer).getUint32(80, true), 8_820);
});

test('accepts only the documented terrain smoothing modes', async () => {
  await assert.rejects(generateTerrainStl({
    bounds: { west: 0, south: 0, east: 0.01, north: 0.01 },
    columns: 2,
    rows: 2,
    dataset: 'COP30',
    printedWidthMm: 100,
    baseThicknessMm: 3,
    verticalExaggeration: 1,
    smoothing: 'heavy' as never
  }, { async sampleGrid() { throw new Error('Provider should not be called.'); } }), /smoothing/);
});
