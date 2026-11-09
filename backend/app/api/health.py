from fastapi import APIRouter, Depends

from .. import clock
from ..config import settings
from ..deps import get_conn
from ..services.season import WEEKDAY_JA, season_label, season_of

router = APIRouter()


@router.get("/health")
def health(conn=Depends(get_conn)):
    now = clock.now(conn)
    return {
        "ok": True,
        "now": now.isoformat(timespec="seconds"),
        "date": now.date().isoformat(),
        "weekday": WEEKDAY_JA[now.weekday()],
        "season": season_of(now.date()),
        "season_label": season_label(season_of(now.date())),
        "demo_mode": settings.demo_mode,
    }
