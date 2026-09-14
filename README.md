# GPX Terrain Studio

An original, self-hosted tool for turning GPX routes into watertight, printable terrain STL models. The source of truth for project scope, decisions, next tasks, and activity history is the Obsidian project note:

`[private project-note path removed before public release]`

[AGENTS.md](AGENTS.md) carries the implementation contract copied from that project.

## Current state

The prototype validates GPX files, preserves their segments on a Leaflet map, derives a regular flat-top hexagonal selection from route bounds plus the provisional 20% context rule, fetches a bounded OpenTopography DEM, and generates a watertight STL in millimeters. The entered width controls the terrain footprint; every export adds a 6 mm frame beyond each side (100 mm terrain becomes 112 mm overall), with its top 5 mm above the configured base thickness. An integrated raised route is optional; recessed routes are out of scope. The browser previews the exact generated STL bytes in Three.js and reuses those bytes for the separate download action. Slicer validation and physical-print validation remain unfinished.

## Prerequisites

- Node 22 or later
- npm 12 or later

## Local development

```sh
npm install
npm run dev
```

The web client runs on Vite's printed URL and proxies `/api` to `http://localhost:8787`. Confirm the API with `http://localhost:8787/api/health`.

Select a `.gpx` file in the browser, then enter the intended terrain width (excluding the fixed exterior frame), base thickness, and vertical exaggeration. Generate the framed model, inspect the exact STL in the interactive preview, and use the separate download button when it is ready. Changing any generation setting marks the preview stale and disables download until regeneration. The browser uses a fixed 96 × 96 DEM request as a bounded prototype setting; it intentionally does not expose a quality selector yet. No routes are written to persistent storage.

Create `.env` from `.env.example` with an approved `OPENTOPOGRAPHY_API_KEY`. `POST /api/terrain/generate` accepts explicit selection bounds, DEM grid dimensions, and print settings, then returns a binary STL. It is connected to the browser, but a successful preview or download must not be treated as slicer or physical-print validation.

```sh
npm test
npm run build
```

Copy `.env.example` to `.env` only when an approved elevation provider is configured. Never commit provider keys or customer GPX files.

## Engineering rules

- Geographic coordinates are projected to local metric coordinates before any geometry work.
- The final preview and STL must consume the same validated mesh in millimeters.
- Core geometry tests must be deterministic and offline. Synthetic DEMs are test fixtures, not a production terrain fallback.
- A successful build is not slicer validation or physical-print validation.

See [docs/decisions.md](docs/decisions.md) for the decision register. Physical print defaults and a production provider decision remain unapproved.
