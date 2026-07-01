from pydantic import BaseModel


class DashboardSummary(BaseModel):
    server_count: int
    http_monitor_count: int
    node_exporter_active_count: int
    node_exporter_pending_count: int
    firing_alert_count: int
    firing_by_level: dict[str, int]
    telegram_bot_count: int
