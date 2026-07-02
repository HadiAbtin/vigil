import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Pencil, Plus, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Checkbox, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge, LevelBadge } from "@/components/ui/Badge";
import { LoadingBlock, EmptyState } from "@/components/ui/Misc";
import { alertRulesApi, alertCategoriesApi, serversApi, portChecksApi, httpMonitorsApi, apiErrorMessage } from "@/lib/api";
import { RULE_TYPE_LABEL } from "@/lib/constants";
import type { AlertLevel, AlertRule, AlertRuleType } from "@/lib/types";

const RESOURCE_TYPES: AlertRuleType[] = ["resource_cpu", "resource_ram", "resource_disk"];

export default function AlertRulesPage() {
  const queryClient = useQueryClient();
  const rules = useQuery({ queryKey: ["alert-rules"], queryFn: alertRulesApi.list });
  const categories = useQuery({ queryKey: ["alert-categories"], queryFn: alertCategoriesApi.list });
  const servers = useQuery({ queryKey: ["servers"], queryFn: serversApi.list });
  const portChecks = useQuery({ queryKey: ["port-checks"], queryFn: portChecksApi.list });
  const httpMonitors = useQuery({ queryKey: ["http-monitors", "all"], queryFn: () => httpMonitorsApi.list(false) });

  const [open, setOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [ruleType, setRuleType] = useState<AlertRuleType>("server_ping");
  const [targetId, setTargetId] = useState<number | "">("");
  const [threshold, setThreshold] = useState("90");
  const [level, setLevel] = useState<AlertLevel>("warning");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [breaches, setBreaches] = useState("3");
  const [template, setTemplate] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- filters ---
  const [filterLevel, setFilterLevel] = useState<AlertLevel | "">("");
  const [filterRuleType, setFilterRuleType] = useState<AlertRuleType | "">("");
  const [filterCategoryId, setFilterCategoryId] = useState<number | "">("");
  const [filterServerId, setFilterServerId] = useState<number | "">("");
  const [filterStatus, setFilterStatus] = useState<"" | "enabled" | "disabled">("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["alert-rules"] });

  function openAdd() {
    setEditingRule(null);
    setRuleType("server_ping");
    setTargetId("");
    setThreshold("90");
    setLevel("warning");
    setCategoryId("");
    setBreaches("3");
    setTemplate("");
    setEnabled(true);
    setError(null);
    setOpen(true);
  }

  function openEdit(rule: AlertRule) {
    setEditingRule(rule);
    setRuleType(rule.rule_type);
    setTargetId(rule.server_id ?? rule.port_check_id ?? rule.http_monitor_id ?? "");
    setThreshold(rule.threshold_value != null ? String(rule.threshold_value) : "90");
    setLevel(rule.level);
    setCategoryId(rule.category_id);
    setBreaches(String(rule.consecutive_breaches_required));
    setTemplate(rule.custom_message_template ?? "");
    setEnabled(rule.enabled);
    setError(null);
    setOpen(true);
  }

  const targetOptions = useMemo(() => {
    if (ruleType === "tcp_port") {
      return (portChecks.data ?? []).map((pc) => ({ id: pc.id, label: `${pc.server_name} :${pc.port}` }));
    }
    if (ruleType === "http_monitor") {
      return (httpMonitors.data ?? []).map((m) => ({ id: m.id, label: m.name }));
    }
    return (servers.data ?? []).map((s) => ({ id: s.id, label: s.name }));
  }, [ruleType, servers.data, portChecks.data, httpMonitors.data]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (editingRule) {
        // rule_type and its target are immutable once created (delete + recreate to retarget) —
        // only these fields are ever sent on update.
        const payload: Partial<AlertRule> = {
          level,
          category_id: Number(categoryId),
          consecutive_breaches_required: Number(breaches),
          custom_message_template: template || null,
          enabled,
        };
        if (RESOURCE_TYPES.includes(editingRule.rule_type)) {
          payload.threshold_value = Number(threshold);
        }
        return alertRulesApi.update(editingRule.id, payload);
      }

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

  // A tcp_port/http_monitor rule doesn't carry server_id directly — it's only
  // reachable through the port check's / monitor's own server_id — so the
  // server filter has to look it up the same way targetLabel does.
  function ruleServerId(rule: AlertRule): number | null {
    if (rule.server_id != null) return rule.server_id;
    if (rule.port_check_id != null) {
      return portChecks.data?.find((p) => p.id === rule.port_check_id)?.server_id ?? null;
    }
    if (rule.http_monitor_id != null) {
      return httpMonitors.data?.find((m) => m.id === rule.http_monitor_id)?.server_id ?? null;
    }
    return null;
  }

  const filteredRules = useMemo(() => {
    return (rules.data ?? []).filter((rule) => {
      if (filterLevel && rule.level !== filterLevel) return false;
      if (filterRuleType && rule.rule_type !== filterRuleType) return false;
      if (filterCategoryId && rule.category_id !== filterCategoryId) return false;
      if (filterServerId && ruleServerId(rule) !== filterServerId) return false;
      if (filterStatus === "enabled" && !rule.enabled) return false;
      if (filterStatus === "disabled" && rule.enabled) return false;
      return true;
    });
  }, [rules.data, filterLevel, filterRuleType, filterCategoryId, filterServerId, filterStatus, portChecks.data, httpMonitors.data]);

  const hasActiveFilters = !!(filterLevel || filterRuleType || filterCategoryId || filterServerId || filterStatus);

  function clearFilters() {
    setFilterLevel("");
    setFilterRuleType("");
    setFilterCategoryId("");
    setFilterServerId("");
    setFilterStatus("");
  }

  return (
    <div>
      <PageHeader
        title="Alert Rules"
        subtitle="Desired state + thresholds per monitored item."
        action={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={openAdd}>
            New rule
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-vigil-border bg-vigil-surface-2 p-4 sm:grid-cols-5">
        <Select label="Level" value={filterLevel} onChange={(e) => setFilterLevel(e.target.value as AlertLevel | "")}>
          <option value="">All levels</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="high">High</option>
        </Select>

        <Select label="Rule type" value={filterRuleType} onChange={(e) => setFilterRuleType(e.target.value as AlertRuleType | "")}>
          <option value="">All types</option>
          {Object.entries(RULE_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>

        <Select
          label="Category"
          value={filterCategoryId}
          onChange={(e) => setFilterCategoryId(e.target.value ? Number(e.target.value) : "")}
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
          value={filterServerId}
          onChange={(e) => setFilterServerId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">All servers</option>
          {servers.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>

        <Select label="Status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as "" | "enabled" | "disabled")}>
          <option value="">All statuses</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </Select>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="col-span-2 flex items-center justify-center gap-1.5 self-end rounded-lg border border-vigil-border px-3 py-2 font-mono text-xs text-vigil-text-dim transition-colors hover:border-vigil-danger/40 hover:text-vigil-danger sm:col-span-5"
          >
            <X className="size-3.5" /> Clear filters
          </button>
        )}
      </div>

      <Card>
        {rules.isLoading ? (
          <LoadingBlock />
        ) : !filteredRules.length ? (
          <EmptyState
            icon={<BellRing className="size-8" />}
            title={rules.data?.length ? "No alert rules match the current filters" : "No alert rules yet"}
          />
        ) : (
          <div className="divide-y divide-vigil-border">
            {filteredRules.map((rule) => (
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
                  <button onClick={() => openEdit(rule)} className="text-vigil-text-faint hover:text-vigil-cyan-bright" title="Edit">
                    <Pencil className="size-3.5" />
                  </button>
                  <button onClick={() => removeMutation.mutate(rule.id)} className="text-vigil-text-faint hover:text-vigil-danger">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editingRule ? "Edit alert rule" : "New alert rule"} wide>
        <div className="space-y-4">
          <Select
            label="Rule type"
            value={ruleType}
            disabled={!!editingRule}
            hint={editingRule ? "Can't be changed after creation — delete and recreate to retarget." : undefined}
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

          <Select label="Target" value={targetId} disabled={!!editingRule} onChange={(e) => setTargetId(Number(e.target.value))} required>
            <option value="">Select…</option>
            {editingRule ? (
              <option value={targetId}>{targetLabel(editingRule)}</option>
            ) : (
              targetOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))
            )}
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
            loading={saveMutation.isPending}
            disabled={!targetId || !categoryId}
            onClick={() => saveMutation.mutate()}
          >
            {editingRule ? "Save changes" : "Create alert rule"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
