# GPX Terrain Studio — Coding Agent Instructions

## Purpose and scope

Build a small, original, self-hosted web app that turns a GPX route into a printable terrain model. The initial user is the owner producing physical products for eventual Etsy sales. Prioritize reliable printable output and a short production workflow.

These instructions apply to this repository. GPX Terrain Studio is a working name; the application is an original implementation rather than a translated fork.

## Project note

Read [docs/decisions.md](docs/decisions.md) before starting implementation for current scope, decisions, and known limitations.

## MVP contract

1. Upload and validate a GPX file.
2. Display its route on an interactive map.
3. Position a fixed-size polygon terrain area over the route.
4. Fetch real elevation data covering that area.
5. Set physical model dimensions in millimeters and vertical exaggeration.
6. Generate a watertight terrain solid with closed sides and a flat base.
7. Add an optional raised route as part of the printable solid. Recessed routes are explicitly excluded by the owner.
8. Preview the generated model using Three.js.
9. Export STL at the intended physical dimensions.

STL is the release requirement. Consider 3MF only after STL is reliably validated in a slicer and through physical test prints.

Exclude accounts, databases, persistent project storage, queues, Strava/Garmin integrations, presets, trays, magnets, NFC, arbitrary polygon drawing, multiple terrain shapes, and color/painting systems. Do not add these without a scope change from the owner.

## Simple architecture

- TypeScript web UI; a lightweight Vite setup is a reasonable starting point.
- Choose one map library: Leaflet by default, or MapLibre if a concrete requirement favors it. Do not install both.
- Three.js for orbit/zoom preview of the actual generated mesh.
- One Node/TypeScript API for elevation requests, generation, validation, and export.
- Keep projection, elevation sampling, geometry, and export in small testable modules independent of the UI and HTTP framework. Avoid a service framework or monorepo unless needed.
- One Docker application deployment serving the UI and API. Document local development and Docker startup with environment variables and a health endpoint.
- Start with bounded request/response generation. Cap input size, DEM resolution, polygon area, and triangle count; use timeouts and actionable errors. Do not introduce a queue to handle oversized requests.
- Keep provider keys on the server. Use temporary files only when necessary and clean them up. Do not persist or log raw customer routes by default.

## Geometry and coordinate contract

- Parse GPX coordinates as geographic latitude/longitude; project into a suitable local metric coordinate system before computing distances or geometry. Do not use map display pixels or raw degrees as physical distances.
- Preserve track segment boundaries. Handle duplicates, missing GPX elevation, multiple segments, and invalid coordinates explicitly; never invent connecting lines across gaps. DEM data supplies terrain elevation.
- One shared transformation must align the map selection, terrain, route, preview, and export. Define axis directions, polygon orientation, scale, and elevation datum in code and tests.
- Keep the geographic selection size separate from printed size. Use one regular flat-top hexagonal terrain shape in v1; derive its initial geographic footprint from the parsed GPX route's local metric bounds plus a documented context margin. Allow repositioning, with rotation only if useful. Changing printed width scales the same selection uniformly and derives the other planar dimension from its aspect ratio.
- Use an initial 20% context margin on every side of the route bounds. Use a provisional 300 m × 300 m minimum selection to satisfy the prototype elevation provider's roughly 250 m request floor; validate it with owner testing. Maximum selection constraints and initial print dimensions are not decided. Record initial values explicitly as provisional before implementation; do not silently treat earlier illustrative dimensions as requirements.
- Define vertical scaling as: base thickness + (elevation − documented datum) × horizontal model scale × vertical exaggeration. Use consistent meters-to-millimeters conversion. Exaggeration changes terrain relief, not base thickness or route feature dimensions.
- Fetch elevation with sufficient sampling margin, then clip to the exact polygon. Handle missing DEM cells and provider failures explicitly; do not substitute zero elevation or synthetic terrain silently.
- Implement an original geometry pipeline. A height-field route emboss/deboss approach is a reasonable first experiment if sampling can preserve physical route width and depth. Choose a more complex method only when measurable output defects justify it.
- Raised routes must join the terrain. Overlapping shells and a floating preview line are not acceptable printable route geometry. Recessed routes are out of scope.
- Every export includes a fixed exterior frame. The entered printed width controls the terrain footprint; the frame extends 6 mm beyond every side, so a 100 mm terrain is 112 mm overall across its left/right extent. Its flat top sits 5 mm above the configured base thickness and joins the terrain through an inner wall as part of the same watertight solid.
- Handle switchbacks, route self-crossings, near-edge routes, and routes crossing the polygon boundary. Clip consistently and keep the final solid closed. Show when part of a route falls outside the selection.
- Require finite vertices, nondegenerate triangles, consistent outward winding, manifold connectivity, no boundary edges or self-intersections, and positive enclosed volume. Validate a single connected solid for the terrain and route.
- Reject or explain settings that cannot preserve a printable route at the chosen resolution. Establish and document conservative route width, route height/depth, base thickness, and resolution limits using print evidence.
- Preview and export must share the same final geometry. Regenerate or mark the preview stale after settings change. STL carries no unit metadata: write coordinates in millimeters and label that clearly for slicer import.

## Reference and dependency policy

Use TrailPrint-3D to understand behavior and investigate edge cases. This is a from-scratch implementation, not a translated fork or a copy of its geometry code. Do not import its code or assets by default. If reuse becomes necessary, document the proposed reuse and verify the exact upstream license and required notices first.

Before selecting map tiles, elevation data, and dependencies, verify their current usage terms, attribution requirements, and suitability for the intended commercial production workflow. Record sources and decisions; do not assume the earlier conversation verified licensing or provider availability. Prefer a single elevation provider behind a small replaceable adapter.

## Implementation sequence

1. Establish the repository, configuration, GPX fixtures, map, and fixed polygon selection. Record provisional defaults and the chosen elevation provider.
2. Prove the geometry pipeline with deterministic synthetic DEM fixtures: terrain, base, dimensions, and STL export. Synthetic fixtures are test data, not a production fallback.
3. Integrate real DEM retrieval and verify projection, coverage, and route alignment.
4. Add and validate raised routes as solids before polishing the preview. Recessed routes are out of scope.
5. Finish Three.js preview, clear progress/error states, resource limits, and Docker startup documentation.
6. Validate representative exports in the owner's slicer and conduct physical print checks. Revisit 3MF only after these pass.

## Verification and delivery

Test geometry changes with flat and sloped DEMs, steep relief, absent elevation cells, multi-segment GPX, tight switchbacks, self-crossings, and polygon-edge crossings. Check bounding-box dimensions, base thickness, route feature dimensions, topology, and deterministic output. Keep provider tests separate so core tests run offline.

Before declaring the MVP complete: upload real GPX, select the area, fetch real elevation, generate terrain-only and raised-route models, inspect the preview, export STL, confirm millimeter dimensions and absence of repair warnings in the chosen slicer, and verify Docker startup from documented instructions. A physical test print is an owner validation step; report it as pending until evidence is supplied.

Run relevant tests, type checks, and production build for implementation changes. Do not invent passing results or claim slicer/print verification from a visual preview. Report what works, checks performed, limitations, and the next concrete step. Keep this file and the project scope synchronized when decisions change.
