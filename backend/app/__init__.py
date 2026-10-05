"""Compatibility layer for the legacy Flask app and the modern FastAPI package."""

from __future__ import annotations

import sys
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
_BACKEND = Path(__file__).resolve().parents[1]
for _candidate in (_ROOT, _BACKEND):
    _path = str(_candidate)
    if _path not in sys.path:
        sys.path.insert(0, _path)

_LEGACY_APP_PATH = _ROOT / "app.py"

try:
    if _LEGACY_APP_PATH.exists():
        _legacy_spec = spec_from_file_location("glassballot_legacy_app", _LEGACY_APP_PATH)
        if _legacy_spec is not None and _legacy_spec.loader is not None:
            _legacy_module = module_from_spec(_legacy_spec)
            _legacy_spec.loader.exec_module(_legacy_module)
            create_app = getattr(_legacy_module, "create_app", None)
        else:
            def create_app(*args, **kwargs):
                raise RuntimeError("Legacy app factory not available because spec loader failed.")
    else:
        def create_app(*args, **kwargs):
            raise RuntimeError("Legacy app factory not available because app.py was not found.")
except Exception:
    def create_app(*args, **kwargs):
        raise RuntimeError("Legacy Flask app is not available in this environment (Flask not installed).")

__all__ = ["create_app"]
