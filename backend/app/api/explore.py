"""つぎの旅（計画: 行きたい場所と日）と店ページ。"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from .. import clock
from ..config import settings
from ..deps import get_conn, write_tx
from ..errors import AppError
from ..repositories import master
from ..services import plan as plan_svc
from ..services.forecast import forecast

router = APIRouter()


class TargetIn(BaseModel):
    target_date: str | None = Field(default=None, max_length=10)


class ItemIn(BaseModel):
    kind: str = Field(default="spot", pattern="^(spot|shop)$")
    target_id: int = Field(ge=1)


@router.get("/plan")
def get_plan(conn=Depends(get_conn)):
    return plan_svc.plan_view(conn, settings.hero_user_id, clock.now(conn))


@router.put("/plan")
def put_plan(body: TargetIn, conn=Depends(get_conn)):
    now = clock.now(conn)
    with write_tx(conn):
        plan_svc.set_target(conn, settings.hero_user_id, now, body.target_date or None)
    return plan_svc.plan_view(conn, settings.hero_user_id, now)


@router.post("/plan/items")
def post_item(body: ItemIn, conn=Depends(get_conn)):
    now = clock.now(conn)
    with write_tx(conn):
        added = plan_svc.add_item(conn, settings.hero_user_id, now, body.kind, body.target_id)
    v = plan_svc.plan_view(conn, settings.hero_user_id, now)
    v["added"] = added
    return v


@router.delete("/plan/items/{kind}/{target_id}")
def delete_item(kind: str, target_id: int, conn=Depends(get_conn)):
    now = clock.now(conn)
    with write_tx(conn):
        plan_svc.remove_item(conn, settings.hero_user_id, now, kind, target_id)
    return plan_svc.plan_view(conn, settings.hero_user_id, now)


@router.get("/plan/ics")
def plan_ics(conn=Depends(get_conn)):
    """予定日を iCalendar で返す（Google カレンダー等に取り込める）。外部 API は使わない。"""
    from fastapi.responses import Response

    v = plan_svc.plan_view(conn, settings.hero_user_id, clock.now(conn))
    if not v["exists"] or not v["target_date"]:
        raise AppError(404, "no_plan_date", "予定日がまだ決まっていません")
    d = v["target_date"].replace("-", "")
    places = "、".join(i["name"] for i in v["items"])
    people = "、".join(p["name"] for p in v["people_that_day"] if p["available"])
    desc = f"行く場所: {places}\\n会えそうな人: {people}\\nひとめぐり便"
    ics = (
        "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//hitomeguri//JP\r\nBEGIN:VEVENT\r\n"
        f"UID:hitomeguri-plan-{v['id']}@local\r\nDTSTART;VALUE=DATE:{d}\r\n"
        f"SUMMARY:星凪諸島へ（ひとめぐり便）\r\nDESCRIPTION:{desc}\r\nLOCATION:星凪諸島\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n"
    )
    return Response(content=ics, media_type="text/calendar; charset=utf-8", headers={"Content-Disposition": 'attachment; filename="hitomeguri.ics"'})


@router.get("/shops/{shop_id}")
def get_shop(shop_id: int, conn=Depends(get_conn)):
    sh = master.shop(conn, shop_id)
    if sh is None:
        raise AppError(404, "shop_not_found", "お店が見つかりません")
    now = clock.now(conn)
    today = now.date().isoformat()
    person = conn.execute("SELECT id, name, intro, svg_key, role FROM people WHERE shop_id = ?", (shop_id,)).fetchone()
    coupons = [
        dict(c)
        for c in conn.execute(
            "SELECT id, category, name, face_value, valid_from, valid_until FROM coupons WHERE user_id = ? AND used_on IS NULL AND category = ? "
            "AND valid_from <= ? AND valid_until >= ? ORDER BY valid_until",
            (settings.hero_user_id, sh["category"], today, today),
        )
    ]
    not_yet = [
        dict(c)
        for c in conn.execute(
            "SELECT id, category, name, face_value, valid_from, valid_until FROM coupons WHERE user_id = ? AND used_on IS NULL AND category = ? AND valid_from > ? ORDER BY valid_from",
            (settings.hero_user_id, sh["category"], today),
        )
    ]
    sp = master.spot(conn, sh["spot_id"])
    return {
        "shop": {k: sh[k] for k in ("id", "name", "area", "category", "description", "access", "svg_key", "rate_percent", "spot_id")},
        "place": {"id": sp["id"], "name": sp["name"].split("（")[0], "image": f"/img/places/{sp['svg_key']}.jpg"} if sp else None,
        "hours": f"{sh['open_time']}–{sh['close_time']}",
        "forecast": forecast(sh, now),
        "person": dict(person, image=f"/img/people/{person['svg_key']}.png") if person else None,
        "coupons_usable": coupons,
        "coupons_not_yet": not_yet,
    }
