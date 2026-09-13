import { fromArrayBuffer } from 'geotiff';

export interface GeographicBounds {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

export interface DemSampleRequest {
  readonly bounds: GeographicBounds;
  readonly columns: number;
  readonly rows: number;
  readonly dataset: 'COP30' | 'COP90' | 'NASADEM' | 'SRTM_GL1' | 'SRTM_GL3';
}

export interface DemGrid {
  readonly columns: number;
  readonly rows: number;
  /** Row-major elevations in meters, ordered south-to-north to match the local mesh Y axis. */
  readonly elevationsM: readonly number[];
  readonly source: 'opentopography';
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
type GeoTiffDecoder = (data: ArrayBuffer, columns: number, rows: number) => Promise<readonly number[]>;

const API_URL = 'https://portal.opentopography.org/API/globaldem';
const MAX_GRID_EDGE = 512;
const MAX_GRID_CELLS = 150_000;
const DEFAULT_TIMEOUT_MS = 20_000;

function finiteInRange(value: number, label: string, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be between ${min} and ${max}.`);
}

function validateRequest(request: DemSampleRequest): void {
  const { west, south, east, north } = request.bounds;
  finiteInRange(west, 'west', -180, 180);
  finiteInRange(east, 'east', -180, 180);
  finiteInRange(south, 'south', -90, 90);
  finiteInRange(north, 'north', -90, 90);
  if (west >= east || south >= north) throw new Error('Elevation bounds must have positive west/east and south/north extent without crossing the antimeridian.');
  if (!Number.isInteger(request.columns) || request.columns < 2 || request.columns > MAX_GRID_EDGE) throw new Error(`columns must be an integer from 2 to ${MAX_GRID_EDGE}.`);
  if (!Number.isInteger(request.rows) || request.rows < 2 || request.rows > MAX_GRID_EDGE) throw new Error(`rows must be an integer from 2 to ${MAX_GRID_EDGE}.`);
  if (request.columns * request.rows > MAX_GRID_CELLS) throw new Error(`DEM grid may not exceed ${MAX_GRID_CELLS} cells.`);
}

export function openTopographyUrl(request: DemSampleRequest, apiKey: string): URL {
  validateRequest(request);
  if (!apiKey.trim()) throw new Error('OpenTopography API key is not configured.');
  const url = new URL(API_URL);
  url.searchParams.set('demtype', request.dataset);
  url.searchParams.set('south', String(request.bounds.south));
  url.searchParams.set('north', String(request.bounds.north));
  url.searchParams.set('west', String(request.bounds.west));
  url.searchParams.set('east', String(request.bounds.east));
  url.searchParams.set('outputFormat', 'GTiff');
  url.searchParams.set('API_Key', apiKey);
  return url;
}

async function decodeGeoTiff(data: ArrayBuffer, columns: number, rows: number): Promise<readonly number[]> {
  const tiff = await fromArrayBuffer(data);
  const image = await tiff.getImage();
  const raster = await image.readRasters({ width: columns, height: rows, interleave: true });
  const values = Array.from(raster as ArrayLike<number>);
  if (values.length !== columns * rows) throw new Error('OpenTopography returned an unexpected raster size.');
  const nodata = Number(image.getGDALNoData());
  const southToNorth: number[] = [];
  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = 0; column < columns; column += 1) {
      const value = values[row * columns + column]!;
      if (!Number.isFinite(value) || (Number.isFinite(nodata) && value === nodata)) {
        throw new Error('OpenTopography returned missing elevation cells for this selection.');
      }
      southToNorth.push(value);
    }
  }
  return southToNorth;
}

export class OpenTopographyProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly decoder: GeoTiffDecoder = decodeGeoTiff,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS
  ) {}

  async sampleGrid(request: DemSampleRequest): Promise<DemGrid> {
    const url = openTopographyUrl(request, this.apiKey);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url.toString(), { signal: controller.signal });
      if (!response.ok) throw new Error(`OpenTopography request failed with HTTP ${response.status}.`);
      const elevationsM = await this.decoder(await response.arrayBuffer(), request.columns, request.rows);
      if (elevationsM.length !== request.columns * request.rows || elevationsM.some((value) => !Number.isFinite(value))) {
        throw new Error('OpenTopography returned an invalid elevation grid.');
      }
      return { columns: request.columns, rows: request.rows, elevationsM, source: 'opentopography' };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw new Error('OpenTopography request timed out.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
