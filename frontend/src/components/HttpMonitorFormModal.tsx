import { useEffect, useState } from "react";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { httpMonitorsApi, apiErrorMessage } from "@/lib/api";
import type { HttpMethod, HttpMonitor, IntervalBucket } from "@/lib/types";

// Shared by both the server-attached "HTTP monitors" section (ServerDetailPage)
// and the standalone "HTTP Monitors" page — same fields, same validation,
// only whether server_id is set on create differs.
export function HttpMonitorFormModal({
  open,
  onClose,
  serverId = null,
  monitor = null,
  invalidateKeys,
}: {
  open: boolean;
  onClose: () => void;
  serverId?: number | null;
  monitor?: HttpMonitor | null;
  invalidateKeys: QueryKey[];
}) {
  const queryClient = useQueryClient();
  const isEdit = monitor != null;

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [status, setStatus] = useState("200-299");
  const [interval, setInterval_] = useState<IntervalBucket>("30s");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(monitor?.name ?? "");
    setUrl(monitor?.url ?? "");
    setMethod(monitor?.method ?? "GET");
    setStatus(monitor?.expected_status_codes ?? "200-299");
    setInterval_(monitor?.interval_bucket ?? "30s");
    setError(null);
  }, [open, monitor]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = { name, url, method, expected_status_codes: status, interval_bucket: interval };
      return isEdit ? httpMonitorsApi.update(monitor!.id, payload) : httpMonitorsApi.create({ ...payload, server_id: serverId });
    },
    onSuccess: () => {
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      onClose();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit HTTP monitor" : "Add HTTP monitor"}>
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
        <Input
          label="Expected status codes"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          hint='e.g. "200-299" or "200,201,204"'
        />
        {error && <p className="text-xs text-vigil-danger">{error}</p>}
        <Button variant="primary" className="w-full" loading={mutation.isPending} disabled={!name || !url} onClick={() => mutation.mutate()}>
          {isEdit ? "Save changes" : "Add monitor"}
        </Button>
      </div>
    </Modal>
  );
}
