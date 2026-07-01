from datetime import datetime, timezone

from app.celery_app import celery_app
from app.core.constants import InstallStatus
from app.db.session import SessionLocal
from app.models import NodeExporterConfig
from app.services import prometheus_query


@celery_app.task(name="app.tasks.check_node_exporter_active.check_node_exporter_active")
def check_node_exporter_active() -> None:
    db = SessionLocal()
    try:
        configs = (
            db.query(NodeExporterConfig).filter(NodeExporterConfig.install_status == InstallStatus.INSTALLED).all()
        )
        for config in configs:
            try:
                up = prometheus_query.get_node_up(config.server_id)
            except Exception:
                up = None
            config.active = up == 1
            config.last_checked_at = datetime.now(timezone.utc)
        db.commit()
    finally:
        db.close()
