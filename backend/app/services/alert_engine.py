"""The alert evaluation loop: for every enabled AlertRule whose bucket interval
has elapsed, query Prometheus, apply flap-dampening (N consecutive breaches
before firing, N consecutive healthy evaluations before resolving), and manage
AlertEvent episodes.

Dedup: server_ping rules are evaluated first. Any other rule (tcp_port,
http_monitor, resource_*) that belongs to a server whose ping rule is currently
firing is short-circuited straight to "suppressed" — no Prometheus query, no
Telegram notification — because a downed server makes every dependent check
uninformative. A single port being down does not suppress unrelated http
monitors on the same server; only whole-server ping-down does.
"""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.constants import (
    NODE_EXPORTER_SCRAPE_INTERVAL_SECONDS,
    INTERVAL_BUCKET_SECONDS,
    AlertEventStatus,
    AlertRuleType,
    PortExpectedState,
)
from app.models import AlertEvent, AlertRule
from app.services import prometheus_query

CheckResult = tuple[bool, str] | None  # (is_breach, human-readable detail), or None if no data yet


def _rule_interval_seconds(rule: AlertRule) -> int:
    if rule.rule_type == AlertRuleType.SERVER_PING:
        return INTERVAL_BUCKET_SECONDS[rule.server.ping_interval_bucket]
    if rule.rule_type == AlertRuleType.TCP_PORT:
        return INTERVAL_BUCKET_SECONDS[rule.port_check.interval_bucket]
    if rule.rule_type == AlertRuleType.HTTP_MONITOR:
        return INTERVAL_BUCKET_SECONDS[rule.http_monitor.interval_bucket]
    return NODE_EXPORTER_SCRAPE_INTERVAL_SECONDS


def _is_due(rule: AlertRule, now: datetime) -> bool:
    if rule.last_evaluated_at is None:
        return True
    elapsed = (now - rule.last_evaluated_at).total_seconds()
    return elapsed >= _rule_interval_seconds(rule)


def _rule_server_id(rule: AlertRule) -> int | None:
    if rule.server_id:
        return rule.server_id
    if rule.port_check_id:
        return rule.port_check.server_id
    if rule.http_monitor_id:
        return rule.http_monitor.server_id  # None for standalone HTTP monitors — never suppressed
    return None


def _status_in_range(code: int, spec: str) -> bool:
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            lo, hi = part.split("-", 1)
            if lo.strip().isdigit() and hi.strip().isdigit() and int(lo) <= code <= int(hi):
                return True
        elif part.isdigit() and code == int(part):
            return True
    return False


def _check_ping(rule: AlertRule) -> CheckResult:
    value = prometheus_query.get_probe_success("server_ping", rule.server_id)
    if value is None:
        return None
    return (value == 0, f"Ping to {rule.server.name} ({rule.server.host})")


def _check_tcp(rule: AlertRule) -> CheckResult:
    value = prometheus_query.get_probe_success("tcp_port", rule.port_check_id)
    if value is None:
        return None
    port_open = value == 1
    breach = (not port_open) if rule.port_check.expected_state == PortExpectedState.OPEN else port_open
    server_name = rule.port_check.server.name
    return (breach, f"Port {rule.port_check.port} on {server_name} ({'open' if port_open else 'closed'})")


def _check_http(rule: AlertRule) -> CheckResult:
    # blackbox_exporter's own probe_success defaults to "2xx only", which would
    # misjudge a monitor that intentionally expects e.g. 404. So probe_success is
    # only used here to tell "never scraped yet" (metric absent) apart from
    # "scraped, connection failed before any response" (present but status-code
    # metric absent) — the actual pass/fail verdict always comes from comparing
    # probe_http_status_code against the admin's own expected_status_codes.
    success = prometheus_query.get_probe_success("http_monitor", rule.http_monitor_id)
    if success is None:
        return None  # not scraped yet
    name = rule.http_monitor.name
    status_code = prometheus_query.get_http_status_code(rule.http_monitor_id)
    if status_code is None:
        return (True, f"{name} is unreachable")
    code = int(status_code)
    if _status_in_range(code, rule.http_monitor.expected_status_codes):
        return (False, f"{name} returned {code}")
    return (True, f"{name} returned {code}, expected {rule.http_monitor.expected_status_codes}")


def _check_resource(rule: AlertRule) -> CheckResult:
    if rule.rule_type == AlertRuleType.RESOURCE_CPU:
        value = prometheus_query.get_cpu_usage_percent(rule.server_id)
        label = "CPU"
    elif rule.rule_type == AlertRuleType.RESOURCE_RAM:
        value = prometheus_query.get_ram_usage_percent(rule.server_id)
        label = "RAM"
    else:
        disk = prometheus_query.get_max_disk_usage_percent(rule.server_id)
        if disk is None:
            return None
        value, mountpoint = disk
        label = f"Disk ({mountpoint})"
        threshold = float(rule.threshold_value)
        return (value >= threshold, f"{label} usage on {rule.server.name}: {value:.1f}% (threshold {threshold:.0f}%)")

    if value is None:
        return None
    threshold = float(rule.threshold_value)
    return (value >= threshold, f"{label} usage on {rule.server.name}: {value:.1f}% (threshold {threshold:.0f}%)")


