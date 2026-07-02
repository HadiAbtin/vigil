from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.base import ORMModel


class LoginRequest(BaseModel):
    username: str
    password: str
    turnstile_token: str | None = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    must_change_password: bool


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class UserOut(ORMModel):
    id: int
    username: str
    must_change_password: bool
    created_at: datetime
