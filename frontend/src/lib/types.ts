export type IntervalBucket = "30s" | "1m" | "5m" | "15m";
export type HttpMethod = "GET" | "POST" | "HEAD" | "PUT";
export type PortExpectedState = "open" | "closed";
export type InstallStatus = "not_configured" | "pending" | "installing" | "installed" | "failed";
export type AlertRuleType =
  | "server_ping"
  | "tcp_port"
  | "http_monitor"
  | "resource_cpu"
  | "resource_ram"
  | "resource_disk";
export type AlertLevel = "info" | "warning" | "high";
export type AlertEventStatus = "firing" | "resolved" | "suppressed";

export interface MetricSeries {
  name: string;
  points: [number, number][];
}

export interface MetricRangeResponse {
  unit: string;
  series: MetricSeries[];
}

export interface User {
  id: number;
  username: string;
  must_change_password: boolean;
  created_at: string;
}

export interface SSHKey {
  id: number;
  name: string;
  public_key: string;
  fingerprint: string;
  created_at: string;
}

export interface SSHKeyCreated extends SSHKey {
  private_key: string | null;
}

export interface PortCheck {
  id: number;
  server_id: number;
  port: number;
  expected_state: PortExpectedState;
  interval_bucket: IntervalBucket;
  enabled: boolean;
  created_at: string;
}

export interface PortCheckWithServer extends PortCheck {
  server_name: string;
}

export interface HttpMonitor {
  id: number;
  server_id: number | null;
  name: string;
  url: string;
  method: HttpMethod;
  expected_status_codes: string;
  interval_bucket: IntervalBucket;
  enabled: boolean;
  created_at: string;
}

export interface NodeExporterConfig {
  id: number;
  server_id: number;
  ssh_key_id: number;
  ssh_user: string;
  ssh_port: number;
  install_status: InstallStatus;
  active: boolean;
  host_key_fingerprint: string | null;
  last_error: string | null;
  last_checked_at: string | null;
  created_at: string;
}

export interface Server {
  id: number;
  name: string;
  host: string;
  ping_enabled: boolean;
  ping_interval_bucket: IntervalBucket;
  created_at: string;
}

export interface ServerDetail extends Server {
  port_checks: PortCheck[];
  http_monitors: HttpMonitor[];
  node_exporter_config: NodeExporterConfig | null;
}

export interface AlertCategory {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export interface AlertRule {
  id: number;
  rule_type: AlertRuleType;
  server_id: number | null;
  port_check_id: number | null;
  http_monitor_id: number | null;
  threshold_value: number | null;
  level: AlertLevel;
  category_id: number;
  consecutive_breaches_required: number;
  custom_message_template: string | null;
  enabled: boolean;
  created_at: string;
}

export interface TelegramBot {
  id: number;
  name: string;
  chat_id: string;
  enabled: boolean;
  categories: AlertCategory[];
  created_at: string;
}

export interface AlertEvent {
  id: number;
  alert_rule_id: number;
  rule_type: AlertRuleType;
  category_name: string;
  target_name: string;
  status: AlertEventStatus;
  level: AlertLevel;
  message: string;
  fired_at: string;
  resolved_at: string | null;
  last_seen_at: string;
}

export interface DashboardSummary {
  server_count: number;
  http_monitor_count: number;
  node_exporter_active_count: number;
  node_exporter_pending_count: number;
  firing_alert_count: number;
  firing_by_level: Record<string, number>;
  telegram_bot_count: number;
}
