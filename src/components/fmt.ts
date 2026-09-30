// Presentation formatters — the ONLY place fractions become %.

export const fmtUsd = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(2)}K`;
  return `$${v.toFixed(2)}`;
};

export const fmtPct = (f: number | null | undefined): string =>
  f === null || f === undefined || !Number.isFinite(f) ? "unavailable" : `${(f * 100).toFixed(2)}%`;

export const fmtInt = (v: number | null | undefined): string =>
  v === null || v === undefined ? "—" : String(Math.round(v));

export const shortAddr = (a: string): string =>
  a.length <= 12 ? a : `${a.slice(0, 4)}…${a.slice(-4)}`;

export const fmtSpan = (sec: number | null): string => {
  if (sec === null) return "—";
  if (sec < 120) return `${sec.toFixed(0)}s`;
  if (sec < 7200) return `${(sec / 60).toFixed(1)}m`;
  return `${(sec / 3600).toFixed(1)}h`;
};
