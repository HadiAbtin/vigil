import { useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import { metricsApi } from "@/lib/api";
import {
  RANGE_OPTIONS,
  REFRESH_OPTIONS,
  SERIES_COLORS,
  type ChartRangeKey,
  type RefreshKey,
  computeRange,
  computeYDomain,
  formatTimeTick,
  formatValue,
  mergeSeries,
} from "@/lib/chartUtils";
import type { AlertRuleType } from "@/lib/types";
import { LoadingBlock } from "@/components/ui/Misc";

interface MetricChartProps {
  ruleType: AlertRuleType;
  targetId: number;
  field?: "latency" | "status";
  unitLabel?: string;
  height?: number;
  defaultRange?: ChartRangeKey;
  defaultRefresh?: RefreshKey;
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "rounded-md border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide transition-colors",
        active
          ? "border-vigil-cyan/40 bg-vigil-cyan/10 text-vigil-cyan-bright"
          : "border-vigil-border text-vigil-text-dim hover:text-vigil-text",
      )}
    >
      {children}
    </button>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
  unit,
  rangeKey,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number; color: string }[];
  label?: number;
  unit: string;
  rangeKey: ChartRangeKey;
}) {
  if (!active || !payload?.length || label === undefined) return null;
  return (
    <div className="vigil-panel rounded-lg px-3 py-2 shadow-xl">
      <p className="mb-1 font-mono text-[11px] text-vigil-text-faint">{formatTimeTick(label, rangeKey, true)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="font-mono text-xs" style={{ color: p.color }}>
          {p.dataKey}: <span className="text-vigil-text">{formatValue(p.value, unit)}</span>
        </p>
      ))}
    </div>
  );
}

export function MetricChart({
  ruleType,
  targetId,
  field,
  height = 220,
  defaultRange = "1h",
  defaultRefresh = "30s",
}: MetricChartProps) {
  const gradientId = useId().replace(/:/g, "");
  const [rangeKey, setRangeKey] = useState<ChartRangeKey>(defaultRange);
  const [refreshKey, setRefreshKey] = useState<RefreshKey>(defaultRefresh);

  const refetchInterval = REFRESH_OPTIONS.find((r) => r.key === refreshKey)?.ms ?? false;

  const query = useQuery({
    queryKey: ["metric-range", ruleType, targetId, field, rangeKey],
    queryFn: () => {
      const { start, end } = computeRange(rangeKey);
      return metricsApi.range(ruleType, targetId, start, end, field);
    },
    refetchInterval,
    placeholderData: (prev) => prev,
  });

  const { start, end } = computeRange(rangeKey);
  const series = query.data?.series ?? [];
  const unit = query.data?.unit ?? "";
  const rows = useMemo(() => mergeSeries(series), [series]);
  const seriesNames = useMemo(() => series.map((s) => s.name), [series]);
  const yDomain = useMemo(() => computeYDomain(rows, seriesNames, unit), [rows, seriesNames, unit]);
  const hasData = rows.length > 0;
  const isMultiSeries = seriesNames.length > 1;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {RANGE_OPTIONS.map((opt) => (
            <Pill key={opt.key} active={rangeKey === opt.key} onClick={() => setRangeKey(opt.key)}>
              {opt.label}
            </Pill>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-wide text-vigil-text-faint">refresh</span>
          {REFRESH_OPTIONS.map((opt) => (
            <Pill key={opt.key} active={refreshKey === opt.key} onClick={() => setRefreshKey(opt.key)}>
              {opt.label}
            </Pill>
          ))}
        </div>
      </div>

      {query.isLoading ? (
        <LoadingBlock />
      ) : query.isError ? (
        <div className="flex items-center gap-2 rounded-lg border border-vigil-danger/30 bg-vigil-danger/10 px-3 py-4 text-xs text-vigil-danger">
          <AlertTriangle className="size-4 shrink-0" />
          Couldn't load metric data from Prometheus.
        </div>
      ) : !hasData ? (
        <div
          style={{ height }}
          className="flex items-center justify-center rounded-lg border border-dashed border-vigil-border text-xs text-vigil-text-faint"
        >
          No data points in this time range yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          {isMultiSeries ? (
            <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1b2942" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                domain={[start, end]}
                tickFormatter={(t) => formatTimeTick(t, rangeKey)}
                stroke="#4c5b73"
                tick={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
                tickLine={false}
                axisLine={{ stroke: "#1b2942" }}
                minTickGap={48}
              />
              <YAxis
                domain={yDomain}
                tickFormatter={(v) => formatValue(v, unit)}
                stroke="#4c5b73"
                tick={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip content={<CustomTooltip unit={unit} rangeKey={rangeKey} />} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace" }} />
              {seriesNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              ))}
            </LineChart>
          ) : (
            <AreaChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1b2942" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                domain={[start, end]}
                tickFormatter={(t) => formatTimeTick(t, rangeKey)}
                stroke="#4c5b73"
                tick={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
                tickLine={false}
                axisLine={{ stroke: "#1b2942" }}
                minTickGap={48}
              />
              <YAxis
                domain={yDomain}
                tickFormatter={(v) => formatValue(v, unit)}
                stroke="#4c5b73"
                tick={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip content={<CustomTooltip unit={unit} rangeKey={rangeKey} />} />
              {seriesNames.map((name) => (
                <Area
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke="#22d3ee"
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                  activeDot={{ r: 4, fill: "#22d3ee", stroke: "#04070c", strokeWidth: 2 }}
                />
              ))}
            </AreaChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  );
}
