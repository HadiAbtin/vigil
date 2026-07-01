import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
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
  const location = useLocation();

  // Close the drawer automatically on navigation, and don't let it linger
  // open under the next page's content.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Lock body scroll while the mobile drawer is open, so the page behind it
  // doesn't scroll along with a swipe inside the drawer.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  function logout() {
    clearSession();
    navigate("/login");
  }

  function navList(onNavigate?: () => void) {
    return (
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "border border-vigil-cyan/30 bg-vigil-cyan/10 text-vigil-cyan-bright"
                  : "border border-transparent text-vigil-text-dim hover:bg-white/5 hover:text-vigil-text",
              )
            }
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-vigil-border bg-vigil-surface/60 backdrop-blur-sm lg:flex">
        <div className="border-b border-vigil-border px-5 py-5">
          <Logo />
        </div>
        {navList()}
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

      {/* Mobile topbar + main content, stacked in their own column so they
          never compete for row space with the (hidden-on-mobile) sidebar. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-vigil-border bg-vigil-bg/90 px-4 py-3 backdrop-blur-md lg:hidden">
          <Logo size={26} />
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="-mr-2 rounded-lg p-2.5 text-vigil-text-dim active:bg-white/10"
          >
            <Menu className="size-5" />
          </button>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-10">{children}</div>
        </main>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/60 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              className="fixed inset-y-0 left-0 z-50 flex w-[82vw] max-w-72 flex-col border-r border-vigil-border bg-vigil-bg lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
            >
              <div className="flex items-center justify-between border-b border-vigil-border px-5 py-5">
                <Logo size={26} />
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                  className="-mr-2 rounded-lg p-2.5 text-vigil-text-dim active:bg-white/10"
                >
                  <X className="size-5" />
                </button>
              </div>
              {navList(() => setMobileOpen(false))}
              <div className="border-t border-vigil-border p-3">
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-vigil-text-dim hover:bg-white/5 hover:text-vigil-danger"
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
