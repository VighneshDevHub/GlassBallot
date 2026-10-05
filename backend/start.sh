#!/bin/bash
set -euo pipefail

# Wait for PostgreSQL
MAX_WAIT=60
WAIT=0
while [ $WAIT -lt $MAX_WAIT ]; do
  if python - <<PY
import asyncio, sys
async def c():
  import os
  from sqlalchemy import text
  url = os.environ.get("DATABASE_URL","").replace("+asyncpg","+psycopg")
  if not url:
    sys.exit(1)
  from sqlalchemy import create_engine
  eng = create_engine(url, connect_args={"connect_timeout": 3})
  try:
    with eng.connect() as conn:
      conn.execute(text("SELECT 1"))
    sys.exit(0)
  except Exception:
    sys.exit(1)
asyncio.run(c())
PY
  then
    echo "PostgreSQL reachable."
    break
  fi
  WAIT=$((WAIT+3))
  echo "Waiting for PostgreSQL... $WAIT/$MAX_WAIT"
  sleep 3
done

# Wait for Redis briefly (best-effort)
echo "Checking Redis..."
python - <<PY || true
import os
try:
    from redis import Redis
    u = os.environ.get("REDIS_URL","redis://redis:6379/0")
    r = Redis.from_url(u, socket_connect_timeout=3)
    r.ping()
    print("Redis reachable.")
except Exception as e:
    print(f"Redis not ready (continuing): {e}")
PY

# Run Alembic migrations synchronously
echo "Running alembic migrations..."
cd /app/backend
# Use a sync DB URL for alembic
export DB_SYNC_URL="${DATABASE_URL/+asyncpg/+psycopg}"
alembic -c alembic.ini upgrade head || {
  echo "Migration failed. Trying with direct DB url override..."
  # Inline fallback: override env value
  python - <<PY
import os, subprocess, sys
url = os.environ.get("DATABASE_URL","")
sync = url.replace("+asyncpg","+psycopg")
env = os.environ.copy()
# Write to a temp alembic override by running with env var set directly
os.chdir("/app/backend")
res = subprocess.run(
    ["alembic", "-c", "alembic.ini", "upgrade", "head"],
    env={**env, "SQLALCHEMY_URL": sync},
)
sys.exit(res.returncode)
PY
  echo "Alembic exited."
}

# Start Uvicorn
echo "Starting uvicorn..."
cd /app
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 1 \
    --log-level info \
    --proxy-headers \
    --forwarded-allow-ips "*"
