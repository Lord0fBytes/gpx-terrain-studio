import assert from 'node:assert/strict';
import test from 'node:test';
import { regularFlatTopHexagon } from './hex-footprint';
import { clipSegmentToConvexPolygon, createRaisedRouteOffset } from './route';

test('clips an edge-crossing route segment to the shared hexagonal footprint', () => {
  const clipped = clipSegmentToConvexPolygon({ x: -30, y: 0 }, { x: 30, y: 0 }, regularFlatTopHexagon(40));
  assert.ok(clipped);
  assert.ok(Math.abs(clipped[0].x + 20) < 1e-9);
  assert.equal(clipped[0].y, 0);
  assert.equal(clipped[1].x, 20);
  assert.equal(clipped[1].y, 0);
});

test('raises only clipped route segments and never bridges GPX gaps', () => {
  const offset = createRaisedRouteOffset([{ points: [{ x: -30, y: 0 }, { x: 30, y: 0 }] }], { widthMm: 4, heightMm: 1, edgeTransitionMm: 1 }, regularFlatTopHexagon(40));
  assert.equal(offset.offsetAt({ x: 0, y: 0 }), 1);
  assert.equal(offset.offsetAt({ x: 0, y: 1.5 }), 0.5);
  assert.equal(offset.offsetAt({ x: 0, y: 3 }), 0);
  assert.equal(offset.clippedSegmentCount, 1);
  assert.equal(offset.omittedSegmentCount, 0);
});
