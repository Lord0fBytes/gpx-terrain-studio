import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGpx } from './gpx';

const MULTI_SEGMENT_GPX = `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>Sample ridge</name></metadata>
<trk><trkseg><trkpt lat="37" lon="-122"><ele>10</ele></trkpt><trkpt lat="37" lon="-122"><ele>11</ele></trkpt><trkpt lat="37.1" lon="-121.9"/></trkseg>
<trkseg><trkpt lat="37.2" lon="-121.8"/><trkpt lat="37.3" lon="-121.7"/></trkseg></trk></gpx>`;

test('preserves track segment boundaries and discards only consecutive duplicate locations', () => {
  const parsed = parseGpx(MULTI_SEGMENT_GPX);
  assert.equal(parsed.name, 'Sample ridge');
  assert.equal(parsed.segments.length, 2);
  assert.deepEqual(parsed.segments.map((segment) => segment.points.length), [2, 2]);
  assert.equal(parsed.duplicatePointsDiscarded, 1);
  assert.equal(parsed.segments[0]!.points[0]!.elevationM, 10);
  assert.equal(parsed.segments[0]!.points[1]!.elevationM, undefined);
});

test('accepts route points as a distinct route segment', () => {
  const parsed = parseGpx('<gpx><rte><name>Route</name><rtept lat="1" lon="2"/><rtept lat="1.1" lon="2.1"/></rte></gpx>');
  assert.deepEqual(parsed.segments[0]!.source, 'route');
});

test('rejects malformed, unsafe, and out-of-range GPX input', () => {
  assert.throws(() => parseGpx('<gpx><trk>'), /Invalid GPX XML/);
  assert.throws(() => parseGpx('<!DOCTYPE gpx><gpx/>'), /DOCTYPE/);
  assert.throws(() => parseGpx('<gpx><trk><trkseg><trkpt lat="91" lon="0"/><trkpt lat="0" lon="0"/></trkseg></trk></gpx>'), /latitude/);
});
