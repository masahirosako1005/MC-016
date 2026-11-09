from fastapi import APIRouter

from . import health, today

router = APIRouter()
router.include_router(health.router)
router.include_router(today.router)
