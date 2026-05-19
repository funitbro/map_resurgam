export type Actor = "Russia" | "USA" | "China";
export type ActorFilter = Actor | "All";
export type MetricKey = "composite" | "influence" | "security" | "propaganda" | "election";

export type MetricDatum = {
  score: number;
  color: string;
  confidence: string;
  opacity: number;
  label: string;
};

export type MapCountry = {
  actor: Actor;
  actor_slug: string;
  country: string;
  iso3: string;
  region: string;
  latitude: number;
  longitude: number;
  layer_status: string;
  last_updated: string;
  notes: string;
  publication_status: string;
  data_status: "Demo" | "Verified";
  demo_warning: string;
  metrics: Record<MetricKey, MetricDatum>;
  composite_score: number;
  map_color: string;
  map_opacity: number;
  confidence: string;
};

export type EvidenceRow = {
  actor?: Actor;
  Evidence_ID: string;
  Country: string;
  ISO3: string;
  Region: string;
  Factor: string;
  Indicator: string;
  Indicator_Score_0_5: number;
  Source_Tier: string;
  Source_Name: string;
  Source_URL?: string;
  Source_Domain?: string;
  Analyst_Notes?: string;
  Evidence_Status?: string;
};

export type SourceRow = {
  actor?: Actor;
  Source_ID: string;
  Source_Name: string;
  Default_Tier: string;
  Reliability_Weight: number;
  URL?: string;
  Useful_For_Factor?: string;
  Notes?: string;
};

export type LegendRow = {
  Score?: number;
  Risk_Label?: string;
  Hex_Colour_NoHash?: string;
  Default_Opacity?: number;
  Meaning?: string;
  Confidence_Band?: string;
  Opacity?: number;
  Confidence_Range?: string;
  Factor?: string;
  Layer_Display_Name?: string;
  Default_Visible?: string;
  Layer_Description?: string;
};

export type Flow = {
  id: string;
  actor: Actor;
  from: string;
  to: string;
  iso3: string;
  score: number;
  color: string;
  opacity: number;
  coordinates: [number, number][];
  data_status: "Demo";
  warning: string;
};

export type SignalMarker = {
  id: string;
  actor: Actor;
  kind: "security" | "digital" | "channel";
  label: string;
  country: string;
  iso3: string;
  score: number;
  latitude: number;
  longitude: number;
  color: string;
  data_status: "Demo";
  warning: string;
};

export type BuildSummary = {
  map_rows: number;
  joined_features: number;
  demo_flows: number;
  demo_markers: number;
  source_workbook: string;
  demo_notice: string;
};
