import { useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  LayoutDashboard,
  Server,
  Globe,
  KeyRound,
  BellRing,
  Tags,
  Send,
  History,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuthStore } from "@/store/auth";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/servers", label: "Servers", icon: Server },
  { to: "/http-monitors", label: "HTTP Monitors", icon: Globe },
  { to: "/ssh-keys", label: "SSH Keys", icon: KeyRound },
  { to: "/alert-rules", label: "Alert Rules", icon: BellRing },
  { to: "/alert-categories", label: "Categories", icon: Tags },
  { to: "/telegram-bots", label: "Telegram Bots", icon: Send },
  { to: "/alert-events", label: "Alert History", icon: History },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const clearSession = useAuthStore((s) => s.clearSession);
  const navigate = useNavigate();

  function logout() {
    clearSession();
    navigate("/login");
  }

  const navList = (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            clsx(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
              isActive
                ? "bg-vigil-cyan/10 text-vigil-cyan-bright border border-vigil-cyan/30"
                : "text-vigil-text-dim border border-transparent hover:bg-white/5 hover:text-vigil-text",
            )
          }
        >
          <Icon className="size-4 shrink-0" />
          {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-vigil-border bg-vigil-surface/60 backdrop-blur-sm lg:flex lg:flex-col">
        <div className="border-b border-vigil-border px-5 py-5">
          <Logo />
        </div>
        {navList}
        <div className="border-t border-vigil-border p-3">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-vigil-text-dim hover:bg-white/5 hover:text-vigil-danger"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile topbar + drawer */}
      <div className="flex flex-1 flex-col lg:hidden">
        <div className="flex items-center justify-between border-b border-vigil-border bg-vigil-surface/80 px-4 py-3 backdrop-blur-sm">
          <Logo size={28} />
          <button onClick={() => setMobileOpen(true)} className="text-vigil-text-dim">
            <Menu className="size-6" />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="w-72 flex-col border-r border-vigil-border bg-vigil-bg flex">
            <div className="flex items-center justify-between border-b border-vigil-border px-5 py-5">
              <Logo />
              <button onClick={() => setMobileOpen(false)} className="text-vigil-text-dim">
                <X className="size-5" />
              </button>
            </div>
            {navList}
            <div className="border-t border-vigil-border p-3">
              <button
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-vigil-text-dim hover:bg-white/5 hover:text-vigil-danger"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </div>
          </div>
          <div className="flex-1 bg-black/60" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
