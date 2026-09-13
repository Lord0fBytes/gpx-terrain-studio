import type { IndexedMesh, Vec3 } from './mesh';

function normal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
  const cross = { x: ab.y * ac.z - ab.z * ac.y, y: ab.z * ac.x - ab.x * ac.z, z: ab.x * ac.y - ab.y * ac.x };
  const length = Math.hypot(cross.x, cross.y, cross.z);
  return { x: cross.x / length, y: cross.y / length, z: cross.z / length };
}

/** Encodes millimeter coordinates as a binary STL. STL carries no unit metadata. */
export function encodeBinaryStl(mesh: IndexedMesh, label = 'GPX Terrain Studio'): Uint8Array {
  const triangleCount = mesh.indices.length / 3;
  if (!Number.isInteger(triangleCount)) throw new Error('Mesh indices must be a multiple of three.');
  const bytes = new Uint8Array(84 + triangleCount * 50);
  const header = new TextEncoder().encode(label.slice(0, 80));
  bytes.set(header, 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(80, triangleCount, true);

  let offset = 84;
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const a = mesh.positions[mesh.indices[triangle * 3]!];
    const b = mesh.positions[mesh.indices[triangle * 3 + 1]!];
    const c = mesh.positions[mesh.indices[triangle * 3 + 2]!];
    if (!a || !b || !c) throw new Error('Mesh triangle references a missing vertex.');
    const unitNormal = normal(a, b, c);
    for (const value of [unitNormal.x, unitNormal.y, unitNormal.z, a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z]) {
      view.setFloat32(offset, value, true);
      offset += 4;
    }
    view.setUint16(offset, 0, true);
    offset += 2;
  }
  return bytes;
}
