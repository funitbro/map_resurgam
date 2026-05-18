import { useMemo, useState } from "react";
import { formatScore, metricShortLabels } from "../data/scoring";
import type { Actor, CountryScore, MetricKey } from "../data/types";

type Props = {
  actor: Actor;
  scores: CountryScore[];
  onSelect: (score: CountryScore) => void;
};

const columns: MetricKey[] = [
  "composite_score",
  "influence_score",
  "pmc_psc_score",
  "propaganda_score",
  "election_interference_score",
  "confidence_score"
];

export function RankedTable({ actor, scores, onSelect }: Props) {
  const [sortBy, setSortBy] = useState<MetricKey>("composite_score");
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return scores
      .filter((score) => score.actor === actor)
      .filter((score) => !needle || score.country.toLowerCase().includes(needle))
      .sort((a, b) => b[sortBy] - a[sortBy]);
  }, [actor, scores, search, sortBy]);

  return (
    <section className="table-panel">
      <div className="table-toolbar">
        <h2>Ranked table</h2>
        <label>
          <span>Search</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Country" />
        </label>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Country</th>
              {columns.map((column) => (
                <th key={column}>
                  <button type="button" onClick={() => setSortBy(column)} className={sortBy === column ? "active-sort" : ""}>
                    {metricShortLabels[column]}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((score, index) => (
              <tr key={`${score.actor}-${score.iso3}`} onClick={() => onSelect(score)}>
                <td>{index + 1}</td>
                <td>{score.country}</td>
                {columns.map((column) => (
                  <td key={column}>{formatScore(score[column], column)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

