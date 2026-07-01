import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Server as ServerIcon, Plus, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { LoadingBlock, EmptyState } from "@/components/ui/Misc";
import { serversApi, apiErrorMessage } from "@/lib/api";
import type { IntervalBucket } from "@/lib/types";

export default function ServersPage() {
  const queryClient = useQueryClient();
  const servers = useQuery({ queryKey: ["servers"], queryFn: serversApi.list });
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [pingInterval, setPingInterval] = useState<IntervalBucket>("30s");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => serversApi.create({ name, host, ping_enabled: true, ping_interval_bucket: pingInterval }),
    onSuccess: (server) => {
      queryClient.invalidateQueries({ queryKey: ["servers"] });
      setOpen(false);
      setName("");
      setHost("");
      navigate(`/servers/${server.id}`);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <div>
      <PageHeader
        title="Servers"
        subtitle="Ping, port, HTTP, and resource monitoring per host."
        action={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
            Add server
          </Button>
        }
      />

      <Card>
        {servers.isLoading ? (
          <LoadingBlock />
        ) : !servers.data?.length ? (
          <EmptyState icon={<ServerIcon className="size-8" />} title="No servers yet" description="Add your first server to start monitoring it." />
        ) : (
          <div className="divide-y divide-vigil-border">
            {servers.data.map((server) => (
              <button
                key={server.id}
                onClick={() => navigate(`/servers/${server.id}`)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-white/5"
              >
                <div className="min-w-0">
                  <p className="font-display text-sm font-medium text-vigil-text">{server.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-vigil-text-dim">{server.host}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {server.ping_enabled && <Badge tone="cyan">ping · {server.ping_interval_bucket}</Badge>}
                  <ChevronRight className="size-4 text-vigil-text-faint" />
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add server">
        <div className="space-y-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. prod-db-01" required />
          <Input label="Host / IP" value={host} onChange={(e) => setHost(e.target.value)} placeholder="10.0.0.5" required />
          <Select label="Ping interval" value={pingInterval} onChange={(e) => setPingInterval(e.target.value as IntervalBucket)}>
            <option value="30s">Every 30s</option>
            <option value="1m">Every 1m</option>
            <option value="5m">Every 5m</option>
            <option value="15m">Every 15m</option>
          </Select>
          {error && <p className="text-xs text-vigil-danger">{error}</p>}
          <Button variant="primary" className="w-full" loading={createMutation.isPending} disabled={!name || !host} onClick={() => createMutation.mutate()}>
            Create server
          </Button>
        </div>
      </Modal>
    </div>
  );
}
