export type Vec3 = Readonly<{ x: number; y: number; z: number }>;

export interface IndexedMesh {
  readonly positions: readonly Vec3[];
  readonly indices: readonly number[];
}

export interface MeshAnalysis {
  readonly triangleCount: number;
  readonly boundaryEdges: number;
  readonly nonManifoldEdges: number;
  readonly inconsistentWindingEdges: number;
  readonly connectedComponents: number;
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

  const edgeUse = new Map<string, { count: number; triangles: number[]; directions: readonly [number, number][] }>();
  let degenerateTriangles = 0;
  let signedVolumeMm3 = 0;

  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const triangle = offset / 3;
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
      const existing = edgeUse.get(key);
      edgeUse.set(key, existing
        ? { count: existing.count + 1, triangles: [...existing.triangles, triangle], directions: [...existing.directions, [from, to]] }
        : { count: 1, triangles: [triangle], directions: [[from, to]] });
    }
  }

  let boundaryEdges = 0;
  let nonManifoldEdges = 0;
  let inconsistentWindingEdges = 0;
  const adjacency = Array.from({ length: mesh.indices.length / 3 }, () => new Set<number>());
  for (const edge of edgeUse.values()) {
    if (edge.count === 1) boundaryEdges += 1;
    if (edge.count > 2) nonManifoldEdges += 1;
    if (edge.count === 2) {
      const [first, second] = edge.directions;
      if (first![0] !== second![1] || first![1] !== second![0]) inconsistentWindingEdges += 1;
      const [firstTriangle, secondTriangle] = edge.triangles;
      adjacency[firstTriangle!]!.add(secondTriangle!);
      adjacency[secondTriangle!]!.add(firstTriangle!);
    }
  }

  let connectedComponents = 0;
  const visited = new Set<number>();
  for (let triangle = 0; triangle < adjacency.length; triangle += 1) {
    if (visited.has(triangle)) continue;
    connectedComponents += 1;
    const queue = [triangle];
    visited.add(triangle);
    while (queue.length > 0) {
      const current = queue.pop()!;
      for (const neighbor of adjacency[current]!) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }

  const nonFiniteVertices = mesh.positions.filter(
    ({ x, y, z }) => !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)
  ).length;

  return {
    triangleCount: mesh.indices.length / 3,
    boundaryEdges,
    nonManifoldEdges,
    inconsistentWindingEdges,
    connectedComponents,
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
  if (analysis.inconsistentWindingEdges > 0) throw new Error('Mesh contains inconsistently wound shared edges.');
  if (analysis.connectedComponents !== 1) throw new Error('Mesh must be a single connected solid.');
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
