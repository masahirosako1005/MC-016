"""ポイントとレシート。
- 写真必須。PNG/JPEG/WebP、5MB まで、先頭バイトで判定。
- 同じ画像（SHA-256）は二重登録として 409。
- ポイント = floor(金額 × 店の還元率)。率はレシートにスナップショット。
- 今日のレシートだけ。画像は 7 日で削除、数値は残す。
"""
from __future__ import annotations

import hashlib
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path

from ..config import settings
from ..errors import AppError
from ..repositories import master

MAGIC = (
    (b"\x89PNG\r\n\x1a\n", "image/png", ".png"),
    (b"\xff\xd8\xff", "image/jpeg", ".jpg"),
)


def sniff_image(data: bytes) -> tuple[str, str]:
    for magic, mime, ext in MAGIC:
        if data.startswith(magic):
            return mime, ext
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", ".webp"
    raise AppError(415, "unsupported_image", "画像は PNG・JPEG・WebP だけ使えます")


def balance(conn: sqlite3.Connection, uid: int) -> int:
    return conn.execute("SELECT COALESCE(SUM(delta), 0) FROM point_ledger WHERE user_id = ?", (uid,)).fetchone()[0]


def register_receipt(conn: sqlite3.Connection, uid: int, shop_id: int, amount: int, data: bytes, now: datetime) -> dict:
    """呼び出し側で write_tx に入れること。"""
    if not (1 <= amount <= 100000):
        raise AppError(422, "bad_amount", "金額は 1〜100,000 円の整数です")
    if len(data) == 0:
        raise AppError(422, "no_image", "レシートの写真を付けてください")
    if len(data) > settings.receipt_max_bytes:
        raise AppError(413, "image_too_large", "画像は 5MB までです")
    mime, ext = sniff_image(data)
    shop = master.shop(conn, shop_id)
    if shop is None:
        raise AppError(404, "shop_not_found", "お店が見つかりません")
    sha = hashlib.sha256(data).hexdigest()
    if conn.execute("SELECT 1 FROM receipts WHERE sha256 = ?", (sha,)).fetchone():
        raise AppError(409, "duplicate_receipt", "同じレシートはすでに登録されています")
    rate = int(shop["rate_percent"])
    points = amount * rate // 100
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    path = settings.uploads_dir / f"{uuid.uuid4().hex}{ext}"  # 保存名はサーバーが決める
    path.write_bytes(data)
    today = now.date().isoformat()
    cur = conn.execute(
        "INSERT INTO receipts(user_id, shop_id, amount, rate_percent, points, sha256, image_path, image_mime, received_on, created_at) "
        "VALUES(?,?,?,?,?,?,?,?,?,?)",
        (uid, shop_id, amount, rate, points, sha, str(path), mime, today, now.isoformat(timespec="seconds")),
    )
    rid = cur.lastrowid
    if points > 0:
        conn.execute(
            "INSERT INTO point_ledger(user_id, delta, reason, ref_type, ref_id, created_at) VALUES(?,?,?,?,?,?)",
            (uid, points, "receipt", "receipt", rid, now.isoformat(timespec="seconds")),
        )
    return {"id": rid, "shop": {"id": shop["id"], "name": shop["name"]}, "amount": amount, "rate_percent": rate, "points": points,
            "received_on": today, "balance": balance(conn, uid)}


def receipt_list(conn: sqlite3.Connection, uid: int) -> list[dict]:
    out = []
    for r in conn.execute(
        "SELECT r.id, r.amount, r.rate_percent, r.points, r.received_on, r.created_at, r.image_path IS NOT NULL AS has_image, s.name AS shop_name, s.area "
        "FROM receipts r JOIN shops s ON s.id = r.shop_id WHERE r.user_id = ? AND r.is_dummy = 0 ORDER BY r.id DESC LIMIT 100",
        (uid,),
    ):
        d = dict(r)
        d["has_image"] = bool(d["has_image"])
        d["image_url"] = f"/api/receipts/{d['id']}/image" if d["has_image"] else None
        out.append(d)
    return out


def receipt_image(conn: sqlite3.Connection, uid: int, receipt_id: int) -> tuple[Path, str]:
    r = conn.execute("SELECT image_path, image_mime FROM receipts WHERE id = ? AND user_id = ?", (receipt_id, uid)).fetchone()
    if r is None or r["image_path"] is None:
        raise AppError(404, "image_not_found", "画像は保存期間（7 日）を過ぎたか、見つかりません")
    p = Path(r["image_path"])
    if not p.exists():
        raise AppError(404, "image_not_found", "画像が見つかりません")
    return p, r["image_mime"]
