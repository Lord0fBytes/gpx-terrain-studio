import { useState, type ChangeEvent, type FormEvent } from 'react';
import { RouteMap, type RouteSegment } from './RouteMap';
import { deriveRouteSelection } from '../core/selection';

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
  const [printedWidthMm, setPrintedWidthMm] = useState('');
  const [baseThicknessMm, setBaseThicknessMm] = useState('');
  const [verticalExaggeration, setVerticalExaggeration] = useState('');
  const [useLightSmoothing, setUseLightSmoothing] = useState(false);
  const [exportMessage, setExportMessage] = useState('Enter the intended physical dimensions to generate a terrain-only STL.');
  const [isGenerating, setIsGenerating] = useState(false);
  const selection = summary && deriveRouteSelection(summary.segments, {
    contextMarginRatio: 0.2,
    minimumWidthM: 300,
    minimumDepthM: 300
  });

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

  async function exportTerrain(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selection) return;
    const dimensions = {
      printedWidthMm: Number(printedWidthMm),
      baseThicknessMm: Number(baseThicknessMm),
      verticalExaggeration: Number(verticalExaggeration)
    };
    if (Object.values(dimensions).some((value) => !Number.isFinite(value) || value <= 0)) {
      setExportMessage('Printed width, base thickness, and vertical exaggeration must all be positive numbers.');
      return;
    }
    setIsGenerating(true);
    setExportMessage('Fetching elevation and generating the watertight STL…');
    try {
      const response = await fetch('/api/terrain/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bounds: selection.geographicBounds,
          columns: 96,
          rows: 96,
          dataset: 'COP30',
          smoothing: useLightSmoothing ? 'light' : 'raw',
          ...dimensions
        })
      });
      if (!response.ok) {
        const payload = await response.json() as { error?: string };
        throw new Error(payload.error ?? 'Unable to generate terrain.');
      }
      const stl = await response.blob();
      const downloadUrl = URL.createObjectURL(stl);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'gpx-terrain-hexagon.stl';
      link.click();
      URL.revokeObjectURL(downloadUrl);
      const depthMm = response.headers.get('x-model-depth-mm');
      const triangles = response.headers.get('x-triangle-count');
      setExportMessage(`Downloaded terrain-only STL: ${dimensions.printedWidthMm} mm wide${depthMm ? ` × ${Number(depthMm).toFixed(1)} mm deep` : ''}${triangles ? `, ${triangles} triangles` : ''}.`);
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : 'Unable to generate terrain.');
    } finally {
      setIsGenerating(false);
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
        <p className="status">GPX import, route selection, and terrain-only STL export are ready to test.</p>
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
              <p className="map-help">Navy lines preserve original GPX segments. The orange hexagon is terrain: route bounds + 20% context, with a provisional 300 m minimum span.</p>
              <RouteMap segments={summary.segments} selection={selection} />
            </section>
            <section className="export-section" aria-labelledby="export-title">
              <h2 id="export-title">3. Export terrain STL</h2>
              <p className="map-help">This exports the watertight hexagonal terrain and flat base in millimeters. Raised or recessed route geometry is not included yet.</p>
              <form className="export-form" onSubmit={exportTerrain}>
                <label>Printed width (mm)<input value={printedWidthMm} onChange={(event) => setPrintedWidthMm(event.target.value)} inputMode="decimal" min="0.01" required step="any" type="number" /></label>
                <label>Base thickness (mm)<input value={baseThicknessMm} onChange={(event) => setBaseThicknessMm(event.target.value)} inputMode="decimal" min="0.01" required step="any" type="number" /></label>
                <label>Vertical exaggeration<input value={verticalExaggeration} onChange={(event) => setVerticalExaggeration(event.target.value)} inputMode="decimal" min="0.01" required step="any" type="number" /></label>
                <label className="smoothing-option">
                  <input checked={useLightSmoothing} onChange={(event) => setUseLightSmoothing(event.target.checked)} type="checkbox" />
                  <span><strong>Light smoothing</strong><small>Softens DEM-cell terraces with one conservative pass. Leave off for bilinear-only terrain.</small></span>
                </label>
                <button disabled={isGenerating} type="submit">{isGenerating ? 'Generating STL…' : 'Generate & download STL'}</button>
              </form>
              <p aria-live="polite" className="status">{exportMessage}</p>
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
