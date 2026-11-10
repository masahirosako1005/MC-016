"""抽選。10pt で 1 回。重み・在庫は運営の窓で変更できる。
在庫 0 の商品は抽選対象から外し、その重みは「はずれ」に合算（表示確率も同じ計算）。
ポイント減算・在庫減・クーポン付与は 1 トランザクション。
"""
from __future__ import annotations

import random
import sqlite3
from datetime import datetime, timedelta

from ..config import settings
from ..errors import AppError
from .points import balance

FIX_KEY = "demo_fixed_prize"


def prize_table(conn: sqlite3.Connection) -> list[dict]:
    rows = [dict(r) for r in conn.execute("SELECT * FROM prizes WHERE enabled = 1 ORDER BY CASE category WHEN 'miss' THEN 1 ELSE 0 END, id")]
    miss_extra = 0
    live: list[dict] = []
    for r in rows:
        in_stock = r["category"] == "miss" or r["stock"] is None or r["stock"] > 0
        if not in_stock:
            miss_extra += r["weight"]
        live.append(dict(r, in_stock=in_stock))
    total = sum(r["weight"] for r in live)
    for r in live:
        eff = (r["weight"] + miss_extra) if r["category"] == "miss" else (r["weight"] if r["in_stock"] else 0)
        r["effective_weight"] = eff
        r["probability"] = round(eff / total, 4) if total else 0.0
    return live


def draw(conn: sqlite3.Connection, uid: int, now: datetime, rng: random.Random | None = None) -> dict:
    """呼び出し側で write_tx に入れること。"""
    bal = balance(conn, uid)
    if bal < settings.points_per_draw:
        raise AppError(409, "not_enough_points", f"抽選には {settings.points_per_draw} ポイント必要です（いま {bal} pt）")
    table = prize_table(conn)
    candidates = [p for p in table if p["effective_weight"] > 0]
    if not candidates:
        raise AppError(409, "no_prizes", "いまは抽選できる商品がありません")

    fixed = None
    if settings.demo_mode:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (FIX_KEY,)).fetchone()
        if row:
            fixed = int(row["value"])
            conn.execute("DELETE FROM settings WHERE key = ?", (FIX_KEY,))
    chosen = None
    if fixed is not None:
        chosen = next((p for p in table if p["id"] == fixed), None)
    if chosen is None:
        r = rng or random.SystemRandom()
        chosen = r.choices(candidates, weights=[p["effective_weight"] for p in candidates])[0]

    ts = now.isoformat(timespec="seconds")
    conn.execute(
        "INSERT INTO point_ledger(user_id, delta, reason, ref_type, ref_id, created_at) VALUES(?,?,?,?,?,?)",
        (uid, -settings.points_per_draw, "draw", "prize", chosen["id"], ts),
    )
    cur = conn.execute("INSERT INTO draws(user_id, prize_id, created_at) VALUES(?,?,?)", (uid, chosen["id"], ts))
    coupon = None
    if chosen["category"] != "miss":
        if chosen["stock"] is not None:
            upd = conn.execute("UPDATE prizes SET stock = stock - 1 WHERE id = ? AND stock > 0", (chosen["id"],))
            if upd.rowcount == 0:
                raise AppError(409, "out_of_stock", "在庫切れです。もう一度お試しください")
        won = now.date()
        c = conn.execute(
            "INSERT INTO coupons(user_id, prize_id, category, name, face_value, won_on, valid_from, valid_until) VALUES(?,?,?,?,?,?,?,?)",
            (uid, chosen["id"], chosen["category"], chosen["name"], chosen["face_value"], won.isoformat(),
             (won + timedelta(days=1)).isoformat(), (won + timedelta(days=settings.coupon_valid_days)).isoformat()),
        )
        coupon = {"id": c.lastrowid, "category": chosen["category"], "name": chosen["name"], "face_value": chosen["face_value"],
                  "valid_from": (won + timedelta(days=1)).isoformat(), "valid_until": (won + timedelta(days=settings.coupon_valid_days)).isoformat()}
    # 渡してくれる人: 会ったことのある人のうち、当たった区分の店の人（会えた日数が多い順）。いなければ ほしまる
    presenter = None
    if chosen["category"] != "miss":
        prow = conn.execute(
            "SELECT p.id, p.name, p.role, p.svg_key, s.name AS shop_name, COUNT(DISTINCT m.met_on) AS days "
            "FROM meetings m JOIN people p ON p.id = m.person_id JOIN shops s ON s.id = p.shop_id "
            "WHERE m.user_id = ? AND s.category = ? GROUP BY p.id ORDER BY days DESC, p.id LIMIT 1",
            (uid, chosen["category"]),
        ).fetchone()
        if prow:
            presenter = {"id": prow["id"], "name": prow["name"], "role": prow["role"] or "店主", "shop_name": prow["shop_name"],
                         "image": f"/img/people/{prow['svg_key']}.png", "days": prow["days"]}
    return {
        "draw_id": cur.lastrowid,
        "prize": {"id": chosen["id"], "category": chosen["category"], "name": chosen["name"], "face_value": chosen["face_value"]},
        "hit": chosen["category"] != "miss",
        "coupon": coupon,
        "presenter": presenter,
        "balance": balance(conn, uid),
    }


def use_coupon(conn: sqlite3.Connection, uid: int, coupon_id: int, shop_id: int, now: datetime) -> dict:
    c = conn.execute("SELECT * FROM coupons WHERE id = ? AND user_id = ?", (coupon_id, uid)).fetchone()
    if c is None:
        raise AppError(404, "coupon_not_found", "クーポンが見つかりません")
    if c["used_on"]:
        raise AppError(409, "coupon_used", "このクーポンは使用済みです")
    shop = conn.execute("SELECT id, name, category FROM shops WHERE id = ?", (shop_id,)).fetchone()
    if shop is None:
        raise AppError(404, "shop_not_found", "お店が見つかりません")
    if shop["category"] != c["category"]:
        raise AppError(409, "coupon_category_mismatch", f"このクーポンは{c['category']}のお店で使えます")
    today = now.date().isoformat()
    if today < c["valid_from"]:
        raise AppError(409, "coupon_not_yet", f"このクーポンは {c['valid_from'].replace('-', '/')} から（次の来訪から）使えます")
    if today > c["valid_until"]:
        raise AppError(409, "coupon_expired", "このクーポンは期限切れです")
    conn.execute(
        "UPDATE coupons SET used_on = ?, used_shop_id = ?, used_at = ? WHERE id = ?",
        (today, shop_id, now.isoformat(timespec="seconds"), coupon_id),
    )
    return {"id": coupon_id, "used_on": today, "shop": {"id": shop["id"], "name": shop["name"]}, "face_value": c["face_value"]}


def coupon_list(conn: sqlite3.Connection, uid: int, today: str) -> list[dict]:
    out = []
    for c in conn.execute(
        "SELECT c.*, s.name AS used_shop_name FROM coupons c LEFT JOIN shops s ON s.id = c.used_shop_id WHERE c.user_id = ? AND c.is_dummy = 0 ORDER BY c.id DESC",
        (uid,),
    ):
        d = dict(c)
        if d["used_on"]:
            d["state"] = "used"
        elif today < d["valid_from"]:
            d["state"] = "not_yet"
        elif today > d["valid_until"]:
            d["state"] = "expired"
        else:
            d["state"] = "usable"
        out.append(d)
    return out
