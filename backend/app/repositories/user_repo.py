from __future__ import annotations

from sqlalchemy import select

from app.models.entities import User
from app.repositories.base import BaseRepo


class UserRepo(BaseRepo[User]):
    model = User

    async def get_by_username_or_email(self, identifier: str) -> User | None:
        stmt = select(User).where((User.username == identifier) | (User.email == identifier))
        result = await self.session.execute(stmt.limit(1))
        return result.scalars().first()
