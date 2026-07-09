from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.core.constants import LLM_RULE_TYPES, RESOURCE_RULE_TYPES, AlertLevel, AlertRuleType
from app.schemas.base import ORMModel

_TARGET_FIELDS = ("server_id", "port_check_id", "http_monitor_id")


def _required_target_field(rule_type: AlertRuleType) -> str:
    if rule_type == AlertRuleType.TCP_PORT:
        return "port_check_id"
    if rule_type == AlertRuleType.HTTP_MONITOR:
        return "http_monitor_id"
    return "server_id"  # server_ping, resource_cpu, resource_ram, resource_disk, llm_tokens, llm_cost


def validate_threshold(rule_type: AlertRuleType, value: float | None) -> None:
    """threshold_value's valid range depends on rule_type: resource rules are a
    0-100 percentage, llm rules are an absolute token count or dollar amount
    with no natural upper bound, everything else doesn't use it at all."""
    if rule_type in RESOURCE_RULE_TYPES:
        if value is None or not (0 <= value <= 100):
            raise ValueError("threshold_value must be a percentage between 0 and 100 for resource rule types")
    elif rule_type in LLM_RULE_TYPES:
        if value is None or value <= 0:
            raise ValueError("threshold_value must be a positive number for llm rule types")


class AlertRuleCreate(BaseModel):
    rule_type: AlertRuleType
    server_id: int | None = None
    port_check_id: int | None = None
    http_monitor_id: int | None = None
    threshold_value: float | None = None
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
        validate_threshold(self.rule_type, self.threshold_value)
        return self


class AlertRuleUpdate(BaseModel):
    threshold_value: float | None = None
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
