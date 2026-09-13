export type TerrainSmoothing = 'raw' | 'light';

/** Applies one conservative 3×3 mean pass to a finite, row-major DEM grid. */
export function applyLightTerrainSmoothing(
  elevationsM: readonly number[],
  columns: number,
  rows: number
): number[] {
  if (!Number.isInteger(columns) || columns < 2 || !Number.isInteger(rows) || rows < 2) {
    throw new Error('Terrain smoothing requires a grid of at least 2 by 2 cells.');
  }
  if (elevationsM.length !== columns * rows || elevationsM.some((value) => !Number.isFinite(value))) {
    throw new Error('Terrain smoothing requires one finite elevation for every DEM cell.');
  }
  return Array.from({ length: elevationsM.length }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    let total = 0;
    let count = 0;
    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
        const neighborRow = row + rowOffset;
        const neighborColumn = column + columnOffset;
        if (neighborRow < 0 || neighborRow >= rows || neighborColumn < 0 || neighborColumn >= columns) continue;
        total += elevationsM[neighborRow * columns + neighborColumn]!;
        count += 1;
      }
    }
    return total / count;
  });
}
