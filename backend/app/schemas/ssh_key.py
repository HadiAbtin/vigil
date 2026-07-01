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
    """private_key is populated only when Vigil generated the keypair itself,
    and only in this one response — it is never retrievable again afterwards.
    When the admin instead pasted an existing key, was_generated is False and
    private_key stays null: Vigil never echoes back key material it was
    handed, since the admin already has their own copy of it."""

    was_generated: bool
    private_key: str | None = None
