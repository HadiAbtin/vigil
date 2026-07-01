from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_password_already_changed
from app.core.constants import AlertRuleType
from app.models import HttpMonitor, PortCheck, Server
from app.schemas.metrics import MetricRangeResponse
from app.services import prometheus_query

router = APIRouter(prefix="/metrics", tags=["metrics"], dependencies=[Depends(require_password_already_changed)])

_MAX_POINTS = 180
_MIN_STEP_SECONDS = 5
_MAX_RANGE_SECONDS = 31 * 24 * 3600  # generous cap, well past Prometheus's default 15d retention


@router.get("", response_model=MetricRangeResponse)
def get_metric_range(
    rule_type: AlertRuleType,
    target_id: int,
    start: int = Query(..., description="Unix timestamp, seconds"),
    end: int = Query(..., description="Unix timestamp, seconds"),
    field: str | None = Query(default=None, description="http_monitor only: 'latency' (default) or 'status'"),
    db: Session = Depends(get_db),
) -> MetricRangeResponse:
    if end <= start:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="end must be after start")
    if end - start > _MAX_RANGE_SECONDS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="range too large")

    step = max(_MIN_STEP_SECONDS, (end - start) // _MAX_POINTS)

    try:
        if rule_type == AlertRuleType.SERVER_PING:
            if db.get(Server, target_id) is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
            unit, series = prometheus_query.get_ping_latency_range(target_id, start, end, step)

        elif rule_type == AlertRuleType.TCP_PORT:
            if db.get(PortCheck, target_id) is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Port check not found")
            unit, series = prometheus_query.get_tcp_latency_range(target_id, start, end, step)

        elif rule_type == AlertRuleType.HTTP_MONITOR:
            if db.get(HttpMonitor, target_id) is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="HTTP monitor not found")
            if field == "status":
                unit, series = prometheus_query.get_http_status_range(target_id, start, end, step)
            else:
                unit, series = prometheus_query.get_http_latency_range(target_id, start, end, step)

        elif rule_type in (AlertRuleType.RESOURCE_CPU, AlertRuleType.RESOURCE_RAM, AlertRuleType.RESOURCE_DISK):
            if db.get(Server, target_id) is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
            if rule_type == AlertRuleType.RESOURCE_CPU:
                unit, series = prometheus_query.get_cpu_range(target_id, start, end, step)
            elif rule_type == AlertRuleType.RESOURCE_RAM:
                unit, series = prometheus_query.get_ram_range(target_id, start, end, step)
            else:
                unit, series = prometheus_query.get_disk_range(target_id, start, end, step)
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported rule_type")
    except prometheus_query.PrometheusQueryError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    return MetricRangeResponse(unit=unit, series=series)
