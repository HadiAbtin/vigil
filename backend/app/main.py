from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import (
    alert_categories,
    alert_events,
    alert_rules,
    auth,
    dashboard,
    http_monitors,
    metrics,
    port_checks,
    servers,
    ssh_keys,
    telegram_bots,
)
from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import User


def _seed_admin() -> None:
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            db.add(
                User(
                    username=settings.SEED_ADMIN_USERNAME,
                    hashed_password=hash_password(settings.SEED_ADMIN_PASSWORD),
                    must_change_password=True,
                )
            )
            db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _seed_admin()
    yield


app = FastAPI(title="Vigil", version="0.1.0", lifespan=lifespan)

if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

API_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(ssh_keys.router, prefix=API_PREFIX)
app.include_router(servers.router, prefix=API_PREFIX)
app.include_router(http_monitors.router, prefix=API_PREFIX)
app.include_router(port_checks.router, prefix=API_PREFIX)
app.include_router(alert_categories.router, prefix=API_PREFIX)
app.include_router(alert_rules.router, prefix=API_PREFIX)
app.include_router(telegram_bots.router, prefix=API_PREFIX)
app.include_router(alert_events.router, prefix=API_PREFIX)
app.include_router(dashboard.router, prefix=API_PREFIX)
app.include_router(metrics.router, prefix=API_PREFIX)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
