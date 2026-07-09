import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Pencil, Cpu, RefreshCw, Globe, Network, LineChart, Activity, Coins } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Checkbox } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge, InstallStatusBadge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingBlock, EmptyState } from "@/components/ui/Misc";
import { MetricChart } from "@/components/MetricChart";
import { MetricChartModal } from "@/components/MetricChartModal";
import { HttpMonitorFormModal } from "@/components/HttpMonitorFormModal";
import { LlmCostChart } from "@/components/LlmCostChart";
import { LlmCostConfigModal } from "@/components/LlmCostConfigModal";
import { serversApi, sshKeysApi, httpMonitorsApi, llmCostApi, apiErrorMessage } from "@/lib/api";
import type { AlertRuleType, HttpMonitor, IntervalBucket, PortCheck, PortExpectedState } from "@/lib/types";

export default function ServerDetailPage() {
  const { id } = useParams();
  const serverId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const server = useQuery({ queryKey: ["servers", serverId], queryFn: () => serversApi.get(serverId), refetchInterval: 10000 });
  const sshKeys = useQuery({ queryKey: ["ssh-keys"], queryFn: sshKeysApi.list });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["servers", serverId] });

  // --- delete server ---
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteServer = useMutation({
    mutationFn: () => serversApi.remove(serverId),
    onSuccess: () => navigate("/servers"),
  });

  // --- edit server modal ---
  const [editServerOpen, setEditServerOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editHost, setEditHost] = useState("");
  const [editPingEnabled, setEditPingEnabled] = useState(true);
  const [editPingInterval, setEditPingInterval] = useState<IntervalBucket>("30s");
  const [editServerError, setEditServerError] = useState<string | null>(null);
  const editServer = useMutation({
    mutationFn: () =>
      serversApi.update(serverId, {
        name: editName,
        host: editHost,
        ping_enabled: editPingEnabled,
        ping_interval_bucket: editPingInterval,
      }),
    onSuccess: () => {
      invalidate();
      setEditServerOpen(false);
    },
    onError: (err) => setEditServerError(apiErrorMessage(err)),
  });

  // --- port check modal (create + edit) ---
  const [portOpen, setPortOpen] = useState(false);
  const [editingPort, setEditingPort] = useState<PortCheck | null>(null);
  const [port, setPort] = useState("");
  const [expectedState, setExpectedState] = useState<PortExpectedState>("open");
  const [portInterval, setPortInterval] = useState<IntervalBucket>("30s");
  const [portError, setPortError] = useState<string | null>(null);
  const savePort = useMutation({
    mutationFn: () => {
      const payload = { port: Number(port), expected_state: expectedState, interval_bucket: portInterval };
      return editingPort ? serversApi.updatePortCheck(serverId, editingPort.id, payload) : serversApi.addPortCheck(serverId, payload);
    },
    onSuccess: () => {
      invalidate();
      setPortOpen(false);
    },
    onError: (err) => setPortError(apiErrorMessage(err)),
  });
  const removePort = useMutation({
    mutationFn: (portCheckId: number) => serversApi.removePortCheck(serverId, portCheckId),
    onSuccess: invalidate,
  });

  function openAddPort() {
    setEditingPort(null);
    setPort("");
    setExpectedState("open");
    setPortInterval("30s");
    setPortError(null);
    setPortOpen(true);
  }

  function openEditPort(pc: PortCheck) {
    setEditingPort(pc);
    setPort(String(pc.port));
    setExpectedState(pc.expected_state);
    setPortInterval(pc.interval_bucket);
    setPortError(null);
    setPortOpen(true);
  }

  // --- http monitor modal (create + edit), shared component ---
  const [httpOpen, setHttpOpen] = useState(false);
  const [editingHttp, setEditingHttp] = useState<HttpMonitor | null>(null);
  const removeHttp = useMutation({
    mutationFn: (monitorId: number) => httpMonitorsApi.remove(monitorId),
    onSuccess: invalidate,
  });

  function openAddHttp() {
    setEditingHttp(null);
    setHttpOpen(true);
  }

  function openEditHttp(m: HttpMonitor) {
    setEditingHttp(m);
    setHttpOpen(true);
  }

  // --- node exporter ---
  const [nodeOpen, setNodeOpen] = useState(false);
  const [sshKeyId, setSshKeyId] = useState<number | "">("");
  const [sshUser, setSshUser] = useState("root");
  const [sshPort, setSshPort] = useState("22");
  const [nodeError, setNodeError] = useState<string | null>(null);
  const addNodeExporter = useMutation({
    mutationFn: () =>
      serversApi.addNodeExporter(serverId, { ssh_key_id: Number(sshKeyId), ssh_user: sshUser, ssh_port: Number(sshPort) }),
    onSuccess: () => {
      invalidate();
      setNodeOpen(false);
    },
    onError: (err) => setNodeError(apiErrorMessage(err)),
  });
  const retryNodeExporter = useMutation({ mutationFn: () => serversApi.retryNodeExporter(serverId), onSuccess: invalidate });
  const removeNodeExporter = useMutation({ mutationFn: () => serversApi.removeNodeExporter(serverId), onSuccess: invalidate });

  // --- LLM cost tracking ---
  const [llmCostConfigOpen, setLlmCostConfigOpen] = useState(false);
  const retryLlmCostSync = useMutation({ mutationFn: () => llmCostApi.retry(serverId), onSuccess: invalidate });
  const removeLlmCostExporter = useMutation({ mutationFn: () => llmCostApi.remove(serverId), onSuccess: invalidate });

  // --- metric graph modal (port checks + http monitors) ---
  const [chartModal, setChartModal] = useState<{ ruleType: AlertRuleType; targetId: number; title: string } | null>(
    null,
  );

  useEffect(() => {
    if (!editServerOpen || !server.data) return;
    setEditName(server.data.name);
    setEditHost(server.data.host);
    setEditPingEnabled(server.data.ping_enabled);
    setEditPingInterval(server.data.ping_interval_bucket);
    setEditServerError(null);
  }, [editServerOpen, server.data]);

  if (server.isLoading || !server.data) return <LoadingBlock />;
  const s = server.data;

  return (
    <div>
      <button onClick={() => navigate("/servers")} className="mb-4 flex items-center gap-1.5 text-xs text-vigil-text-dim hover:text-vigil-cyan-bright">
        <ArrowLeft className="size-3.5" /> Back to servers
      </button>

      <PageHeader
        title={s.name}
        subtitle={s.host}
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={<Pencil className="size-3.5" />} onClick={() => setEditServerOpen(true)}>
              Edit
            </Button>
            <Button variant="danger" size="sm" icon={<Trash2 className="size-3.5" />} onClick={() => setDeleteOpen(true)}>
              Delete server
            </Button>
          </div>
        }
      />

      {s.ping_enabled && (
        <div className="mb-6">
          <Card>
            <CardHeader title="Ping latency" subtitle={`ICMP round-trip time to ${s.host}`} action={<Activity className="size-4 text-vigil-cyan-bright" />} />
            <div className="p-5">
              <MetricChart ruleType="server_ping" targetId={s.id} />
            </div>
          </Card>
        </div>
      )}

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        {/* Port checks */}
        <Card className="min-w-0">
          <CardHeader
            title="Port checks"
            subtitle="TCP reachability on specific ports"
            action={
              <Button size="sm" variant="secondary" icon={<Plus className="size-3.5" />} onClick={openAddPort}>
                Add
              </Button>
            }
          />
          {!s.port_checks.length ? (
            <EmptyState icon={<Network className="size-6" />} title="No port checks" />
          ) : (
            <div className="divide-y divide-vigil-border">
              {s.port_checks.map((pc) => (
                <div key={pc.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-vigil-text">:{pc.port}</span>
                    <Badge tone={pc.expected_state === "open" ? "success" : "neutral"}>expect {pc.expected_state}</Badge>
                    <Badge tone="neutral">{pc.interval_bucket}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setChartModal({ ruleType: "tcp_port", targetId: pc.id, title: `Port :${pc.port} latency` })}
                      className="text-vigil-text-faint hover:text-vigil-cyan-bright"
                      title="View latency graph"
                    >
                      <LineChart className="size-3.5" />
                    </button>
                    <button onClick={() => openEditPort(pc)} className="text-vigil-text-faint hover:text-vigil-cyan-bright" title="Edit">
                      <Pencil className="size-3.5" />
                    </button>
                    <button onClick={() => removePort.mutate(pc.id)} className="text-vigil-text-faint hover:text-vigil-danger">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* HTTP monitors */}
        <Card className="min-w-0">
          <CardHeader
            title="HTTP monitors"
            subtitle="Endpoint checks tied to this server"
            action={
              <Button size="sm" variant="secondary" icon={<Plus className="size-3.5" />} onClick={openAddHttp}>
                Add
              </Button>
            }
          />
          {!s.http_monitors.length ? (
            <EmptyState icon={<Globe className="size-6" />} title="No HTTP monitors" />
          ) : (
            <div className="divide-y divide-vigil-border">
              {s.http_monitors.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-vigil-text">
                      <span className="font-mono text-vigil-cyan-bright">{m.method}</span> {m.name}
                    </p>
                    <p className="truncate font-mono text-[11px] text-vigil-text-faint">{m.url}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone="neutral">{m.expected_status_codes}</Badge>
                    <button
                      onClick={() => setChartModal({ ruleType: "http_monitor", targetId: m.id, title: m.name })}
                      className="text-vigil-text-faint hover:text-vigil-cyan-bright"
                      title="View latency graph"
                    >
                      <LineChart className="size-3.5" />
                    </button>
                    <button onClick={() => openEditHttp(m)} className="text-vigil-text-faint hover:text-vigil-cyan-bright" title="Edit">
                      <Pencil className="size-3.5" />
                    </button>
                    <button onClick={() => removeHttp.mutate(m.id)} className="text-vigil-text-faint hover:text-vigil-danger">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Resource monitoring */}
      <div className="mt-6">
        <Card>
          <CardHeader title="Resource monitoring" subtitle="CPU / RAM / disk via node_exporter, installed automatically over SSH" />
          <div className="p-5">
            {!s.node_exporter_config ? (
              <EmptyState
                icon={<Cpu className="size-8" />}
                title="Not configured"
                description="Provide SSH access and Vigil will install node_exporter as a systemd service."
                action={
                  <Button variant="primary" size="sm" onClick={() => setNodeOpen(true)}>
                    Configure resource monitoring
                  </Button>
                }
              />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <InstallStatusBadge status={s.node_exporter_config.install_status} active={s.node_exporter_config.active} />
                    <span className="font-mono text-xs text-vigil-text-dim">
                      {s.node_exporter_config.ssh_user}@{s.host}:{s.node_exporter_config.ssh_port}
                    </span>
                  </div>
                  {s.node_exporter_config.last_error && (
                    <p className="max-w-lg text-xs text-vigil-danger">{s.node_exporter_config.last_error}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {s.node_exporter_config.install_status === "failed" && (
                    <Button size="sm" variant="secondary" icon={<RefreshCw className="size-3.5" />} loading={retryNodeExporter.isPending} onClick={() => retryNodeExporter.mutate()}>
                      Retry
                    </Button>
                  )}
                  <Button size="sm" variant="danger" icon={<Trash2 className="size-3.5" />} onClick={() => removeNodeExporter.mutate()}>
                    Remove
                  </Button>
                </div>
              </div>
            )}
          </div>

          {s.node_exporter_config?.active && (
            <div className="grid min-w-0 gap-6 border-t border-vigil-border p-5 lg:grid-cols-3">
              <div className="min-w-0">
                <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-vigil-text-dim">CPU usage</p>
                <MetricChart ruleType="resource_cpu" targetId={s.id} height={180} />
              </div>
              <div className="min-w-0">
                <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-vigil-text-dim">RAM usage</p>
                <MetricChart ruleType="resource_ram" targetId={s.id} height={180} />
              </div>
              <div className="min-w-0">
                <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-vigil-text-dim">Disk usage</p>
                <MetricChart ruleType="resource_disk" targetId={s.id} height={180} />
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* LLM cost tracking */}
      <div className="mt-6">
        <Card>
          <CardHeader
            title="LLM Cost"
            subtitle="Token usage & estimated cost across Claude, OpenAI, Gemini, and DeepSeek"
            action={
              s.llm_cost_exporter && (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" icon={<Pencil className="size-3.5" />} onClick={() => setLlmCostConfigOpen(true)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="secondary" icon={<RefreshCw className="size-3.5" />} loading={retryLlmCostSync.isPending} onClick={() => retryLlmCostSync.mutate()}>
                    Resync
                  </Button>
                  <Button size="sm" variant="danger" icon={<Trash2 className="size-3.5" />} onClick={() => removeLlmCostExporter.mutate()}>
                    Remove
                  </Button>
                </div>
              )
            }
          />
          <div className="p-5">
            {!s.llm_cost_exporter ? (
              <EmptyState
                icon={<Coins className="size-8" />}
                title="Not configured"
                description="Point Vigil at a usage exporter's endpoint and token to start tracking LLM spend for this server."
                action={
                  <Button variant="primary" size="sm" onClick={() => setLlmCostConfigOpen(true)}>
                    Configure LLM cost tracking
                  </Button>
                }
              />
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-2 font-mono text-xs text-vigil-text-dim">
                  <span>{s.llm_cost_exporter.base_url}</span>
                  {s.llm_cost_exporter.last_synced_at && (
                    <span>· last synced {new Date(s.llm_cost_exporter.last_synced_at).toLocaleString()}</span>
                  )}
                </div>
                {s.llm_cost_exporter.last_error && (
                  <p className="mb-4 text-xs text-vigil-danger">{s.llm_cost_exporter.last_error}</p>
                )}
                <LlmCostChart serverId={s.id} />
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Edit server modal */}
      <Modal open={editServerOpen} onClose={() => setEditServerOpen(false)} title="Edit server">
        <div className="space-y-4">
          <Input label="Name" value={editName} onChange={(e) => setEditName(e.target.value)} required />
          <Input label="Host / IP" value={editHost} onChange={(e) => setEditHost(e.target.value)} required />
          <Checkbox label="Ping enabled" checked={editPingEnabled} onChange={(e) => setEditPingEnabled(e.target.checked)} />
          <Select label="Ping interval" value={editPingInterval} onChange={(e) => setEditPingInterval(e.target.value as IntervalBucket)}>
            <option value="30s">Every 30s</option>
            <option value="1m">Every 1m</option>
            <option value="5m">Every 5m</option>
            <option value="15m">Every 15m</option>
          </Select>
          {editServerError && <p className="text-xs text-vigil-danger">{editServerError}</p>}
          <Button
            variant="primary"
            className="w-full"
            loading={editServer.isPending}
            disabled={!editName || !editHost}
            onClick={() => editServer.mutate()}
          >
            Save changes
          </Button>
        </div>
      </Modal>

      {/* Add/edit port check modal */}
      <Modal open={portOpen} onClose={() => setPortOpen(false)} title={editingPort ? "Edit port check" : "Add port check"}>
        <div className="space-y-4">
          <Input label="Port" type="number" min={1} max={65535} value={port} onChange={(e) => setPort(e.target.value)} required />
          <Select label="Expected state" value={expectedState} onChange={(e) => setExpectedState(e.target.value as PortExpectedState)}>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </Select>
          <Select label="Check interval" value={portInterval} onChange={(e) => setPortInterval(e.target.value as IntervalBucket)}>
            <option value="30s">Every 30s</option>
            <option value="1m">Every 1m</option>
            <option value="5m">Every 5m</option>
            <option value="15m">Every 15m</option>
          </Select>
          {portError && <p className="text-xs text-vigil-danger">{portError}</p>}
          <Button variant="primary" className="w-full" loading={savePort.isPending} disabled={!port} onClick={() => savePort.mutate()}>
            {editingPort ? "Save changes" : "Add port check"}
          </Button>
        </div>
      </Modal>

      {/* Add/edit HTTP monitor modal */}
      <HttpMonitorFormModal
        open={httpOpen}
        onClose={() => setHttpOpen(false)}
        serverId={serverId}
        monitor={editingHttp}
        invalidateKeys={[["servers", serverId]]}
      />

      {/* Configure node exporter modal */}
      <Modal open={nodeOpen} onClose={() => setNodeOpen(false)} title="Configure resource monitoring">
        <div className="space-y-4">
          <p className="text-xs text-vigil-text-dim">
            The chosen key's public half must already be in <code className="rounded bg-vigil-surface-2 px-1 py-0.5">~/.ssh/authorized_keys</code> on{" "}
            {s.host}, and the SSH user needs passwordless sudo (or be root).
          </p>
          <Select label="SSH key" value={sshKeyId} onChange={(e) => setSshKeyId(Number(e.target.value))} required>
            <option value="">Select a key…</option>
            {sshKeys.data?.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input label="SSH user" value={sshUser} onChange={(e) => setSshUser(e.target.value)} required />
            <Input label="SSH port" type="number" value={sshPort} onChange={(e) => setSshPort(e.target.value)} required />
          </div>
          {nodeError && <p className="text-xs text-vigil-danger">{nodeError}</p>}
          <Button variant="primary" className="w-full" loading={addNodeExporter.isPending} disabled={!sshKeyId || !sshUser} onClick={() => addNodeExporter.mutate()}>
            Start provisioning
          </Button>
        </div>
      </Modal>

      {/* Configure/edit LLM cost tracking modal */}
      <LlmCostConfigModal
        open={llmCostConfigOpen}
        onClose={() => setLlmCostConfigOpen(false)}
        serverId={serverId}
        existing={s.llm_cost_exporter}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete server"
        description="This removes all its port checks, HTTP monitors, and resource monitoring config."
        confirmLabel="Delete"
        danger
        loading={deleteServer.isPending}
        onConfirm={() => deleteServer.mutate()}
        onCancel={() => setDeleteOpen(false)}
      />

      <MetricChartModal
        open={chartModal !== null}
        onClose={() => setChartModal(null)}
        title={chartModal?.title ?? ""}
        ruleType={chartModal?.ruleType ?? "tcp_port"}
        targetId={chartModal?.targetId ?? null}
      />
    </div>
  );
}
