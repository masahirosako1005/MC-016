"""レシート画像は 7 日で削除する（数値は残す）。起動時と日次で呼ぶ。"""
from __future__ import annotations

import logging
import sqlite3
from datetime import timedelta
from pathlib import Path

from .. import clock
from ..config import settings

log = logging.getLogger("hitomeguri")


def purge_old_receipt_images(conn: sqlite3.Connection) -> int:
    cutoff = (clock.now(conn) - timedelta(days=settings.receipt_image_keep_days)).isoformat(timespec="seconds")
    rows = conn.execute(
        "SELECT id, image_path FROM receipts WHERE image_path IS NOT NULL AND created_at < ?", (cutoff,)
    ).fetchall()
    n = 0
    for r in rows:
        p = Path(r["image_path"])
        try:
            if p.exists():
                p.unlink()
        except OSError:
            log.warning("画像を削除できませんでした id=%s", r["id"])
        conn.execute("UPDATE receipts SET image_path = NULL WHERE id = ?", (r["id"],))
        n += 1
    return n
