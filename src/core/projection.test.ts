import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalProjection } from './projection';

test('projects the origin to zero and uses east/north meters', () => {
  const projection = createLocalProjection({ latitude: 0, longitude: 0 });
  assert.deepEqual(projection.project({ latitude: 0, longitude: 0 }), { x: 0, y: 0 });
  const east = projection.project({ latitude: 0, longitude: 0.001 });
  const north = projection.project({ latitude: 0.001, longitude: 0 });
  assert.ok(Math.abs(east.x - 111.319) < 0.01);
  assert.ok(Math.abs(east.y) < 0.01);
  assert.ok(Math.abs(north.y - 110.574) < 0.01);
  assert.ok(Math.abs(north.x) < 0.01);
});

test('rejects invalid geographic coordinates', () => {
  assert.throws(() => createLocalProjection({ latitude: 91, longitude: 0 }), /Latitude/);
});
