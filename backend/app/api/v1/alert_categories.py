from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_password_already_changed
from app.models import AlertCategory
from app.schemas.alert_category import AlertCategoryCreate, AlertCategoryOut, AlertCategoryUpdate

router = APIRouter(
    prefix="/alert-categories", tags=["alert-categories"], dependencies=[Depends(require_password_already_changed)]
)


@router.get("", response_model=list[AlertCategoryOut])
def list_categories(db: Session = Depends(get_db)) -> list[AlertCategory]:
    return db.query(AlertCategory).order_by(AlertCategory.name).all()


@router.post("", response_model=AlertCategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(payload: AlertCategoryCreate, db: Session = Depends(get_db)) -> AlertCategory:
    if db.query(AlertCategory).filter(AlertCategory.name == payload.name).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A category with this name already exists")
    category = AlertCategory(**payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.patch("/{category_id}", response_model=AlertCategoryOut)
def update_category(category_id: int, payload: AlertCategoryUpdate, db: Session = Depends(get_db)) -> AlertCategory:
    category = db.get(AlertCategory, category_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, db: Session = Depends(get_db)) -> None:
    category = db.get(AlertCategory, category_id)
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    if category.alert_rules:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="This category is still assigned to one or more alert rules"
        )
    db.delete(category)
    db.commit()
