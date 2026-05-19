import { useEffect, useMemo } from "react";
import L, { type Layer, type PathOptions } from "leaflet";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { confidenceOpacity, normalizeHex } from "../data/colors";
import { formatScore, riskLabel, selectedMetric } from "../data/scoring";
import type { Flow, MapCountry, MetricKey, SignalMarker } from "../data/types";

type Props = {
  countries: MapCountry[];
  geojson: GeoJSON.FeatureCollection;
  flows: Flow[];
  markers: SignalMarker[];
  metrics: MetricKey[];
  selectedKey?: string;
  onSelect: (country: MapCountry) => void;
};

type MarkerGroup = {
  id: string;
  actor: SignalMarker["actor"];
  country: string;
  iso3: string;
  latitude: number;
  longitude: number;
  markers: SignalMarker[];
};

const tileUrl =
  (import.meta.env.VITE_TILE_URL as string | undefined) ||
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const tileAttribution =
  (import.meta.env.VITE_TILE_ATTRIBUTION as string | undefined) ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>';

function countryKey(country: MapCountry) {
  return `${country.actor}:${country.iso3}`;
}

function popupHtml(country: MapCountry, metrics: MetricKey[]) {
  const datum = selectedMetric(country, metrics);
  return `
    <div class="intel-popup">
      <strong>${country.country}</strong>
      <span>${country.actor} / ${country.iso3} / ${country.region}</span>
      <b>${datum.label}: ${formatScore(datum.score)} (${riskLabel(datum.score)})</b>
      <span>Confidence: ${datum.confidence}</span>
      <em>${country.data_status === "Demo" ? "Demo / pilot data, not verified intelligence" : country.publication_status}</em>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return replacements[char];
  });
}

function groupMarkers(markers: SignalMarker[]) {
  const order: Record<SignalMarker["kind"], number> = { security: 0, channel: 1, digital: 2 };
  const groups = new Map<string, MarkerGroup>();
  markers.forEach((marker) => {
    const key = `${marker.actor}:${marker.iso3}`;
    const current =
      groups.get(key) ??
      ({
        id: key,
        actor: marker.actor,
        country: marker.country,
        iso3: marker.iso3,
        latitude: 0,
        longitude: 0,
        markers: []
      } satisfies MarkerGroup);
    current.markers.push(marker);
    groups.set(key, current);
  });

  return [...groups.values()].map((group) => {
    group.markers.sort((left, right) => order[left.kind] - order[right.kind]);
    const markerCount = group.markers.length || 1;
    return {
      ...group,
      latitude: group.markers.reduce((sum, marker) => sum + marker.latitude, 0) / markerCount,
      longitude: group.markers.reduce((sum, marker) => sum + marker.longitude, 0) / markerCount
    };
  });
}

function makeMarkerIcon(group: MarkerGroup) {
  const html = group.markers
    .map(
      (marker) =>
        `<span class="signal-icon ${marker.kind}" style="--marker-color:${normalizeHex(marker.color)}" title="${escapeHtml(marker.label)}" aria-label="${escapeHtml(marker.label)}"></span>`
    )
    .join("");
  const width = group.markers.length * 26 + Math.max(0, group.markers.length - 1) * 6;
  return L.divIcon({
    className: `signal-marker signal-marker-row actor-${group.actor.toLowerCase()}`,
    html,
    iconSize: [width, 26],
    iconAnchor: [width / 2, 13]
  });
}

function markerPopupHtml(group: MarkerGroup) {
  const rows = group.markers
    .map(
      (marker) =>
        `<span><b>${escapeHtml(marker.label)}</b>: Score ${formatScore(marker.score)}</span>`
    )
    .join("");
  const warning = group.markers[0]?.warning ?? "Generated icon from workbook score fields; not verified intelligence.";
  return `<div class="intel-popup"><strong>${escapeHtml(group.country)}</strong><span>${group.actor} / ${group.iso3}</span>${rows}<em>${escapeHtml(warning)}</em></div>`;
}

function createPanes(map: L.Map) {
  const panes = [
    ["country-fill", 410],
    ["country-border", 420],
    ["flows", 430],
    ["markers", 440],
    ["selected-outline", 450],
    ["intel-popups", 700]
  ] as const;
  panes.forEach(([name, zIndex]) => {
    const pane = map.getPane(name) ?? map.createPane(name);
    pane.style.zIndex = String(zIndex);
  });
}

function LeafletLayers({ countries, geojson, flows, markers, metrics, selectedKey, onSelect }: Props) {
  const map = useMap();
  const markerGroups = useMemo(() => groupMarkers(markers), [markers]);
  const byIso = useMemo(() => {
    const result = new Map<string, MapCountry>();
    countries.forEach((country) => {
      const current = result.get(country.iso3);
      if (!current || country.composite_score > current.composite_score) result.set(country.iso3, country);
    });
    return result;
  }, [countries]);

  useEffect(() => {
    createPanes(map);
  }, [map]);

  useEffect(() => {
    const style = (feature?: GeoJSON.Feature): PathOptions => {
      const props = feature?.properties as { iso3?: string; has_map_data?: boolean } | null;
      const country = props?.iso3 ? byIso.get(props.iso3) : undefined;
      if (!country) {
        return {
          pane: "country-fill",
          fillColor: "#101827",
          color: "#293142",
          weight: 0.45,
          fillOpacity: 0.22,
          opacity: 0.75
        };
      }
      const datum = selectedMetric(country, metrics);
      return {
        pane: "country-fill",
        fillColor: normalizeHex(datum.color),
        color: selectedKey === countryKey(country) ? "#f8fafc" : "#56627a",
        weight: selectedKey === countryKey(country) ? 2.2 : 0.7,
        fillOpacity: confidenceOpacity(datum.opacity),
        opacity: 0.95
      };
    };

    const countryLayer = L.geoJSON(geojson, {
      pane: "country-fill",
      style,
      onEachFeature: (feature, layer: Layer) => {
        const props = feature.properties as { iso3?: string } | null;
        const country = props?.iso3 ? byIso.get(props.iso3) : undefined;
        if (!country) return;
        layer.bindPopup(popupHtml(country, metrics), { pane: "intel-popups", className: "dark-popup" });
        layer.on({
          mouseover: () => {
            (layer as L.Path).setStyle({ weight: 2.4, color: "#dbeafe" });
          },
          mouseout: () => {
            (layer as L.Path).setStyle(style(feature));
          },
          click: () => {
            onSelect(country);
          }
        });
      }
    }).addTo(map);

    return () => {
      countryLayer.removeFrom(map);
    };
  }, [byIso, geojson, map, metrics, onSelect, selectedKey]);

  useEffect(() => {
    const renderer = L.canvas({ pane: "flows", padding: 0.35 });
    const flowLayers = flows.map((flow) =>
      L.polyline(flow.coordinates, {
        pane: "flows",
        renderer,
        color: normalizeHex(flow.color),
        opacity: Math.min(0.82, Math.max(0.22, flow.opacity)),
        weight: Math.max(1, flow.score * 0.7),
        dashArray: flow.data_status === "Demo" ? "5 8" : undefined
      })
        .bindTooltip(`${flow.from} -> ${flow.to} (${flow.data_status})`)
        .addTo(map)
    );
    return () => {
      flowLayers.forEach((layer) => layer.removeFrom(map));
    };
  }, [flows, map]);

  useEffect(() => {
    const markerLayers = markerGroups.map((group) =>
      L.marker([group.latitude, group.longitude], {
        pane: "markers",
        icon: makeMarkerIcon(group),
        keyboard: true,
        title: `${group.actor} signal indicators: ${group.country}`
      })
        .bindPopup(markerPopupHtml(group), { pane: "intel-popups", className: "dark-popup" })
        .addTo(map)
    );
    return () => {
      markerLayers.forEach((layer) => layer.removeFrom(map));
    };
  }, [map, markerGroups]);

  return null;
}

export function MapView(props: Props) {
  return (
    <MapContainer className="leaflet-dashboard-map" center={[24, 18]} zoom={2.05} minZoom={2} maxZoom={7} worldCopyJump>
      <TileLayer url={tileUrl} attribution={tileAttribution} />
      <LeafletLayers {...props} />
    </MapContainer>
  );
}
