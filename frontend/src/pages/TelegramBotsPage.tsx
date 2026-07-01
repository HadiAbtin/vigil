import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Checkbox } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { LoadingBlock, EmptyState } from "@/components/ui/Misc";
import { telegramBotsApi, alertCategoriesApi, apiErrorMessage } from "@/lib/api";

export default function TelegramBotsPage() {
  const queryClient = useQueryClient();
  const bots = useQuery({ queryKey: ["telegram-bots"], queryFn: telegramBotsApi.list });
  const categories = useQuery({ queryKey: ["alert-categories"], queryFn: alertCategoriesApi.list });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<number, string>>({});

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["telegram-bots"] });

  const createMutation = useMutation({
    mutationFn: () => telegramBotsApi.create({ name, bot_token: token, chat_id: chatId, category_ids: categoryIds, enabled: true }),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      setName("");
      setToken("");
      setChatId("");
      setCategoryIds([]);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const removeMutation = useMutation({ mutationFn: (id: number) => telegramBotsApi.remove(id), onSuccess: invalidate });
  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => telegramBotsApi.update(id, { enabled }),
    onSuccess: invalidate,
  });

  const testMutation = useMutation({
    mutationFn: (id: number) => telegramBotsApi.test(id),
    onSuccess: (_data, id) => setTestResult((r) => ({ ...r, [id]: "sent" })),
    onError: (err, id) => setTestResult((r) => ({ ...r, [id]: apiErrorMessage(err) })),
  });

  function toggleCategory(id: number) {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  return (
    <div>
      <PageHeader
        title="Telegram Bots"
        subtitle="Each bot delivers alerts for the categories assigned to it."
        action={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
            New bot
          </Button>
        }
      />

      <Card>
        {bots.isLoading ? (
          <LoadingBlock />
        ) : !bots.data?.length ? (
          <EmptyState icon={<Send className="size-8" />} title="No Telegram bots configured" />
        ) : (
          <div className="divide-y divide-vigil-border">
            {bots.data.map((bot) => (
              <div key={bot.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-display text-sm font-medium text-vigil-text">{bot.name}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-vigil-text-faint">chat: {bot.chat_id}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {bot.categories.length ? (
                      bot.categories.map((c) => <Badge key={c.id} tone="cyan">{c.name}</Badge>)
                    ) : (
                      <span className="text-xs text-vigil-text-faint">no categories assigned</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {testResult[bot.id] && (
                    <span className={`text-xs ${testResult[bot.id] === "sent" ? "text-vigil-success" : "text-vigil-danger"}`}>
                      {testResult[bot.id] === "sent" ? "Sent!" : testResult[bot.id]}
                    </span>
                  )}
                  <Button size="sm" variant="secondary" icon={<CheckCircle2 className="size-3.5" />} loading={testMutation.isPending} onClick={() => testMutation.mutate(bot.id)}>
                    Test
                  </Button>
                  {!bot.enabled && <Badge tone="neutral">disabled</Badge>}
                  <Button size="sm" variant="ghost" onClick={() => toggleMutation.mutate({ id: bot.id, enabled: !bot.enabled })}>
                    {bot.enabled ? "Disable" : "Enable"}
                  </Button>
                  <button onClick={() => removeMutation.mutate(bot.id)} className="text-vigil-text-faint hover:text-vigil-danger">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="New Telegram bot">
        <div className="space-y-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ops-alerts-bot" required />
          <Input label="Bot token" value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456:ABC-DEF..." required />
          <Input label="Chat / group ID" value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="-1001234567890" required />

          <div>
            <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-vigil-text-dim">Categories</span>
            <div className="space-y-1.5 rounded-lg border border-vigil-border bg-vigil-surface-2 p-3">
              {categories.data?.length ? (
                categories.data.map((c) => (
                  <Checkbox key={c.id} label={c.name} checked={categoryIds.includes(c.id)} onChange={() => toggleCategory(c.id)} />
                ))
              ) : (
                <p className="text-xs text-vigil-text-faint">Create an alert category first.</p>
              )}
            </div>
          </div>

          {error && <p className="text-xs text-vigil-danger">{error}</p>}
          <Button variant="primary" className="w-full" loading={createMutation.isPending} disabled={!name || !token || !chatId} onClick={() => createMutation.mutate()}>
            Create bot
          </Button>
        </div>
      </Modal>
    </div>
  );
}
