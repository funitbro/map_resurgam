import { useMemo } from "react";
import { actors, formatScore, metricShortLabels, scoreMetrics } from "../data/scoring";
import type { Actor, ComparisonRow, CountryScore, MetricKey } from "../data/types";
import { colorForScore } from "../data/colors";

type Props = {
  scores: CountryScore[];
  selectedIso?: string;
  onSelect: (iso3: string) => void;
};

function buildRows(scores: CountryScore[]): ComparisonRow[] {
  const grouped = scores.reduce<Record<string, Partial<Record<Actor, CountryScore>>>>((acc, score) => {
    acc[score.iso3] = { ...(acc[score.iso3] ?? {}), [score.actor]: score };
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([iso3, entries]) => {
      const present = actors.map((actor) => entries[actor]).filter(Boolean) as CountryScore[];
      const sorted = [...present].sort((a, b) => b.composite_score - a.composite_score);
      const highest = sorted[0];
      const second = sorted[1];
      const dominantDimension = scoreMetrics.reduce((best, metric) => (highest[metric] > highest[best] ? metric : best), "influence_score" as MetricKey);
      return {
        country: highest.country,
        iso3,
        Russia: entries.Russia,
        USA: entries.USA,
        China: entries.China,
        highestActor: highest.actor,
        scoreDifference: second ? Number((highest.composite_score - second.composite_score).toFixed(2)) : 0,
        dominantDimension
      };
    })
    .sort((a, b) => Math.max(b.Russia?.composite_score ?? 0, b.USA?.composite_score ?? 0, b.China?.composite_score ?? 0) - Math.max(a.Russia?.composite_score ?? 0, a.USA?.composite_score ?? 0, a.China?.composite_score ?? 0));
}

export function ComparePanel({ scores, selectedIso, onSelect }: Props) {
  const rows = useMemo(() => buildRows(scores), [scores]);
  const selected = rows.find((row) => row.iso3 === selectedIso) ?? rows[0];

  return (
    <section className="compare-panel">
      <div className="comparison-chart">
        <h2>{selected ? selected.country : "Comparison"}</h2>
        {selected &&
          scoreMetrics.map((metric) => (
            <div className="compare-row" key={metric}>
              <span>{metricShortLabels[metric]}</span>
              {actors.map((actor) => {
                const value = selected[actor]?.[metric];
                return (
                  <div key={actor}>
                    <small>{actor}</small>
                    <i style={{ width: `${((value ?? 0) / 5) * 100}%`, background: colorForScore(value, metric) }} />
                    <strong>{formatScore(value, metric)}</strong>
                  </div>
                );
              })}
            </div>
          ))}
      </div>
      <div className="table-scroll compact">
        <table>
          <thead>
            <tr>
              <th>Country</th>
              <th>Russia</th>
              <th>USA</th>
              <th>China</th>
              <th>Highest</th>
              <th>Diff.</th>
              <th>Dominant</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.iso3} className={row.iso3 === selectedIso ? "selected" : ""} onClick={() => onSelect(row.iso3)}>
                <td>{row.country}</td>
                <td>{formatScore(row.Russia?.composite_score)}</td>
                <td>{formatScore(row.USA?.composite_score)}</td>
                <td>{formatScore(row.China?.composite_score)}</td>
                <td>{row.highestActor}</td>
                <td>{row.scoreDifference.toFixed(2)}</td>
                <td>{metricShortLabels[row.dominantDimension]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

