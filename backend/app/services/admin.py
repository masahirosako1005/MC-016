"""運営の窓。還元率・抽選商品の変更、補填集計、履歴。利用者側には出さない。"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime

from ..errors import AppError


def _hist(conn: sqlite3.Connection, now: datetime, kind: str, target: str, before, after) -> None:
    conn.execute(
        "INSERT INTO admin_history(at, kind, target, before, after) VALUES(?,?,?,?,?)",
        (now.isoformat(timespec="seconds"), kind, target, json.dumps(before, ensure_ascii=False), json.dumps(after, ensure_ascii=False)),
    )


def set_rate(conn: sqlite3.Connection, shop_id: int, rate: int, now: datetime) -> dict:
    if not (1 <= rate <= 20):
        raise AppError(422, "bad_rate", "還元率は 1〜20% です")
    row = conn.execute("SELECT id, name, rate_percent FROM shops WHERE id = ?", (shop_id,)).fetchone()
    if row is None:
        raise AppError(404, "shop_not_found", "お店が見つかりません")
    if row["rate_percent"] != rate:
        conn.execute("UPDATE shops SET rate_percent = ? WHERE id = ?", (rate, shop_id))
        _hist(conn, now, "rate", f"shop:{shop_id} {row['name']}", {"rate_percent": row["rate_percent"]}, {"rate_percent": rate})
    return {"id": shop_id, "name": row["name"], "rate_percent": rate}


def update_prize(conn: sqlite3.Connection, prize_id: int, patch: dict, now: datetime) -> dict:
    row = conn.execute("SELECT * FROM prizes WHERE id = ?", (prize_id,)).fetchone()
    if row is None:
        raise AppError(404, "prize_not_found", "商品が見つかりません")
    before = dict(row)
    after = dict(before)
    for k in ("name", "face_value", "weight", "stock", "enabled"):
        if k in patch and patch[k] is not None:
            after[k] = patch[k]
    if "stock" in patch and patch["stock"] is None and before["category"] != "miss":
        after["stock"] = None
    if after["weight"] < 0 or after["weight"] > 1000:
        raise AppError(422, "bad_weight", "重みは 0〜1000 です")
    if after["face_value"] < 0 or after["face_value"] > 100000:
        raise AppError(422, "bad_face_value", "額面は 0〜100,000 円です")
    if after["stock"] is not None and (after["stock"] < 0 or after["stock"] > 100000):
        raise AppError(422, "bad_stock", "在庫は 0〜100,000 です")
    if before["category"] == "miss":
        after["face_value"] = 0
        after["stock"] = None
        after["enabled"] = 1
    changed = {k: after[k] for k in after if after[k] != before[k]}
    if changed:
        conn.execute(
            "UPDATE prizes SET name = ?, face_value = ?, weight = ?, stock = ?, enabled = ? WHERE id = ?",
            (after["name"], int(after["face_value"]), int(after["weight"]), after["stock"], int(bool(after["enabled"])), prize_id),
        )
        _hist(conn, now, "prize", f"prize:{prize_id} {before['name']}", {k: before[k] for k in changed}, changed)
    return dict(conn.execute("SELECT * FROM prizes WHERE id = ?", (prize_id,)).fetchone())


def reimbursement(conn: sqlite3.Connection, month: str) -> dict:
    """month = 'YYYY-MM'。店ごとの使用枚数と補填額（額面の合計）。"""
    if len(month) != 7 or month[4] != "-" or not (month[:4].isdigit() and month[5:].isdigit()):
        raise AppError(422, "bad_month", "月は YYYY-MM で指定してください")
    rows = [
        dict(r)
        for r in conn.execute(
            "SELECT s.id AS shop_id, s.name AS shop_name, s.area, s.category, COUNT(c.id) AS used_count, COALESCE(SUM(c.face_value),0) AS amount "
            "FROM shops s LEFT JOIN coupons c ON c.used_shop_id = s.id AND substr(c.used_on,1,7) = ? GROUP BY s.id ORDER BY s.id",
            (month,),
        )
    ]
    months = [r["m"] for r in conn.execute("SELECT DISTINCT substr(used_on,1,7) AS m FROM coupons WHERE used_on IS NOT NULL ORDER BY m DESC")]
    return {"month": month, "rows": rows, "total_count": sum(r["used_count"] for r in rows), "total_amount": sum(r["amount"] for r in rows), "months": months}


def history(conn: sqlite3.Connection, limit: int = 100) -> list[dict]:
    out = []
    for r in conn.execute("SELECT * FROM admin_history ORDER BY id DESC LIMIT ?", (limit,)):
        d = dict(r)
        d["before"] = json.loads(d["before"]) if d["before"] else None
        d["after"] = json.loads(d["after"]) if d["after"] else None
        out.append(d)
    return out


def recent_receipts(conn: sqlite3.Connection, limit: int = 50) -> list[dict]:
    out = []
    for r in conn.execute(
        "SELECT r.id, r.user_id, r.amount, r.rate_percent, r.points, r.received_on, r.created_at, r.image_path IS NOT NULL AS has_image, r.is_dummy, s.name AS shop_name "
        "FROM receipts r JOIN shops s ON s.id = r.shop_id WHERE r.is_dummy = 0 ORDER BY r.id DESC LIMIT ?",
        (limit,),
    ):
        d = dict(r)
        d["has_image"] = bool(d["has_image"])
        d["image_url"] = f"/api/admin/receipts/{d['id']}/image" if d["has_image"] else None
        out.append(d)
    return out
