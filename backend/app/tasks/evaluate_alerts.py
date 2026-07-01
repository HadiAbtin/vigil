from app.celery_app import celery_app
from app.db.session import SessionLocal
from app.services import alert_engine


@celery_app.task(name="app.tasks.evaluate_alerts.evaluate_alerts")
def evaluate_alerts() -> None:
    db = SessionLocal()
    try:
        alert_engine.evaluate_all(db)
    finally:
        db.close()
