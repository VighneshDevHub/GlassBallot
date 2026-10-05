from __future__ import annotations

from uuid import UUID

from sqlalchemy import select

from app.models.entities import Role, User, UserRole
from app.repositories.base import BaseRepo


class AdminRepo(BaseRepo[User]):
    model = User

    async def get_user(self, user_id: UUID) -> User | None:
        return await self.get(user_id)

    async def get_user_by_username(self, identifier: str) -> User | None:
        stmt = select(User).where((User.username == identifier) | (User.email == identifier))
        result = await self.session.execute(stmt.limit(1))
        return result.scalars().first()

    async def get_user_roles(self, user_id: UUID) -> list[Role]:
        stmt = (
            select(Role)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == user_id)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
