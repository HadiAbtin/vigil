from datetime import datetime

from pydantic import BaseModel, Field

from app.core.constants import IntervalBucket
from app.schemas.base import ORMModel
from app.schemas.http_monitor import HttpMonitorOut
from app.schemas.llm_cost import LlmCostExporterOut
from app.schemas.node_exporter_config import NodeExporterConfigOut
from app.schemas.port_check import PortCheckOut


class ServerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    host: str = Field(min_length=1, max_length=255)
    ping_enabled: bool = True
    ping_interval_bucket: IntervalBucket = IntervalBucket.THIRTY_SECONDS


class ServerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    host: str | None = Field(default=None, min_length=1, max_length=255)
    ping_enabled: bool | None = None
    ping_interval_bucket: IntervalBucket | None = None


class ServerOut(ORMModel):
    id: int
    name: str
    host: str
    ping_enabled: bool
    ping_interval_bucket: IntervalBucket
    created_at: datetime


class ServerDetailOut(ServerOut):
    port_checks: list[PortCheckOut] = []
    http_monitors: list[HttpMonitorOut] = []
    node_exporter_config: NodeExporterConfigOut | None = None
    llm_cost_exporter: LlmCostExporterOut | None = None
