from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from .. import clock
from ..config import settings
from ..deps import get_conn, write_tx
from ..services import letters as svc
from ..services.book import book_view

router = APIRouter()


@router.get("/letters")
def get_letters(conn=Depends(get_conn)):
    return svc.letters_index(conn, settings.hero_user_id, clock.now(conn))


@router.get("/letters/{day}")
def get_letter(day: str, conn=Depends(get_conn)):
    return svc.letter_view(conn, settings.hero_user_id, day, clock.now(conn))


@router.post("/letters/{day}/open")
def post_open(day: str, conn=Depends(get_conn)):
    now = clock.now(conn)
    svc.letter_view(conn, settings.hero_user_id, day, now)  # 存在と時刻の確認
    with write_tx(conn):
        svc.open_letter(conn, settings.hero_user_id, day, now)
    return {"ok": True}


class DiaryIn(BaseModel):
    text: str = Field(max_length=140)


@router.put("/diaries/{day}")
def put_diary(day: str, body: DiaryIn, conn=Depends(get_conn)):
    now = clock.now(conn)
    svc.letter_view(conn, settings.hero_user_id, day, now)
    with write_tx(conn):
        svc.save_diary(conn, settings.hero_user_id, day, body.text, now)
    return {"ok": True, "text": body.text.strip()}


class WishIn(BaseModel):
    kind: str = Field(pattern="^(season|event|shop)$")
    target_type: str = Field(pattern="^(promise|shop)$")
    target_id: int = Field(ge=1)
    label: str = Field(max_length=100)


@router.post("/wishes")
def post_wish(body: WishIn, conn=Depends(get_conn)):
    now = clock.now(conn)
    with write_tx(conn):
        return svc.add_wish(conn, settings.hero_user_id, body.kind, body.target_type, body.target_id, body.label, now)


@router.get("/book")
def get_book(conn=Depends(get_conn)):
    return book_view(conn, settings.hero_user_id, clock.now(conn))
