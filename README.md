# GPX Terrain Studio

An original, self-hosted tool for turning GPX routes into watertight, printable terrain STL models. The source of truth for product scope and geometry requirements is [AGENTS.md](AGENTS.md).

## Current state

The foundation is in place: a TypeScript client, API health endpoint, project conventions, and a multi-segment GPX fixture. The first implementation milestone is offline GPX parsing plus a deterministic synthetic-DEM terrain solid and STL export. Real elevation retrieval and printable route geometry are intentionally not implemented yet.

## Prerequisites

- Node 22 or later
- npm 12 or later

## Local development

```sh
npm install
npm run dev
```

The web client runs on Vite's printed URL and proxies `/api` to `http://localhost:8787`. Confirm the API with `http://localhost:8787/api/health`.

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

See [docs/decisions.md](docs/decisions.md) for provisional dimensions and external-service decisions.
