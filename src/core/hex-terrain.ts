import { assertPrintableSolid, type IndexedMesh, type Vec3 } from './mesh';
import { regularFlatTopHexagon } from './hex-footprint';

export interface HexTerrainInput {
  readonly widthMm: number;
  readonly columns: number;
  readonly rows: number;
  /** Elevation samples in meters, ordered from the south row to the north row. */
  readonly elevationsM: readonly number[];
  readonly baseThicknessMm: number;
  readonly elevationToModelMm: (elevationM: number) => number;
  readonly surfaceOffsetMm?: (point: Readonly<{ x: number; y: number }>) => number;
}

function finitePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a finite positive number.`);
}

function sampleBilinear(input: HexTerrainInput, xMm: number, yMm: number, depthMm: number): number {
  const u = Math.max(0, Math.min(input.columns - 1, ((xMm / input.widthMm) + 0.5) * (input.columns - 1)));
  const v = Math.max(0, Math.min(input.rows - 1, ((yMm / depthMm) + 0.5) * (input.rows - 1)));
  const left = Math.floor(u);
  const right = Math.min(left + 1, input.columns - 1);
  const south = Math.floor(v);
  const north = Math.min(south + 1, input.rows - 1);
  const xFraction = u - left;
  const yFraction = v - south;
  const elevation = (column: number, row: number) => input.elevationsM[row * input.columns + column];
  const southValue = elevation(left, south) * (1 - xFraction) + elevation(right, south) * xFraction;
  const northValue = elevation(left, north) * (1 - xFraction) + elevation(right, north) * xFraction;
  return southValue * (1 - yFraction) + northValue * yFraction;
}

/** Builds a closed, regular flat-top hexagonal terrain solid in millimeters. */
export function buildHexTerrainSolid(input: HexTerrainInput): IndexedMesh {
  finitePositive(input.widthMm, 'widthMm');
  finitePositive(input.baseThicknessMm, 'baseThicknessMm');
  if (!Number.isInteger(input.columns) || input.columns < 2) throw new Error('columns must be an integer of at least 2.');
  if (!Number.isInteger(input.rows) || input.rows < 2) throw new Error('rows must be an integer of at least 2.');
  if (input.elevationsM.length !== input.columns * input.rows || input.elevationsM.some((value) => !Number.isFinite(value))) {
    throw new Error('elevationsM must contain one finite value for every DEM cell.');
  }

  const circumradiusMm = input.widthMm / 2;
  const depthMm = Math.sqrt(3) * circumradiusMm;
  // Use every available DEM interval across the limiting grid edge. This improves
  // surface fidelity without fabricating elevation values beyond bilinear sampling.
  const subdivisions = Math.min(input.columns, input.rows) - 1;
  const vertices: Array<{ x: number; y: number; elevationMm: number }> = [];
  const vertexByCoordinate = new Map<string, number>();
  const indices: number[] = [];
  const keyFor = (x: number, y: number) => `${x.toFixed(9)}:${y.toFixed(9)}`;
  const addTopVertex = (x: number, y: number): number => {
    const key = keyFor(x, y);
    const existing = vertexByCoordinate.get(key);
    if (existing !== undefined) return existing;
    const elevationMm = input.elevationToModelMm(sampleBilinear(input, x, y, depthMm));
    if (!Number.isFinite(elevationMm)) throw new Error('elevationToModelMm must return finite model coordinates.');
    const index = vertices.length;
    vertices.push({ x, y, elevationMm });
    vertexByCoordinate.set(key, index);
    return index;
  };
  const pointInSector = (a: Vec3, b: Vec3, i: number, j: number): number => addTopVertex(
    (a.x * i + b.x * j) / subdivisions,
    (a.y * i + b.y * j) / subdivisions
  );
  const corners: Vec3[] = regularFlatTopHexagon(input.widthMm).map((point) => ({ ...point, z: 0 }));

  for (let sector = 0; sector < 6; sector += 1) {
    const a = corners[sector];
    const b = corners[(sector + 1) % 6];
    for (let i = 0; i < subdivisions; i += 1) {
      for (let j = 0; i + j < subdivisions; j += 1) {
        indices.push(pointInSector(a, b, i, j), pointInSector(a, b, i + 1, j), pointInSector(a, b, i, j + 1));
        if (i + j < subdivisions - 1) {
          indices.push(pointInSector(a, b, i + 1, j), pointInSector(a, b, i + 1, j + 1), pointInSector(a, b, i, j + 1));
        }
      }
    }
  }

  const minimumElevationMm = Math.min(...vertices.map((vertex) => vertex.elevationMm));
  const positions: Vec3[] = vertices.map((vertex) => {
    const offset = input.surfaceOffsetMm?.(vertex) ?? 0;
    if (!Number.isFinite(offset) || offset < 0) throw new Error('surfaceOffsetMm must return finite non-negative offsets.');
    return { x: vertex.x, y: vertex.y, z: input.baseThicknessMm + vertex.elevationMm - minimumElevationMm + offset };
  });
  const topTriangleIndices = [...indices];
  const bottomOffset = positions.length;
  positions.push(...vertices.map((vertex) => ({ x: vertex.x, y: vertex.y, z: 0 })));
  for (let index = 0; index < topTriangleIndices.length; index += 3) {
    indices.push(bottomOffset + topTriangleIndices[index], bottomOffset + topTriangleIndices[index + 2], bottomOffset + topTriangleIndices[index + 1]);
  }

  const boundary: number[] = [];
  for (let side = 0; side < 6; side += 1) {
    const a = corners[side];
    const b = corners[(side + 1) % 6];
    for (let step = 0; step < subdivisions; step += 1) boundary.push(pointInSector(a, b, subdivisions - step, step));
  }
  for (let index = 0; index < boundary.length; index += 1) {
    const topA = boundary[index];
    const topB = boundary[(index + 1) % boundary.length];
    const bottomA = bottomOffset + topA;
    const bottomB = bottomOffset + topB;
    indices.push(topA, bottomB, topB, topA, bottomA, bottomB);
  }

  const mesh = { positions, indices };
  assertPrintableSolid(mesh);
  return mesh;
}
