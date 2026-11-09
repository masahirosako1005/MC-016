from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from .. import clock
from ..config import settings
from ..deps import get_conn, write_tx
from ..errors import AppError
from ..repositories import master
from ..services import seeds as seeds_svc
from ..services.relationship import met_on, relationship
from ..services.today import today_view

router = APIRouter()


class MeetIn(BaseModel):
    person_id: int = Field(ge=1)


@router.get("/today")
def get_today(conn=Depends(get_conn)):
    return today_view(conn, clock.now(conn))


@router.post("/meetings")
def post_meeting(body: MeetIn, conn=Depends(get_conn)):
    uid = settings.hero_user_id
    now = clock.now(conn)
    today = now.date()
    p = master.person(conn, body.person_id)
    if p is None:
        raise AppError(404, "person_not_found", "お店の人が見つかりません")
    already = met_on(conn, uid, body.person_id, today.isoformat())
    given = None
    if not already:
        with write_tx(conn):
            conn.execute(
                "INSERT INTO meetings(user_id, person_id, met_on, created_at) VALUES(?,?,?,?)",
                (uid, body.person_id, today.isoformat(), now.isoformat(timespec="seconds")),
            )
            given = seeds_svc.give_seed_if_none(conn, uid, body.person_id, today)
    return {
        "already": already,
        "person": {"id": p["id"], "name": p["name"]},
        "relationship": relationship(conn, uid, body.person_id),
        "seed": seeds_svc.describe(seeds_svc.active_seed(conn, uid, body.person_id), today, True),
        "new_seed": given is not None,
    }


@router.post("/seeds/{seed_id}/fulfill")
def post_fulfill(seed_id: int, conn=Depends(get_conn)):
    today = clock.today(conn)
    with write_tx(conn):
        return seeds_svc.fulfill(conn, settings.hero_user_id, seed_id, today)
