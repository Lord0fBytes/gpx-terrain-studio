import type { GeographicPoint } from './gpx';

export interface LocalPointMeters {
  readonly x: number;
  readonly y: number;
}

export interface LocalProjection {
  readonly origin: Readonly<{ latitude: number; longitude: number }>;
  project(point: Pick<GeographicPoint, 'latitude' | 'longitude'>): LocalPointMeters;
  unproject(point: LocalPointMeters): Readonly<{ latitude: number; longitude: number }>;
}

const SEMI_MAJOR_AXIS_M = 6_378_137;
const FLATTENING = 1 / 298.257223563;
const ECCENTRICITY_SQUARED = FLATTENING * (2 - FLATTENING);
const SEMI_MINOR_AXIS_M = SEMI_MAJOR_AXIS_M * (1 - FLATTENING);
const SECOND_ECCENTRICITY_SQUARED = (SEMI_MAJOR_AXIS_M ** 2 - SEMI_MINOR_AXIS_M ** 2) / SEMI_MINOR_AXIS_M ** 2;

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function validateCoordinates(latitude: number, longitude: number): void {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error('Latitude must be between -90 and 90.');
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('Longitude must be between -180 and 180.');
}

function earthCenteredFixed(latitude: number, longitude: number): readonly [number, number, number] {
  const lat = radians(latitude);
  const lon = radians(longitude);
  const sinLat = Math.sin(lat);
  const radius = SEMI_MAJOR_AXIS_M / Math.sqrt(1 - ECCENTRICITY_SQUARED * sinLat * sinLat);
  return [
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.cos(lat) * Math.sin(lon),
    radius * (1 - ECCENTRICITY_SQUARED) * sinLat
  ];
}

/** Creates a WGS84 local east/north tangent-plane projection in meters. */
export function createLocalProjection(origin: Readonly<{ latitude: number; longitude: number }>): LocalProjection {
  validateCoordinates(origin.latitude, origin.longitude);
  const [originX, originY, originZ] = earthCenteredFixed(origin.latitude, origin.longitude);
  const lat = radians(origin.latitude);
  const lon = radians(origin.longitude);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinLon = Math.sin(lon);
  const cosLon = Math.cos(lon);

  return {
    origin: { ...origin },
    project(point) {
      validateCoordinates(point.latitude, point.longitude);
      const [x, y, z] = earthCenteredFixed(point.latitude, point.longitude);
      const dx = x - originX;
      const dy = y - originY;
      const dz = z - originZ;
      return {
        x: -sinLon * dx + cosLon * dy,
        y: -sinLat * cosLon * dx - sinLat * sinLon * dy + cosLat * dz
      };
    },
    unproject(point) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) throw new Error('Local coordinates must be finite.');
      const x = originX - sinLon * point.x - sinLat * cosLon * point.y;
      const y = originY + cosLon * point.x - sinLat * sinLon * point.y;
      const z = originZ + cosLat * point.y;
      const longitude = Math.atan2(y, x);
      const distanceFromAxis = Math.hypot(x, y);
      const theta = Math.atan2(z * SEMI_MAJOR_AXIS_M, distanceFromAxis * SEMI_MINOR_AXIS_M);
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      const latitude = Math.atan2(
        z + SECOND_ECCENTRICITY_SQUARED * SEMI_MINOR_AXIS_M * sinTheta ** 3,
        distanceFromAxis - ECCENTRICITY_SQUARED * SEMI_MAJOR_AXIS_M * cosTheta ** 3
      );
      return { latitude: (latitude * 180) / Math.PI, longitude: (longitude * 180) / Math.PI };
    }
  };
}
