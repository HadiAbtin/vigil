import type { AlertRuleType } from "@/lib/types";

export const RULE_TYPE_LABEL: Record<AlertRuleType, string> = {
  server_ping: "Server reachability (ping)",
  tcp_port: "Port check",
  http_monitor: "HTTP monitor",
  resource_cpu: "CPU usage",
  resource_ram: "RAM usage",
  resource_disk: "Disk usage",
  llm_tokens: "LLM tokens (daily)",
  llm_cost: "LLM cost (daily)",
};

// Matches the provider keys returned by the LLM usage exporter's API exactly
// (e.g. "anthropic", not "claude") — this only maps them to a display label.
export const LLM_PROVIDERS = ["anthropic", "openai", "gemini", "deepseek"] as const;
export const LLM_PROVIDER_LABEL: Record<string, string> = {
  anthropic: "Claude",
  openai: "OpenAI",
  gemini: "Gemini",
  deepseek: "DeepSeek",
};
