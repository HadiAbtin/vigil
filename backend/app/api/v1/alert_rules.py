from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_password_already_changed
from app.models import AlertCategory, AlertRule, HttpMonitor, PortCheck, Server
from app.schemas.alert_rule import AlertRuleCreate, AlertRuleOut, AlertRuleUpdate

router = APIRouter(prefix="/alert-rules", tags=["alert-rules"], dependencies=[Depends(require_password_already_changed)])

_TARGET_MODEL = {
    "server_id": Server,
    "port_check_id": PortCheck,
    "http_monitor_id": HttpMonitor,
}


def _validate_references(db: Session, payload: AlertRuleCreate) -> None:
    if db.get(AlertCategory, payload.category_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category not found")
    for field, model in _TARGET_MODEL.items():
        value = getattr(payload, field)
        if value is not None and db.get(model, value) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field}={value} not found")


@router.get("", response_model=list[AlertRuleOut])
def list_alert_rules(db: Session = Depends(get_db)) -> list[AlertRule]:
    return db.query(AlertRule).order_by(AlertRule.id).all()


@router.post("", response_model=AlertRuleOut, status_code=status.HTTP_201_CREATED)
def create_alert_rule(payload: AlertRuleCreate, db: Session = Depends(get_db)) -> AlertRule:
    _validate_references(db, payload)
    rule = AlertRule(**payload.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.patch("/{rule_id}", response_model=AlertRuleOut)
def update_alert_rule(rule_id: int, payload: AlertRuleUpdate, db: Session = Depends(get_db)) -> AlertRule:
    rule = db.get(AlertRule, rule_id)
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert rule not found")
    updates = payload.model_dump(exclude_unset=True)
    if "category_id" in updates and db.get(AlertCategory, updates["category_id"]) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category not found")
    for field, value in updates.items():
        setattr(rule, field, value)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_alert_rule(rule_id: int, db: Session = Depends(get_db)) -> None:
    rule = db.get(AlertRule, rule_id)
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert rule not found")
    db.delete(rule)
    db.commit()
