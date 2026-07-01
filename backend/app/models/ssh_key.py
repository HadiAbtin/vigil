from typing import TYPE_CHECKING

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.node_exporter_config import NodeExporterConfig


class SSHKey(Base, TimestampMixin):
    __tablename__ = "ssh_keys"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    encrypted_private_key: Mapped[str] = mapped_column(Text)
    public_key: Mapped[str] = mapped_column(Text)
    fingerprint: Mapped[str] = mapped_column(String(128))

    node_exporter_configs: Mapped[list["NodeExporterConfig"]] = relationship(back_populates="ssh_key")
