# Decision register

The Obsidian project note is the source of truth for current scope, decisions, next tasks, and activity history:

`[private project-note path removed before public release]`

## Confirmed repository foundations

- This is a new, original implementation. TrailPrint-3D may be used to understand behavior and edge cases, but its code and assets must not be copied.
- The application will use TypeScript, a lightweight Vite UI, one Node/TypeScript API, and independently testable core modules.
- STL is the first export format. No claim of slicer or physical-print validation is made by this repository.
- `fast-xml-parser` is the approved GPX XML dependency (MIT; reviewed 2026-09-13). It is used for syntax validation and structured parsing rather than a hand-written regular-expression parser. [License](https://github.com/NaturalIntelligence/fast-xml-parser/blob/master/LICENSE)

## Decisions intentionally pending

Do not infer values or select a provider until the owner makes or approves the decision:

- terrain selection shape and geographic footprint
- printed dimensions, base thickness, route dimensions, and exaggeration limits
- map library (Leaflet is the documented default, not a committed dependency)
- elevation and map-tile providers, including commercial terms, coverage, credentials, attribution, cost, and limits
- target slicer, printer/nozzle, and minimum printable detail

When a decision is made, record the value, rationale, review date, and validation evidence here and update the Obsidian project note in the same change.
