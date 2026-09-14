import { elevationToModelMm, derivePrintScale } from '../core/print-scale';
import { encodeBinaryStl } from '../core/stl';
import { buildHexTerrainSolid } from '../core/hex-terrain';
import { regularFlatTopHexagon } from '../core/hex-footprint';
import { createLocalProjection } from '../core/projection';
import { createRaisedRouteOffset, type ModelRouteSegment } from '../core/route';
import { applyLightTerrainSmoothing, type TerrainSmoothing } from '../core/smoothing';
import type { DemGrid, DemSampleRequest, GeographicBounds } from './elevation/opentopography';

export interface TerrainGenerationRequest extends DemSampleRequest {
  readonly printedWidthMm: number;
  readonly baseThicknessMm: number;
  readonly verticalExaggeration: number;
  readonly smoothing?: TerrainSmoothing;
  readonly raisedRoute?: Readonly<{
    widthMm: number;
    heightMm: number;
    segments: readonly Readonly<{ points: readonly Readonly<{ latitude: number; longitude: number }>[] }> [];
  }>;
}

export interface TerrainGenerationResult {
  readonly stl: Uint8Array;
  readonly terrainWidthMm: number;
  readonly printedWidthMm: number;
  readonly printedDepthMm: number;
  readonly triangleCount: number;
  readonly clippedRouteSegments: number;
  readonly omittedRouteSegments: number;
}

const RAISED_BORDER_WIDTH_MM = 6;
const RAISED_BORDER_HEIGHT_MM = 5;

export interface ElevationSampler {
  sampleGrid(request: DemSampleRequest): Promise<DemGrid>;
}

function selectionDimensionsM(bounds: GeographicBounds): Readonly<{ widthM: number; depthM: number }> {
  const center = { latitude: (bounds.south + bounds.north) / 2, longitude: (bounds.west + bounds.east) / 2 };
  const projection = createLocalProjection(center);
  const southwest = projection.project({ latitude: bounds.south, longitude: bounds.west });
  const southeast = projection.project({ latitude: bounds.south, longitude: bounds.east });
  const northwest = projection.project({ latitude: bounds.north, longitude: bounds.west });
  return { widthM: Math.abs(southeast.x - southwest.x), depthM: Math.abs(northwest.y - southwest.y) };
}

function raisedRouteOffset(request: TerrainGenerationRequest, widthM: number): Readonly<{ offsetAt(point: Readonly<{ x: number; y: number }>): number; clippedSegmentCount: number; omittedSegmentCount: number }> | undefined {
  const route = request.raisedRoute;
  if (!route) return undefined;
  if (!Number.isFinite(route.widthMm) || route.widthMm <= 0 || !Number.isFinite(route.heightMm) || route.heightMm <= 0) {
    throw new Error('Raised route width and height must be finite positive numbers.');
  }
  const terrainStepMm = request.printedWidthMm / (Math.min(request.columns, request.rows) - 1);
  const minimumWidthMm = terrainStepMm * 2;
  if (route.widthMm < minimumWidthMm) {
    throw new Error(`Raised route width must be at least ${minimumWidthMm.toFixed(2)} mm for the current terrain resolution.`);
  }
  if (!Array.isArray(route.segments) || route.segments.length === 0) throw new Error('Raised route requires at least one GPX segment.');
  const center = { latitude: (request.bounds.south + request.bounds.north) / 2, longitude: (request.bounds.west + request.bounds.east) / 2 };
  const projection = createLocalProjection(center);
  const scaleMmPerM = request.printedWidthMm / widthM;
  const segments: ModelRouteSegment[] = route.segments.map((segment) => {
    if (!Array.isArray(segment.points) || segment.points.length < 2) throw new Error('Each raised route segment requires at least two points.');
    return { points: segment.points.map((point: Readonly<{ latitude: number; longitude: number }>) => {
      if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) throw new Error('Raised route contains invalid coordinates.');
      const local = projection.project(point);
      return { x: local.x * scaleMmPerM, y: local.y * scaleMmPerM };
    }) };
  });
  return createRaisedRouteOffset(segments, { ...route, edgeTransitionMm: terrainStepMm }, regularFlatTopHexagon(request.printedWidthMm));
}

/** Fetches a DEM and returns the same validated millimeter mesh that is encoded into the STL response. */
export async function generateTerrainStl(
  request: TerrainGenerationRequest,
  elevationProvider: ElevationSampler
): Promise<TerrainGenerationResult> {
  if (request.smoothing !== undefined && request.smoothing !== 'raw' && request.smoothing !== 'light') {
    throw new Error('smoothing must be raw or light.');
  }
  const { widthM, depthM } = selectionDimensionsM(request.bounds);
  const printScale = derivePrintScale({ selectionWidthM: widthM, selectionDepthM: depthM, printedWidthMm: request.printedWidthMm });
  const dem = await elevationProvider.sampleGrid(request);
  if (dem.columns !== request.columns || dem.rows !== request.rows || dem.elevationsM.length !== request.columns * request.rows) {
    throw new Error('Elevation provider returned a grid with unexpected dimensions.');
  }
  const elevationsM = request.smoothing === 'light'
    ? applyLightTerrainSmoothing(dem.elevationsM, dem.columns, dem.rows)
    : dem.elevationsM;
  const routeOffset = raisedRouteOffset(request, widthM);
  const datumM = Math.min(...elevationsM);
  const mesh = buildHexTerrainSolid({
    widthMm: printScale.printedWidthMm,
    columns: dem.columns,
    rows: dem.rows,
    elevationsM,
    baseThicknessMm: request.baseThicknessMm,
    elevationToModelMm: (elevationM) => elevationToModelMm(
      elevationM,
      datumM,
      printScale.horizontalModelScaleMmPerM,
      request.verticalExaggeration
    ),
    surfaceOffsetMm: routeOffset?.offsetAt,
    raisedBorder: { widthMm: RAISED_BORDER_WIDTH_MM, heightAboveBaseMm: RAISED_BORDER_HEIGHT_MM }
  });
  const outerWidthMm = printScale.printedWidthMm + RAISED_BORDER_WIDTH_MM * 2;
  return {
    stl: encodeBinaryStl(mesh),
    terrainWidthMm: printScale.printedWidthMm,
    printedWidthMm: outerWidthMm,
    printedDepthMm: outerWidthMm * Math.sqrt(3) / 2,
    triangleCount: mesh.indices.length / 3,
    clippedRouteSegments: routeOffset?.clippedSegmentCount ?? 0,
    omittedRouteSegments: routeOffset?.omittedSegmentCount ?? 0
  };
}
