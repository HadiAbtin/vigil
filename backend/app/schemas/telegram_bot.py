from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.alert_category import AlertCategoryOut
from app.schemas.base import ORMModel


class TelegramBotCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    bot_token: str = Field(min_length=1)
    chat_id: str = Field(min_length=1, max_length=64)
    category_ids: list[int] = []
    enabled: bool = True


class TelegramBotUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    bot_token: str | None = Field(default=None, min_length=1, description="Set to rotate the token")
    chat_id: str | None = Field(default=None, min_length=1, max_length=64)
    category_ids: list[int] | None = None
    enabled: bool | None = None


class TelegramBotOut(ORMModel):
    id: int
    name: str
    chat_id: str
    enabled: bool
    categories: list[AlertCategoryOut]
    created_at: datetime
