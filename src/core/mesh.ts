export type Vec3 = Readonly<{ x: number; y: number; z: number }>;

export interface IndexedMesh {
  readonly positions: readonly Vec3[];
  readonly indices: readonly number[];
}

export interface MeshAnalysis {
  readonly triangleCount: number;
  readonly boundaryEdges: number;
  readonly nonManifoldEdges: number;
  readonly degenerateTriangles: number;
  readonly nonFiniteVertices: number;
  readonly signedVolumeMm3: number;
}

export interface MeshBounds {
  readonly min: Vec3;
  readonly max: Vec3;
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function edgeKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function analyzeMesh(mesh: IndexedMesh): MeshAnalysis {
  if (mesh.indices.length % 3 !== 0) {
    throw new Error('Mesh indices must be a multiple of three.');
  }

  const edgeUse = new Map<string, number>();
  let degenerateTriangles = 0;
  let signedVolumeMm3 = 0;

  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const aIndex = mesh.indices[offset]!;
    const bIndex = mesh.indices[offset + 1]!;
    const cIndex = mesh.indices[offset + 2]!;
    const a = mesh.positions[aIndex];
    const b = mesh.positions[bIndex];
    const c = mesh.positions[cIndex];
    if (!a || !b || !c) throw new Error('Mesh triangle references a missing vertex.');

    const normal = cross(subtract(b, a), subtract(c, a));
    if (dot(normal, normal) <= 1e-18) degenerateTriangles += 1;
    signedVolumeMm3 += dot(a, cross(b, c)) / 6;

    for (const [from, to] of [[aIndex, bIndex], [bIndex, cIndex], [cIndex, aIndex]] as const) {
      const key = edgeKey(from, to);
      edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1);
    }
  }

  let boundaryEdges = 0;
  let nonManifoldEdges = 0;
  for (const count of edgeUse.values()) {
    if (count === 1) boundaryEdges += 1;
    if (count > 2) nonManifoldEdges += 1;
  }

  const nonFiniteVertices = mesh.positions.filter(
    ({ x, y, z }) => !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)
  ).length;

  return {
    triangleCount: mesh.indices.length / 3,
    boundaryEdges,
    nonManifoldEdges,
    degenerateTriangles,
    nonFiniteVertices,
    signedVolumeMm3
  };
}

export function assertPrintableSolid(mesh: IndexedMesh): void {
  const analysis = analyzeMesh(mesh);
  if (analysis.nonFiniteVertices > 0) throw new Error('Mesh contains non-finite vertices.');
  if (analysis.degenerateTriangles > 0) throw new Error('Mesh contains degenerate triangles.');
  if (analysis.boundaryEdges > 0) throw new Error('Mesh contains boundary edges.');
  if (analysis.nonManifoldEdges > 0) throw new Error('Mesh contains non-manifold edges.');
  if (analysis.signedVolumeMm3 <= 0) throw new Error('Mesh must have positive signed volume.');
}

export function meshBounds(mesh: IndexedMesh): MeshBounds {
  if (mesh.positions.length === 0) throw new Error('Cannot measure an empty mesh.');
  const first = mesh.positions[0]!;
  let min = { ...first };
  let max = { ...first };
  for (const point of mesh.positions.slice(1)) {
    min = { x: Math.min(min.x, point.x), y: Math.min(min.y, point.y), z: Math.min(min.z, point.z) };
    max = { x: Math.max(max.x, point.x), y: Math.max(max.y, point.y), z: Math.max(max.z, point.z) };
  }
  return { min, max };
}
