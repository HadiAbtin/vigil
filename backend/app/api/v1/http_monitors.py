from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_password_already_changed
from app.models import HttpMonitor, Server
from app.schemas.http_monitor import HttpMonitorCreate, HttpMonitorOut, HttpMonitorUpdate
from app.services import prometheus_sd

router = APIRouter(
    prefix="/http-monitors", tags=["http-monitors"], dependencies=[Depends(require_password_already_changed)]
)


@router.get("", response_model=list[HttpMonitorOut])
def list_http_monitors(
    standalone_only: bool = Query(default=False, description="Only return monitors with no server_id"),
    db: Session = Depends(get_db),
) -> list[HttpMonitor]:
    query = db.query(HttpMonitor)
    if standalone_only:
        query = query.filter(HttpMonitor.server_id.is_(None))
    return query.order_by(HttpMonitor.name).all()


@router.post("", response_model=HttpMonitorOut, status_code=status.HTTP_201_CREATED)
def create_http_monitor(payload: HttpMonitorCreate, db: Session = Depends(get_db)) -> HttpMonitor:
    if payload.server_id is not None and db.get(Server, payload.server_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Server not found")
    monitor = HttpMonitor(**payload.model_dump())
    db.add(monitor)
    db.commit()
    db.refresh(monitor)
    prometheus_sd.sync_all(db)
    return monitor


@router.patch("/{monitor_id}", response_model=HttpMonitorOut)
def update_http_monitor(monitor_id: int, payload: HttpMonitorUpdate, db: Session = Depends(get_db)) -> HttpMonitor:
    monitor = db.get(HttpMonitor, monitor_id)
    if monitor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="HTTP monitor not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(monitor, field, value)
    db.commit()
    db.refresh(monitor)
    prometheus_sd.sync_all(db)
    return monitor


@router.delete("/{monitor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_http_monitor(monitor_id: int, db: Session = Depends(get_db)) -> None:
    monitor = db.get(HttpMonitor, monitor_id)
    if monitor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="HTTP monitor not found")
    db.delete(monitor)
    db.commit()
    prometheus_sd.sync_all(db)
