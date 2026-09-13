# Decision register

The Obsidian project note is the source of truth for current scope, decisions, next tasks, and activity history:

`[private project-note path removed before public release]`

## Confirmed repository foundations

- This is a new, original implementation. TrailPrint-3D may be used to understand behavior and edge cases, but its code and assets must not be copied.
- The application will use TypeScript, a lightweight Vite UI, one Node/TypeScript API, and independently testable core modules.
- STL is the first export format. No claim of slicer or physical-print validation is made by this repository.
- V1 uses one regular, flat-top hexagonal terrain selection. Its initial geographic footprint is derived from the uploaded GPX route's local metric bounds plus a **20% context margin on every side**; it is not a single global fixed distance.
- The initial 300 m × 300 m minimum selection is provisional. It gives the prototype OpenTopography integration room above its roughly 250 m bounding-box floor and needs owner validation against representative routes.
- The browser currently requests a fixed 96 × 96 COP30 DEM grid for export (9,216 cells). The hex builder uses every available interval across that grid's limiting edge, producing a bounded high-detail surface rather than discarding half the requested density. This is still constrained by the underlying DEM resolution; no user-facing quality control is included yet.
- The terrain-only export form intentionally requires the owner to enter printed width, base thickness, and vertical exaggeration. No unapproved physical defaults are silently applied.
- Source GeoTIFF elevations are resampled bilinearly into the bounded export grid. This removes nearest-neighbor DEM-cell terraces without adding a terrain blur; it interpolates between measured cells but does not claim additional source detail.
- The export form exposes one opt-in **Light smoothing** checkbox. It performs exactly one 3×3 mean pass after bilinear resampling and before vertical scaling; the unchecked default remains bilinear-only terrain.
- `fast-xml-parser` is the approved GPX XML dependency (MIT; reviewed 2026-09-13). It is used for syntax validation and structured parsing rather than a hand-written regular-expression parser. [License](https://github.com/NaturalIntelligence/fast-xml-parser/blob/master/LICENSE)
- Leaflet is selected as the prototype map library (BSD-2-Clause; reviewed 2026-09-13). [License/FAQ](https://github.com/Leaflet/Leaflet/blob/main/FAQ.md)

## Decisions intentionally pending

Do not infer values or select a provider until the owner makes or approves the decision:

- route-derived minimum/maximum selection constraints
- printed dimensions, base thickness, route dimensions, and exaggeration limits
- elevation and map-tile providers, including commercial terms, coverage, credentials, attribution, cost, and limits
- target slicer, printer/nozzle, and minimum printable detail

When a decision is made, record the value, rationale, review date, and validation evidence here and update the Obsidian project note in the same change.

## Prototype map tiles — reviewed 2026-09-13

The browser defaults to the standard OpenStreetMap raster tile URL for low-volume prototype use only. Leaflet displays the required visible OpenStreetMap attribution, and the app does not prefetch or download tiles. OpenStreetMap tile availability is best-effort and may be withdrawn; its tiles are not a production provider decision. A future provider must set both `VITE_MAP_TILE_URL` and `VITE_MAP_TILE_ATTRIBUTION` and be reviewed here before commercial release. [Tile usage policy](https://operations.osmfoundation.org/policies/tiles/)

## Provider research — OpenTopography, reviewed 2026-09-13

TrailPrint-3D uses OpenTopography, so it is a useful behavior reference. It is selected for the private prototype only.

- OpenTopography's global DEM API supports datasets including COP30 and requires an API key.
- Its current terms permit commercial use of obtained data, subject to dataset licensing and attribution, but prohibit integrating an ordinary API key into a commercial, for-profit product or service.
- The owner reports direct confirmation from OpenTopography that a standard key is acceptable for this private prototype. The key must remain server-only, and its use must be re-confirmed against the written authorization and current terms before any commercial deployment.

The adapter uses the `geotiff` package (MIT; reviewed 2026-09-13) to decode returned GeoTIFF data server-side. [License](https://github.com/geotiffjs/geotiff.js/blob/master/package.json)

Sources: [Terms of Use](https://opentopography.org/usageterms), [developer/API guidance](https://opentopography.org/developers), and [citation policy](https://opentopography.org/node/10).
