// Depth curve — share vs cumulative events. Minimal inline SVG; no lib.
// The point of the picture: does the line settle, or keep swinging?

"use client";

import type { DepthPoint } from "@/types";

export function DepthChart({ points, label }: { points: DepthPoint[]; label: string }) {
  const W = 560, H = 140, P = 18;
  const xs = points.map((p) => p.events);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const x = (e: number) => P + (xMax === xMin ? (W - 2 * P) / 2 : ((e - xMin) / (xMax - xMin)) * (W - 2 * P));
  const y = (f: number) => H - P - f * (H - 2 * P);

  const series = (get: (p: DepthPoint) => number | null) =>
    points.map((p) => (get(p) === null ? null : `${x(p.events).toFixed(1)},${y(get(p)!)}`)).filter(Boolean).join(" ");

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="data text-[10px] uppercase tracking-[0.15em] text-faint">{label}</span>
        <span className="data text-[10px] text-dim">
          {points.length ? `${points[0]!.events} → ${points[points.length - 1]!.events} events` : ""}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full">
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line x1={P} x2={W - P} y1={y(g)} y2={y(g)} stroke="#2c2820" strokeWidth="0.5" />
            <text x={2} y={y(g) + 3} fontSize="8" fill="#6b6355" fontFamily="monospace">{Math.round(g * 100)}%</text>
          </g>
        ))}
        <polyline points={series((p) => p.topNShare)} fill="none" stroke="#d8a24a" strokeWidth="1.6" />
        <polyline points={series((p) => p.noBuyShare)} fill="none" stroke="#d4664a" strokeWidth="1.4" strokeDasharray="4 3" />
        {points.map((p, i) => (
          <circle key={i} cx={x(p.events)} cy={p.topNShare === null ? H - P : y(p.topNShare)} r="2.4" fill="#d8a24a" />
        ))}
      </svg>
      <div className="mt-1 flex gap-4 data text-[10px] text-dim">
        <span><span className="text-accent">—</span> top-N share</span>
        <span><span className="text-selltone">- -</span> no-buy-observed share</span>
      </div>
    </div>
  );
}
