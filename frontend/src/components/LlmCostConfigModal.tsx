import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { llmCostApi, apiErrorMessage } from "@/lib/api";
import type { LlmCostExporter } from "@/lib/types";

export function LlmCostConfigModal({
  open,
  onClose,
  serverId,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  serverId: number;
  existing: LlmCostExporter | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = existing != null;

  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setBaseUrl(existing?.base_url ?? "");
    setToken("");
    setError(null);
  }, [open, existing]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (isEdit) {
        return llmCostApi.update(serverId, { base_url: baseUrl, ...(token ? { token } : {}) });
      }
      return llmCostApi.create(serverId, { base_url: baseUrl, token });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servers", serverId] });
      queryClient.invalidateQueries({ queryKey: ["llm-cost-usage", serverId] });
      onClose();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit LLM cost tracking" : "Configure LLM cost tracking"}>
      <div className="space-y-4">
        <p className="text-xs text-vigil-text-dim">
          Points Vigil at a usage exporter running on this server (e.g. the one this server itself hosts) and pulls its
          daily token/cost breakdown across providers.
        </p>
        <Input
          label="Exporter endpoint URL"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://your-server.example.com"
          hint='The base URL only — Vigil appends "/api/v1/usage/daily" itself.'
          required
        />
        <Input
          label="Token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={isEdit ? "Leave blank to keep the current token" : ""}
          hint={isEdit ? "Only fill this in if you want to rotate the token." : "Stored encrypted, never shown again after saving."}
          required={!isEdit}
        />
        {error && <p className="text-xs text-vigil-danger">{error}</p>}
        <Button
          variant="primary"
          className="w-full"
          loading={saveMutation.isPending}
          disabled={!baseUrl || (!isEdit && !token)}
          onClick={() => saveMutation.mutate()}
        >
          {isEdit ? "Save changes" : "Start tracking"}
        </Button>
      </div>
    </Modal>
  );
}
