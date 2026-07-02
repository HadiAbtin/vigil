import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { History, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { LevelBadge, AlertStatusBadge } from "@/components/ui/Badge";
import { LoadingBlock, EmptyState } from "@/components/ui/Misc";
import { alertEventsApi, alertCategoriesApi, serversApi } from "@/lib/api";
import { RULE_TYPE_LABEL } from "@/lib/constants";
import type { AlertEventStatus, AlertLevel, AlertRuleType } from "@/lib/types";

const TABS: { label: string; value: AlertEventStatus | undefined }[] = [
  { label: "All", value: undefined },
  { label: "Firing", value: "firing" },
  { label: "Resolved", value: "resolved" },
  { label: "Suppressed", value: "suppressed" },
];

export default function AlertEventsPage() {
  const [status, setStatus] = useState<AlertEventStatus | undefined>(undefined);
  const [level, setLevel] = useState<AlertLevel | "">("");
  const [ruleType, setRuleType] = useState<AlertRuleType | "">("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [serverId, setServerId] = useState<number | "">("");

  const categories = useQuery({ queryKey: ["alert-categories"], queryFn: alertCategoriesApi.list });
  const servers = useQuery({ queryKey: ["servers"], queryFn: serversApi.list });

  const filters = {
    status,
    level: level || undefined,
    rule_type: ruleType || undefined,
    category_id: categoryId || undefined,
    server_id: serverId || undefined,
  };

  const events = useQuery({
    queryKey: ["alert-events", filters],
    queryFn: () => alertEventsApi.list(filters),
    refetchInterval: 15000,
  });

  const hasActiveFilters = !!(level || ruleType || categoryId || serverId);

  function clearFilters() {
    setLevel("");
    setRuleType("");
    setCategoryId("");
    setServerId("");
  }

  return (
    <div>
      <PageHeader title="Alert History" subtitle="Every firing, resolved, and suppressed episode." />

      <div className="mb-4 flex gap-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setStatus(tab.value)}
            className={clsx(
              "rounded-lg border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors",
              status === tab.value
                ? "border-vigil-cyan/40 bg-vigil-cyan/10 text-vigil-cyan-bright"
                : "border-vigil-border text-vigil-text-dim hover:text-vigil-text",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-vigil-border bg-vigil-surface-2 p-4 sm:grid-cols-4">
        <Select label="Level" value={level} onChange={(e) => setLevel(e.target.value as AlertLevel | "")}>
          <option value="">All levels</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="high">High</option>
        </Select>

        <Select label="Rule type" value={ruleType} onChange={(e) => setRuleType(e.target.value as AlertRuleType | "")}>
          <option value="">All types</option>
          {Object.entries(RULE_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>

        <Select
          label="Category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">All categories</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        <Select
          label="Server"
          value={serverId}
          onChange={(e) => setServerId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">All servers</option>
          {servers.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="col-span-2 flex items-center justify-center gap-1.5 self-end rounded-lg border border-vigil-border px-3 py-2 font-mono text-xs text-vigil-text-dim transition-colors hover:border-vigil-danger/40 hover:text-vigil-danger sm:col-span-4"
          >
            <X className="size-3.5" /> Clear filters
          </button>
        )}
      </div>

      <Card>
        {events.isLoading ? (
          <LoadingBlock />
        ) : !events.data?.length ? (
          <EmptyState
            icon={<History className="size-8" />}
            title="No events"
            description={hasActiveFilters ? "No events match the current filters." : undefined}
          />
        ) : (
          <div className="divide-y divide-vigil-border">
            {events.data.map((event) => (
              <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-vigil-text">{event.message}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-vigil-text-faint">
                    {event.category_name} · {event.target_name} · fired {new Date(event.fired_at).toLocaleString()}
                    {event.resolved_at && ` · resolved ${new Date(event.resolved_at).toLocaleString()}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <LevelBadge level={event.level} />
                  <AlertStatusBadge status={event.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
