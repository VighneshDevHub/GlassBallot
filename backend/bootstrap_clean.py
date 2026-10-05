import asyncio
from app.core.database import SessionLocal, engine
from app.models.entities import Base
from app.services.election_setup_service import ElectionSetupService

async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    async with SessionLocal() as session:
        setup_svc = ElectionSetupService(session)
        await setup_svc._ensure_super_admin()
        await session.commit()
        elec = await setup_svc.bootstrap_default_demo()
        print(f"CLEAN BOOTSTRAP COMPLETE: election={elec.id if elec else 'None'}")

if __name__ == "__main__":
    asyncio.run(main())
