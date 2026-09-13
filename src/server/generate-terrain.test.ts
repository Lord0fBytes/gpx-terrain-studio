import assert from 'node:assert/strict';
import test from 'node:test';
import { generateTerrainStl } from './generate-terrain';

test('generates a millimeter STL from an injected DEM provider', async () => {
  const result = await generateTerrainStl({
    bounds: { west: 0, south: 0, east: 0.01, north: 0.01 },
    columns: 2,
    rows: 2,
    dataset: 'COP30',
    printedWidthMm: 100,
    baseThicknessMm: 3,
    verticalExaggeration: 1
  }, {
    async sampleGrid() {
      return { columns: 2, rows: 2, elevationsM: [100, 110, 120, 130], source: 'opentopography' };
    }
  });
  assert.equal(result.printedWidthMm, 100);
  assert.ok(Math.abs(result.printedDepthMm - 86.6025) < 0.001);
  assert.equal(result.triangleCount, 24);
  assert.equal(new DataView(result.stl.buffer).getUint32(80, true), 24);
});
