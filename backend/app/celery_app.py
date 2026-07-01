from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "vigil",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.evaluate_alerts",
        "app.tasks.provision_node_exporter",
        "app.tasks.check_node_exporter_active",
        "app.tasks.dispatch_telegram_alert",
    ],
)

celery_app.conf.timezone = "UTC"
celery_app.conf.beat_schedule = {
    "evaluate-alerts": {
        "task": "app.tasks.evaluate_alerts.evaluate_alerts",
        "schedule": float(settings.ALERT_EVAL_INTERVAL_SECONDS),
    },
    "check-node-exporter-active": {
        "task": "app.tasks.check_node_exporter_active.check_node_exporter_active",
        "schedule": 30.0,
    },
}
