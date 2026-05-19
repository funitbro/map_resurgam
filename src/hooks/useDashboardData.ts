import { useEffect, useState } from "react";
import type { BuildSummary, EvidenceRow, Flow, LegendRow, MapCountry, SignalMarker, SourceRow } from "../data/types";

type DashboardData = {
  countries: MapCountry[];
  joined: GeoJSON.FeatureCollection;
  flows: Flow[];
  markers: SignalMarker[];
  legend: LegendRow[];
  evidence: EvidenceRow[];
  sources: SourceRow[];
  rules: Record<string, unknown>[];
  summary?: BuildSummary;
};

const emptyCollection: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export function useDashboardData() {
  const [data, setData] = useState<DashboardData>({
    countries: [],
    joined: emptyCollection,
    flows: [],
    markers: [],
    legend: [],
    evidence: [],
    sources: [],
    rules: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [countries, joined, flows, markers, legend, evidence, sources, rules, summary] = await Promise.all([
          fetch("/data/normalized_map_data.json").then((response) => response.json()),
          fetch("/data/joined_countries.geojson").then((response) => response.json()),
          fetch("/data/flows.json").then((response) => response.json()),
          fetch("/data/markers.json").then((response) => response.json()),
          fetch("/data/legend_config.json").then((response) => response.json()),
          fetch("/data/evidence_log.json").then((response) => response.json()),
          fetch("/data/source_register.json").then((response) => response.json()),
          fetch("/data/rules_weights.json").then((response) => response.json()),
          fetch("/data/build_summary.json").then((response) => response.json())
        ]);
        if (!active) return;
        setData({ countries, joined, flows, markers, legend, evidence, sources, rules, summary });
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load dashboard data");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  return { data, loading, error };
}
