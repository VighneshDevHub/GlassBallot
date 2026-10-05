from __future__ import annotations

import json
import logging
import sys
import time
from typing import Any

from app.core.config import get_settings

SENSITIVE_FIELD_KEYWORDS = (
    "password", "otp", "secret", "share", "plaintext", "cookie",
    "private_key", "eph_d", "token", "session", "voter_id", "choice",
)


def _redact(obj: Any, depth: int = 0) -> Any:
    if depth > 8:
        return "<redacted:recursion>"
    if isinstance(obj, dict):
        return {
            k: "<redacted>" if any(s in str(k).lower() for s in SENSITIVE_FIELD_KEYWORDS) else _redact(v, depth + 1)
            for k, v in obj.items()
        }
    if isinstance(obj, list):
        return [_redact(i, depth + 1) for i in obj]
    if isinstance(obj, str) and len(obj) > 256:
        return f"<str(len={len(obj)})>"
    return obj


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:  # noqa: D401 - impure side effect OK
        settings = get_settings()
        payload: dict[str, Any] = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.created)),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "app": settings.app_name,
            "env": settings.app_env,
        }
        extras = {k: v for k, v in record.__dict__.items() if k not in (
            "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
            "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
            "created", "msecs", "relativeCreated", "thread", "threadName",
            "processName", "process", "getMessage", "asctime", "taskName",
        )}
        if extras:
            payload["extra"] = _redact(extras)
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info).splitlines()[-5:]
        return json.dumps(payload, separators=(",", ":"), default=str)


def configure_logging() -> None:
    settings = get_settings()
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    root = logging.getLogger()
    if root.handlers:
        return
    root.setLevel(level)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root.addHandler(handler)
    for noisy in ("uvicorn.access", "httpx", "httpcore"):
        logging.getLogger(noisy).setLevel(max(level, logging.WARNING))


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
