from fastapi import APIRouter, Depends, Query

from .. import clock
from ..deps import get_conn
from ..errors import AppError
from ..services.places import person_detail, place_detail, places_view

router = APIRouter()


@router.get("/places")
def get_places(
    q: str = Query("", max_length=50),
    area: str = Query("", max_length=20),
    season: str = Query("", pattern="^(|spring|summer|autumn|winter)$"),
    conn=Depends(get_conn),
):
    return places_view(conn, clock.now(conn), q=q.strip(), area=area, season=season)


@router.get("/places/{spot_id}")
def get_place(spot_id: int, conn=Depends(get_conn)):
    d = place_detail(conn, clock.now(conn), spot_id)
    if d is None:
        raise AppError(404, "place_not_found", "場所が見つかりません")
    return d


@router.get("/people/{person_id}")
def get_person(person_id: int, conn=Depends(get_conn)):
    d = person_detail(conn, clock.now(conn), person_id)
    if d is None:
        raise AppError(404, "person_not_found", "人が見つかりません")
    return d
