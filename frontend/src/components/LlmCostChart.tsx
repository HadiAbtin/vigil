import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle } from "lucide-react";
import { llmCostApi } from "@/lib/api";
import { LLM_PROVIDER_LABEL } from "@/lib/constants";
import { SERIES_COLORS, mergeSeries, computeYDomain } from "@/lib/chartUtils";
import type { LlmUsageGranularity } from "@/lib/types";
import { LoadingBlock } from "@/components/ui/Misc";

const GRANULARITY_OPTIONS: { key: LlmUsageGranularity; label: string }[] = [
  { key: "day", label: "Daily" },
  { key: "week", label: "Weekly" },
  { key: "month", label: "Monthly" },
  { key: "year", label: "Yearly" },
];

function formatTokens(v: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: Math.abs(v) >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(v);
}

// Real per-request LLM costs are often fractions of a cent — a flat 2-decimal
// format would round almost everything to "$0.00", so widen precision for
// small values instead of always showing the same two decimals.
function formatCost(v: number): string {
  if (v === 0) return "$0.00";
  if (v < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

function formatBucketLabel(ts: number, granularity: LlmUsageGranularity): string {
  const d = new Date(ts * 1000);
  if (granularity === "month") return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  if (granularity === "year") return d.toLocaleDateString(undefined, { year: "numeric" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

export function LlmCostChart({ serverId }: { serverId: number }) {
  const [granularity, setGranularity] = useState<LlmUsageGranularity>("day");
  const [mode, setMode] = useState<"tokens" | "cost">("tokens");

  // Keyed on granularity so switching tabs fully remounts the query instead of
  // re-rendering in place — same fix applied to the Response-time/Status-code
  // toggle elsewhere, avoiding any chance of a stale series lingering.
  const query = useQuery({
    queryKey: ["llm-cost-usage", serverId, granularity],
    queryFn: () => llmCostApi.usage(serverId, granularity),
  });

  const data = query.data;
  const series = mode === "tokens" ? (data?.token_series ?? []) : (data?.cost_series ?? []);
  const rows = useMemo(() => mergeSeries(series), [series]);
  const seriesNames = useMemo(() => series.map((s) => s.name), [series]);
  const yDomain = useMemo(() => computeYDomain(rows, seriesNames, ""), [rows, seriesNames]);
  const formatAxisValue = mode === "tokens" ? formatTokens : formatCost;

  const providerBreakdown = useMemo(
    () =>
      series.map((s) => ({
        provider: s.name,
        label: LLM_PROVIDER_LABEL[s.name] ?? s.name,
        value: s.points.length ? s.points[s.points.length - 1][1] : 0,
      })),
    [series],
  );

  const hasData = rows.length > 0 && rows.some((r) => seriesNames.some((n) => (r[n] ?? 0) > 0));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          {GRANULARITY_OPTIONS.map((opt) => (
            <Pill key={opt.key} active={granularity === opt.key} onClick={() => setGranularity(opt.key)}>
              {opt.label}
            </Pill>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Pill active={mode === "tokens"} onClick={() => setMode("tokens")}>
            Tokens
          </Pill>
          <Pill active={mode === "cost"} onClick={() => setMode("cost")}>
            Cost
          </Pill>
        </div>
      </div>

      {data && (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4 rounded-lg border border-vigil-border bg-vigil-surface-2 p-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-vigil-text-dim">{data.period_label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-vigil-cyan-bright">
              {mode === "tokens" ? `${formatTokens(data.period_total_tokens)} tokens` : formatCost(data.period_total_cost)}
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            {providerBreakdown.map((p) => (
              <div key={p.provider} className="text-right">
                <p className="font-mono text-[10px] uppercase tracking-wide text-vigil-text-faint">{p.label}</p>
                <p className="font-mono text-sm text-vigil-text">
                  {mode === "tokens" ? formatTokens(p.value) : formatCost(p.value)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {query.isLoading ? (
        <LoadingBlock />
      ) : query.isError ? (
        <div className="flex items-center gap-2 rounded-lg border border-vigil-danger/30 bg-vigil-danger/10 px-3 py-4 text-xs text-vigil-danger">
          <AlertTriangle className="size-4 shrink-0" />
          Couldn't load LLM usage data.
        </div>
      ) : !hasData ? (
        <div
          style={{ height: 220 }}
          className="flex items-center justify-center rounded-lg border border-dashed border-vigil-border text-xs text-vigil-text-faint"
        >
          No usage recorded in this range yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1b2942" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(t) => formatBucketLabel(t, granularity)}
              stroke="#4c5b73"
              tick={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
              tickLine={false}
              axisLine={{ stroke: "#1b2942" }}
              minTickGap={32}
            />
            <YAxis
              domain={yDomain}
              tickFormatter={formatAxisValue}
              stroke="#4c5b73"
              tick={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip
              formatter={(value: number, name: string) => [formatAxisValue(value), LLM_PROVIDER_LABEL[name] ?? name]}
              labelFormatter={(t) => formatBucketLabel(Number(t), granularity)}
              contentStyle={{ background: "#0e1626", border: "1px solid #1b2942", borderRadius: 8 }}
            />
            <Legend
              formatter={(value: string) => LLM_PROVIDER_LABEL[value] ?? value}
              wrapperStyle={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
            />
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
        </ResponsiveContainer>
      )}
    </div>
  );
}
