from __future__ import annotations

from app.models.entities import Role
from app.repositories.base import BaseRepo


class RoleRepo(BaseRepo[Role]):
    model = Role
