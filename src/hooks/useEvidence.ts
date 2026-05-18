import { useEffect, useState } from "react";
import type { EvidenceItem, SourceItem } from "../data/types";

export function useEvidence() {
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [sources, setSources] = useState<SourceItem[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/data/evidence.json").then((response) => (response.ok ? response.json() : [])),
      fetch("/data/sources.json").then((response) => (response.ok ? response.json() : []))
    ]).then(([evidenceData, sourceData]: [EvidenceItem[], SourceItem[]]) => {
      if (!active) return;
      setEvidence(evidenceData);
      setSources(sourceData);
    });
    return () => {
      active = false;
    };
  }, []);

  return { evidence, sources };
}

