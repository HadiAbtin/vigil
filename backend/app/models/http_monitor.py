from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import HttpMethod, IntervalBucket
from app.db.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.server import Server


class HttpMonitor(Base, TimestampMixin):
    """Powers both a server-attached HTTP check and the standalone "HTTP Monitor"
    section — server_id is nullable and simply unset for standalone monitors."""

    __tablename__ = "http_monitors"

    id: Mapped[int] = mapped_column(primary_key=True)
    server_id: Mapped[int | None] = mapped_column(ForeignKey("servers.id", ondelete="CASCADE"), nullable=True)
    name: Mapped[str] = mapped_column(String(128))
    url: Mapped[str] = mapped_column(String(2048))
    method: Mapped[str] = mapped_column(String(8), default=HttpMethod.GET)
    expected_status_codes: Mapped[str] = mapped_column(String(64), default="200-299")
    interval_bucket: Mapped[str] = mapped_column(String(8), default=IntervalBucket.THIRTY_SECONDS)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    server: Mapped["Server | None"] = relationship(back_populates="http_monitors")
