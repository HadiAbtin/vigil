import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, Trash2, Copy, Check, Sparkles, Upload, ShieldCheck } from "lucide-react";
import clsx from "clsx";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingBlock, EmptyState } from "@/components/ui/Misc";
import { sshKeysApi, apiErrorMessage } from "@/lib/api";
import type { SSHKeyCreated } from "@/lib/types";

type Mode = "generate" | "import";

function ModeTab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "border-vigil-cyan/40 bg-vigil-cyan/10 text-vigil-cyan-bright"
          : "border-vigil-border text-vigil-text-dim hover:text-vigil-text",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export default function SSHKeysPage() {
  const queryClient = useQueryClient();
  const keys = useQuery({ queryKey: ["ssh-keys"], queryFn: sshKeysApi.list });

  const [createOpen, setCreateOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("generate");
  const [name, setName] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<SSHKeyCreated | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => sshKeysApi.create({ name, private_key: mode === "import" ? privateKey : undefined }),
    onSuccess: (key) => {
      queryClient.invalidateQueries({ queryKey: ["ssh-keys"] });
      setCreateOpen(false);
      setCreated(key);
      setName("");
      setPrivateKey("");
      setMode("generate");
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

  const canSubmit = name.trim().length > 0 && (mode === "generate" || privateKey.trim().length > 0);

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
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={copied === `list-${key.id}` ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    onClick={() => copy(key.public_key, `list-${key.id}`)}
                  >
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

      <div className="mt-4 flex items-start gap-2 text-xs text-vigil-text-faint">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Private keys are encrypted at rest and are never retrievable through the API afterwards — Vigil only ever shows a
          freshly-generated private key once, at creation time.
        </span>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New SSH key">
        <div className="space-y-4">
          <div className="flex gap-2">
            <ModeTab active={mode === "generate"} onClick={() => setMode("generate")} icon={<Sparkles className="size-4" />}>
              Generate new key
            </ModeTab>
            <ModeTab active={mode === "import"} onClick={() => setMode("import")} icon={<Upload className="size-4" />}>
              Import existing key
            </ModeTab>
          </div>

          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. prod-fleet" required />

          {mode === "generate" ? (
            <p className="rounded-lg border border-vigil-border bg-vigil-surface-2 px-3 py-2.5 text-xs text-vigil-text-dim">
              Vigil will generate a fresh RSA-4096 keypair. The private key is encrypted and stored for future provisioning
              runs; you'll get the public key to copy onto your servers right after creating it.
            </p>
          ) : (
            <Textarea
              label="Private key"
              hint="An existing key you already use elsewhere. Its public half is derived automatically — Vigil never asks for or stores the public key separately."
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
              required
            />
          )}

          {error && <p className="text-xs text-vigil-danger">{error}</p>}
          <Button variant="primary" className="w-full" loading={createMutation.isPending} disabled={!canSubmit} onClick={() => createMutation.mutate()}>
            {mode === "generate" ? "Generate key" : "Import key"}
          </Button>
        </div>
      </Modal>

      <Modal open={!!created} onClose={() => setCreated(null)} title="SSH key saved" wide>
        {created && (
          <div className="space-y-4">
            {created.was_generated ? (
              <p className="text-sm text-vigil-text-dim">
                Add this <strong className="text-vigil-text">public key</strong> to the target server's{" "}
                <code className="rounded bg-vigil-surface-2 px-1.5 py-0.5 font-mono text-xs">~/.ssh/authorized_keys</code>{" "}
                before enabling resource monitoring on it.
              </p>
            ) : (
              <p className="text-sm text-vigil-text-dim">
                Key imported. Since this is a key pair you already use, its public half is most likely already on your
                servers — here it is anyway, in case you need to copy it onto another one.
              </p>
            )}
            <div>
              <div className="mb-1.5 flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  icon={copied === "pub" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  onClick={() => copy(created.public_key, "pub")}
                >
                  Copy
                </Button>
              </div>
              <pre className="max-h-32 overflow-auto rounded-lg border border-vigil-border bg-vigil-surface-2 p-3 font-mono text-xs text-vigil-cyan-bright break-all whitespace-pre-wrap">
                {created.public_key}
              </pre>
            </div>

            {created.private_key && (
              <>
                <p className="text-sm text-vigil-text-dim">
                  This is your only chance to save an offline copy of the <strong className="text-vigil-text">private key</strong> —
                  Vigil keeps an encrypted copy, but will not display it again.
                </p>
                <div>
                  <div className="mb-1.5 flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={copied === "priv" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      onClick={() => copy(created.private_key!, "priv")}
                    >
                      Copy
                    </Button>
                  </div>
                  <pre className="max-h-40 overflow-auto rounded-lg border border-vigil-border bg-vigil-surface-2 p-3 font-mono text-xs text-vigil-text-dim break-all whitespace-pre-wrap">
                    {created.private_key}
                  </pre>
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
