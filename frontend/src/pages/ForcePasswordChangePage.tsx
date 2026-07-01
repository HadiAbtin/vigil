import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { KeyRound, ShieldAlert } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { authApi, apiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export default function ForcePasswordChangePage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setMustChangePassword = useAuthStore((s) => s.setMustChangePassword);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setMustChangePassword(false);
      navigate("/", { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="vigil-panel vigil-panel-glow w-full max-w-md rounded-2xl p-8"
      >
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo size={48} withWordmark={false} />
          <div>
            <h1 className="font-display text-lg font-bold text-vigil-text">Set a new password</h1>
            <p className="mt-1 max-w-xs text-xs text-vigil-text-dim">
              You're using the default seeded credentials. Choose a new password before continuing to the dashboard.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            hint="At least 8 characters."
            required
          />
          <Input
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-vigil-danger/30 bg-vigil-danger/10 px-3 py-2 text-xs text-vigil-danger">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" className="w-full" loading={loading} icon={<KeyRound className="size-4" />}>
            Update password
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
