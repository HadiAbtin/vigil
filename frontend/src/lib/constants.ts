import type { AlertRuleType } from "@/lib/types";

export const RULE_TYPE_LABEL: Record<AlertRuleType, string> = {
  server_ping: "Server reachability (ping)",
  tcp_port: "Port check",
  http_monitor: "HTTP monitor",
  resource_cpu: "CPU usage",
  resource_ram: "RAM usage",
  resource_disk: "Disk usage",
};
