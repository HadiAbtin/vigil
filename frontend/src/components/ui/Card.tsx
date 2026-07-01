import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
  children: ReactNode;
}

export function Card({ glow, className, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        "vigil-panel rounded-xl",
        glow && "vigil-panel-glow",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-vigil-border px-5 py-4">
      <div>
        <h2 className="font-display text-sm font-semibold tracking-wide text-vigil-text uppercase">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-vigil-text-dim">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
