import { useEffect, useState } from "react";
import type { CountryScore } from "../data/types";

export function useScores() {
  const [scores, setScores] = useState<CountryScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let active = true;
    fetch("/data/scores.json")
      .then((response) => {
        if (!response.ok) throw new Error(`scores.json returned ${response.status}`);
        return response.json();
      })
      .then((data: CountryScore[]) => {
        if (active) setScores(data);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { scores, loading, error };
}

