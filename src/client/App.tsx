import { lazy, Suspense, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { RouteMap, type RouteSegment } from './RouteMap';
import { deriveRouteSelection } from '../core/selection';

const TerrainViewer = lazy(async () => {
  const module = await import('./TerrainViewer');
  return { default: module.TerrainViewer };
});

type Step = 1 | 2 | 3 | 4;

const workflowSteps: readonly Readonly<{ step: Step; label: string; shortLabel: string }>[] = [
  { step: 1, label: 'Upload GPX', shortLabel: 'Upload' },
  { step: 2, label: 'Map & terrain area', shortLabel: 'Map' },
  { step: 3, label: 'Fine-tune settings', shortLabel: 'Settings' },
  { step: 4, label: '3D model viewer', shortLabel: 'Preview' }
];

interface ValidationSummary {
  readonly name?: string;
  readonly segments: readonly RouteSegment[];
  readonly duplicatePointsDiscarded: number;
  readonly ignoredShortSegments: number;
}

interface GeneratedModel {
  readonly stl: ArrayBuffer;
  readonly settingsKey: string;
  readonly overallWidthMm?: number;
  readonly overallDepthMm?: number;
  readonly triangleCount?: number;
  readonly omittedRouteSegments: number;
  readonly includesRaisedRoute: boolean;
}

export function App() {
  const [activeStep, setActiveStep] = useState<Step>(1);
  const [summary, setSummary] = useState<ValidationSummary>();
  const [message, setMessage] = useState('Choose a GPX file to validate its route segments.');
  const [printedWidthMm, setPrintedWidthMm] = useState('');
  const [baseThicknessMm, setBaseThicknessMm] = useState('');
  const [verticalExaggeration, setVerticalExaggeration] = useState('');
  const [useLightSmoothing, setUseLightSmoothing] = useState(false);
  const [includeRaisedRoute, setIncludeRaisedRoute] = useState(false);
  const [routeWidthMm, setRouteWidthMm] = useState('');
  const [routeHeightMm, setRouteHeightMm] = useState('');
  const [exportMessage, setExportMessage] = useState('Enter the intended physical dimensions to generate a terrain STL with its raised border.');
  const [exportIsError, setExportIsError] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedModel, setGeneratedModel] = useState<GeneratedModel>();
  const stageHeadingRef = useRef<HTMLHeadingElement>(null);
  const shouldFocusStageRef = useRef(false);
  const selection = summary && deriveRouteSelection(summary.segments, {
    contextMarginRatio: 0.2,
    minimumWidthM: 300,
    minimumDepthM: 300
  });
  const generationRequest = selection ? {
    bounds: selection.geographicBounds,
    columns: 96,
    rows: 96,
    dataset: 'COP30',
    smoothing: useLightSmoothing ? 'light' : 'raw',
    raisedRoute: includeRaisedRoute ? { widthMm: Number(routeWidthMm), heightMm: Number(routeHeightMm), segments: summary?.segments ?? [] } : undefined,
    printedWidthMm: Number(printedWidthMm),
    baseThicknessMm: Number(baseThicknessMm),
    verticalExaggeration: Number(verticalExaggeration)
  } : undefined;
  const currentSettingsKey = generationRequest ? JSON.stringify(generationRequest) : '';
  const previewIsStale = generatedModel !== undefined && generatedModel.settingsKey !== currentSettingsKey;
  const activeStepLabel = workflowSteps.find(({ step }) => step === activeStep)?.label ?? 'Upload GPX';

  useEffect(() => {
    if (!shouldFocusStageRef.current) return;
    shouldFocusStageRef.current = false;
    stageHeadingRef.current?.focus();
  }, [activeStep]);

  function isStepAvailable(step: Step): boolean {
    if (step === 1) return true;
    if (step === 4) return generatedModel !== undefined;
    return summary !== undefined;
  }

  function goToStep(step: Step): void {
    if (!isStepAvailable(step)) return;
    shouldFocusStageRef.current = true;
    setActiveStep(step);
  }

  async function validateGpx(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    setSummary(undefined);
    setGeneratedModel(undefined);
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
      setMessage(`${file.name} is ready. Continue to the map to inspect the terrain area.`);
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
      setExportMessage('Terrain width, base thickness, and vertical exaggeration must all be positive numbers.');
      setExportIsError(true);
      return;
    }
    const raisedRoute = generationRequest?.raisedRoute;
    if (raisedRoute && (!Number.isFinite(raisedRoute.widthMm) || raisedRoute.widthMm <= 0 || !Number.isFinite(raisedRoute.heightMm) || raisedRoute.heightMm <= 0)) {
      setExportMessage('Raised route width and height must both be positive numbers.');
      setExportIsError(true);
      return;
    }
    setIsGenerating(true);
    setExportIsError(false);
    setExportMessage('Fetching elevation and generating the watertight STL…');
    try {
      const response = await fetch('/api/terrain/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...generationRequest, ...dimensions })
      });
      if (!response.ok) {
        const payload = await response.json() as { error?: string };
        throw new Error(payload.error ?? 'Unable to generate terrain.');
      }
      const stl = await response.arrayBuffer();
      const depthMm = response.headers.get('x-model-depth-mm');
      const modelWidthMm = response.headers.get('x-model-width-mm');
      const triangles = response.headers.get('x-triangle-count');
      const omittedRouteSegments = Number(response.headers.get('x-route-segments-omitted') ?? '0');
      setGeneratedModel({
        stl,
        settingsKey: currentSettingsKey,
        overallWidthMm: modelWidthMm ? Number(modelWidthMm) : undefined,
        overallDepthMm: depthMm ? Number(depthMm) : undefined,
        triangleCount: triangles ? Number(triangles) : undefined,
        omittedRouteSegments,
        includesRaisedRoute: includeRaisedRoute
      });
      setExportMessage(`Preview ready for the exact ${includeRaisedRoute ? 'raised-route' : 'terrain'} STL.${omittedRouteSegments > 0 ? ` ${omittedRouteSegments} route segment${omittedRouteSegments === 1 ? '' : 's'} fell outside the hexagon.` : ''}`);
      shouldFocusStageRef.current = true;
      setActiveStep(4);
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : 'Unable to generate terrain.');
      setExportIsError(true);
    } finally {
      setIsGenerating(false);
    }
  }

  function downloadGeneratedModel(): void {
    if (!generatedModel || previewIsStale) return;
    const downloadUrl = URL.createObjectURL(new Blob([generatedModel.stl], { type: 'model/stl' }));
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'gpx-terrain-hexagon.stl';
    link.click();
    URL.revokeObjectURL(downloadUrl);
  }

  return (
    <main>
      <a className="skip-link" href="#workflow-panel">Skip to current workflow step</a>
      <section className="hero" aria-labelledby="app-title">
        <p className="eyebrow">PRINTABLE TERRAIN</p>
        <h1 id="app-title">GPX Terrain Studio</h1>
        <p className="intro">A focused production tool for turning a route into a watertight terrain model.</p>
        <p className="status">GPX import, route selection, framed terrain export, and optional raised routes are ready to test.</p>
      </section>

      <nav className="workflow-nav" aria-label="Terrain model workflow">
        <p className="workflow-progress" aria-live="polite">Step {activeStep} of 4 <span>·</span> {activeStepLabel}</p>
        <ol className="workflow-tabs">
          {workflowSteps.map(({ step, label, shortLabel }) => {
            const available = isStepAvailable(step);
            return <li key={step}>
              <button
                aria-current={activeStep === step ? 'step' : undefined}
                className={`workflow-tab${activeStep === step ? ' is-active' : ''}${available && activeStep > step ? ' is-complete' : ''}`}
                disabled={!available}
                onClick={() => goToStep(step)}
                type="button"
              >
                <span>{String(step).padStart(2, '0')}</span>
                <strong>{label}</strong>
                <small>{shortLabel}</small>
              </button>
            </li>;
          })}
        </ol>
      </nav>

      <section className="workflow-panel" id="workflow-panel" aria-labelledby="stage-title">
        {activeStep === 1 && <section className="workflow-stage upload" aria-labelledby="stage-title">
          <p className="eyebrow">STEP 01</p>
          <h2 id="stage-title" ref={stageHeadingRef} tabIndex={-1}>Upload GPX</h2>
          <p className="stage-intro">Start with a GPX route. Its original track segments remain separate throughout the terrain workflow.</p>
          <label className="file-input">
            <span>Select GPX file</span>
            <input accept=".gpx,application/gpx+xml,application/xml,text/xml" onChange={validateGpx} type="file" />
          </label>
          <p aria-live="polite" className="status">{message}</p>
          {summary && <>
            <dl className="summary">
              <div><dt>Segments</dt><dd>{summary.segments.length}</dd></div>
              <div><dt>Points</dt><dd>{summary.segments.reduce((total, segment) => total + segment.points.length, 0)}</dd></div>
              <div><dt>Duplicates removed</dt><dd>{summary.duplicatePointsDiscarded}</dd></div>
            </dl>
            <div className="workflow-actions">
              <button className="workflow-action workflow-action--primary" onClick={() => goToStep(2)} type="button">Continue to map</button>
            </div>
          </>}
        </section>}

        {activeStep === 2 && summary && <section className="workflow-stage map-section" aria-labelledby="stage-title">
          <p className="eyebrow">STEP 02</p>
          <h2 id="stage-title" ref={stageHeadingRef} tabIndex={-1}>Map &amp; terrain area</h2>
          <p className="map-help">Navy lines preserve original GPX segments. The orange hexagon is terrain: route bounds + 20% context, with a provisional 300 m minimum span.</p>
          <RouteMap segments={summary.segments} selection={selection} />
          <div className="workflow-actions">
            <button className="workflow-action" onClick={() => goToStep(1)} type="button">Back to upload</button>
            <button className="workflow-action workflow-action--primary" onClick={() => goToStep(3)} type="button">Continue to settings</button>
          </div>
        </section>}

        {activeStep === 3 && summary && <section className="workflow-stage export-section" aria-labelledby="stage-title">
          <p className="eyebrow">STEP 03</p>
          <h2 id="stage-title" ref={stageHeadingRef} tabIndex={-1}>Fine-tune settings</h2>
          <p className="map-help">The entered terrain width excludes the frame. Every export adds a 6 mm frame outside each side, with its top 5 mm above the configured base thickness. Optionally add the raised route; recessed routes are excluded.</p>
          <form className="export-form" onSubmit={exportTerrain}>
            <label>Terrain width, excluding border (mm)<input value={printedWidthMm} onChange={(event) => setPrintedWidthMm(event.target.value)} inputMode="decimal" min="0.01" required step="any" type="number" /></label>
            <label>Base thickness (mm)<input value={baseThicknessMm} onChange={(event) => setBaseThicknessMm(event.target.value)} inputMode="decimal" min="0.01" required step="any" type="number" /></label>
            <label>Vertical exaggeration<input value={verticalExaggeration} onChange={(event) => setVerticalExaggeration(event.target.value)} inputMode="decimal" min="0.01" required step="any" type="number" /></label>
            <label className="smoothing-option">
              <input checked={useLightSmoothing} onChange={(event) => setUseLightSmoothing(event.target.checked)} type="checkbox" />
              <span><strong>Light smoothing</strong><small>Softens DEM-cell terraces with one conservative pass. Leave off for bilinear-only terrain.</small></span>
            </label>
            <label className="smoothing-option">
              <input checked={includeRaisedRoute} onChange={(event) => setIncludeRaisedRoute(event.target.checked)} type="checkbox" />
              <span><strong>Include raised route</strong><small>Integrates the uploaded GPX route into the terrain solid. Route settings are required when enabled.</small></span>
            </label>
            {includeRaisedRoute && <div className="route-settings">
              <label>Route width (mm)<input value={routeWidthMm} onChange={(event) => setRouteWidthMm(event.target.value)} inputMode="decimal" min="0.01" required step="any" type="number" /></label>
              <label>Route rise (mm)<input value={routeHeightMm} onChange={(event) => setRouteHeightMm(event.target.value)} inputMode="decimal" min="0.01" required step="any" type="number" /></label>
              <p>Use values appropriate for your printer; no printable-detail defaults have been approved yet.</p>
            </div>}
            <button disabled={isGenerating} type="submit">{isGenerating ? 'Generating preview…' : 'Generate model & preview'}</button>
          </form>
          <p aria-live="polite" className={`status${exportIsError ? ' is-error' : ''}`} role={exportIsError ? 'alert' : undefined}>{exportMessage}</p>
          <div className="workflow-actions">
            <button className="workflow-action" onClick={() => goToStep(2)} type="button">Back to map</button>
          </div>
        </section>}

        {activeStep === 4 && generatedModel && <section className="workflow-stage preview-section" aria-labelledby="stage-title">
          <div className="preview-heading">
            <div>
              <p className="eyebrow">STEP 04 · FINAL GEOMETRY</p>
              <h2 id="stage-title" ref={stageHeadingRef} tabIndex={-1}>3D model viewer</h2>
            </div>
            <dl className="preview-summary">
              {generatedModel.overallWidthMm !== undefined && <div><dt>Overall width</dt><dd>{generatedModel.overallWidthMm.toFixed(1)} mm</dd></div>}
              {generatedModel.overallDepthMm !== undefined && <div><dt>Overall depth</dt><dd>{generatedModel.overallDepthMm.toFixed(1)} mm</dd></div>}
              {generatedModel.triangleCount !== undefined && <div><dt>Triangles</dt><dd>{generatedModel.triangleCount.toLocaleString()}</dd></div>}
            </dl>
          </div>
          <Suspense fallback={<div className="terrain-viewer is-loading" aria-busy="true"><p>Loading 3D viewer…</p></div>}>
            <TerrainViewer isStale={previewIsStale} stl={generatedModel.stl} />
          </Suspense>
          <div className="preview-actions">
            <p>{generatedModel.includesRaisedRoute ? 'Terrain, exterior frame, and raised route are shown.' : 'Terrain and exterior frame are shown without a raised route.'}</p>
            <button disabled={previewIsStale} onClick={downloadGeneratedModel} type="button">{previewIsStale ? 'Regenerate before download' : 'Download STL'}</button>
          </div>
          <div className="workflow-actions">
            <button className="workflow-action" onClick={() => goToStep(3)} type="button">Adjust settings</button>
          </div>
        </section>}
      </section>

      <section className="notice" aria-label="Current scope">
        <strong>Deliberately narrow MVP.</strong> One route, one fixed terrain shape, one final STL. The geometry engine—not the preview—will be the source of truth.
      </section>
    </main>
  );
}
