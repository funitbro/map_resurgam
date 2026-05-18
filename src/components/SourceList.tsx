import type { SourceItem } from "../data/types";

type Props = {
  sources: SourceItem[];
};

export function SourceList({ sources }: Props) {
  const visible = sources.slice(0, 8);
  if (!visible.length) return null;
  return (
    <div className="source-list">
      <h4>Source register</h4>
      {visible.map((source) => (
        <a key={`${source.actor}-${source.source_name}`} href={source.url || undefined} target="_blank" rel="noreferrer">
          <span>{source.source_name}</span>
          <small>{source.publisher || source.source_type || source.reliability}</small>
        </a>
      ))}
    </div>
  );
}

