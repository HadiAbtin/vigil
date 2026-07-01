import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { History } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { LevelBadge, AlertStatusBadge } from "@/components/ui/Badge";
import { LoadingBlock, EmptyState } from "@/components/ui/Misc";
import { alertEventsApi } from "@/lib/api";
import type { AlertEventStatus } from "@/lib/types";

const TABS: { label: string; value: AlertEventStatus | undefined }[] = [
  { label: "All", value: undefined },
  { label: "Firing", value: "firing" },
  { label: "Resolved", value: "resolved" },
  { label: "Suppressed", value: "suppressed" },
];

export default function AlertEventsPage() {
  const [status, setStatus] = useState<AlertEventStatus | undefined>(undefined);
  const events = useQuery({ queryKey: ["alert-events", status ?? "all"], queryFn: () => alertEventsApi.list(status), refetchInterval: 15000 });

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

      <Card>
        {events.isLoading ? (
          <LoadingBlock />
        ) : !events.data?.length ? (
          <EmptyState icon={<History className="size-8" />} title="No events" />
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
