from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import IntervalBucket, PortExpectedState
from app.db.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.server import Server


class PortCheck(Base, TimestampMixin):
    __tablename__ = "port_checks"

    id: Mapped[int] = mapped_column(primary_key=True)
    server_id: Mapped[int] = mapped_column(ForeignKey("servers.id", ondelete="CASCADE"))
    port: Mapped[int] = mapped_column(Integer)
    expected_state: Mapped[str] = mapped_column(String(8), default=PortExpectedState.OPEN)
    interval_bucket: Mapped[str] = mapped_column(String(8), default=IntervalBucket.THIRTY_SECONDS)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    server: Mapped["Server"] = relationship(back_populates="port_checks")
