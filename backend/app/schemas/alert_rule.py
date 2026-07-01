from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.core.constants import RESOURCE_RULE_TYPES, AlertLevel, AlertRuleType
from app.schemas.base import ORMModel

_TARGET_FIELDS = ("server_id", "port_check_id", "http_monitor_id")


def _required_target_field(rule_type: AlertRuleType) -> str:
    if rule_type == AlertRuleType.TCP_PORT:
        return "port_check_id"
    if rule_type == AlertRuleType.HTTP_MONITOR:
        return "http_monitor_id"
    return "server_id"  # server_ping, resource_cpu, resource_ram, resource_disk


class AlertRuleCreate(BaseModel):
    rule_type: AlertRuleType
    server_id: int | None = None
    port_check_id: int | None = None
    http_monitor_id: int | None = None
    threshold_value: float | None = Field(default=None, ge=0, le=100)
    level: AlertLevel = AlertLevel.WARNING
    category_id: int
    consecutive_breaches_required: int = Field(default=3, ge=1, le=20)
    custom_message_template: str | None = None
    enabled: bool = True

    @model_validator(mode="after")
    def validate_target(self) -> "AlertRuleCreate":
        required = _required_target_field(self.rule_type)
        values = {f: getattr(self, f) for f in _TARGET_FIELDS}
        if values[required] is None:
            raise ValueError(f"{required} is required for rule_type={self.rule_type}")
        for field, value in values.items():
            if field != required and value is not None:
                raise ValueError(f"{field} must not be set for rule_type={self.rule_type}")
        if self.rule_type in RESOURCE_RULE_TYPES and self.threshold_value is None:
            raise ValueError("threshold_value (percent) is required for resource rule types")
        return self


class AlertRuleUpdate(BaseModel):
    threshold_value: float | None = Field(default=None, ge=0, le=100)
    level: AlertLevel | None = None
    category_id: int | None = None
    consecutive_breaches_required: int | None = Field(default=None, ge=1, le=20)
    custom_message_template: str | None = None
    enabled: bool | None = None


class AlertRuleOut(ORMModel):
    id: int
    rule_type: AlertRuleType
    server_id: int | None
    port_check_id: int | None
    http_monitor_id: int | None
    threshold_value: float | None
    level: AlertLevel
    category_id: int
    consecutive_breaches_required: int
    custom_message_template: str | None
    enabled: bool
    created_at: datetime
