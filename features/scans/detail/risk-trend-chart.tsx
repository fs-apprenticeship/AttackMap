"use client";

import { useMemo, useState } from "react";

import type { RiskTrendPoint } from "@/lib/scans/trend";
import { riskLevelColor } from "@/lib/scans/severity";

// Single-series line: risk score (0-100) over time for one target's scan
// history. Mark specs follow the app's existing gauge conventions (see
// risk-score-gauge.tsx) — 2px line, >=8px markers colored by risk level, a
// 2px surface-color ring so markers stay legible where the line crosses them.

const WIDTH = 600;
const HEIGHT = 200;
const PAD_X = 28;
const PAD_TOP = 20;
const PAD_BOTTOM = 28;
const PLOT_WIDTH = WIDTH - PAD_X * 2;
const PLOT_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM;
const Y_TICKS = [0, 50, 100];

type PlottedPoint = RiskTrendPoint & { x: number; y: number };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function layoutPoints(points: RiskTrendPoint[]): PlottedPoint[] {
  const times = points.map((p) => new Date(p.at).getTime());
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const span = maxTime - minTime;

  return points.map((point, i) => {
    const t = times[i];
    // All points share one timestamp (span === 0): space them evenly instead
    // of collapsing onto a single x.
    const fraction = span > 0 ? (t - minTime) / span : points.length > 1 ? i / (points.length - 1) : 0.5;
    return {
      ...point,
      x: PAD_X + fraction * PLOT_WIDTH,
      y: PAD_TOP + (1 - point.riskScore / 100) * PLOT_HEIGHT,
    };
  });
}

type RiskTrendChartProps = {
  points: RiskTrendPoint[];
  currentScanId?: string;
};

export function RiskTrendChart({ points, currentScanId }: RiskTrendChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const plotted = useMemo(() => layoutPoints(points), [points]);
  const path = useMemo(
    () => plotted.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "),
    [plotted],
  );
  const last = plotted[plotted.length - 1];
  const active = activeIndex !== null ? plotted[activeIndex] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        role="img"
        aria-label="Risk score over time"
        className="overflow-visible"
      >
        {Y_TICKS.map((tick) => {
          const y = PAD_TOP + (1 - tick / 100) * PLOT_HEIGHT;
          return (
            <g key={tick}>
              <line
                x1={PAD_X}
                x2={WIDTH - PAD_X}
                y1={y}
                y2={y}
                className="stroke-border"
                strokeWidth={1}
              />
              <text x={0} y={y} dy="0.32em" className="fill-muted-foreground text-[10px]">
                {tick}
              </text>
            </g>
          );
        })}

        <path d={path} fill="none" className="stroke-foreground/70" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {plotted.map((point, i) => (
          <g key={point.scanId}>
            <circle
              cx={point.x}
              cy={point.y}
              r={4}
              fill={riskLevelColor[point.riskLevel]}
              stroke="var(--background)"
              strokeWidth={2}
              className={point.scanId === currentScanId ? "opacity-100" : "opacity-90"}
            />
            {/* Hit target wider than the mark, per dataviz interaction guidance. */}
            <circle
              cx={point.x}
              cy={point.y}
              r={12}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${formatDate(point.at)}: risk score ${point.riskScore}, ${point.riskLevel}`}
              onPointerEnter={() => setActiveIndex(i)}
              onPointerLeave={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(i)}
              onBlur={() => setActiveIndex(null)}
              className="cursor-pointer outline-none"
            />
          </g>
        ))}

        {last && (
          <text
            x={last.x}
            y={last.y - 10}
            textAnchor="middle"
            className="fill-foreground text-[11px] font-semibold"
          >
            {last.riskScore}
          </text>
        )}

        {plotted.length > 0 && (
          <>
            <text x={plotted[0].x} y={HEIGHT - 6} textAnchor="start" className="fill-muted-foreground text-[10px]">
              {formatDate(plotted[0].at)}
            </text>
            {plotted.length > 1 && (
              <text x={last.x} y={HEIGHT - 6} textAnchor="end" className="fill-muted-foreground text-[10px]">
                {formatDate(last.at)}
              </text>
            )}
          </>
        )}
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
          style={{
            left: `${(active.x / WIDTH) * 100}%`,
            top: `${(active.y / HEIGHT) * 100}%`,
          }}
        >
          <p className="font-semibold">{active.riskScore} / 100 · <span className="capitalize">{active.riskLevel}</span></p>
          <p className="text-muted-foreground">{formatDate(active.at)} · {active.filename}</p>
        </div>
      )}
    </div>
  );
}
