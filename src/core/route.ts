import type { PlanarPoint } from './hex-footprint';

export interface ModelRouteSegment {
  readonly points: readonly PlanarPoint[];
}

export interface RaisedRouteSettings {
  readonly widthMm: number;
  readonly heightMm: number;
}

function cross(a: PlanarPoint, b: PlanarPoint, point: PlanarPoint): number {
  return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
}

/** Clips a segment to a counter-clockwise convex polygon without bridging GPX gaps. */
export function clipSegmentToConvexPolygon(from: PlanarPoint, to: PlanarPoint, polygon: readonly PlanarPoint[]): readonly [PlanarPoint, PlanarPoint] | undefined {
  let start = 0;
  let end = 1;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index]!;
    const b = polygon[(index + 1) % polygon.length]!;
    const q = cross(a, b, from);
    const r = (b.x - a.x) * dy - (b.y - a.y) * dx;
    if (Math.abs(r) < 1e-12) {
      if (q < 0) return undefined;
      continue;
    }
    const boundary = -q / r;
    if (r > 0) start = Math.max(start, boundary);
    else end = Math.min(end, boundary);
    if (start > end) return undefined;
  }
  return [
    { x: from.x + dx * start, y: from.y + dy * start },
    { x: from.x + dx * end, y: from.y + dy * end }
  ];
}

function distanceToSegment(point: PlanarPoint, from: PlanarPoint, to: PlanarPoint): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - from.x, point.y - from.y);
  const t = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (from.x + dx * t), point.y - (from.y + dy * t));
}

/** Builds an integrated, flat-topped raised route offset for a terrain height field. */
export function createRaisedRouteOffset(
  segments: readonly ModelRouteSegment[],
  settings: RaisedRouteSettings,
  footprint: readonly PlanarPoint[]
): Readonly<{ offsetAt(point: PlanarPoint): number; clippedSegmentCount: number; omittedSegmentCount: number }> {
  if (!Number.isFinite(settings.widthMm) || settings.widthMm <= 0 || !Number.isFinite(settings.heightMm) || settings.heightMm <= 0) {
    throw new Error('Raised route width and height must be finite positive numbers.');
  }
  let totalSegmentCount = 0;
  const clippedSegments = segments.flatMap((segment) => segment.points.slice(1).flatMap((to, index) => {
    totalSegmentCount += 1;
    const from = segment.points[index]!;
    const clipped = clipSegmentToConvexPolygon(from, to, footprint);
    return clipped ? [clipped] : [];
  }));
  return {
    clippedSegmentCount: clippedSegments.length,
    omittedSegmentCount: totalSegmentCount - clippedSegments.length,
    offsetAt(point) {
      return clippedSegments.some(([from, to]) => distanceToSegment(point, from, to) <= settings.widthMm / 2)
        ? settings.heightMm
        : 0;
    }
  };
}
