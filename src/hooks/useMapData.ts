import { useEffect, useState } from "react";
import type { ActorMode } from "../data/types";

export function useMapData(actor: ActorMode) {
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [error, setError] = useState("");
  const slug = actor === "Compare" ? "comparison" : actor.toLowerCase();

  useEffect(() => {
    let active = true;
    setData(null);
    fetch(`/data/map_layers/${slug}.geojson`)
      .then((response) => {
        if (!response.ok) throw new Error(`${slug}.geojson returned ${response.status}`);
        return response.json();
      })
      .then((geojson: GeoJSON.FeatureCollection) => {
        if (active) setData(geojson);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  return { data, error };
}

