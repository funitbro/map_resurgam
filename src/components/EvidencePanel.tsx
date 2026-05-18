import type { EvidenceItem } from "../data/types";

type Props = {
  evidence: EvidenceItem[];
};

export function EvidencePanel({ evidence }: Props) {
  if (!evidence.length) {
    return <p className="empty-state">No country-specific evidence rows are available for this selection.</p>;
  }

  const grouped = evidence.reduce<Record<string, EvidenceItem[]>>((acc, item) => {
    acc[item.category] = [...(acc[item.category] ?? []), item];
    return acc;
  }, {});

  return (
    <div className="evidence-list">
      {Object.entries(grouped).map(([category, items]) => (
        <section key={category}>
          <h4>{category}</h4>
          {items.map((item, index) => (
            <article className="evidence-item" key={`${item.claim}-${index}`}>
              <p>{item.claim}</p>
              <div className="evidence-meta">
                <span>{item.source_name}</span>
                {item.reliability && <span>{item.reliability}</span>}
                {item.date_accessed && <span>{item.date_accessed}</span>}
              </div>
              {item.source_url && (
                <a href={item.source_url} target="_blank" rel="noreferrer">
                  Open source
                </a>
              )}
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}

