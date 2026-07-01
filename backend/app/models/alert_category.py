from typing import TYPE_CHECKING

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.alert_rule import AlertRule
    from app.models.telegram_bot import TelegramBot


class AlertCategory(Base, TimestampMixin):
    __tablename__ = "alert_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(64), unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    alert_rules: Mapped[list["AlertRule"]] = relationship(back_populates="category")
    telegram_bots: Mapped[list["TelegramBot"]] = relationship(
        secondary="telegram_bot_categories", back_populates="categories"
    )
