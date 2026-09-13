import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeMesh, assertPrintableSolid, meshBounds } from './mesh';
import { encodeBinaryStl } from './stl';
import { buildTerrainSolid } from './terrain';

test('builds a closed solid with the intended flat base and planar dimensions', () => {
  const mesh = buildTerrainSolid({
    widthMm: 40,
    depthMm: 20,
    columns: 3,
    rows: 3,
    samplesMm: [100, 100, 100, 100, 100, 100, 100, 100, 100],
    baseThicknessMm: 3
  });
  const analysis = analyzeMesh(mesh);
  const bounds = meshBounds(mesh);

  assert.deepEqual(analysis, {
    triangleCount: 32,
    boundaryEdges: 0,
    nonManifoldEdges: 0,
    inconsistentWindingEdges: 0,
    connectedComponents: 1,
    degenerateTriangles: 0,
    nonFiniteVertices: 0,
    signedVolumeMm3: 2400
  });
  assert.deepEqual(bounds, { min: { x: -20, y: -10, z: 0 }, max: { x: 20, y: 10, z: 3 } });
});

test('rejects disconnected solids even when each component is individually closed', () => {
  const tetrahedron = (offsetX: number) => [
    { x: offsetX, y: 0, z: 0 }, { x: offsetX + 1, y: 0, z: 0 },
    { x: offsetX, y: 1, z: 0 }, { x: offsetX, y: 0, z: 1 }
  ];
  assert.throws(() => assertPrintableSolid({
    positions: [...tetrahedron(0), ...tetrahedron(3)],
    indices: [0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3, 4, 6, 5, 4, 5, 7, 5, 6, 7, 6, 4, 7]
  }), /single connected/);
});

test('normalizes a sloped field to preserve base thickness while retaining relief', () => {
  const mesh = buildTerrainSolid({
    widthMm: 40,
    depthMm: 20,
    columns: 2,
    rows: 2,
    samplesMm: [24, 26, 30, 34],
    baseThicknessMm: 2
  });
  const bounds = meshBounds(mesh);
  assert.deepEqual(bounds, { min: { x: -20, y: -10, z: 0 }, max: { x: 20, y: 10, z: 12 } });
  assert.equal(analyzeMesh(mesh).boundaryEdges, 0);
});

test('rejects invalid grid data instead of emitting an unprintable mesh', () => {
  assert.throws(() => buildTerrainSolid({
    widthMm: 40,
    depthMm: 20,
    columns: 2,
    rows: 2,
    samplesMm: [0, 1, Number.NaN, 3],
    baseThicknessMm: 2
  }), /finite/);
});

test('writes a binary STL with one record per terrain triangle', () => {
  const mesh = buildTerrainSolid({
    widthMm: 20,
    depthMm: 20,
    columns: 2,
    rows: 2,
    samplesMm: [0, 0, 0, 0],
    baseThicknessMm: 2
  });
  const stl = encodeBinaryStl(mesh);
  assert.equal(new DataView(stl.buffer).getUint32(80, true), 12);
  assert.equal(stl.byteLength, 84 + 12 * 50);
});
