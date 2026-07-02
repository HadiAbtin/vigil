from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db, require_password_already_changed
from app.core.constants import AlertEventStatus, AlertLevel, AlertRuleType
from app.models import AlertEvent, AlertRule, HttpMonitor, PortCheck
from app.schemas.alert_event import AlertEventOut

router = APIRouter(prefix="/alert-events", tags=["alert-events"], dependencies=[Depends(require_password_already_changed)])


def _target_name(rule: AlertRule) -> str:
    if rule.rule_type == AlertRuleType.TCP_PORT and rule.port_check is not None:
        return f"{rule.port_check.server.name}:{rule.port_check.port}"
    if rule.rule_type == AlertRuleType.HTTP_MONITOR and rule.http_monitor is not None:
        return rule.http_monitor.name
    if rule.server is not None:
        return rule.server.name
    return "?"


@router.get("", response_model=list[AlertEventOut])
def list_alert_events(
    status: AlertEventStatus | None = Query(default=None),
    level: AlertLevel | None = Query(default=None),
    rule_type: AlertRuleType | None = Query(default=None),
    category_id: int | None = Query(default=None),
    server_id: int | None = Query(default=None, description="Matches events targeting this server directly, or via one of its port checks / HTTP monitors"),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[AlertEventOut]:
    query = (
        db.query(AlertEvent)
        .join(AlertEvent.alert_rule)
        .options(
            joinedload(AlertEvent.alert_rule).joinedload(AlertRule.category),
            joinedload(AlertEvent.alert_rule).joinedload(AlertRule.server),
            joinedload(AlertEvent.alert_rule).joinedload(AlertRule.port_check),
            joinedload(AlertEvent.alert_rule).joinedload(AlertRule.http_monitor),
        )
    )
    if status is not None:
        query = query.filter(AlertEvent.status == status)
    if level is not None:
        query = query.filter(AlertEvent.level == level)
    if rule_type is not None:
        query = query.filter(AlertRule.rule_type == rule_type)
    if category_id is not None:
        query = query.filter(AlertRule.category_id == category_id)
    if server_id is not None:
        query = (
            query.outerjoin(PortCheck, AlertRule.port_check_id == PortCheck.id)
            .outerjoin(HttpMonitor, AlertRule.http_monitor_id == HttpMonitor.id)
            .filter(
                or_(
                    AlertRule.server_id == server_id,
                    PortCheck.server_id == server_id,
                    HttpMonitor.server_id == server_id,
                )
            )
        )
    events = query.order_by(AlertEvent.fired_at.desc()).limit(limit).all()

    return [
        AlertEventOut(
            id=e.id,
            alert_rule_id=e.alert_rule_id,
            rule_type=e.alert_rule.rule_type,
            category_name=e.alert_rule.category.name,
            target_name=_target_name(e.alert_rule),
            status=e.status,
            level=e.level,
            message=e.message,
            fired_at=e.fired_at,
            resolved_at=e.resolved_at,
            last_seen_at=e.last_seen_at,
        )
        for e in events
    ]
