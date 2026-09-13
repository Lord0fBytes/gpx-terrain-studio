import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import { parseGpx } from '../core/gpx';
import { OpenTopographyProvider } from './elevation/opentopography';
import { generateTerrainStl, type TerrainGenerationRequest } from './generate-terrain';

export const PORT = Number.parseInt(process.env.PORT ?? '8787', 10);

const MAX_REQUEST_BYTES = 1_000_000;

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_REQUEST_BYTES) throw new Error('Request body exceeds the 1000000 byte limit.');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parseTerrainRequest(body: string): TerrainGenerationRequest {
  try {
    return JSON.parse(body) as TerrainGenerationRequest;
  } catch {
    throw new Error('Terrain generation request must be valid JSON.');
  }
}

export async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  if (request.method === 'GET' && url.pathname === '/api/health') {
    sendJson(response, 200, { status: 'ok' });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/gpx/validate') {
    try {
      const parsed = parseGpx(await readRequestBody(request));
      sendJson(response, 200, {
        name: parsed.name,
        segments: parsed.segments,
        duplicatePointsDiscarded: parsed.duplicatePointsDiscarded,
        ignoredShortSegments: parsed.ignoredShortSegments
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to validate GPX.';
      const status = message.includes('exceeds the 1000000 byte limit') ? 413 : 400;
      sendJson(response, status, { error: message });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/terrain/generate') {
    try {
      const apiKey = process.env.OPENTOPOGRAPHY_API_KEY;
      if (!apiKey) throw new Error('OpenTopography API key is not configured on the server.');
      const result = await generateTerrainStl(
        parseTerrainRequest(await readRequestBody(request)),
        new OpenTopographyProvider(apiKey)
      );
      response.writeHead(200, {
        'content-type': 'model/stl',
        'content-disposition': 'attachment; filename="terrain.stl"',
        'x-model-width-mm': String(result.printedWidthMm),
        'x-model-depth-mm': String(result.printedDepthMm),
        'x-triangle-count': String(result.triangleCount)
      });
      response.end(result.stl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to generate terrain.';
      const status = message.includes('exceeds the 1000000 byte limit') ? 413 : 400;
      sendJson(response, status, { error: message });
    }
    return;
  }

  sendJson(response, 404, { error: 'Not found' });
}

const isEntrypoint = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  createServer((request, response) => { void handleRequest(request, response); }).listen(PORT, () => {
    console.info(`API listening on http://localhost:${PORT}`);
  });
}
