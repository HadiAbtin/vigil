import type { ReactNode } from "react";

export function Spinner({ className = "size-5" }: { className?: string }) {
  return <span className={`${className} inline-block rounded-full border-2 border-vigil-cyan/30 border-t-vigil-cyan animate-spin`} />;
}

export function LoadingBlock() {
  return (
    <div className="flex items-center justify-center py-16 text-vigil-text-dim">
      <Spinner />
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      {icon && <div className="text-vigil-text-faint">{icon}</div>}
      <div>
        <p className="font-display text-sm font-medium text-vigil-text">{title}</p>
        {description && <p className="mt-1 max-w-sm text-xs text-vigil-text-dim">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, icon, tone = "cyan" }: { label: string; value: ReactNode; icon?: ReactNode; tone?: "cyan" | "danger" | "success" | "warning" }) {
  const toneColor = {
    cyan: "text-vigil-cyan-bright",
    danger: "text-vigil-danger",
    success: "text-vigil-success",
    warning: "text-vigil-warning",
  }[tone];

  return (
    <div className="vigil-panel rounded-xl p-5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wider text-vigil-text-dim">{label}</span>
        {icon && <span className={toneColor}>{icon}</span>}
      </div>
      <p className={`mt-3 font-display text-3xl font-semibold ${toneColor}`}>{value}</p>
    </div>
  );
}
