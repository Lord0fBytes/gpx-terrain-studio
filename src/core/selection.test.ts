import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveRouteSelection } from './selection';

const segments = [{
  source: 'track' as const,
  points: [
    { latitude: 0, longitude: 0 },
    { latitude: 0.001, longitude: 0.002 }
  ]
}];

test('derives a metric footprint from route bounds plus explicit context', () => {
  const selection = deriveRouteSelection(segments, {
    contextMarginRatio: 0.2,
    minimumWidthM: 50,
    minimumDepthM: 50
  });
  assert.ok(selection.widthM > 311 && selection.widthM < 312);
  assert.ok(selection.depthM > 269 && selection.depthM < 270);
  assert.ok(Math.abs(selection.center.x) < 1e-6);
  assert.ok(Math.abs(selection.center.y) < 1e-6);
  assert.ok(selection.geographicBounds.west < 0);
  assert.ok(selection.geographicBounds.east > 0.002);
  assert.equal(selection.polygon.length, 6);
});

test('uses the smallest hexagon that contains the padded route dimensions', () => {
  const selection = deriveRouteSelection([{ source: 'route', points: [{ latitude: 10, longitude: 10 }, { latitude: 10, longitude: 10.001 }] }], {
    contextMarginRatio: 0.25,
    minimumWidthM: 20,
    minimumDepthM: 80
  });
  assert.ok(selection.depthM > 142 && selection.depthM < 143);
  assert.ok(selection.widthM > 160);
});

test('rejects an empty route and unspecified constraints', () => {
  assert.throws(() => deriveRouteSelection([], { contextMarginRatio: 0.1, minimumWidthM: 1, minimumDepthM: 1 }), /without GPX points/);
  assert.throws(() => deriveRouteSelection(segments, { contextMarginRatio: -1, minimumWidthM: 1, minimumDepthM: 1 }), /contextMarginRatio/);
});