_CHECKERS = {
    AlertRuleType.SERVER_PING: _check_ping,
    AlertRuleType.TCP_PORT: _check_tcp,
    AlertRuleType.HTTP_MONITOR: _check_http,
    AlertRuleType.RESOURCE_CPU: _check_resource,
    AlertRuleType.RESOURCE_RAM: _check_resource,
    AlertRuleType.RESOURCE_DISK: _check_resource,
}


def _current_open_event(db: Session, rule: AlertRule) -> AlertEvent | None:
    return (
        db.query(AlertEvent)
        .filter(AlertEvent.alert_rule_id == rule.id, AlertEvent.resolved_at.is_(None))
        .order_by(AlertEvent.id.desc())
        .first()
    )


def _render_message(rule: AlertRule, detail: str) -> str:
    if rule.custom_message_template:
        return rule.custom_message_template.format(detail=detail, category=rule.category.name, level=rule.level)
    return f"[{rule.category.name}] {detail}"


def _evaluate_rule(db: Session, rule: AlertRule, now: datetime) -> None:
    checker = _CHECKERS[rule.rule_type]
    result = checker(rule)
    if result is None:
        return  # no Prometheus data yet — retry sooner rather than waiting a full bucket

    is_breach, detail = result
    rule.last_evaluated_at = now
    open_event = _current_open_event(db, rule)

    if is_breach:
        rule.consecutive_breach_count += 1
        rule.consecutive_healthy_count = 0

        if open_event is None:
            if rule.consecutive_breach_count >= rule.consecutive_breaches_required:
                event = AlertEvent(
                    alert_rule_id=rule.id,
                    status=AlertEventStatus.FIRING,
                    level=rule.level,
                    message=_render_message(rule, detail),
                    last_seen_at=now,
                )
                db.add(event)
                db.flush()
                _dispatch(event.id)
        elif open_event.status == AlertEventStatus.FIRING:
            open_event.last_seen_at = now
    else:
        rule.consecutive_healthy_count += 1
        rule.consecutive_breach_count = 0

        if open_event is not None and open_event.status == AlertEventStatus.FIRING:
            if rule.consecutive_healthy_count >= rule.consecutive_breaches_required:
                open_event.resolved_at = now
                db.flush()
                _dispatch(open_event.id)


def _suppress_rule(db: Session, rule: AlertRule, now: datetime) -> None:
    open_event = _current_open_event(db, rule)
    if open_event is not None and open_event.status == AlertEventStatus.SUPPRESSED:
        open_event.last_seen_at = now
        return

    if open_event is not None and open_event.status == AlertEventStatus.FIRING:
        # Already firing independently when the server also went down — close
        # the episode quietly (no extra Telegram noise) and switch to suppressed.
        open_event.resolved_at = now

    db.add(
        AlertEvent(
            alert_rule_id=rule.id,
            status=AlertEventStatus.SUPPRESSED,
            level=rule.level,
            message=f"[{rule.category.name}] suppressed — server unreachable",
            last_seen_at=now,
        )
    )
    rule.consecutive_breach_count = 0
    rule.consecutive_healthy_count = 0


def _close_suppression_if_any(db: Session, rule: AlertRule, now: datetime) -> None:
    open_event = _current_open_event(db, rule)
    if open_event is not None and open_event.status == AlertEventStatus.SUPPRESSED:
        open_event.resolved_at = now


def _dispatch(event_id: int) -> None:
    from app.tasks.dispatch_telegram_alert import dispatch_telegram_alert  # avoid import cycle

    dispatch_telegram_alert.delay(event_id)


def evaluate_all(db: Session) -> None:
    now = datetime.now(timezone.utc)
    rules = db.query(AlertRule).filter(AlertRule.enabled.is_(True)).all()

    ping_rules = [r for r in rules if r.rule_type == AlertRuleType.SERVER_PING]
    other_rules = [r for r in rules if r.rule_type != AlertRuleType.SERVER_PING]

    for rule in ping_rules:
        if _is_due(rule, now):
            _evaluate_rule(db, rule, now)
    db.flush()

    down_server_ids: set[int] = set()
    for rule in ping_rules:
        open_event = _current_open_event(db, rule)
        if open_event is not None and open_event.status == AlertEventStatus.FIRING:
            down_server_ids.add(rule.server_id)

    for rule in other_rules:
        server_id = _rule_server_id(rule)
        if server_id is not None and server_id in down_server_ids:
            _suppress_rule(db, rule, now)
            continue
        _close_suppression_if_any(db, rule, now)
        if _is_due(rule, now):
            _evaluate_rule(db, rule, now)

    db.commit()
