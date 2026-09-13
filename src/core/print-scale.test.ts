import assert from 'node:assert/strict';
import test from 'node:test';
import { derivePrintScale, elevationToModelMm } from './print-scale';

test('changes printed dimensions without changing the geographic selection aspect ratio', () => {
  assert.deepEqual(derivePrintScale({ selectionWidthM: 2400, selectionDepthM: 1800, printedWidthMm: 160 }), {
    horizontalModelScaleMmPerM: 1 / 15,
    printedWidthMm: 160,
    printedDepthMm: 120
  });
});

test('converts elevation using the documented scale and exaggeration formula', () => {
  assert.equal(elevationToModelMm(1250, 1200, 0.1, 1.5), 7.5);
});

test('rejects invalid physical scale inputs', () => {
  assert.throws(() => derivePrintScale({ selectionWidthM: 0, selectionDepthM: 1, printedWidthMm: 1 }), /selectionWidthM/);
  assert.throws(() => elevationToModelMm(1, 0, 0.1, 0), /verticalExaggeration/);
});
