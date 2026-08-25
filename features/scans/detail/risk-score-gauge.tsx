import type { RiskLevel } from "@/lib/types";
import { riskLevelColor } from "@/lib/scans/severity";

// Rule-based risk score shown as a donut gauge. Score and level come from
// `getRiskAssessment` (deterministic, AI-independent), so this stays comparable
// across scans regardless of whether an AI summary has been generated. Rendered
// as a borderless section inside the summary band's right sidebar.

const SIZE = 92;
const STROKE = 9;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const sectionLabel =
  "text-xs font-semibold uppercase tracking-wide text-muted-foreground";

type RiskScoreGaugeProps = {
  score: number;
  level: RiskLevel;
};

export function RiskScoreGauge({ score, level }: RiskScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const offset = CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <div>
      <p className={sectionLabel}>Risk score</p>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="-rotate-90"
            aria-hidden
          >
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
            stroke="currentColor"
            className="text-muted"
              strokeWidth={STROKE}
            />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={riskLevelColor[level]}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              className="transition-[stroke-dashoffset] duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold text-foreground">
              {clamped}
            </span>
            <span className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
              / 100
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold capitalize text-foreground">
            {level} risk
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Rule-based score
          </p>
        </div>
      </div>
    </div>
  );
}
