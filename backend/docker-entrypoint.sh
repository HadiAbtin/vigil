#!/usr/bin/env bash
# Applied by every backend-image container (API, celery-worker, celery-beat)
# before starting its actual process, so a fresh `docker compose up` always
# has an up-to-date schema regardless of which container wins the race to
# start first. See app/db/migrate.py for why this is advisory-lock-guarded
# rather than a bare `alembic upgrade head`.
set -e
python -m app.db.migrate
exec "$@"
