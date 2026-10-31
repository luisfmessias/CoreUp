"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export type ChartPoint = { label: string; value: number };

const width = 320;
const height = 150;
const pad = { top: 16, right: 44, bottom: 22, left: 34 };

export function LineChart({
  points,
  formatValue,
  title
}: {
  points: ChartPoint[];
  formatValue: (value: number) => string;
  title: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const values = points.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = rawMax - rawMin || Math.max(rawMax * 0.1, 1);
  const min = Math.max(0, rawMin - spread * 0.25);
  const max = rawMax + spread * 0.25;
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const x = (index: number) => pad.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) => pad.top + plotHeight - ((value - min) / (max - min)) * plotHeight;
  const ticks = [min, (min + max) / 2, max];
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
  const last = points.length - 1;
  const shown = active ?? null;

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const localX = ((event.clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    points.forEach((_, index) => {
      if (Math.abs(x(index) - localX) < Math.abs(x(nearest) - localX)) nearest = index;
    });
    setActive(nearest);
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "ArrowRight") setActive((index) => Math.min((index ?? -1) + 1, last));
    if (event.key === "ArrowLeft") setActive((index) => Math.max((index ?? last + 1) - 1, 0));
  }

  return (
    <div>
      <div className="relative">
        <svg
          ref={svgRef}
          aria-label={`${title}. Use as setas para ver cada valor.`}
          className="block h-auto w-full touch-none select-none focus:outline-none focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-accent"
          onBlur={() => setActive(null)}
          onFocus={() => setActive(last)}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerMove}
          onPointerLeave={() => setActive(null)}
          onPointerMove={onPointerMove}
          role="img"
          tabIndex={0}
          viewBox={`0 0 ${width} ${height}`}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line stroke="rgba(255,255,255,0.07)" strokeWidth="1" x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} />
              <text className="fill-white/40 text-[10px] tabular-nums" textAnchor="end" x={pad.left - 6} y={y(tick) + 3}>
                {Math.round(tick)}
              </text>
            </g>
          ))}

          {shown !== null && (
            <line stroke="rgba(255,255,255,0.25)" strokeWidth="1" x1={x(shown)} x2={x(shown)} y1={pad.top} y2={pad.top + plotHeight} />
          )}

          {points.length > 1 && (
            <path d={path} fill="none" stroke="var(--color-accent)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          )}

          {points.map((point, index) => (
            <circle
              key={`${point.label}-${index}`}
              cx={x(index)}
              cy={y(point.value)}
              fill="var(--color-accent)"
              r={index === shown ? 5 : 4}
              stroke="var(--color-ink)"
              strokeWidth="2"
            />
          ))}

          <text className="fill-white/85 text-[11px] font-medium tabular-nums" x={x(last) + 8} y={y(points[last].value) + 4}>
            {formatValue(points[last].value)}
          </text>

          <text className="fill-white/40 text-[10px]" textAnchor="start" x={pad.left} y={height - 4}>
            {points[0].label}
          </text>
          {points.length > 1 && (
            <text className="fill-white/40 text-[10px]" textAnchor="end" x={width - pad.right} y={height - 4}>
              {points[last].label}
            </text>
          )}
        </svg>

        {shown !== null && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-white/10 bg-[#161a18] px-2.5 py-1.5 text-xs shadow-lg"
            role="status"
            style={{ left: `${(Math.min(Math.max(x(shown), 60), width - 60) / width) * 100}%` }}
          >
            <span className="block font-semibold tabular-nums text-white">{formatValue(points[shown].value)}</span>
            <span className="block text-white/55">{points[shown].label}</span>
          </div>
        )}
      </div>

      <details className="mt-2 text-xs text-white/55">
        <summary className="cursor-pointer select-none hover:text-white/80">Ver dados em tabela</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-white/40">
              <th className="py-1 font-normal">Data</th>
              <th className="py-1 text-right font-normal">Valor</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point, index) => (
              <tr key={`${point.label}-${index}`} className="border-t border-white/[0.06]">
                <td className="py-1">{point.label}</td>
                <td className="py-1 text-right tabular-nums text-white/80">{formatValue(point.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
