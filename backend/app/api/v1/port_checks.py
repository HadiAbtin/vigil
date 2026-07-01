from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db, require_password_already_changed
from app.models import PortCheck
from app.schemas.port_check import PortCheckWithServerOut

router = APIRouter(prefix="/port-checks", tags=["port-checks"], dependencies=[Depends(require_password_already_changed)])


@router.get("", response_model=list[PortCheckWithServerOut])
def list_port_checks(db: Session = Depends(get_db)) -> list[PortCheckWithServerOut]:
    checks = db.query(PortCheck).options(joinedload(PortCheck.server)).order_by(PortCheck.id).all()
    return [
        PortCheckWithServerOut(
            id=c.id,
            server_id=c.server_id,
            port=c.port,
            expected_state=c.expected_state,
            interval_bucket=c.interval_bucket,
            enabled=c.enabled,
            created_at=c.created_at,
            server_name=c.server.name,
        )
        for c in checks
    ]
