import { useQuery } from "@tanstack/react-query";
import { Server, Globe, Cpu, BellRing, Send } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard, LoadingBlock, EmptyState } from "@/components/ui/Misc";
import { Card, CardHeader } from "@/components/ui/Card";
import { LevelBadge, AlertStatusBadge } from "@/components/ui/Badge";
import { dashboardApi, alertEventsApi } from "@/lib/api";

export default function DashboardPage() {
  const summary = useQuery({ queryKey: ["dashboard-summary"], queryFn: dashboardApi.summary, refetchInterval: 15000 });
  const recentEvents = useQuery({
    queryKey: ["alert-events", "recent"],
    queryFn: () => alertEventsApi.list(),
    refetchInterval: 15000,
  });

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Live overview of everything Vigil is watching." />

      {summary.isLoading ? (
        <LoadingBlock />
      ) : summary.data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard label="Servers" value={summary.data.server_count} icon={<Server className="size-4" />} />
          <StatCard label="HTTP Monitors" value={summary.data.http_monitor_count} icon={<Globe className="size-4" />} />
          <StatCard
            label="Resource Monitoring"
            value={`${summary.data.node_exporter_active_count} active`}
            icon={<Cpu className="size-4" />}
            tone={summary.data.node_exporter_pending_count > 0 ? "warning" : "cyan"}
          />
          <StatCard
            label="Firing Alerts"
            value={summary.data.firing_alert_count}
            icon={<BellRing className="size-4" />}
            tone={summary.data.firing_alert_count > 0 ? "danger" : "success"}
          />
          <StatCard label="Telegram Bots" value={summary.data.telegram_bot_count} icon={<Send className="size-4" />} />
        </div>
      ) : null}

      <div className="mt-6">
        <Card>
          <CardHeader title="Recent alert activity" subtitle="Most recent firing, resolved, and suppressed episodes." />
          <div className="divide-y divide-vigil-border">
            {recentEvents.isLoading ? (
              <LoadingBlock />
            ) : !recentEvents.data?.length ? (
              <EmptyState title="No alert activity yet" description="Once alert rules start evaluating, episodes will show up here." />
            ) : (
              recentEvents.data.slice(0, 15).map((event) => (
                <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-vigil-text">{event.message}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-vigil-text-faint">
                      {event.category_name} · {event.target_name} · {new Date(event.fired_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <LevelBadge level={event.level} />
                    <AlertStatusBadge status={event.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
