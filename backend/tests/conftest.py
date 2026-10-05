from __future__ import annotations

import os
import sys
import pytest
import asyncio

# Ensure root and backend are on PYTHONPATH
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKEND = os.path.join(ROOT, "backend")
for path in (ROOT, BACKEND):
    if path not in sys.path:
        sys.path.insert(0, path)

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_glassballot.db"
os.environ["DEMO_MODE"] = "true"

from app.core.database import engine
from app.models.base import Base
import app.models.entities  # Ensure all models are loaded in Base.metadata


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    async def _init_models():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(_init_models())
