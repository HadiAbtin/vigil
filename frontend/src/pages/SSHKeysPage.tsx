import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, Trash2, Copy, Check } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingBlock, EmptyState } from "@/components/ui/Misc";
import { sshKeysApi, apiErrorMessage } from "@/lib/api";
import type { SSHKeyCreated } from "@/lib/types";

export default function SSHKeysPage() {
  const queryClient = useQueryClient();
  const keys = useQuery({ queryKey: ["ssh-keys"], queryFn: sshKeysApi.list });

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<SSHKeyCreated | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => sshKeysApi.create({ name, private_key: privateKey || undefined }),
    onSuccess: (key) => {
      queryClient.invalidateQueries({ queryKey: ["ssh-keys"] });
      setCreateOpen(false);
      setCreated(key);
      setName("");
      setPrivateKey("");
      setError(null);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => sshKeysApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ssh-keys"] });
      setDeleteId(null);
    },
  });

  function copy(text: string, tag: string) {
    navigator.clipboard.writeText(text);
    setCopied(tag);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div>
      <PageHeader
        title="SSH Keys"
        subtitle="Reusable keys for provisioning node_exporter on your servers."
        action={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreateOpen(true)}>
            New key
          </Button>
        }
      />

      <Card>
        {keys.isLoading ? (
          <LoadingBlock />
        ) : !keys.data?.length ? (
          <EmptyState
            icon={<KeyRound className="size-8" />}
            title="No SSH keys yet"
            description="Generate one here, then copy the public key onto any server's ~/.ssh/authorized_keys before enabling resource monitoring."
          />
        ) : (
          <div className="divide-y divide-vigil-border">
            {keys.data.map((key) => (
              <div key={key.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-display text-sm font-medium text-vigil-text">{key.name}</p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-vigil-text-faint">{key.fingerprint}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" icon={copied === `list-${key.id}` ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} onClick={() => copy(key.public_key, `list-${key.id}`)}>
                    Copy public key
                  </Button>
                  <Button size="sm" variant="danger" icon={<Trash2 className="size-3.5" />} onClick={() => setDeleteId(key.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New SSH key">
        <div className="space-y-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. prod-fleet" required />
          <Textarea
            label="Private key (optional)"
            hint="Leave blank and Vigil will generate a fresh RSA-4096 keypair for you."
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
          />
          {error && <p className="text-xs text-vigil-danger">{error}</p>}
          <Button variant="primary" className="w-full" loading={createMutation.isPending} disabled={!name} onClick={() => createMutation.mutate()}>
            Create key
          </Button>
        </div>
      </Modal>

      <Modal open={!!created} onClose={() => setCreated(null)} title="SSH key created" wide>
        {created && (
          <div className="space-y-4">
            <p className="text-sm text-vigil-text-dim">
              Add this <strong className="text-vigil-text">public key</strong> to the target server's{" "}
              <code className="rounded bg-vigil-surface-2 px-1.5 py-0.5 font-mono text-xs">~/.ssh/authorized_keys</code> before
              enabling resource monitoring on it.
            </p>
            <div className="relative">
              <pre className="max-h-32 overflow-auto rounded-lg border border-vigil-border bg-vigil-surface-2 p-3 font-mono text-xs text-vigil-cyan-bright break-all whitespace-pre-wrap">
                {created.public_key}
              </pre>
              <Button
                size="sm"
                variant="ghost"
                className="absolute right-2 top-2"
                icon={copied === "pub" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                onClick={() => copy(created.public_key, "pub")}
              >
                Copy
              </Button>
            </div>

            {created.private_key && (
              <>
                <p className="text-sm text-vigil-text-dim">
                  This is your only chance to save an offline copy of the <strong className="text-vigil-text">private key</strong> —
                  Vigil keeps an encrypted copy, but will not display it again.
                </p>
                <div className="relative">
                  <pre className="max-h-40 overflow-auto rounded-lg border border-vigil-border bg-vigil-surface-2 p-3 font-mono text-xs text-vigil-text-dim break-all whitespace-pre-wrap">
                    {created.private_key}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute right-2 top-2"
                    icon={copied === "priv" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    onClick={() => copy(created.private_key!, "priv")}
                  >
                    Copy
                  </Button>
                </div>
              </>
            )}

            <Button variant="primary" className="w-full" onClick={() => setCreated(null)}>
              Done
            </Button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete SSH key"
        description="Servers using this key for resource monitoring will need a replacement key first."
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId !== null && deleteMutation.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
