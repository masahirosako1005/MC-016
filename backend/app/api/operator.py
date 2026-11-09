"""運営の窓の拡張: DMO ダッシュボード、お店の編集・写真、イベントのお知らせ、お店からの便り。利用者側の便り取得も。"""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .. import clock
from ..config import settings
from ..deps import get_conn, write_tx
from ..errors import AppError
from ..services import operator as svc

router = APIRouter()


@router.get("/admin/dashboard")
def dashboard(conn=Depends(get_conn)):
    return svc.dmo_dashboard(conn, clock.now(conn))


@router.get("/admin/shops/{shop_id}/dashboard")
def shop_dashboard(shop_id: int, conn=Depends(get_conn)):
    return svc.shop_dashboard(conn, shop_id, clock.now(conn))


class ShopIn(BaseModel):
    description: str | None = Field(default=None, max_length=300)
    access: str | None = Field(default=None, max_length=120)
    recommend: str | None = Field(default=None, max_length=300)


@router.put("/admin/shops/{shop_id}")
def put_shop(shop_id: int, body: ShopIn, conn=Depends(get_conn)):
    with write_tx(conn):
        return svc.update_shop(conn, shop_id, body.model_dump(), clock.now(conn))


@router.post("/admin/shops/{shop_id}/photo")
async def post_shop_photo(shop_id: int, image: UploadFile = File(...), conn=Depends(get_conn)):
    data = await image.read()
    with write_tx(conn):
        mime = svc.set_shop_photo(conn, shop_id, data, clock.now(conn))
    return {"ok": True, "mime": mime, "url": f"/api/shops/{shop_id}/photo"}


@router.get("/shops/{shop_id}/photo")
def get_shop_photo(shop_id: int, conn=Depends(get_conn)):
    p = svc.shop_photo_path(conn, shop_id)
    if not p or not Path(p).exists():
        raise AppError(404, "photo_not_found", "写真がありません")
    return FileResponse(p, headers={"Cache-Control": "private, max-age=600"})


class EventIn(BaseModel):
    date: str = Field(min_length=10, max_length=10)
    title: str = Field(min_length=1, max_length=60)
    kind: str = Field(default="外部", max_length=20)
    expected: int | None = Field(default=None, ge=0, le=10_000_000)
    note: str | None = Field(default=None, max_length=200)
    source: str = Field(default="DMO", max_length=20)


@router.get("/admin/events")
def get_events(conn=Depends(get_conn)):
    return {"events": svc.list_events(conn, clock.now(conn))}


@router.post("/admin/events")
def post_event(body: EventIn, conn=Depends(get_conn)):
    with write_tx(conn):
        return svc.add_event(conn, clock.now(conn), body.date, body.title, body.kind, body.expected, body.note, body.source)


@router.delete("/admin/events/{event_id}")
def delete_event(event_id: int, conn=Depends(get_conn)):
    with write_tx(conn):
        svc.delete_event(conn, event_id)
    return {"ok": True}


class MessageIn(BaseModel):
    title: str = Field(min_length=1, max_length=60)
    body: str = Field(min_length=1, max_length=400)
    coupon_face_value: int | None = Field(default=None, ge=100, le=10000)
    coupon_days: int | None = Field(default=None, ge=1, le=365)


@router.post("/admin/shops/{shop_id}/messages")
def post_message(shop_id: int, body: MessageIn, conn=Depends(get_conn)):
    with write_tx(conn):
        return svc.send_message(conn, shop_id, clock.now(conn), body.title, body.body, body.coupon_face_value, body.coupon_days)


@router.get("/messages")
def get_messages(conn=Depends(get_conn)):
    return {"messages": svc.user_messages(conn, settings.hero_user_id)}


@router.post("/messages/{message_id}/read")
def read_message(message_id: int, conn=Depends(get_conn)):
    with write_tx(conn):
        svc.mark_read(conn, settings.hero_user_id, message_id, clock.now(conn))
    return {"ok": True}
