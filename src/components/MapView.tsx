import { useEffect, useMemo, useRef } from "react";
import maplibregl, { type Map, type MapLayerMouseEvent, type Popup } from "maplibre-gl";
import { workbookColorExpression } from "../data/colors";
import { formatScore, metricLabels } from "../data/scoring";
import type { ActorMode, CountryScore, MetricKey } from "../data/types";
import { useMapData } from "../hooks/useMapData";

type Props = {
  actor: ActorMode;
  metric: MetricKey;
  scores: CountryScore[];
  selectedIso?: string;
  onSelect: (iso3: string, country?: string) => void;
};

const sourceId = "influence-countries";
const fillLayerId = "influence-fills";
const lineLayerId = "influence-lines";
const pointLayerId = "influence-points";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function MapView({ actor, metric, scores, selectedIso, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const { data, error } = useMapData(actor);

  const pointFallback = useMemo<GeoJSON.FeatureCollection>(() => {
    const activeScores = actor === "Compare" ? scores : scores.filter((score) => score.actor === actor);
    return {
      type: "FeatureCollection",
      features: activeScores
        .filter((score) => typeof score.latitude === "number" && typeof score.longitude === "number")
        .map((score) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [score.longitude as number, score.latitude as number] },
          properties: score
        }))
    };
  }, [actor, scores]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [20, 18],
      zoom: 1.25,
      minZoom: 1,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "(c) OpenStreetMap contributors"
          }
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
            paint: { "raster-saturation": -0.6, "raster-opacity": 0.55 }
          }
        ]
      }
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const geojson = data && data.features.length ? data : pointFallback;
    if (!map || !geojson) return;

    const addOrUpdate = () => {
      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geojson);
        return;
      }
      map.addSource(sourceId, { type: "geojson", data: geojson });
      map.addLayer({
        id: fillLayerId,
        type: "fill",
        source: sourceId,
        filter: ["==", "$type", "Polygon"],
        paint: {
          "fill-color": workbookColorExpression(metric) as any,
          "fill-opacity": ["case", ["has", metric], ["coalesce", ["get", "map_opacity"], ["+", 0.25, ["*", ["coalesce", ["get", "confidence_score"], 0.5], 0.55]]], 0.18]
        }
      });
      map.addLayer({
        id: lineLayerId,
        type: "line",
        source: sourceId,
        filter: ["==", "$type", "Polygon"],
        paint: {
          "line-color": ["case", ["==", ["get", "iso3"], selectedIso ?? ""], "#111827", "#ffffff"],
          "line-width": ["case", ["==", ["get", "iso3"], selectedIso ?? ""], 2.2, 0.6],
          "line-opacity": 0.8
        }
      });
      map.addLayer({
        id: pointLayerId,
        type: "circle",
        source: sourceId,
        filter: ["==", "$type", "Point"],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 5, 4, 10],
          "circle-color": workbookColorExpression(metric) as any,
          "circle-opacity": ["coalesce", ["get", "map_opacity"], ["+", 0.35, ["*", ["coalesce", ["get", "confidence_score"], 0.5], 0.5]]],
          "circle-stroke-color": ["case", ["==", ["get", "iso3"], selectedIso ?? ""], "#111827", "#ffffff"],
          "circle-stroke-width": ["case", ["==", ["get", "iso3"], selectedIso ?? ""], 2.5, 1]
        }
      });

      const clickHandler = (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        const props = feature?.properties as Record<string, string> | undefined;
        if (props?.iso3) onSelect(props.iso3, props.country);
      };
      const hoverHandler = (event: MapLayerMouseEvent) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = event.features?.[0];
        const props = feature?.properties as Record<string, string | number> | undefined;
        if (!props) return;
        const value = typeof props[metric] === "number" ? (props[metric] as number) : Number(props[metric]);
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false })
          .setLngLat(event.lngLat)
          .setHTML(
            `<strong>${escapeHtml(props.country ?? "Country")}</strong><span>${escapeHtml(props.actor ?? actor)}</span><span>${escapeHtml(metricLabels[metric])}: ${escapeHtml(formatScore(value, metric))}</span><span>Confidence: ${escapeHtml(formatScore(Number(props.confidence_score ?? 0), "confidence_score"))}</span>`
          )
          .addTo(map);
      };
      const leaveHandler = () => {
        map.getCanvas().style.cursor = "";
        popupRef.current?.remove();
      };
      [fillLayerId, pointLayerId].forEach((layerId) => {
        map.on("click", layerId, clickHandler);
        map.on("mousemove", layerId, hoverHandler);
        map.on("mouseleave", layerId, leaveHandler);
      });
    };

    if (map.loaded()) addOrUpdate();
    else map.once("load", addOrUpdate);
  }, [actor, data, metric, onSelect, pointFallback, selectedIso]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer(fillLayerId)) return;
    map.setPaintProperty(fillLayerId, "fill-color", workbookColorExpression(metric) as any);
    map.setPaintProperty(pointLayerId, "circle-color", workbookColorExpression(metric) as any);
  }, [metric]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer(lineLayerId)) return;
    map.setPaintProperty(lineLayerId, "line-color", ["case", ["==", ["get", "iso3"], selectedIso ?? ""], "#111827", "#ffffff"]);
    map.setPaintProperty(lineLayerId, "line-width", ["case", ["==", ["get", "iso3"], selectedIso ?? ""], 2.2, 0.6]);
    map.setPaintProperty(pointLayerId, "circle-stroke-color", ["case", ["==", ["get", "iso3"], selectedIso ?? ""], "#111827", "#ffffff"]);
    map.setPaintProperty(pointLayerId, "circle-stroke-width", ["case", ["==", ["get", "iso3"], selectedIso ?? ""], 2.5, 1]);
  }, [selectedIso]);

  return (
    <section className="map-shell">
      <div ref={containerRef} className="map-container" aria-label="Interactive influence map" />
      {error && <div className="map-notice">Map layer not generated yet: {error}</div>}
    </section>
  );
}
