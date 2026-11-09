from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from .. import clock
from ..config import settings
from ..deps import get_conn, write_tx
from ..errors import AppError
from ..repositories import master
from ..services import plan as plan_svc
from ..services.explore import explore_view, place_detail
from ..services.forecast import forecast

router = APIRouter()


@router.get("/explore")
def get_explore(
    q: str = Query("", max_length=50),
    area: str = Query("", max_length=20),
    season: str = Query("", pattern="^(|spring|summer|autumn|winter)$"),
    category: str = Query("", max_length=10),
    conn=Depends(get_conn),
):
    return explore_view(conn, clock.now(conn), q=q.strip(), area=area, season=season, category=category)


@router.get("/place/{kind}/{target_id}")
def get_place(kind: str, target_id: int, conn=Depends(get_conn)):
    if kind not in ("spot", "shop"):
        raise AppError(404, "not_found", "見つかりません")
    d = place_detail(conn, clock.now(conn), kind, target_id)
    if d is None:
        raise AppError(404, "not_found", "場所が見つかりません")
    plan = plan_svc.plan_view(conn, settings.hero_user_id, clock.now(conn))
    d["in_plan"] = any(it["kind"] == kind and it["id"] == target_id for it in plan["items"])
    return d


class TargetIn(BaseModel):
    target_date: str | None = Field(default=None, max_length=10)


class ItemIn(BaseModel):
    kind: str = Field(pattern="^(spot|shop)$")
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


@router.get("/shops/{shop_id}")
def get_shop(shop_id: int, conn=Depends(get_conn)):
    sh = master.shop(conn, shop_id)
    if sh is None:
        raise AppError(404, "shop_not_found", "お店が見つかりません")
    now = clock.now(conn)
    today = now.date().isoformat()
    person = conn.execute("SELECT id, name, intro, svg_key FROM people WHERE shop_id = ?", (shop_id,)).fetchone()
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
    return {
        "shop": {k: sh[k] for k in ("id", "name", "area", "category", "description", "access", "svg_key", "is_unmanned", "rate_percent")},
        "hours": f"{sh['open_time']}–{sh['close_time']}",
        "forecast": forecast(sh, now),
        "person": dict(person) if person else None,
        "coupons_usable": coupons,
        "coupons_not_yet": not_yet,
    }
