from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.base import ORMModel


class SSHKeyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    private_key: str | None = Field(
        default=None,
        description="Paste an existing private key (PEM/OpenSSH). Omit to have Vigil generate a fresh one.",
    )


class SSHKeyOut(ORMModel):
    id: int
    name: str
    public_key: str
    fingerprint: str
    created_at: datetime


class SSHKeyCreated(SSHKeyOut):
    """Returned only once, right after generation, so the admin can copy the
    private key if they want an offline backup — it is never retrievable again."""

    private_key: str | None = None
