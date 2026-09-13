import { XMLParser, XMLValidator } from 'fast-xml-parser';

export interface GeographicPoint {
  readonly latitude: number;
  readonly longitude: number;
  readonly elevationM?: number;
  readonly time?: string;
}

export interface GpxSegment {
  readonly points: readonly GeographicPoint[];
  readonly source: 'track' | 'route';
}

export interface ParsedGpx {
  readonly name?: string;
  readonly segments: readonly GpxSegment[];
  readonly duplicatePointsDiscarded: number;
  readonly ignoredShortSegments: number;
}

const MAX_GPX_CHARACTERS = 1_000_000;

type XmlRecord = Record<string, unknown>;

function isRecord(value: unknown): value is XmlRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function oneOrMany(value: unknown): readonly unknown[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function textValue(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim() || undefined;
  return undefined;
}

function coordinate(value: unknown, label: string, min: number, max: number): number {
  const parsed = Number(textValue(value));
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be a finite value between ${min} and ${max}.`);
  }
  return parsed;
}

function parsePoint(value: unknown): GeographicPoint {
  if (!isRecord(value)) throw new Error('GPX point must be an XML element.');
  const latitude = coordinate(value['@_lat'], 'GPX latitude', -90, 90);
  const longitude = coordinate(value['@_lon'], 'GPX longitude', -180, 180);
  const elevationText = textValue(value.ele);
  const elevationM = elevationText === undefined ? undefined : Number(elevationText);
  if (elevationM !== undefined && !Number.isFinite(elevationM)) {
    throw new Error('GPX elevation must be finite when present.');
  }
  return { latitude, longitude, elevationM, time: textValue(value.time) };
}

function sameLocation(a: GeographicPoint, b: GeographicPoint): boolean {
  return a.latitude === b.latitude && a.longitude === b.longitude;
}

function normalizeSegment(points: readonly unknown[], source: GpxSegment['source']): {
  readonly segment?: GpxSegment;
  readonly duplicatePointsDiscarded: number;
} {
  const normalized: GeographicPoint[] = [];
  let duplicatePointsDiscarded = 0;
  for (const rawPoint of points) {
    const point = parsePoint(rawPoint);
    if (normalized.length > 0 && sameLocation(normalized[normalized.length - 1]!, point)) {
      duplicatePointsDiscarded += 1;
      continue;
    }
    normalized.push(point);
  }
  return {
    segment: normalized.length >= 2 ? { points: normalized, source } : undefined,
    duplicatePointsDiscarded
  };
}

/** Parses track and route segments without creating lines across source segment gaps. */
export function parseGpx(xml: string): ParsedGpx {
  if (xml.length === 0) throw new Error('GPX file is empty.');
  if (xml.length > MAX_GPX_CHARACTERS) throw new Error(`GPX file exceeds the ${MAX_GPX_CHARACTERS} character limit.`);
  if (/<!doctype/i.test(xml)) throw new Error('GPX files with a DOCTYPE are not accepted.');

  const syntax = XMLValidator.validate(xml);
  if (syntax !== true) throw new Error(`Invalid GPX XML: ${syntax.err.msg}`);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseAttributeValue: false,
    processEntities: false,
    trimValues: true
  });
  const parsed = parser.parse(xml) as { gpx?: unknown };
  if (!isRecord(parsed.gpx)) throw new Error('Document root must be a GPX element.');
  const gpx = parsed.gpx;
  const segments: GpxSegment[] = [];
  let duplicatePointsDiscarded = 0;
  let ignoredShortSegments = 0;

  for (const track of oneOrMany(gpx.trk)) {
    if (!isRecord(track)) throw new Error('GPX track must be an XML element.');
    for (const rawSegment of oneOrMany(track.trkseg)) {
      if (!isRecord(rawSegment)) throw new Error('GPX track segment must be an XML element.');
      const result = normalizeSegment(oneOrMany(rawSegment.trkpt), 'track');
      duplicatePointsDiscarded += result.duplicatePointsDiscarded;
      if (result.segment) segments.push(result.segment);
      else ignoredShortSegments += 1;
    }
  }

  for (const route of oneOrMany(gpx.rte)) {
    if (!isRecord(route)) throw new Error('GPX route must be an XML element.');
    const result = normalizeSegment(oneOrMany(route.rtept), 'route');
    duplicatePointsDiscarded += result.duplicatePointsDiscarded;
    if (result.segment) segments.push(result.segment);
    else ignoredShortSegments += 1;
  }

  if (segments.length === 0) throw new Error('GPX file contains no usable track or route segment.');
  const metadata = isRecord(gpx.metadata) ? gpx.metadata : undefined;
  const firstTrack = oneOrMany(gpx.trk).find(isRecord);
  const firstRoute = oneOrMany(gpx.rte).find(isRecord);
  return {
    name: textValue(metadata?.name) ?? textValue(firstTrack?.name) ?? textValue(firstRoute?.name),
    segments,
    duplicatePointsDiscarded,
    ignoredShortSegments
  };
}
