# GPX Terrain Studio

An original, self-hosted tool for turning GPX routes into watertight, printable terrain STL models. The source of truth for project scope, decisions, next tasks, and activity history is the Obsidian project note:

`[private project-note path removed before public release]`

[AGENTS.md](AGENTS.md) carries the implementation contract copied from that project.

## Current state

Only neutral repository foundation work is in place: a TypeScript client/API shell, API health endpoint, project conventions, and a multi-segment GPX fixture. No GPX parsing, map, elevation retrieval, terrain geometry, route geometry, preview, export, slicer validation, or print validation has been implemented.

## Prerequisites

- Node 22 or later
- npm 12 or later

## Local development

```sh
npm install
npm run dev
```

The web client runs on Vite's printed URL and proxies `/api` to `http://localhost:8787`. Confirm the API with `http://localhost:8787/api/health`.

The first interactive checkpoint is GPX validation: select a `.gpx` file in the browser. The app reports its usable track/route segments and does not persist or display raw coordinates. Map placement, terrain generation, and STL download are not available yet.

For server-only terrain experiments, create `.env` from `.env.example` with an approved `OPENTOPOGRAPHY_API_KEY`. `POST /api/terrain/generate` accepts explicit selection bounds, DEM grid dimensions, and print settings, then returns a binary STL. This endpoint is not yet connected to the browser and must not be treated as slicer or physical-print validation.

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

See [docs/decisions.md](docs/decisions.md) for the decision register. It deliberately contains no unapproved physical defaults or external-provider selection.
