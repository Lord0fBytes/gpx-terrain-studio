import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RouteSelection } from '../core/selection';

export interface RoutePoint {
  readonly latitude: number;
  readonly longitude: number;
}

export interface RouteSegment {
  readonly source: 'track' | 'route';
  readonly points: readonly RoutePoint[];
}

export function RouteMap({ segments, selection }: Readonly<{ segments: readonly RouteSegment[]; selection?: RouteSelection }>) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = container.current;
    if (!element || segments.length === 0) return;
    const map = L.map(element, { scrollWheelZoom: false, zoomControl: true });
    const tileUrl = import.meta.env.VITE_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const attribution = import.meta.env.VITE_MAP_TILE_ATTRIBUTION
      ?? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';
    L.tileLayer(tileUrl, { attribution, maxZoom: 19 }).addTo(map);
    const routeLayers = segments.map((segment) => L.polyline(
      segment.points.map((point) => [point.latitude, point.longitude] as L.LatLngTuple),
      { color: '#1e3a5f', weight: 4, opacity: 0.9 }
    ).addTo(map));
    const layers: L.Layer[] = [...routeLayers];
    if (selection) {
      layers.push(L.polygon(selection.polygon.map((point) => [point.latitude, point.longitude]), {
        color: '#d86f3d',
        weight: 2,
        fillColor: '#d86f3d',
        fillOpacity: 0.08
      }).addTo(map));
    }
    map.fitBounds(L.featureGroup(layers).getBounds(), { padding: [24, 24], maxZoom: 14 });
    return () => { map.remove(); };
  }, [segments, selection]);

  return <div aria-label="Route map" className="route-map" ref={container} role="application" />;
}
