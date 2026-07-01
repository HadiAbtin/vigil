import type { MetricSeries } from "@/lib/types";

export type ChartRangeKey = "5m" | "1h" | "today" | "7d";
export type RefreshKey = "off" | "5s" | "10s" | "30s" | "60s";

export const RANGE_OPTIONS: { key: ChartRangeKey; label: string }[] = [
  { key: "5m", label: "5m" },
  { key: "1h", label: "1h" },
  { key: "today", label: "Today" },
  { key: "7d", label: "7d" },
];

export const REFRESH_OPTIONS: { key: RefreshKey; label: string; ms: number | false }[] = [
  { key: "off", label: "Off", ms: false },
  { key: "5s", label: "5s", ms: 5000 },
  { key: "10s", label: "10s", ms: 10000 },
  { key: "30s", label: "30s", ms: 30000 },
  { key: "60s", label: "60s", ms: 60000 },
];

export function computeRange(key: ChartRangeKey): { start: number; end: number } {
  const end = Math.floor(Date.now() / 1000);
  let start: number;
  switch (key) {
    case "5m":
      start = end - 5 * 60;
      break;
    case "1h":
      start = end - 60 * 60;
      break;
    case "today": {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      start = Math.floor(midnight.getTime() / 1000);
      break;
    }
    case "7d":
      start = end - 7 * 24 * 60 * 60;
      break;
  }
  return { start, end };
}

export function formatTimeTick(ts: number, rangeKey: ChartRangeKey, withSeconds = false): string {
  const d = new Date(ts * 1000);
  if (rangeKey === "7d") {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  if (rangeKey === "today" && !withSeconds) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
  });
}

export function formatValue(value: number, unit: string): string {
  if (Number.isNaN(value)) return "—";
  if (unit === "%") return `${value.toFixed(1)}%`;
  if (unit === "ms") {
    if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
    // Keep a decimal even in the tens/hundreds range — axis ticks on a narrow
    // window (e.g. 14-15ms of jitter) would otherwise round to duplicate
    // labels ("15ms", "15ms", "15ms") and look broken.
    return `${value.toFixed(value < 10 ? 2 : 1)}ms`;
  }
  if (unit === "code") return String(Math.round(value));
  return new Intl.NumberFormat(undefined, {
    notation: Math.abs(value) >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 2,
  }).format(value);
}

export type ChartRow = { t: number } & Record<string, number>;

export function mergeSeries(series: MetricSeries[]): ChartRow[] {
  const rows = new Map<number, ChartRow>();
  for (const s of series) {
    for (const [t, v] of s.points) {
      const row = rows.get(t) ?? ({ t } as ChartRow);
      row[s.name] = v;
      rows.set(t, row);
    }
  }
  return Array.from(rows.values()).sort((a, b) => a.t - b.t);
}

export function computeYDomain(rows: ChartRow[], keys: string[], unit: string): [number, number] {
  if (unit === "%") return [0, 100];

  let min = Infinity;
  let max = -Infinity;
  for (const row of rows) {
    for (const key of keys) {
      const v = row[key];
      if (typeof v === "number" && !Number.isNaN(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.15);
    return [Math.max(0, min - pad), max + pad];
  }
  const pad = (max - min) * 0.15;
  return [Math.max(0, min - pad), max + pad];
}

export const SERIES_COLORS = ["#22d3ee", "#3b82f6", "#34d399", "#fbbf24", "#f8617a", "#a78bfa"];
