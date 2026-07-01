from datetime import datetime

from pydantic import BaseModel, Field

from app.core.constants import InstallStatus
from app.schemas.base import ORMModel


class NodeExporterConfigCreate(BaseModel):
    ssh_key_id: int
    ssh_user: str = Field(min_length=1, max_length=64)
    ssh_port: int = Field(default=22, ge=1, le=65535)


class NodeExporterConfigOut(ORMModel):
    id: int
    server_id: int
    ssh_key_id: int
    ssh_user: str
    ssh_port: int
    install_status: InstallStatus
    active: bool
    host_key_fingerprint: str | None
    last_error: str | None
    last_checked_at: datetime | None
    created_at: datetime
