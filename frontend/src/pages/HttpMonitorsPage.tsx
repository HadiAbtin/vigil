import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, LineChart, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { LoadingBlock, EmptyState } from "@/components/ui/Misc";
import { MetricChartModal } from "@/components/MetricChartModal";
import { httpMonitorsApi, apiErrorMessage } from "@/lib/api";
import type { HttpMethod, IntervalBucket } from "@/lib/types";

export default function HttpMonitorsPage() {
  const queryClient = useQueryClient();
  const monitors = useQuery({ queryKey: ["http-monitors", "standalone"], queryFn: () => httpMonitorsApi.list(true) });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [status, setStatus] = useState("200-299");
  const [interval, setInterval_] = useState<IntervalBucket>("30s");
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["http-monitors", "standalone"] });

  const createMutation = useMutation({
    mutationFn: () =>
      httpMonitorsApi.create({ name, url, method, expected_status_codes: status, interval_bucket: interval }),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      setName("");
      setUrl("");
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const removeMutation = useMutation({ mutationFn: (id: number) => httpMonitorsApi.remove(id), onSuccess: invalidate });

  const [chartTarget, setChartTarget] = useState<{ id: number; name: string } | null>(null);

  return (
    <div>
      <PageHeader
        title="HTTP Monitors"
        subtitle="Standalone endpoint checks, independent of any server."
        action={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
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
                  <button onClick={() => removeMutation.mutate(m.id)} className="text-vigil-text-faint hover:text-vigil-danger">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add HTTP monitor">
        <div className="space-y-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="URL" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/health" required />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Method" value={method} onChange={(e) => setMethod(e.target.value as HttpMethod)}>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="HEAD">HEAD</option>
              <option value="PUT">PUT</option>
            </Select>
            <Select label="Check interval" value={interval} onChange={(e) => setInterval_(e.target.value as IntervalBucket)}>
              <option value="30s">Every 30s</option>
              <option value="1m">Every 1m</option>
              <option value="5m">Every 5m</option>
              <option value="15m">Every 15m</option>
            </Select>
          </div>
          <Input label="Expected status codes" value={status} onChange={(e) => setStatus(e.target.value)} hint='e.g. "200-299" or "200,201,204"' />
          {error && <p className="text-xs text-vigil-danger">{error}</p>}
          <Button variant="primary" className="w-full" loading={createMutation.isPending} disabled={!name || !url} onClick={() => createMutation.mutate()}>
            Add monitor
          </Button>
        </div>
      </Modal>

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
