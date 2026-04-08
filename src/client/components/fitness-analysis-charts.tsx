"use client";

import {
  clampPercent,
  humanizeToken,
  type CriterionResult,
  type FitnessReport,
} from "./fitness-analysis-types";
import { useTranslation } from "@/i18n";

const DIMENSION_ORDER = ["context", "governance", "harness", "collaboration", "sdlc"] as const;
const LEVEL_ORDER = [
  "awareness",
  "assisted_coding",
  "structured_ai_coding",
  "agent_centric",
  "agent_first",
] as const;

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const angle = (angleDeg - 90) * (Math.PI / 180);
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function buildRadarPoints(report: FitnessReport, radius: number, cx: number, cy: number) {
  return DIMENSION_ORDER.map((dimension, index) => {
    const score = clampPercent(report.dimensions[dimension]?.score ?? 0);
    const angle = (360 / DIMENSION_ORDER.length) * index;
    const point = polarToCartesian(cx, cy, (radius * score) / 100, angle);
    const labelPoint = polarToCartesian(cx, cy, radius + 18, angle);
    return {
      dimension,
      label: report.dimensions[dimension]?.name ?? humanizeToken(dimension),
      score,
      point,
      labelPoint,
      angle,
    };
  });
}

export function FluencyRadarChart({ report, compact = false }: { report: FitnessReport; compact?: boolean }) {
  const svgSize = compact ? 220 : 260;
  const center = svgSize / 2;
  const radius = compact ? 62 : 78;
  const points = buildRadarPoints(report, radius, center, center);
  const polygonPoints = points.map(({ point }) => `${point.x},${point.y}`).join(" ");

  return (
    <section className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-white/80 p-4 dark:bg-white/6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 dark:text-slate-400">Readiness radar</div>
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <svg viewBox={`0 0 ${svgSize} ${svgSize}`} className={`overflow-visible ${compact ? "h-[220px] w-[220px]" : "h-[260px] w-[260px]"}`}>
          {[25, 50, 75, 100].map((ring) => (
            <polygon
              key={ring}
              points={DIMENSION_ORDER.map((_, index) => {
                const { x, y } = polarToCartesian(center, center, (radius * ring) / 100, (360 / DIMENSION_ORDER.length) * index);
                return `${x},${y}`;
              }).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.14}
              strokeWidth="1"
            />
          ))}

          {points.map(({ angle, labelPoint }, index) => {
            const axisEnd = polarToCartesian(center, center, radius, angle);
            return (
              <g key={DIMENSION_ORDER[index]}>
                <line x1={center} y1={center} x2={axisEnd.x} y2={axisEnd.y} stroke="currentColor" strokeOpacity="0.16" strokeWidth="1" />
                <text
                  x={labelPoint.x}
                  y={labelPoint.y}
                  textAnchor={labelPoint.x < center - 8 ? "end" : labelPoint.x > center + 8 ? "start" : "middle"}
                  className="fill-current text-[9px] text-slate-700 dark:text-slate-400"
 >
                  {points[index].label}
                </text>
              </g>
            );
          })}

          <polygon points={polygonPoints} fill="rgba(37, 99, 235, 0.16)" stroke="rgba(37, 99, 235, 0.8)" strokeWidth="2" />
          {points.map(({ point, score, dimension }) => (
            <g key={dimension}>
              <circle cx={point.x} cy={point.y} r="4" fill="rgba(37, 99, 235, 1)" />
              <title>{`${humanizeToken(dimension)} ${score}%`}</title>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

export function FluencyLevelLadder({ report, compact = false }: { report: FitnessReport; compact?: boolean }) {
  const { t } = useTranslation();
  const currentLevel = report.overallLevel;
  const nextLevel = report.nextLevel;

  return (
    <section className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-white/80 p-4 dark:bg-white/6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 dark:text-slate-400">Level ladder</div>
        </div>
      </div>

      <div className={`mt-4 ${compact ? "space-y-2" : "space-y-3"}`}>
        {LEVEL_ORDER.map((level, index) => {
          const levelName = humanizeToken(level);
          const isCurrent = currentLevel === level;
          const isNext = nextLevel === level;
          const isCompleted = LEVEL_ORDER.indexOf(currentLevel as typeof LEVEL_ORDER[number]) > index;

          return (
            <div key={level} className="flex items-center gap-3">
              <div
                className={`flex shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
 compact ? "h-7 w-7" : "h-8 w-8"
 } ${
                  isCurrent
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : isNext
                      ? "border-amber-300 bg-amber-50 text-amber-700"
                      : isCompleted
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-400"
                }`}
              >
                {index + 1}
              </div>
              <div className="min-w-0 flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-200">{levelName}</div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-slate-700 dark:text-slate-400">
                    {isCurrent ? t.fitness.levels.current : isNext ? t.fitness.levels.target : isCompleted ? t.fitness.levels.cleared : t.fitness.levels.locked}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function countBlockersByDimension(blockers: CriterionResult[]) {
  const counts = new Map<string, number>();
  for (const blocker of blockers) {
    counts.set(blocker.dimension, (counts.get(blocker.dimension) ?? 0) + (blocker.critical ? 2 : 1));
  }
  return [...counts.entries()]
    .map(([dimension, count]) => ({ dimension, count }))
    .sort((left, right) => right.count - left.count);
}

export function FluencyBlockerBarChart({ blockers, compact = false }: { blockers: CriterionResult[]; compact?: boolean }) {
  const rows = countBlockersByDimension(blockers);
  const max = Math.max(...rows.map((row) => row.count), 1);

  return (
    <section className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-white/80 p-4 dark:bg-white/6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 dark:text-slate-400">Blocker impact</div>
        </div>
      </div>

      <div className={`mt-4 ${compact ? "space-y-2" : "space-y-3"}`}>
        {rows.length > 0 ? rows.map((row) => (
          <div key={row.dimension} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span className="font-medium text-slate-900 dark:text-slate-200">{humanizeToken(row.dimension)}</span>
              <span className="text-slate-700 dark:text-slate-400">{row.count}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-50 dark:bg-slate-900">
              <div
                className="h-full rounded-full bg-amber-400"
 style={{ width: `${(row.count / max) * 100}%` }}
              />
            </div>
          </div>
        )) : (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-3 py-5 text-sm text-slate-700 dark:text-slate-400">
            当前没有 blocker，可以把重点放在能力提升或趋势对比上。
          </div>
        )}
      </div>
    </section>
  );
}
