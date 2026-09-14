import { readFile, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseGpx } from '../core/gpx';
import { OpenTopographyProvider } from './elevation/opentopography';
import { generateTerrainStl, type TerrainGenerationRequest } from './generate-terrain';

export const PORT = Number.parseInt(process.env.PORT ?? '8787', 10);
export const HOST = process.env.HOST ?? '0.0.0.0';

const MAX_REQUEST_BYTES = 1_000_000;
const DEFAULT_STATIC_DIRECTORY = resolve(process.env.STATIC_DIRECTORY ?? 'dist');
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2'
};

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

function staticFilePath(pathname: string, staticDirectory: string): string | undefined {
  let decodedPathname: string;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  const relativePath = decodedPathname === '/' ? 'index.html' : decodedPathname.replace(/^\/+/, '');
  const filePath = resolve(staticDirectory, relativePath);
  return filePath === staticDirectory || filePath.startsWith(`${staticDirectory}${sep}`) ? filePath : undefined;
}

async function serveStaticFile(request: IncomingMessage, response: ServerResponse, url: URL, staticDirectory: string): Promise<boolean> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  if (url.pathname.startsWith('/api/')) return false;
  const requestedPath = staticFilePath(url.pathname, staticDirectory);
  if (!requestedPath) return false;
  let filePath = requestedPath;
  try {
    if (!(await stat(filePath)).isFile()) throw new Error('Not a file.');
  } catch {
    if (extname(url.pathname)) return false;
    filePath = resolve(staticDirectory, 'index.html');
    try {
      if (!(await stat(filePath)).isFile()) return false;
    } catch {
      return false;
    }
  }
  const extension = extname(filePath).toLowerCase();
  const cacheControl = url.pathname.startsWith('/assets/')
    ? 'public, max-age=31536000, immutable'
    : 'no-cache';
  response.writeHead(200, {
    'cache-control': cacheControl,
    'content-type': CONTENT_TYPES[extension] ?? 'application/octet-stream'
  });
  if (request.method === 'HEAD') {
    response.end();
  } else {
    response.end(await readFile(filePath));
  }
  return true;
}

export async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  staticDirectory = DEFAULT_STATIC_DIRECTORY
): Promise<void> {
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
        'x-triangle-count': String(result.triangleCount),
        'x-route-segments-omitted': String(result.omittedRouteSegments)
      });
      response.end(result.stl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to generate terrain.';
      const status = message.includes('exceeds the 1000000 byte limit') ? 413 : 400;
      sendJson(response, status, { error: message });
    }
    return;
  }

  if (await serveStaticFile(request, response, url, staticDirectory)) return;
  sendJson(response, 404, { error: 'Not found' });
}

export function createTerrainServer(staticDirectory = DEFAULT_STATIC_DIRECTORY): Server {
  return createServer((request, response) => { void handleRequest(request, response, staticDirectory); });
}

const isEntrypoint = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  createTerrainServer().listen(PORT, HOST, () => {
    console.info(`GPX Terrain Studio listening on http://${HOST}:${PORT}`);
  });
}
