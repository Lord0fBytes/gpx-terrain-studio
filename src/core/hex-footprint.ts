export interface PlanarPoint {
  readonly x: number;
  readonly y: number;
}

/** Returns the shared counter-clockwise, flat-top hexagon footprint in millimeters. */
export function regularFlatTopHexagon(widthMm: number): readonly PlanarPoint[] {
  if (!Number.isFinite(widthMm) || widthMm <= 0) throw new Error('widthMm must be a finite positive number.');
  const radius = widthMm / 2;
  return Array.from({ length: 6 }, (_, index) => ({
    x: radius * Math.cos((index * Math.PI) / 3),
    y: radius * Math.sin((index * Math.PI) / 3)
  }));
}
