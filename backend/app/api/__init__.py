from fastapi import APIRouter

from ..config import settings
from . import admin, explore, health, memories, operator, photos, places, today, wallet

router = APIRouter()
router.include_router(health.router)
router.include_router(today.router)
router.include_router(places.router)
router.include_router(explore.router)
router.include_router(wallet.router)
router.include_router(photos.router)
router.include_router(memories.router)
router.include_router(admin.router)
router.include_router(operator.router)

if settings.demo_mode:
    from . import demo

    router.include_router(demo.router)
