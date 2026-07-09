from datetime import date as date_

from sqlalchemy import BigInteger, Date, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class LlmUsageDaily(Base):
    """One row per (server, date, provider). Populated by periodically polling
    the admin-configured LlmCostExporter and upserting — this is Vigil's own
    accumulated history, kept independent of the exporter's own retention
    (which caps at 180 days) so a year of data can build up over time even if
    the exporter itself can't return that much in one query. Rows survive the
    exporter config being deleted/reconfigured; only deleting the server itself
    cascades here."""

    __tablename__ = "llm_usage_daily"
    __table_args__ = (UniqueConstraint("server_id", "date", "provider", name="uq_llm_usage_daily_server_date_provider"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    server_id: Mapped[int] = mapped_column(ForeignKey("servers.id", ondelete="CASCADE"), index=True)
    date: Mapped[date_] = mapped_column(Date, index=True)
    provider: Mapped[str] = mapped_column(String(32))
    input_tokens: Mapped[int] = mapped_column(BigInteger, default=0)
    output_tokens: Mapped[int] = mapped_column(BigInteger, default=0)
    cache_read_tokens: Mapped[int] = mapped_column(BigInteger, default=0)
    cache_write_tokens: Mapped[int] = mapped_column(BigInteger, default=0)
    requests: Mapped[int] = mapped_column(Integer, default=0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0)
