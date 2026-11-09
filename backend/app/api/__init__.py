from fastapi import APIRouter

from . import explore, health, today, wallet

router = APIRouter()
router.include_router(health.router)
router.include_router(today.router)
router.include_router(explore.router)
router.include_router(wallet.router)
