from __future__ import annotations

from fastapi import APIRouter

from app.api.routes.admin import router as admin_router
from app.api.routes.auth import admin_auth_router, router as auth_router
from app.api.routes.ballots import router as ballots_router
from app.api.routes.elections import router as elections_router
from app.api.routes.health import router as health_router
from app.api.routes.integrity import router as integrity_router
from app.api.routes.verification import router as verification_router
from app.api.routes.voting import router as voting_router
from app.api.routes.voter import router as voter_router
from app.api.routes.witnesses import router as witnesses_router

api_router = APIRouter()

api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(admin_auth_router)
api_router.include_router(voter_router)
api_router.include_router(elections_router)
api_router.include_router(voting_router)
api_router.include_router(ballots_router)
api_router.include_router(verification_router)
api_router.include_router(witnesses_router)
api_router.include_router(integrity_router)
api_router.include_router(admin_router)
