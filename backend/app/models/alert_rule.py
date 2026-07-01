from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import AlertLevel
from app.db.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.alert_category import AlertCategory
    from app.models.alert_event import AlertEvent
    from app.models.http_monitor import HttpMonitor
    from app.models.port_check import PortCheck
    from app.models.server import Server

_VALID_TARGET_SQL = (
    "(rule_type = 'server_ping' AND server_id IS NOT NULL AND port_check_id IS NULL AND http_monitor_id IS NULL) OR "
    "(rule_type IN ('resource_cpu', 'resource_ram', 'resource_disk') AND server_id IS NOT NULL "
    "AND port_check_id IS NULL AND http_monitor_id IS NULL) OR "
    "(rule_type = 'tcp_port' AND port_check_id IS NOT NULL AND server_id IS NULL AND http_monitor_id IS NULL) OR "
    "(rule_type = 'http_monitor' AND http_monitor_id IS NOT NULL AND server_id IS NULL AND port_check_id IS NULL)"
)


class AlertRule(Base, TimestampMixin):
    __tablename__ = "alert_rules"
    __table_args__ = (CheckConstraint(_VALID_TARGET_SQL, name="valid_target_for_rule_type"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    rule_type: Mapped[str] = mapped_column(String(16))

    # Exactly one of these is set, enforced by the CHECK constraint above and
    # validated again at the schema layer before insert/update.
    server_id: Mapped[int | None] = mapped_column(ForeignKey("servers.id", ondelete="CASCADE"), nullable=True)
    port_check_id: Mapped[int | None] = mapped_column(
        ForeignKey("port_checks.id", ondelete="CASCADE"), nullable=True
    )
    http_monitor_id: Mapped[int | None] = mapped_column(
        ForeignKey("http_monitors.id", ondelete="CASCADE"), nullable=True
    )

    threshold_value: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    level: Mapped[str] = mapped_column(String(8), default=AlertLevel.WARNING)
    category_id: Mapped[int] = mapped_column(ForeignKey("alert_categories.id"))
    consecutive_breaches_required: Mapped[int] = mapped_column(Integer, default=3, server_default="3")
    custom_message_template: Mapped[str | None] = mapped_column(Text, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    # Runtime evaluation state, mutated in place every alert-engine cycle.
    consecutive_breach_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    consecutive_healthy_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    last_evaluated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    server: Mapped["Server | None"] = relationship(foreign_keys=[server_id])
    port_check: Mapped["PortCheck | None"] = relationship(foreign_keys=[port_check_id])
    http_monitor: Mapped["HttpMonitor | None"] = relationship(foreign_keys=[http_monitor_id])
    category: Mapped["AlertCategory"] = relationship(back_populates="alert_rules")
    events: Mapped[list["AlertEvent"]] = relationship(back_populates="alert_rule", cascade="all, delete-orphan")
