from __future__ import annotations

from uuid import UUID

from sqlalchemy import select

from app.models.entities import Role, UserRole
from app.repositories.base import BaseRepo


class UserRoleRepo(BaseRepo[UserRole]):
    model = UserRole

    async def list_roles_for_user(self, user_id: UUID) -> list[str]:
        stmt = (
            select(Role.name)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user_id)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
