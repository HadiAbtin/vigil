from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Column, ForeignKey, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.alert_category import AlertCategory

telegram_bot_categories = Table(
    "telegram_bot_categories",
    Base.metadata,
    Column("telegram_bot_id", ForeignKey("telegram_bots.id", ondelete="CASCADE"), primary_key=True),
    Column("alert_category_id", ForeignKey("alert_categories.id", ondelete="CASCADE"), primary_key=True),
)


class TelegramBot(Base, TimestampMixin):
    __tablename__ = "telegram_bots"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    encrypted_bot_token: Mapped[str] = mapped_column(Text)
    chat_id: Mapped[str] = mapped_column(String(64))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    categories: Mapped[list["AlertCategory"]] = relationship(
        secondary=telegram_bot_categories, back_populates="telegram_bots"
    )
