import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, LineChart, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingBlock, EmptyState } from "@/components/ui/Misc";
import { MetricChartModal } from "@/components/MetricChartModal";
import { HttpMonitorFormModal } from "@/components/HttpMonitorFormModal";
import { httpMonitorsApi } from "@/lib/api";
import type { HttpMonitor } from "@/lib/types";

export default function HttpMonitorsPage() {
  const queryClient = useQueryClient();
  const monitors = useQuery({ queryKey: ["http-monitors", "standalone"], queryFn: () => httpMonitorsApi.list(true) });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["http-monitors", "standalone"] });

  const [formOpen, setFormOpen] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState<HttpMonitor | null>(null);

  function openAdd() {
    setEditingMonitor(null);
    setFormOpen(true);
  }

  function openEdit(m: HttpMonitor) {
    setEditingMonitor(m);
    setFormOpen(true);
  }

  const removeMutation = useMutation({ mutationFn: (id: number) => httpMonitorsApi.remove(id), onSuccess: invalidate });

  const [chartTarget, setChartTarget] = useState<{ id: number; name: string } | null>(null);

  return (
    <div>
      <PageHeader
        title="HTTP Monitors"
        subtitle="Standalone endpoint checks, independent of any server."
        action={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={openAdd}>
            Add monitor
          </Button>
        }
      />

      <Card>
        {monitors.isLoading ? (
          <LoadingBlock />
        ) : !monitors.data?.length ? (
          <EmptyState icon={<Globe className="size-8" />} title="No standalone HTTP monitors" description="Add a URL to start checking it on a schedule." />
        ) : (
          <div className="divide-y divide-vigil-border">
            {monitors.data.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm text-vigil-text">
                    <span className="font-mono text-vigil-cyan-bright">{m.method}</span> {m.name}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-vigil-text-faint">{m.url}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone="neutral">{m.expected_status_codes}</Badge>
                  <Badge tone="neutral">{m.interval_bucket}</Badge>
                  <button
                    onClick={() => setChartTarget({ id: m.id, name: m.name })}
                    className="text-vigil-text-faint hover:text-vigil-cyan-bright"
                    title="View graph"
                  >
                    <LineChart className="size-3.5" />
                  </button>
                  <button onClick={() => openEdit(m)} className="text-vigil-text-faint hover:text-vigil-cyan-bright" title="Edit">
                    <Pencil className="size-3.5" />
                  </button>
                  <button onClick={() => removeMutation.mutate(m.id)} className="text-vigil-text-faint hover:text-vigil-danger">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <HttpMonitorFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        serverId={null}
        monitor={editingMonitor}
        invalidateKeys={[["http-monitors", "standalone"]]}
      />

      <MetricChartModal
        open={chartTarget !== null}
        onClose={() => setChartTarget(null)}
        title={chartTarget?.name ?? ""}
        ruleType="http_monitor"
        targetId={chartTarget?.id ?? null}
      />
    </div>
  );
}
