import type { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-vigil-cyan to-vigil-blue text-black font-semibold shadow-[0_0_20px_rgba(34,211,238,0.35)] hover:shadow-[0_0_28px_rgba(34,211,238,0.55)] hover:brightness-110",
  secondary:
    "bg-vigil-surface-2 border border-vigil-border text-vigil-text hover:border-vigil-cyan/50 hover:text-vigil-cyan-bright",
  ghost: "bg-transparent text-vigil-text-dim hover:text-vigil-text hover:bg-white/5",
  danger: "bg-vigil-danger/10 border border-vigil-danger/40 text-vigil-danger hover:bg-vigil-danger/20",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-xs px-3 py-1.5 gap-1.5",
  md: "text-sm px-4 py-2.5 gap-2",
};

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  loading,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center rounded-lg font-display tracking-wide transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading ? <span className="size-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" /> : icon}
      {children}
    </button>
  );
}
