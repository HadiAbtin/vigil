import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tags, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { LoadingBlock, EmptyState } from "@/components/ui/Misc";
import { alertCategoriesApi, apiErrorMessage } from "@/lib/api";

export default function AlertCategoriesPage() {
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: ["alert-categories"], queryFn: alertCategoriesApi.list });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["alert-categories"] });

  const createMutation = useMutation({
    mutationFn: () => alertCategoriesApi.create({ name, description: description || undefined }),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      setName("");
      setDescription("");
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => alertCategoriesApi.remove(id),
    onSuccess: invalidate,
    onError: (err) => setError(apiErrorMessage(err)),
  });

  return (
    <div>
      <PageHeader
        title="Alert Categories"
        subtitle="Group alert rules so Telegram bots know which ones to deliver."
        action={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
            New category
          </Button>
        }
      />

      {error && <p className="mb-3 text-xs text-vigil-danger">{error}</p>}

      <Card>
        {categories.isLoading ? (
          <LoadingBlock />
        ) : !categories.data?.length ? (
          <EmptyState icon={<Tags className="size-8" />} title="No categories yet" description='Try something like "Critical Infra" or "App Team".' />
        ) : (
          <div className="divide-y divide-vigil-border">
            {categories.data.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="font-display text-sm font-medium text-vigil-text">{c.name}</p>
                  {c.description && <p className="mt-0.5 text-xs text-vigil-text-dim">{c.description}</p>}
                </div>
                <button onClick={() => removeMutation.mutate(c.id)} className="text-vigil-text-faint hover:text-vigil-danger">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="New alert category">
        <div className="space-y-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Critical Infra" required />
          <Input label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button variant="primary" className="w-full" loading={createMutation.isPending} disabled={!name} onClick={() => createMutation.mutate()}>
            Create category
          </Button>
        </div>
      </Modal>
    </div>
  );
}
