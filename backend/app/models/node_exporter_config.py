from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import InstallStatus
from app.db.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.server import Server
    from app.models.ssh_key import SSHKey


class NodeExporterConfig(Base, TimestampMixin):
    __tablename__ = "node_exporter_configs"

    id: Mapped[int] = mapped_column(primary_key=True)
    server_id: Mapped[int] = mapped_column(ForeignKey("servers.id", ondelete="CASCADE"), unique=True)
    ssh_key_id: Mapped[int] = mapped_column(ForeignKey("ssh_keys.id"))
    ssh_user: Mapped[str] = mapped_column(String(64))
    ssh_port: Mapped[int] = mapped_column(Integer, default=22)
    install_status: Mapped[str] = mapped_column(String(16), default=InstallStatus.PENDING)
    active: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    host_key_fingerprint: Mapped[str | None] = mapped_column(String(128), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    server: Mapped["Server"] = relationship(back_populates="node_exporter_config")
    ssh_key: Mapped["SSHKey"] = relationship(back_populates="node_exporter_configs")
