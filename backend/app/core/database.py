import socket
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

settings = get_settings()

db_url = settings.database_url

# Auto-detect if running outside Docker without postgres host resolution
if "@postgres:" in db_url or "@postgres/" in db_url:
    try:
        socket.gethostbyname("postgres")
    except socket.gaierror:
        db_url = "sqlite+aiosqlite:///./glassballot.db"

engine = create_async_engine(
    db_url,
    pool_pre_ping=True,
    future=True,
)

SessionLocal = async_sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def get_db_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
