import { elevationToModelMm, derivePrintScale } from '../core/print-scale';
import { createLocalProjection } from '../core/projection';
import { encodeBinaryStl } from '../core/stl';
import { buildHexTerrainSolid } from '../core/hex-terrain';
import { applyLightTerrainSmoothing, type TerrainSmoothing } from '../core/smoothing';
import type { DemGrid, DemSampleRequest, GeographicBounds } from './elevation/opentopography';

export interface TerrainGenerationRequest extends DemSampleRequest {
  readonly printedWidthMm: number;
  readonly baseThicknessMm: number;
  readonly verticalExaggeration: number;
  readonly smoothing?: TerrainSmoothing;
}

export interface TerrainGenerationResult {
  readonly stl: Uint8Array;
  readonly printedWidthMm: number;
  readonly printedDepthMm: number;
  readonly triangleCount: number;
}

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
    )
  });
  return {
    stl: encodeBinaryStl(mesh),
    printedWidthMm: printScale.printedWidthMm,
    printedDepthMm: printScale.printedWidthMm * Math.sqrt(3) / 2,
    triangleCount: mesh.indices.length / 3
  };
}
