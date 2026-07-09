"""Polls an admin-configured "verbo"-style LLM usage exporter's daily-usage
endpoint and upserts the result into our own llm_usage_daily table.

The exporter hard-caps `days` at 180 (verified against a live instance — a
request for more is rejected with HTTP 422), so a year of retained history can
only come from accumulating our own rows over time via repeated syncs, never
from a single query.
"""

from datetime import date as date_cls
from datetime import datetime, time, timedelta, timezone

import httpx
from sqlalchemy.orm import Session

from app.core.constants import LLM_PROVIDERS, LLM_USAGE_EXPORTER_MAX_DAYS
from app.core.encryption import decrypt_secret
from app.models import LlmCostExporter, LlmUsageDaily
from app.schemas.llm_cost import LlmUsageResponse
from app.schemas.metrics import MetricSeries

_USAGE_FIELDS = ("input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens", "requests", "cost_usd")

# How many trailing buckets each granularity shows, and the label for "the
# current (still in-progress) bucket" whose total gets surfaced prominently.
_GRANULARITY_BUCKET_COUNT = {"day": 30, "week": 12, "month": 12, "year": 3}
_PERIOD_LABEL = {"day": "Today", "week": "This week", "month": "This month", "year": "This year"}


class LlmCostFetchError(Exception):
    pass


def fetch_daily_usage(base_url: str, token: str, days: int) -> dict:
    days = min(days, LLM_USAGE_EXPORTER_MAX_DAYS)
    url = f"{base_url.rstrip('/')}/api/v1/usage/daily"
    try:
        resp = httpx.get(url, params={"days": days, "token": token}, timeout=15)
    except httpx.HTTPError as exc:
        raise LlmCostFetchError(f"Could not reach exporter: {exc}") from exc
    if resp.status_code != 200:
        raise LlmCostFetchError(f"Exporter returned {resp.status_code}: {resp.text[:200]}")
    return resp.json()


def sync_exporter(db: Session, exporter: LlmCostExporter, days: int) -> None:
    token = decrypt_secret(exporter.encrypted_token)
    data = fetch_daily_usage(exporter.base_url, token, days)

    for day in data.get("days", []):
        day_date = date_cls.fromisoformat(day["date"])
        for provider, stats in (day.get("providers") or {}).items():
            row = (
                db.query(LlmUsageDaily)
                .filter(
                    LlmUsageDaily.server_id == exporter.server_id,
                    LlmUsageDaily.date == day_date,
                    LlmUsageDaily.provider == provider,
                )
                .first()
            )
            if row is None:
                row = LlmUsageDaily(server_id=exporter.server_id, date=day_date, provider=provider)
                db.add(row)
            for field in _USAGE_FIELDS:
                setattr(row, field, stats.get(field, 0))

    exporter.last_synced_at = datetime.now(timezone.utc)
    exporter.last_error = None
    db.commit()


def _bucket_start(d: date_cls, granularity: str) -> date_cls:
    if granularity == "day":
        return d
    if granularity == "week":
        return d - timedelta(days=d.weekday())  # Monday of that week
    if granularity == "month":
        return d.replace(day=1)
    return d.replace(month=1, day=1)  # year


def _previous_bucket_start(bucket_start: date_cls, granularity: str) -> date_cls:
    if granularity == "day":
        return bucket_start - timedelta(days=1)
    if granularity == "week":
        return bucket_start - timedelta(days=7)
    if granularity == "month":
        return (bucket_start - timedelta(days=1)).replace(day=1)
    return bucket_start.replace(year=bucket_start.year - 1)  # year


def build_usage_response(db: Session, server_id: int, granularity: str) -> LlmUsageResponse:
    """Aggregates our own accumulated llm_usage_daily rows into day/week/month/
    year buckets — never calls the external exporter directly, so viewing this
    chart is always fast and works even if the exporter is temporarily down."""
    today = datetime.now(timezone.utc).date()
    bucket_count = _GRANULARITY_BUCKET_COUNT[granularity]
    current_bucket = _bucket_start(today, granularity)

    bucket_starts = [current_bucket]
    for _ in range(bucket_count - 1):
        bucket_starts.append(_previous_bucket_start(bucket_starts[-1], granularity))
    bucket_starts.sort()
    earliest = bucket_starts[0]

    rows = (
        db.query(LlmUsageDaily)
        .filter(LlmUsageDaily.server_id == server_id, LlmUsageDaily.date >= earliest)
        .all()
    )

    sums = {bs: {p: {"tokens": 0.0, "cost": 0.0} for p in LLM_PROVIDERS} for bs in bucket_starts}
    for row in rows:
        bs = _bucket_start(row.date, granularity)
        bucket = sums.get(bs)
        if bucket is None or row.provider not in bucket:
            continue  # unknown/legacy provider key — ignore rather than crash the chart
        bucket[row.provider]["tokens"] += row.input_tokens + row.output_tokens
        bucket[row.provider]["cost"] += row.cost_usd

    token_series: list[MetricSeries] = []
    cost_series: list[MetricSeries] = []
    for provider in LLM_PROVIDERS:
        token_points, cost_points = [], []
        for bs in bucket_starts:
            ts = datetime.combine(bs, time.min, tzinfo=timezone.utc).timestamp()
            token_points.append([ts, sums[bs][provider]["tokens"]])
            cost_points.append([ts, sums[bs][provider]["cost"]])
        token_series.append(MetricSeries(name=provider, points=token_points))
        cost_series.append(MetricSeries(name=provider, points=cost_points))

    current = sums[current_bucket]
    return LlmUsageResponse(
        granularity=granularity,
        token_series=token_series,
        cost_series=cost_series,
        period_label=_PERIOD_LABEL[granularity],
        period_total_tokens=sum(v["tokens"] for v in current.values()),
        period_total_cost=sum(v["cost"] for v in current.values()),
        period_cost_by_provider={p: current[p]["cost"] for p in LLM_PROVIDERS},
    )
