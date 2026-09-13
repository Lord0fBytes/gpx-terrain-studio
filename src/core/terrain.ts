import { assertPrintableSolid, type IndexedMesh, type Vec3 } from './mesh';

export interface TerrainGridInput {
  readonly widthMm: number;
  readonly depthMm: number;
  readonly columns: number;
  readonly rows: number;
  readonly samplesMm: readonly number[];
  readonly baseThicknessMm: number;
}

function assertFinitePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a finite positive number.`);
}

function pointIndex(column: number, row: number, columns: number): number {
  return row * columns + column;
}

function perimeterEdges(columns: number, rows: number): readonly [number, number][] {
  const edges: [number, number][] = [];
  for (let column = 0; column < columns - 1; column += 1) {
    edges.push([pointIndex(column, 0, columns), pointIndex(column + 1, 0, columns)]);
  }
  for (let row = 0; row < rows - 1; row += 1) {
    edges.push([pointIndex(columns - 1, row, columns), pointIndex(columns - 1, row + 1, columns)]);
  }
  for (let column = columns - 1; column > 0; column -= 1) {
    edges.push([pointIndex(column, rows - 1, columns), pointIndex(column - 1, rows - 1, columns)]);
  }
  for (let row = rows - 1; row > 0; row -= 1) {
    edges.push([pointIndex(0, row, columns), pointIndex(0, row - 1, columns)]);
  }
  return edges;
}

/** Creates a closed, right-handed terrain solid from a finite rectangular height field. */
export function buildTerrainSolid(input: TerrainGridInput): IndexedMesh {
  const { widthMm, depthMm, columns, rows, samplesMm, baseThicknessMm } = input;
  assertFinitePositive(widthMm, 'widthMm');
  assertFinitePositive(depthMm, 'depthMm');
  assertFinitePositive(baseThicknessMm, 'baseThicknessMm');
  if (!Number.isInteger(columns) || columns < 2) throw new Error('columns must be an integer of at least two.');
  if (!Number.isInteger(rows) || rows < 2) throw new Error('rows must be an integer of at least two.');
  if (samplesMm.length !== columns * rows) throw new Error('samplesMm must contain one value per grid point.');
  if (samplesMm.some((sample) => !Number.isFinite(sample))) throw new Error('samplesMm must contain only finite values.');

  const minimumSample = Math.min(...samplesMm);
  const pointCount = columns * rows;
  const positions: Vec3[] = [];
  const indices: number[] = [];

  for (let row = 0; row < rows; row += 1) {
    const y = -depthMm / 2 + (depthMm * row) / (rows - 1);
    for (let column = 0; column < columns; column += 1) {
      const x = -widthMm / 2 + (widthMm * column) / (columns - 1);
      const sample = samplesMm[pointIndex(column, row, columns)]!;
      positions.push({ x, y, z: baseThicknessMm + sample - minimumSample });
    }
  }
  for (let row = 0; row < rows; row += 1) {
    const y = -depthMm / 2 + (depthMm * row) / (rows - 1);
    for (let column = 0; column < columns; column += 1) {
      const x = -widthMm / 2 + (widthMm * column) / (columns - 1);
      positions.push({ x, y, z: 0 });
    }
  }

  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const a = pointIndex(column, row, columns);
      const b = pointIndex(column + 1, row, columns);
      const c = pointIndex(column, row + 1, columns);
      const d = pointIndex(column + 1, row + 1, columns);
      indices.push(a, b, c, b, d, c);
      indices.push(pointCount + a, pointCount + c, pointCount + b, pointCount + b, pointCount + c, pointCount + d);
    }
  }

  for (const [from, to] of perimeterEdges(columns, rows)) {
    indices.push(from, pointCount + to, to, from, pointCount + from, pointCount + to);
  }

  const mesh = { positions, indices };
  assertPrintableSolid(mesh);
  return mesh;
}
