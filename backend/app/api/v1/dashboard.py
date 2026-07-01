from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_password_already_changed
from app.core.constants import AlertEventStatus, InstallStatus
from app.models import AlertEvent, HttpMonitor, NodeExporterConfig, Server, TelegramBot
from app.schemas.dashboard import DashboardSummary

router = APIRouter(prefix="/dashboard", tags=["dashboard"], dependencies=[Depends(require_password_already_changed)])


@router.get("/summary", response_model=DashboardSummary)
def get_summary(db: Session = Depends(get_db)) -> DashboardSummary:
    server_count = db.query(func.count(Server.id)).scalar() or 0
    http_monitor_count = db.query(func.count(HttpMonitor.id)).scalar() or 0
    node_active = (
        db.query(func.count(NodeExporterConfig.id))
        .filter(NodeExporterConfig.install_status == InstallStatus.INSTALLED, NodeExporterConfig.active.is_(True))
        .scalar()
        or 0
    )
    node_pending = (
        db.query(func.count(NodeExporterConfig.id))
        .filter(NodeExporterConfig.install_status.in_([InstallStatus.PENDING, InstallStatus.INSTALLING]))
        .scalar()
        or 0
    )
    telegram_bot_count = db.query(func.count(TelegramBot.id)).scalar() or 0

    firing = (
        db.query(AlertEvent.level, func.count(AlertEvent.id))
        .filter(AlertEvent.status == AlertEventStatus.FIRING)
        .group_by(AlertEvent.level)
        .all()
    )
    firing_by_level = {level: count for level, count in firing}
    firing_alert_count = sum(firing_by_level.values())

    return DashboardSummary(
        server_count=server_count,
        http_monitor_count=http_monitor_count,
        node_exporter_active_count=node_active,
        node_exporter_pending_count=node_pending,
        firing_alert_count=firing_alert_count,
        firing_by_level=firing_by_level,
        telegram_bot_count=telegram_bot_count,
    )
