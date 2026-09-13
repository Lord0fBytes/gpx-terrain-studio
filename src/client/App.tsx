import { useState, type ChangeEvent } from 'react';
import { RouteMap, type RouteSegment } from './RouteMap';

const steps = [
  'Upload and validate a GPX route',
  'Position the fixed terrain selection',
  'Generate and inspect the printable solid',
  'Export millimeter-scale STL'
];

interface ValidationSummary {
  readonly name?: string;
  readonly segments: readonly RouteSegment[];
  readonly duplicatePointsDiscarded: number;
  readonly ignoredShortSegments: number;
}

export function App() {
  const [summary, setSummary] = useState<ValidationSummary>();
  const [message, setMessage] = useState('Choose a GPX file to validate its route segments.');

  async function validateGpx(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    setSummary(undefined);
    setMessage(`Validating ${file.name}…`);
    try {
      const response = await fetch('/api/gpx/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/gpx+xml' },
        body: await file.text()
      });
      const payload = await response.json() as ValidationSummary | { error: string };
      if (!response.ok || 'error' in payload) throw new Error('error' in payload ? payload.error : 'Unable to validate GPX.');
      setSummary(payload);
      setMessage(`${file.name} is ready for map placement.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to validate GPX.');
    }
  }

  return (
    <main>
      <section className="hero" aria-labelledby="app-title">
        <p className="eyebrow">PRINTABLE TERRAIN</p>
        <h1 id="app-title">GPX Terrain Studio</h1>
        <p className="intro">
          A focused production tool for turning a route into a watertight terrain model.
        </p>
        <p className="status">Foundation ready · GPX import is the next feature.</p>
      </section>
      <section className="upload" aria-labelledby="upload-title">
        <h2 id="upload-title">1. Validate GPX</h2>
        <label className="file-input">
          <span>Select GPX file</span>
          <input accept=".gpx,application/gpx+xml,application/xml,text/xml" onChange={validateGpx} type="file" />
        </label>
        <p aria-live="polite" className="status">{message}</p>
        {summary && (
          <>
            <dl className="summary">
              <div><dt>Segments</dt><dd>{summary.segments.length}</dd></div>
              <div><dt>Points</dt><dd>{summary.segments.reduce((total, segment) => total + segment.points.length, 0)}</dd></div>
              <div><dt>Duplicates removed</dt><dd>{summary.duplicatePointsDiscarded}</dd></div>
            </dl>
            <section className="map-section" aria-labelledby="map-title">
              <h2 id="map-title">2. Inspect route</h2>
              <p className="map-help">Each line preserves its original GPX segment; gaps are not connected.</p>
              <RouteMap segments={summary.segments} />
            </section>
          </>
        )}
      </section>
      <section aria-labelledby="workflow-title">
        <h2 id="workflow-title">Production workflow</h2>
        <ol className="steps">
          {steps.map((step, index) => (
            <li key={step}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              {step}
            </li>
          ))}
        </ol>
      </section>
      <section className="notice" aria-label="Current scope">
        <strong>Deliberately narrow MVP.</strong> One route, one fixed terrain shape, one final STL.
        The geometry engine—not the preview—will be the source of truth.
      </section>
    </main>
  );
}
