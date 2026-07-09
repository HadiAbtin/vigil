from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.base import ORMModel
from app.schemas.metrics import MetricSeries


def _validate_base_url(v: str) -> str:
    if not (v.startswith("http://") or v.startswith("https://")):
        raise ValueError("base_url must start with http:// or https://")
    return v


class LlmCostExporterCreate(BaseModel):
    base_url: str = Field(min_length=1, max_length=255)
    token: str = Field(min_length=1)

    @field_validator("base_url")
    @classmethod
    def _check_base_url(cls, v: str) -> str:
        return _validate_base_url(v)


class LlmCostExporterUpdate(BaseModel):
    base_url: str | None = Field(default=None, min_length=1, max_length=255)
    token: str | None = Field(default=None, min_length=1, description="Set to rotate the token")
    enabled: bool | None = None

    @field_validator("base_url")
    @classmethod
    def _check_base_url(cls, v: str | None) -> str | None:
        return _validate_base_url(v) if v is not None else v


class LlmCostExporterOut(ORMModel):
    id: int
    server_id: int
    base_url: str
    enabled: bool
    last_synced_at: datetime | None
    last_error: str | None
    created_at: datetime


class LlmUsageResponse(BaseModel):
    granularity: str
    token_series: list[MetricSeries]
    cost_series: list[MetricSeries]
    period_label: str
    period_total_tokens: float
    period_total_cost: float
    period_cost_by_provider: dict[str, float]
