"""デモ層。DEMO_MODE=1 のときだけ組み込まれる（0 のときは /api/demo/* は JSON 404 のまま）。
模擬の時計と、場面を進める操作。本体の画面にはデモ操作を一切出さない。
"""
from __future__ import annotations

import shutil
import sqlite3
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from .. import clock
from ..config import settings
from ..deps import get_conn, write_tx
from ..errors import AppError
from ..seed.master import seed_master
from ..services.lottery import FIX_KEY, prize_table
from ..services.photos import seed_sample_photos
from ..services.season import LABEL, WEEKDAY_JA, season_of

router = APIRouter(prefix="/demo")

SCENES = [
    {"key": "pre", "label": "⓪ 旅前", "at": settings.demo_start, "desc": "計画: 行きたい場所をスワイプで選び、地図で整えて、日を決める"},
    {"key": "trip", "label": "① 旅中", "at": settings.demo_trip_day, "desc": "マップから場所へ。そこにいる人に会い、ゆるキャラと AR フォト、レシートでポイント"},
    {"key": "night", "label": "② その夜", "at": settings.demo_night, "desc": "その日の思い出がコルクボードに。日記と「行きたい」"},
    {"key": "after30", "label": "③ 30 日後", "at": settings.demo_after30, "desc": "30 日後、便りが届く。あの日の思い出と行きたい場所、次の季節まであと何週間"},
    {"key": "season", "label": "④ 次の季節", "at": settings.demo_next_season, "desc": "種が花に。会えた日に約束を果たす"},
    {"key": "admin", "label": "⑤ 運営", "at": settings.demo_next_season, "desc": "運営の窓: 指標・来訪予定・還元率・補填"},
]


def _state(conn: sqlite3.Connection) -> dict:
    now = clock.now(conn)
    cur = None
    for sc in SCENES:
        if sc["key"] != "admin" and now >= datetime.fromisoformat(sc["at"]):
            cur = sc["key"]
    fixed = conn.execute("SELECT value FROM settings WHERE key = ?", (FIX_KEY,)).fetchone()
    return {
        "now": now.isoformat(timespec="seconds"),
        "date": now.date().isoformat(),
        "weekday": WEEKDAY_JA[now.weekday()],
        "season": season_of(now.date()),
        "season_label": LABEL[season_of(now.date())],
        "scene": cur,
        "scenes": SCENES,
        "fixed_prize": int(fixed["value"]) if fixed else None,
        "prizes": [{"id": p["id"], "name": p["name"], "category": p["category"]} for p in prize_table(conn)],
    }


@router.get("/state")
def state(conn=Depends(get_conn)):
    return _state(conn)


def _jump(conn: sqlite3.Connection, iso: str) -> dict:
    with write_tx(conn):
        clock.set_demo_clock(conn, datetime.fromisoformat(iso))
    return _state(conn)


@router.post("/trip-day")
def trip_day(conn=Depends(get_conn)):
    return _jump(conn, settings.demo_trip_day)


@router.post("/night")
def night(conn=Depends(get_conn)):
    now = clock.now(conn)
    # 「その日の夜」= いまの日付の 19:00
    return _jump(conn, now.replace(hour=19, minute=0, second=0).isoformat(timespec="seconds"))


@router.post("/after30")
def after30(conn=Depends(get_conn)):
    return _jump(conn, settings.demo_after30)


@router.post("/next-season")
def next_season_(conn=Depends(get_conn)):
    return _jump(conn, settings.demo_next_season)


class ClockIn(BaseModel):
    at: str = Field(min_length=16, max_length=19)


@router.post("/clock")
def set_clock(body: ClockIn, conn=Depends(get_conn)):
    try:
        dt = datetime.fromisoformat(body.at)
    except ValueError:
        raise AppError(422, "bad_datetime", "日時の形式が不正です（例 2026-10-24T10:00）")
    return _jump(conn, dt.isoformat(timespec="seconds"))


class FixIn(BaseModel):
    prize_id: int | None = Field(default=None, ge=1)


@router.post("/fix-lottery")
def fix_lottery(body: FixIn, conn=Depends(get_conn)):
    with write_tx(conn):
        if body.prize_id is None:
            conn.execute("DELETE FROM settings WHERE key = ?", (FIX_KEY,))
        else:
            if not conn.execute("SELECT 1 FROM prizes WHERE id = ?", (body.prize_id,)).fetchone():
                raise AppError(404, "prize_not_found", "商品が見つかりません")
            conn.execute(
                "INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (FIX_KEY, str(body.prize_id)),
            )
    return _state(conn)


@router.post("/reset")
def reset(conn=Depends(get_conn)):
    """主人公の履歴とデモ時計を初期化する。マスタ・取り込んだ CSV・ダミーは残す。"""
    uid = settings.hero_user_id
    with write_tx(conn):
        for sql in (
            "DELETE FROM meetings WHERE user_id = ? AND is_dummy = 0",
            "DELETE FROM spot_checkins WHERE user_id = ?",
            "DELETE FROM seeds WHERE user_id = ?",
            "DELETE FROM receipts WHERE user_id = ? AND is_dummy = 0",
            "DELETE FROM point_ledger WHERE user_id = ?",
            "DELETE FROM draws WHERE user_id = ?",
            "DELETE FROM coupons WHERE user_id = ? AND is_dummy = 0",
            "DELETE FROM diaries WHERE user_id = ?",
            "DELETE FROM wishes WHERE user_id = ?",
            "DELETE FROM letter_opens WHERE user_id = ? AND is_dummy = 0",
            "DELETE FROM plan_items WHERE plan_id IN (SELECT id FROM plans WHERE user_id = ? AND is_dummy = 0)",
            "DELETE FROM plans WHERE user_id = ? AND is_dummy = 0",
        ):
            conn.execute(sql, (uid,))
        # 写真: サンプル以外を削除（ファイルも）
        for r in conn.execute("SELECT path FROM photos WHERE user_id = ? AND is_sample = 0", (uid,)).fetchall():
            try:
                shutil.os.remove(r["path"])
            except OSError:
                pass
        conn.execute("DELETE FROM photos WHERE user_id = ? AND is_sample = 0", (uid,))
        # 在庫を初期値に戻す（商品の重み等の運営変更は保持）
        conn.execute("DELETE FROM settings WHERE key = ?", (FIX_KEY,))
        clock.set_demo_clock(conn, datetime.fromisoformat(settings.demo_start))
        seed_master(conn)
        seed_sample_photos(conn, uid)
    return _state(conn)
