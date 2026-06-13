type ScoreSummaryCard = {
  label: string;
  value: string;
  tone: "accent" | "neutral" | "signal";
  wide?: boolean;
};

type ScoreMetricView = {
  key: string;
  label: string;
  score: string;
  share: string;
  evidence: string;
};

export type ScoreEvidencePanelProps = {
  radarLabel: string;
  summaryCards: ScoreSummaryCard[];
  metrics: ScoreMetricView[];
};

type Point = { x: number; y: number };

function polarPoint(index: number, count: number, radius: number, center: number): Point {
  const angle = -Math.PI / 2 + index * ((Math.PI * 2) / count);
  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
  };
}

function polygonPoints(count: number, radius: number, center: number): string {
  return Array.from({ length: count }, (_, index) => {
    const point = polarPoint(index, count, radius, center);
    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }).join(" ");
}

function dataPoints(metrics: ScoreMetricView[], radius: number, center: number): string {
  return metrics
    .map((metric, index) => {
      const rawScore = Number.parseFloat(metric.score);
      const magnitude = Number.isFinite(rawScore) ? Math.max(0.18, Math.min(1, rawScore / 100)) : 0.18;
      const point = polarPoint(index, metrics.length, radius * magnitude, center);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}

function labelAnchor(x: number, center: number): "start" | "middle" | "end" {
  if (x < center - 18) return "end";
  if (x > center + 18) return "start";
  return "middle";
}

function labelDx(anchor: "start" | "middle" | "end"): number {
  if (anchor === "start") return 10;
  if (anchor === "end") return -10;
  return 0;
}

function labelDy(y: number, center: number): number {
  if (y < center - 20) return -10;
  if (y > center + 20) return 18;
  return 4;
}

export function ScoreEvidencePanel(props: ScoreEvidencePanelProps) {
  const size = 420;
  const center = size / 2;
  const radius = 122;
  const labelRadius = 170;
  const rings = [0.25, 0.5, 0.75, 1];
  const polygon = dataPoints(props.metrics, radius, center);

  return (
    <div className="score-evidence-shell">
      <div className="score-hero">
        <div className="score-summary-grid">
          {props.summaryCards.map((card) => (
            <article
              key={`${card.label}-${card.value}`}
              className={`score-summary-card score-summary-${card.tone}${card.wide ? " is-wide" : ""}`}
            >
              <span className="score-summary-label">{card.label}</span>
              <strong className="score-summary-value">{card.value}</strong>
            </article>
          ))}
        </div>

        <div className="score-radar-shell" data-radar-hexagon="true" aria-label={props.radarLabel}>
          <div className="score-radar-stage">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-hidden="true">
              {rings.map((ring) => (
                <polygon
                  key={ring}
                  className="score-radar-ring"
                  points={polygonPoints(props.metrics.length, radius * ring, center)}
                />
              ))}

              {props.metrics.map((metric, index) => {
                const outerPoint = polarPoint(index, props.metrics.length, radius, center);
                const labelPoint = polarPoint(index, props.metrics.length, labelRadius, center);
                const anchor = labelAnchor(labelPoint.x, center);
                const metricPoint = polarPoint(
                  index,
                  props.metrics.length,
                  radius * Math.max(0.18, Math.min(1, Number.parseFloat(metric.score) / 100)),
                  center,
                );

                return (
                  <g key={metric.key} className={`score-radar-axis score-tone-${(index % 6) + 1}`}>
                    <line x1={center} y1={center} x2={outerPoint.x} y2={outerPoint.y} />
                    <circle cx={metricPoint.x} cy={metricPoint.y} r="5" className="score-radar-point" />
                    <text
                      x={labelPoint.x + labelDx(anchor)}
                      y={labelPoint.y + labelDy(labelPoint.y, center)}
                      textAnchor={anchor}
                      className="score-radar-label"
                    >
                      {metric.label}
                    </text>
                    <text
                      x={labelPoint.x + labelDx(anchor)}
                      y={labelPoint.y + labelDy(labelPoint.y, center) + 18}
                      textAnchor={anchor}
                      className="score-radar-label score-radar-score"
                    >
                      {metric.score}
                    </text>
                  </g>
                );
              })}

              <polygon className="score-radar-fill" points={polygon} />
              <polygon className="score-radar-outline" points={polygon} />
            </svg>
          </div>
        </div>
      </div>

      <div className="score-component-grid">
        {props.metrics.map((metric, index) => (
          <article key={metric.key} className={`score-component-card score-tone-${(index % 6) + 1}`}>
            <div className="score-component-head">
              <div className="score-component-title">
                <span className="score-component-index">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{metric.label}</h3>
                  <p>{metric.share}</p>
                </div>
              </div>
              <strong className="score-component-score">{metric.score}</strong>
            </div>
            <p className="score-component-evidence">{metric.evidence}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
