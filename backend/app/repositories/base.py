from __future__ import annotations

from typing import Any, Generic, Type, TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepo(Generic[ModelT]):
    model: Type[ModelT]

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, id_val: Any) -> ModelT | None:
        return await self.session.get(self.model, id_val)

    async def create(self, **kwargs: Any) -> ModelT:
        obj = self.model(**kwargs)
        self.session.add(obj)
        await self.session.flush()
        return obj

    async def update(self, obj: ModelT, **kwargs: Any) -> ModelT:
        for k, v in kwargs.items():
            setattr(obj, k, v)
        await self.session.flush()
        return obj

    async def delete(self, obj: ModelT) -> None:
        await self.session.delete(obj)
        await self.session.flush()

    async def all(self) -> list[ModelT]:
        result = await self.session.execute(select(self.model))
        return list(result.scalars().all())

    async def first_where(self, **filters: Any) -> ModelT | None:
        stmt = select(self.model)
        for k, v in filters.items():
            stmt = stmt.where(getattr(self.model, k) == v)
        result = await self.session.execute(stmt.limit(1))
        return result.scalars().first()

    async def any_exists(self) -> bool:
        stmt = select(self.model).limit(1)
        result = await self.session.execute(stmt)
        return result.scalars().first() is not None
