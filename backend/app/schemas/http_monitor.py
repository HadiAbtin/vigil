import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.core.constants import HttpMethod, IntervalBucket
from app.schemas.base import ORMModel

_STATUS_SPEC_RE = re.compile(r"^\s*\d{3}(-\d{3})?(\s*,\s*\d{3}(-\d{3})?)*\s*$")


def _validate_status_spec(value: str) -> str:
    if not _STATUS_SPEC_RE.match(value):
        raise ValueError('expected_status_codes must look like "200", "200-299", or "200,201,204"')
    return value


class HttpMonitorCreate(BaseModel):
    server_id: int | None = Field(default=None, description="Omit for a standalone HTTP monitor")
    name: str = Field(min_length=1, max_length=128)
    url: str = Field(min_length=1, max_length=2048)
    method: HttpMethod = HttpMethod.GET
    expected_status_codes: str = "200-299"
    interval_bucket: IntervalBucket = IntervalBucket.THIRTY_SECONDS
    enabled: bool = True

    @field_validator("url")
    @classmethod
    def url_must_be_http(cls, v: str) -> str:
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("url must start with http:// or https://")
        return v

    @field_validator("expected_status_codes")
    @classmethod
    def status_spec(cls, v: str) -> str:
        return _validate_status_spec(v)


class HttpMonitorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    url: str | None = None
    method: HttpMethod | None = None
    expected_status_codes: str | None = None
    interval_bucket: IntervalBucket | None = None
    enabled: bool | None = None

    @field_validator("url")
    @classmethod
    def url_must_be_http(cls, v: str | None) -> str | None:
        if v is not None and not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("url must start with http:// or https://")
        return v

    @field_validator("expected_status_codes")
    @classmethod
    def status_spec(cls, v: str | None) -> str | None:
        return _validate_status_spec(v) if v is not None else v


class HttpMonitorOut(ORMModel):
    id: int
    server_id: int | None
    name: str
    url: str
    method: HttpMethod
    expected_status_codes: str
    interval_bucket: IntervalBucket
    enabled: bool
    created_at: datetime
