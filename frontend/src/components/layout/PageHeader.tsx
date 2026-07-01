import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold text-vigil-text vigil-glow-text">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-vigil-text-dim">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
