from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .. import clock
from ..config import settings
from ..deps import get_conn, write_tx
from ..repositories import master
from ..services import lottery, points

router = APIRouter()


@router.get("/wallet")
def get_wallet(conn=Depends(get_conn)):
    uid = settings.hero_user_id
    today = clock.today(conn).isoformat()
    legacy = [dict(r) for r in conn.execute("SELECT reward_name, prize_name, got_at FROM legacy_rewards WHERE user_id = ? ORDER BY got_at DESC", (uid,))]
    return {
        "balance": points.balance(conn, uid),
        "points_per_draw": settings.points_per_draw,
        "prizes": [
            {"id": p["id"], "category": p["category"], "name": p["name"], "face_value": p["face_value"], "probability": p["probability"],
             "in_stock": p["in_stock"], "stock": p["stock"]}
            for p in lottery.prize_table(conn)
        ],
        "coupons": lottery.coupon_list(conn, uid, today),
        "receipts": points.receipt_list(conn, uid),
        "shops": [{"id": s["id"], "name": s["name"], "category": s["category"], "rate_percent": s["rate_percent"]} for s in master.shops(conn)],
        "legacy_rewards": legacy,
        "today": today,
    }


@router.post("/receipts")
async def post_receipt(shop_id: int = Form(ge=1), amount: int = Form(ge=1, le=100000), image: UploadFile = File(...), conn=Depends(get_conn)):
    data = await image.read()
    now = clock.now(conn)
    with write_tx(conn):
        return points.register_receipt(conn, settings.hero_user_id, shop_id, amount, data, now)


@router.get("/receipts/{receipt_id}/image")
def get_receipt_image(receipt_id: int, conn=Depends(get_conn)):
    path, mime = points.receipt_image(conn, settings.hero_user_id, receipt_id)
    return FileResponse(path, media_type=mime, headers={"Cache-Control": "private, no-store"})


@router.post("/draws")
def post_draw(conn=Depends(get_conn)):
    now = clock.now(conn)
    with write_tx(conn):
        return lottery.draw(conn, settings.hero_user_id, now)


class UseIn(BaseModel):
    shop_id: int = Field(ge=1)


@router.post("/coupons/{coupon_id}/use")
def post_use(coupon_id: int, body: UseIn, conn=Depends(get_conn)):
    now = clock.now(conn)
    with write_tx(conn):
        return lottery.use_coupon(conn, settings.hero_user_id, coupon_id, body.shop_id, now)
