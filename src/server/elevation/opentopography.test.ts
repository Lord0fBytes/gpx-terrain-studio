import assert from 'node:assert/strict';
import test from 'node:test';
import { DEM_RESAMPLE_METHOD, OpenTopographyProvider, openTopographyUrl, type DemSampleRequest } from './opentopography';

const request: DemSampleRequest = {
  bounds: { west: -122.5, south: 37.7, east: -122.4, north: 37.8 },
  columns: 2,
  rows: 2,
  dataset: 'COP30'
};

test('builds a bounded OpenTopography GeoTIFF request without exposing it to callers', () => {
  const url = openTopographyUrl(request, 'private-key');
  assert.equal(url.origin + url.pathname, 'https://portal.opentopography.org/API/globaldem');
  assert.equal(url.searchParams.get('demtype'), 'COP30');
  assert.equal(url.searchParams.get('outputFormat'), 'GTiff');
  assert.equal(url.searchParams.get('API_Key'), 'private-key');
});

test('uses bilinear interpolation when resampling the source DEM into an export grid', () => {
  assert.equal(DEM_RESAMPLE_METHOD, 'bilinear');
});

test('returns decoder samples ordered for the local south-to-north mesh convention', async () => {
  let requestedUrl = '';
  const provider = new OpenTopographyProvider(
    'private-key',
    async (url) => {
      requestedUrl = url;
      return new Response(new Uint8Array([1, 2, 3]).buffer, { status: 200 });
    },
    async () => [10, 20, 30, 40]
  );
  const result = await provider.sampleGrid(request);
  assert.deepEqual(result, { columns: 2, rows: 2, elevationsM: [10, 20, 30, 40], source: 'opentopography' });
  assert.match(requestedUrl, /API_Key=private-key/);
});

test('rejects invalid bounds and provider failures without inventing terrain values', async () => {
  assert.throws(() => openTopographyUrl({ ...request, bounds: { ...request.bounds, east: -122.5 } }, 'key'), /positive/);
  const provider = new OpenTopographyProvider('key', async () => new Response('no coverage', { status: 400 }));
  await assert.rejects(provider.sampleGrid(request), /HTTP 400/);
});
