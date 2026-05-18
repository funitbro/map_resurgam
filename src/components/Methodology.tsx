type Props = {
  onClose: () => void;
};

export function Methodology({ onClose }: Props) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="methodology-title">
      <section className="methodology">
        <div className="panel-heading">
          <div>
            <span>Scoring model</span>
            <h2 id="methodology-title">Methodology</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close methodology">
            x
          </button>
        </div>
        <p>
          Scores use a 0-5 scale. The composite score is the average of influence/leverage, PMC/PSC or contractor presence,
          propaganda ecosystem activity, and election or political-process interference unless a workbook provides a trusted
          composite score.
        </p>
        <p>
          Confidence reflects source quality, number of sources, specificity, and recency. It is normalized to 0-1 for map
          opacity and shown as High, Medium, or Low in detail views.
        </p>
        <ul>
          <li>Russia PMC/PSC scoring covers Wagner, Africa Corps, and PMC-style military presence.</li>
          <li>USA scoring covers contractors, security contractors, military-support contractors, and PMC-like presence.</li>
          <li>China scoring covers private security companies, overseas police or security cooperation, GSI-linked security activity, and PLA-linked facility access.</li>
          <li>Election interference is scored conservatively. Diplomacy or democracy assistance alone is not enough.</li>
        </ul>
        <p className="disclaimer">
          This map is an analytical visualization based on open-source evidence and structured scoring. It should not be treated
          as a legal finding or definitive attribution.
        </p>
      </section>
    </div>
  );
}

