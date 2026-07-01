import type { ReactNode } from "react";
import clsx from "clsx";
import type { AlertEventStatus, AlertLevel, InstallStatus } from "@/lib/types";

type Tone = "cyan" | "success" | "warning" | "danger" | "neutral";

const toneClasses: Record<Tone, string> = {
  cyan: "bg-vigil-cyan/10 text-vigil-cyan-bright border-vigil-cyan/30",
  success: "bg-vigil-success/10 text-vigil-success border-vigil-success/30",
  warning: "bg-vigil-warning/10 text-vigil-warning border-vigil-warning/30",
  danger: "bg-vigil-danger/10 text-vigil-danger border-vigil-danger/30",
  neutral: "bg-white/5 text-vigil-text-dim border-vigil-border",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-wider",
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}

const LEVEL_TONE: Record<AlertLevel, Tone> = { info: "cyan", warning: "warning", high: "danger" };

export function LevelBadge({ level }: { level: AlertLevel }) {
  return <Badge tone={LEVEL_TONE[level]}>{level}</Badge>;
}

const EVENT_TONE: Record<AlertEventStatus, Tone> = { firing: "danger", resolved: "success", suppressed: "neutral" };

export function AlertStatusBadge({ status }: { status: AlertEventStatus }) {
  return <Badge tone={EVENT_TONE[status]}>{status}</Badge>;
}

const INSTALL_TONE: Record<InstallStatus, Tone> = {
  not_configured: "neutral",
  pending: "warning",
  installing: "cyan",
  installed: "success",
  failed: "danger",
};

export function InstallStatusBadge({ status, active }: { status: InstallStatus; active?: boolean }) {
  if (status === "installed") {
    return <Badge tone={active ? "success" : "warning"}>{active ? "active" : "installed · not scraped yet"}</Badge>;
  }
  return <Badge tone={INSTALL_TONE[status]}>{status.replace("_", " ")}</Badge>;
}
