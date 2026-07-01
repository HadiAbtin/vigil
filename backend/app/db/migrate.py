"""Run Alembic migrations guarded by a Postgres advisory lock.

Every backend-image container (API, celery-worker, celery-beat) runs this on
startup so a fresh `docker compose up` always ends with an up-to-date schema,
regardless of which container starts first. Without the lock, several
containers racing to create Alembic's own version table on a brand-new
database can hit a duplicate-key error — the advisory lock serializes them
instead. It's held for the life of this connection, so Postgres releases it
automatically even if this process dies mid-migration.
"""

import subprocess
import sys

from sqlalchemy import text

from app.db.session import engine

_MIGRATION_LOCK_ID = 727_384_910


def main() -> None:
    with engine.connect() as conn:
        conn.execute(text("SELECT pg_advisory_lock(:id)"), {"id": _MIGRATION_LOCK_ID})
        try:
            subprocess.run(["alembic", "upgrade", "head"], check=True)
        finally:
            conn.execute(text("SELECT pg_advisory_unlock(:id)"), {"id": _MIGRATION_LOCK_ID})


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as exc:
        sys.exit(exc.returncode)
