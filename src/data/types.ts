export type Actor = "Russia" | "USA" | "China";
export type ActorMode = Actor | "Compare";

export type MetricKey =
  | "composite_score"
  | "influence_score"
  | "pmc_psc_score"
  | "propaganda_score"
  | "election_interference_score"
  | "confidence_score";

export type ViewMode = "map" | "table" | "country" | "evidence";

export type CountryScore = {
  actor: Actor;
  country: string;
  iso3: string;
  region?: string;
  latitude?: number | null;
  longitude?: number | null;
  composite_score: number;
  influence_score: number;
  pmc_psc_score: number;
  propaganda_score: number;
  election_interference_score: number;
  confidence_score: number;
  confidence_band: "High" | "Medium" | "Low";
  map_color?: string;
  map_opacity?: number;
  short_rationale?: string;
  caveats?: string;
  last_updated?: string;
};

export type EvidenceItem = {
  actor: Actor;
  country: string;
  iso3?: string;
  category: "Influence" | "PMC/PSC" | "Propaganda" | "Election interference" | "Confidence" | "General";
  claim: string;
  source_name: string;
  source_url?: string;
  source_type?: string;
  reliability?: "High" | "Medium" | "Low" | string;
  date_accessed?: string;
  notes?: string;
};

export type SourceItem = {
  actor: Actor;
  source_name: string;
  url?: string;
  publisher?: string;
  source_type?: string;
  reliability?: "High" | "Medium" | "Low" | string;
  notes?: string;
};

export type ComparisonRow = {
  country: string;
  iso3: string;
  Russia?: CountryScore;
  USA?: CountryScore;
  China?: CountryScore;
  highestActor: Actor;
  scoreDifference: number;
  dominantDimension: MetricKey;
};

