import { useState } from "react";
import clsx from "clsx";
import { Modal } from "@/components/ui/Modal";
import { MetricChart } from "@/components/MetricChart";
import type { AlertRuleType } from "@/lib/types";

const HTTP_FIELD_TABS: { key: "latency" | "status"; label: string }[] = [
  { key: "latency", label: "Response time" },
  { key: "status", label: "Status code" },
];

export function MetricChartModal({
  open,
  onClose,
  title,
  ruleType,
  targetId,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  ruleType: AlertRuleType;
  targetId: number | null;
}) {
  const [field, setField] = useState<"latency" | "status">("latency");
  const showFieldTabs = ruleType === "http_monitor";

  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      {showFieldTabs && (
        <div className="mb-3 flex gap-1.5">
          {HTTP_FIELD_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setField(tab.key)}
              className={clsx(
                "rounded-md border px-2.5 py-1 text-xs transition-colors",
                field === tab.key
                  ? "border-vigil-cyan/40 bg-vigil-cyan/10 text-vigil-cyan-bright"
                  : "border-vigil-border text-vigil-text-dim hover:text-vigil-text",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
      {targetId !== null && (
        <MetricChart ruleType={ruleType} targetId={targetId} field={showFieldTabs ? field : undefined} height={280} />
      )}
    </Modal>
  );
}
