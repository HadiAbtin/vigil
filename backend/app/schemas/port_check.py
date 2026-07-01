from datetime import datetime

from pydantic import BaseModel, Field

from app.core.constants import IntervalBucket, PortExpectedState
from app.schemas.base import ORMModel


class PortCheckCreate(BaseModel):
    port: int = Field(ge=1, le=65535)
    expected_state: PortExpectedState = PortExpectedState.OPEN
    interval_bucket: IntervalBucket = IntervalBucket.THIRTY_SECONDS
    enabled: bool = True


class PortCheckUpdate(BaseModel):
    port: int | None = Field(default=None, ge=1, le=65535)
    expected_state: PortExpectedState | None = None
    interval_bucket: IntervalBucket | None = None
    enabled: bool | None = None


class PortCheckOut(ORMModel):
    id: int
    server_id: int
    port: int
    expected_state: PortExpectedState
    interval_bucket: IntervalBucket
    enabled: bool
    created_at: datetime


class PortCheckWithServerOut(PortCheckOut):
    server_name: str
