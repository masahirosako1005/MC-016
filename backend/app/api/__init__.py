from fastapi import APIRouter

from . import admin, explore, health, memories, photos, today, wallet

router = APIRouter()
router.include_router(health.router)
router.include_router(today.router)
router.include_router(explore.router)
router.include_router(wallet.router)
router.include_router(photos.router)
router.include_router(memories.router)
router.include_router(admin.router)
