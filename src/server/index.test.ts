import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createTerrainServer } from './index';

async function withServer<T>(server: ReturnType<typeof createTerrainServer>, callback: (baseUrl: string) => Promise<T>): Promise<T> {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('health endpoint returns an OK status', async () => {
  await withServer(createTerrainServer(), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });
});

test('GPX validation summarizes segments without returning route coordinates', async () => {
  await withServer(createTerrainServer(), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/gpx/validate`, {
      method: 'POST',
      headers: { 'content-type': 'application/gpx+xml' },
      body: '<gpx><trk><trkseg><trkpt lat="1" lon="2"/><trkpt lat="1.1" lon="2.1"/></trkseg></trk></gpx>'
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      segments: [{ source: 'track', points: [{ latitude: 1, longitude: 2 }, { latitude: 1.1, longitude: 2.1 }] }],
      duplicatePointsDiscarded: 0,
      ignoredShortSegments: 0
    });
  });
});

test('serves the built client and keeps API routes separate', async () => {
  const staticDirectory = await mkdtemp(join(tmpdir(), 'gpx-terrain-static-'));
  await mkdir(join(staticDirectory, 'assets'));
  await writeFile(join(staticDirectory, 'index.html'), '<!doctype html><title>GPX Terrain Studio</title>');
  await writeFile(join(staticDirectory, 'assets', 'app.js'), 'console.log("terrain");');
  try {
    await withServer(createTerrainServer(staticDirectory), async (baseUrl) => {
      const root = await fetch(`${baseUrl}/`);
      assert.equal(root.status, 200);
      assert.match(root.headers.get('content-type') ?? '', /text\/html/);
      assert.match(await root.text(), /GPX Terrain Studio/);

      const asset = await fetch(`${baseUrl}/assets/app.js`);
      assert.equal(asset.status, 200);
      assert.match(asset.headers.get('content-type') ?? '', /text\/javascript/);
      assert.match(asset.headers.get('cache-control') ?? '', /immutable/);

      const missingApi = await fetch(`${baseUrl}/api/not-found`);
      assert.equal(missingApi.status, 404);
    });
  } finally {
    await rm(staticDirectory, { force: true, recursive: true });
  }
});
