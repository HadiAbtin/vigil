from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import IntervalBucket
from app.db.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.http_monitor import HttpMonitor
    from app.models.node_exporter_config import NodeExporterConfig
    from app.models.port_check import PortCheck


class Server(Base, TimestampMixin):
    __tablename__ = "servers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    host: Mapped[str] = mapped_column(String(255))
    ping_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    ping_interval_bucket: Mapped[str] = mapped_column(String(8), default=IntervalBucket.THIRTY_SECONDS)

    port_checks: Mapped[list["PortCheck"]] = relationship(
        back_populates="server", cascade="all, delete-orphan"
    )
    http_monitors: Mapped[list["HttpMonitor"]] = relationship(
        back_populates="server", cascade="all, delete-orphan"
    )
    node_exporter_config: Mapped["NodeExporterConfig | None"] = relationship(
        back_populates="server", uselist=False, cascade="all, delete-orphan"
    )
