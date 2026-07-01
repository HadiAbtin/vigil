from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.base import ORMModel


class AlertCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    description: str | None = None


class AlertCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=64)
    description: str | None = None


class AlertCategoryOut(ORMModel):
    id: int
    name: str
    description: str | None
    created_at: datetime
