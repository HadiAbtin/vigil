from app.celery_app import celery_app
from app.db.session import SessionLocal
from app.models import LlmCostExporter
from app.services import llm_cost

# Small window on every periodic sync — just enough to keep "today" (still
# accumulating) and any very recent corrections fresh. The big historical
# backfill only happens once, synchronously, when the exporter is first
# configured (see servers.py), using the exporter's full 180-day allowance.
_SYNC_WINDOW_DAYS = 14


@celery_app.task(name="app.tasks.sync_llm_usage.sync_llm_usage")
def sync_llm_usage() -> None:
    db = SessionLocal()
    try:
        exporters = db.query(LlmCostExporter).filter(LlmCostExporter.enabled.is_(True)).all()
        for exporter in exporters:
            try:
                llm_cost.sync_exporter(db, exporter, days=_SYNC_WINDOW_DAYS)
            except Exception as exc:
                db.rollback()
                exporter.last_error = str(exc)[:500]
                db.commit()
    finally:
        db.close()
