import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Checkbox, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge, LevelBadge } from "@/components/ui/Badge";
import { LoadingBlock, EmptyState } from "@/components/ui/Misc";
import { alertRulesApi, alertCategoriesApi, serversApi, portChecksApi, httpMonitorsApi, apiErrorMessage } from "@/lib/api";
import type { AlertLevel, AlertRule, AlertRuleType } from "@/lib/types";

const RULE_TYPE_LABEL: Record<AlertRuleType, string> = {
  server_ping: "Server reachability (ping)",
  tcp_port: "Port check",
  http_monitor: "HTTP monitor",
  resource_cpu: "CPU usage",
  resource_ram: "RAM usage",
  resource_disk: "Disk usage",
};

const RESOURCE_TYPES: AlertRuleType[] = ["resource_cpu", "resource_ram", "resource_disk"];

export default function AlertRulesPage() {
  const queryClient = useQueryClient();
  const rules = useQuery({ queryKey: ["alert-rules"], queryFn: alertRulesApi.list });
  const categories = useQuery({ queryKey: ["alert-categories"], queryFn: alertCategoriesApi.list });
  const servers = useQuery({ queryKey: ["servers"], queryFn: serversApi.list });
  const portChecks = useQuery({ queryKey: ["port-checks"], queryFn: portChecksApi.list });
  const httpMonitors = useQuery({ queryKey: ["http-monitors", "all"], queryFn: () => httpMonitorsApi.list(false) });

  const [open, setOpen] = useState(false);
  const [ruleType, setRuleType] = useState<AlertRuleType>("server_ping");
  const [targetId, setTargetId] = useState<number | "">("");
  const [threshold, setThreshold] = useState("90");
  const [level, setLevel] = useState<AlertLevel>("warning");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [breaches, setBreaches] = useState("3");
  const [template, setTemplate] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["alert-rules"] });

  const targetOptions = useMemo(() => {
    if (ruleType === "tcp_port") {
      return (portChecks.data ?? []).map((pc) => ({ id: pc.id, label: `${pc.server_name} :${pc.port}` }));
    }
    if (ruleType === "http_monitor") {
      return (httpMonitors.data ?? []).map((m) => ({ id: m.id, label: m.name }));
    }
    return (servers.data ?? []).map((s) => ({ id: s.id, label: s.name }));
  }, [ruleType, servers.data, portChecks.data, httpMonitors.data]);

  const createMutation = useMutation({
    mutationFn: () => {
      const payload: Partial<AlertRule> = {
        rule_type: ruleType,
        level,
        category_id: Number(categoryId),
        consecutive_breaches_required: Number(breaches),
        custom_message_template: template || null,
        enabled,
      };
      if (RESOURCE_TYPES.includes(ruleType)) {
        payload.server_id = Number(targetId);
        payload.threshold_value = Number(threshold);
      } else if (ruleType === "tcp_port") {
        payload.port_check_id = Number(targetId);
      } else if (ruleType === "http_monitor") {
        payload.http_monitor_id = Number(targetId);
      } else {
        payload.server_id = Number(targetId);
      }
      return alertRulesApi.create(payload);
    },
    onSuccess: () => {
      invalidate();
      setOpen(false);
      setTargetId("");
      setTemplate("");
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const removeMutation = useMutation({ mutationFn: (id: number) => alertRulesApi.remove(id), onSuccess: invalidate });
  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => alertRulesApi.update(id, { enabled }),
    onSuccess: invalidate,
  });

  function categoryName(id: number) {
    return categories.data?.find((c) => c.id === id)?.name ?? `#${id}`;
  }

  function targetLabel(rule: AlertRule) {
    if (rule.rule_type === "tcp_port") {
      const pc = portChecks.data?.find((p) => p.id === rule.port_check_id);
      return pc ? `${pc.server_name} :${pc.port}` : `port check #${rule.port_check_id}`;
    }
    if (rule.rule_type === "http_monitor") {
      return httpMonitors.data?.find((m) => m.id === rule.http_monitor_id)?.name ?? `monitor #${rule.http_monitor_id}`;
    }
    return servers.data?.find((s) => s.id === rule.server_id)?.name ?? `server #${rule.server_id}`;
  }

  return (
    <div>
      <PageHeader
        title="Alert Rules"
        subtitle="Desired state + thresholds per monitored item."
        action={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
            New rule
          </Button>
        }
      />

      <Card>
        {rules.isLoading ? (
          <LoadingBlock />
        ) : !rules.data?.length ? (
          <EmptyState icon={<BellRing className="size-8" />} title="No alert rules yet" />
        ) : (
          <div className="divide-y divide-vigil-border">
            {rules.data.map((rule) => (
              <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm text-vigil-text">
                    {RULE_TYPE_LABEL[rule.rule_type]} <span className="text-vigil-text-dim">·</span>{" "}
                    <span className="font-mono text-xs text-vigil-cyan-bright">{targetLabel(rule)}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-vigil-text-dim">
                    {categoryName(rule.category_id)}
                    {rule.threshold_value != null && ` · threshold ${rule.threshold_value}%`}
                    {` · fires after ${rule.consecutive_breaches_required} consecutive breaches`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <LevelBadge level={rule.level} />
                  {!rule.enabled && <Badge tone="neutral">disabled</Badge>}
                  <Button size="sm" variant="ghost" onClick={() => toggleMutation.mutate({ id: rule.id, enabled: !rule.enabled })}>
                    {rule.enabled ? "Disable" : "Enable"}
                  </Button>
                  <button onClick={() => removeMutation.mutate(rule.id)} className="text-vigil-text-faint hover:text-vigil-danger">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="New alert rule" wide>
        <div className="space-y-4">
          <Select
            label="Rule type"
            value={ruleType}
            onChange={(e) => {
              setRuleType(e.target.value as AlertRuleType);
              setTargetId("");
            }}
          >
            {Object.entries(RULE_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>

          <Select label="Target" value={targetId} onChange={(e) => setTargetId(Number(e.target.value))} required>
            <option value="">Select…</option>
            {targetOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </Select>

          {RESOURCE_TYPES.includes(ruleType) && (
            <Input
              label="Threshold (%)"
              type="number"
              min={1}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              hint="Alert fires when usage is at or above this percentage."
              required
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <Select label="Level" value={level} onChange={(e) => setLevel(e.target.value as AlertLevel)}>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="high">High</option>
            </Select>
            <Select label="Category" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))} required>
              <option value="">Select…</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <Input
            label="Consecutive breaches to fire"
            type="number"
            min={1}
            max={20}
            value={breaches}
            onChange={(e) => setBreaches(e.target.value)}
            hint="Higher = fewer false alarms on flaky/flapping checks, slower to alert."
          />

          <Textarea
            label="Custom message (optional)"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="Leave blank for the default auto-generated message"
          />

          <Checkbox label="Enabled" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />

          {error && <p className="text-xs text-vigil-danger">{error}</p>}
          <Button
            variant="primary"
            className="w-full"
            loading={createMutation.isPending}
            disabled={!targetId || !categoryId}
            onClick={() => createMutation.mutate()}
          >
            Create alert rule
          </Button>
        </div>
      </Modal>
    </div>
  );
}
