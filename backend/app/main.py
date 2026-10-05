from __future__ import annotations

from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.exceptions import GlassBallotError
from app.core.logging import configure_logging, get_logger
from app.services.election_setup_service import ElectionSetupService

settings = get_settings()
configure_logging()
logger = get_logger("glassballot.api")


async def _sync_missing_columns(conn) -> None:  # noqa: ANN001
    """
    For SQLite dev databases: add any columns that exist in ORM models but are
    missing from the live table (schema drift when new columns added to models).
    This is a no-op on PostgreSQL where Alembic manages migrations properly.
    """
    from sqlalchemy import inspect as sa_inspect, text

    dialect = conn.dialect.name
    if dialect != "sqlite":
        return

    def _do_sync(sync_conn):  # noqa: ANN001
        inspector = sa_inspect(sync_conn)
        from app.models.entities import Base  # noqa: PLC0415

        for table_name, table in Base.metadata.tables.items():
            if not inspector.has_table(table_name):
                continue
            existing_cols = {col["name"] for col in inspector.get_columns(table_name)}
            for col in table.columns:
                if col.name not in existing_cols:
                    col_type = col.type.compile(dialect=sync_conn.dialect)
                    default_sql = ""
                    if col.server_default is not None:
                        default_sql = f" DEFAULT {col.server_default.arg}"
                    elif not col.nullable:
                        type_str = str(col.type).upper()
                        if "BOOL" in type_str:
                            default_sql = " DEFAULT 0"
                        elif "INT" in type_str or "NUM" in type_str or "REAL" in type_str:
                            default_sql = " DEFAULT 0"
                        else:
                            default_sql = " DEFAULT ''"
                    ddl = f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type}{default_sql}"
                    sync_conn.execute(text(ddl))
                    logger.info("Schema sync: added column %s.%s", table_name, col.name)

    await conn.run_sync(_do_sync)


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ANN001, ANN201
    try:
        from app.core.database import engine
        from app.models.entities import Base
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            # Sync any columns added to models after the table was first created
            await _sync_missing_columns(conn)

        async with SessionLocal() as session:
            setup_svc = ElectionSetupService(session)
            await setup_svc._ensure_super_admin()
            await session.commit()
            created = await setup_svc.bootstrap_default_demo()
            if created:
                logger.info(
                    "Bootstrapped default demo election: %s (%s)",
                    created.title,
                    created.public_id,
                )
            else:
                logger.info("Election data already present; skipping bootstrap.")
    except Exception as exc:  # noqa: BLE001
        logger.error("Bootstrap failed (continuing).", exc_info=exc)
    yield


SECURITY_HEADERS: dict[str, str] = {
    "Content-Security-Policy": (
        "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; "
        "frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    ),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
}

app = FastAPI(
    title="GlassBallot API",
    version="0.1.0",
    lifespan=lifespan,
    summary=(
        "Production-quality prototype for low-stakes elections; "
        "independent security audit required before real-world deployment."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_request_id(request: Request, call_next):  # noqa: ANN001, ANN201 - FastAPI style
    request_id = request.headers.get("X-Request-ID") or str(uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    for k, v in SECURITY_HEADERS.items():
        if k not in response.headers:
            response.headers[k] = v
    return response


@app.exception_handler(GlassBallotError)
async def glassballot_exception_handler(request: Request, exc: GlassBallotError) -> JSONResponse:
    rid = getattr(request.state, "request_id", "")
    level = "warning" if exc.status_code < 500 else "error"
    getattr(logger, level)(
        "GlassBallotError",
        extra={"code": exc.code, "status": exc.status_code, "path": request.url.path, "request_id": rid},
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.message, "code": exc.code, "request_id": rid},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    rid = getattr(request.state, "request_id", "")
    logger.error(
        "UnhandledException",
        exc_info=exc,
        extra={"path": request.url.path, "request_id": rid},
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error.",
            "code": "UnhandledException",
            "request_id": rid,
        },
    )


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "name": "GlassBallot API",
        "status": "starting",
        "disclaimer": (
            "Production-quality prototype for low-stakes elections; "
            "independent security audit required before real-world deployment."
        ),
        "api_prefix": settings.api_prefix,
    }


app.include_router(api_router, prefix=settings.api_prefix)
