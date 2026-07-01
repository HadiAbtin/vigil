import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogIn, ShieldAlert } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { authApi, apiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { access_token, must_change_password } = await authApi.login(username, password);
      setSession(access_token, must_change_password);
      navigate(must_change_password ? "/change-password" : "/", { replace: true });
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
        className="vigil-panel vigil-panel-glow w-full max-w-sm rounded-2xl p-8"
      >
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size={56} withWordmark={false} />
          <div>
            <h1 className="font-display text-xl font-bold tracking-widest text-vigil-text">
              VIGIL<span className="text-vigil-cyan-bright">.</span>
            </h1>
            <p className="mt-1 font-mono text-xs text-vigil-text-dim">// infrastructure watch, always on</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-vigil-danger/30 bg-vigil-danger/10 px-3 py-2 text-xs text-vigil-danger">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" className="w-full" loading={loading} icon={<LogIn className="size-4" />}>
            Sign in
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
