import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeMesh, meshBounds } from './mesh';
import { buildHexTerrainSolid } from './hex-terrain';

test('builds a watertight regular flat-top hexagonal terrain solid', () => {
  const mesh = buildHexTerrainSolid({
    widthMm: 40,
    columns: 4,
    rows: 4,
    elevationsM: Array.from({ length: 16 }, () => 100),
    baseThicknessMm: 3,
    elevationToModelMm: (elevation) => elevation
  });
  const bounds = meshBounds(mesh);
  assert.equal(bounds.min.x, -20);
  assert.equal(bounds.max.x, 20);
  assert.ok(Math.abs(bounds.min.y + Math.sqrt(3) * 10) < 1e-9);
  assert.ok(Math.abs(bounds.max.y - Math.sqrt(3) * 10) < 1e-9);
  assert.equal(bounds.min.z, 0);
  assert.equal(bounds.max.z, 3);
  const analysis = analyzeMesh(mesh);
  assert.equal(analysis.boundaryEdges, 0);
  assert.equal(analysis.nonManifoldEdges, 0);
  assert.equal(analysis.connectedComponents, 1);
  assert.ok(analysis.signedVolumeMm3 > 0);
});

test('preserves terrain relief while keeping the hexagonal base flat', () => {
  const mesh = buildHexTerrainSolid({
    widthMm: 40,
    columns: 4,
    rows: 4,
    elevationsM: Array.from({ length: 16 }, (_, index) => index),
    baseThicknessMm: 2,
    elevationToModelMm: (elevation) => elevation / 2
  });
  const bounds = meshBounds(mesh);
  assert.equal(bounds.min.z, 0);
  assert.equal(Math.min(...mesh.positions.filter((point) => point.z > 0).map((point) => point.z)), 2);
  assert.ok(bounds.max.z > 2);
});

test('uses the full limiting DEM grid edge for hex surface detail', () => {
  const mesh = buildHexTerrainSolid({
    widthMm: 40,
    columns: 4,
    rows: 6,
    elevationsM: Array.from({ length: 24 }, (_, index) => index),
    baseThicknessMm: 2,
    elevationToModelMm: (elevation) => elevation
  });
  // Six sectors × three squared subdivisions, with matching bottom and side walls.
  assert.equal(mesh.indices.length / 3, 144);
});

test('rejects invalid hex terrain input', () => {
  assert.throws(() => buildHexTerrainSolid({
    widthMm: 40,
    columns: 2,
    rows: 2,
    elevationsM: [1, 2, 3],
    baseThicknessMm: 3,
    elevationToModelMm: (elevation) => elevation
  }), /elevationsM/);
});
