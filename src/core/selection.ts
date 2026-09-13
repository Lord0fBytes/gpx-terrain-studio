import type { GpxSegment } from './gpx';
import { createLocalProjection, type LocalPointMeters } from './projection';

export interface RouteSelectionOptions {
  /** Fraction of the unpadded route extent added on each side (for example, 0.1 = 10%). */
  readonly contextMarginRatio: number;
  readonly minimumWidthM: number;
  readonly minimumDepthM: number;
}

export interface RouteSelection {
  readonly center: LocalPointMeters;
  readonly widthM: number;
  readonly depthM: number;
  readonly routeBounds: Readonly<{ min: LocalPointMeters; max: LocalPointMeters }>;
  readonly geographicBounds: Readonly<{ west: number; south: number; east: number; north: number }>;
  readonly polygon: readonly Readonly<{ latitude: number; longitude: number }>[];
}

function positiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a finite positive number.`);
}

function nonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a finite non-negative number.`);
}

/** Derives a metric flat-top hexagonal terrain footprint without connecting or modifying GPX segments. */
export function deriveRouteSelection(
  segments: readonly GpxSegment[],
  options: RouteSelectionOptions
): RouteSelection {
  nonNegativeFinite(options.contextMarginRatio, 'contextMarginRatio');
  positiveFinite(options.minimumWidthM, 'minimumWidthM');
  positiveFinite(options.minimumDepthM, 'minimumDepthM');
  const points = segments.flatMap((segment) => segment.points);
  if (points.length === 0) throw new Error('Cannot derive a terrain selection without GPX points.');

  const latitude = (Math.min(...points.map((point) => point.latitude)) + Math.max(...points.map((point) => point.latitude))) / 2;
  const longitude = (Math.min(...points.map((point) => point.longitude)) + Math.max(...points.map((point) => point.longitude))) / 2;
  const projection = createLocalProjection({ latitude, longitude });
  const localPoints = points.map((point) => projection.project(point));
  const min = {
    x: Math.min(...localPoints.map((point) => point.x)),
    y: Math.min(...localPoints.map((point) => point.y))
  };
  const max = {
    x: Math.max(...localPoints.map((point) => point.x)),
    y: Math.max(...localPoints.map((point) => point.y))
  };
  const routeWidthM = Math.max(max.x - min.x, options.minimumWidthM) * (1 + options.contextMarginRatio * 2);
  const routeDepthM = Math.max(max.y - min.y, options.minimumDepthM) * (1 + options.contextMarginRatio * 2);
  const center = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2 };
  const circumradiusM = Math.max(routeWidthM / 2, routeDepthM / Math.sqrt(3));
  const widthM = circumradiusM * 2;
  const depthM = circumradiusM * Math.sqrt(3);
  const polygon = Array.from({ length: 6 }, (_, index) => {
    const angle = (index * Math.PI) / 3;
    return projection.unproject({ x: center.x + circumradiusM * Math.cos(angle), y: center.y + circumradiusM * Math.sin(angle) });
  });
  return {
    center,
    widthM,
    depthM,
    routeBounds: { min, max },
    polygon,
    geographicBounds: {
      west: Math.min(...polygon.map((point) => point.longitude)),
      south: Math.min(...polygon.map((point) => point.latitude)),
      east: Math.max(...polygon.map((point) => point.longitude)),
      north: Math.max(...polygon.map((point) => point.latitude))
    }
  };
}
