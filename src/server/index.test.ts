import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { handleRequest } from './index';

test('health endpoint returns an OK status', async () => {
  const server = createServer((request, response) => { void handleRequest(request, response); });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('GPX validation summarizes segments without returning route coordinates', async () => {
  const server = createServer((request, response) => { void handleRequest(request, response); });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  const response = await fetch(`http://127.0.0.1:${address.port}/api/gpx/validate`, {
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
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});
