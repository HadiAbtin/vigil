from datetime import datetime

from pydantic import BaseModel

from app.core.constants import AlertEventStatus, AlertLevel, AlertRuleType


class AlertEventOut(BaseModel):
    id: int
    alert_rule_id: int
    rule_type: AlertRuleType
    category_name: str
    target_name: str
    status: AlertEventStatus
    level: AlertLevel
    message: str
    fired_at: datetime
    resolved_at: datetime | None
    last_seen_at: datetime
