const steps = [
  'Upload and validate a GPX route',
  'Position the fixed terrain selection',
  'Generate and inspect the printable solid',
  'Export millimeter-scale STL'
];

export function App() {
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
