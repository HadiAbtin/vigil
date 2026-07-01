"""Shared enums/constants referenced across models, services, and Celery tasks."""

from enum import StrEnum


class IntervalBucket(StrEnum):
    """Admin-selectable poll intervals. Each maps to a dedicated Prometheus scrape
    job (Prometheus's scrape_interval is per-job, not per-target), so this list is
    intentionally curated rather than free-form seconds."""

    THIRTY_SECONDS = "30s"
    ONE_MINUTE = "1m"
    FIVE_MINUTES = "5m"
    FIFTEEN_MINUTES = "15m"


INTERVAL_BUCKET_SECONDS: dict[str, int] = {
    IntervalBucket.THIRTY_SECONDS: 30,
    IntervalBucket.ONE_MINUTE: 60,
    IntervalBucket.FIVE_MINUTES: 300,
    IntervalBucket.FIFTEEN_MINUTES: 900,
}


class ProbeType(StrEnum):
    PING = "ping"
    TCP = "tcp"
    HTTP = "http"


class InstallStatus(StrEnum):
    NOT_CONFIGURED = "not_configured"
    PENDING = "pending"
    INSTALLING = "installing"
    INSTALLED = "installed"
    FAILED = "failed"


class PortExpectedState(StrEnum):
    OPEN = "open"
    CLOSED = "closed"


class HttpMethod(StrEnum):
    GET = "GET"
    POST = "POST"
    HEAD = "HEAD"
    PUT = "PUT"


class AlertRuleType(StrEnum):
    SERVER_PING = "server_ping"
    TCP_PORT = "tcp_port"
    HTTP_MONITOR = "http_monitor"
    RESOURCE_CPU = "resource_cpu"
    RESOURCE_RAM = "resource_ram"
    RESOURCE_DISK = "resource_disk"


RESOURCE_RULE_TYPES = {
    AlertRuleType.RESOURCE_CPU,
    AlertRuleType.RESOURCE_RAM,
    AlertRuleType.RESOURCE_DISK,
}

# node_exporter is scraped on a single fixed job (not bucketed like blackbox
# probes), so resource-rule evaluation cadence is gated on this instead of an
# admin-selectable IntervalBucket.
NODE_EXPORTER_SCRAPE_INTERVAL_SECONDS = 30
CPU_RATE_WINDOW = "2m"


class AlertLevel(StrEnum):
    INFO = "info"
    WARNING = "warning"
    HIGH = "high"


class AlertEventStatus(StrEnum):
    """An AlertEvent row represents one firing/suppressed episode. The ramp-up
    ("pending") state before a rule crosses its consecutive-breach threshold is
    tracked as counters directly on AlertRule, not as its own event row, so the
    history table isn't flooded with episodes that never actually fired."""

    FIRING = "firing"
    RESOLVED = "resolved"
    SUPPRESSED = "suppressed"
