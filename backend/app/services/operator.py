"""運営の窓（DMO と お店・施設）の機能: ダッシュボード、店の編集、イベントのお知らせ、お店からの便り。"""
from __future__ import annotations

import sqlite3
import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta

from ..config import settings
from ..errors import AppError
from ..repositories import master
from .points import sniff_image


def _month(d: str) -> str:
    return d[:7]


def _months_back(now: datetime, n: int) -> list[str]:
    y, m = now.year, now.month
    out = []
    for _ in range(n):
        out.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    return list(reversed(out))


def dmo_dashboard(conn: sqlite3.Connection, now: datetime) -> dict:
    """月ごとの観光消費額・来訪者数・会えた数（ダミーを含む。dummy も別に返す）。"""
    months = _months_back(now, 6)
    spend = defaultdict(int)
    spend_dummy = defaultdict(int)
    visitors: dict[str, set] = defaultdict(set)
    meetings = defaultdict(int)
    receipts_n = defaultdict(int)
    for r in conn.execute("SELECT received_on, amount, user_id, is_dummy FROM receipts"):
        m = _month(r["received_on"])
        spend[m] += r["amount"]
        if r["is_dummy"]:
            spend_dummy[m] += r["amount"]
        visitors[m].add(r["user_id"])
        receipts_n[m] += 1
    for r in conn.execute("SELECT met_on, user_id FROM meetings"):
        m = _month(r["met_on"])
        meetings[m] += 1
        visitors[m].add(r["user_id"])
    for r in conn.execute("SELECT substr(visited_at,1,10) AS d, user_id FROM spot_visits"):
        visitors[_month(r["d"])].add(r["user_id"])
    by_area = defaultdict(int)
    for r in conn.execute("SELECT s.area, SUM(r.amount) AS total FROM receipts r JOIN shops s ON s.id = r.shop_id GROUP BY s.area"):
        by_area[r["area"]] = r["total"]
    by_category = defaultdict(int)
    for r in conn.execute("SELECT s.category, SUM(r.amount) AS total FROM receipts r JOIN shops s ON s.id = r.shop_id GROUP BY s.category"):
        by_category[r["category"]] = r["total"]
    series = [
        {"month": m, "spend": spend.get(m, 0), "spend_dummy": spend_dummy.get(m, 0), "visitors": len(visitors.get(m, set())), "meetings": meetings.get(m, 0), "receipts": receipts_n.get(m, 0)}
        for m in months
    ]
    cur, prev = series[-1], series[-2] if len(series) > 1 else None
    return {
        "months": months,
        "series": series,
        "by_area": [{"area": a, "total": t} for a, t in sorted(by_area.items())],
        "by_category": [{"category": c, "total": t} for c, t in sorted(by_category.items())],
        "summary": {
            "spend_this_month": cur["spend"], "spend_prev_month": prev["spend"] if prev else 0,
            "visitors_this_month": cur["visitors"], "visitors_prev_month": prev["visitors"] if prev else 0,
            "meetings_this_month": cur["meetings"],
        },
        "note": "値にはダミー履歴を含みます（spend_dummy はそのうちのダミー分）。本番では実データのみ。",
    }


def shop_dashboard(conn: sqlite3.Connection, shop_id: int, now: datetime) -> dict:
    sh = master.shop(conn, shop_id)
    if sh is None:
        raise AppError(404, "shop_not_found", "お店が見つかりません")
    person = conn.execute("SELECT id, name, role FROM people WHERE shop_id = ?", (shop_id,)).fetchone()
    months = _months_back(now, 6)
    my_meet = defaultdict(int)
    my_spend = defaultdict(int)
    my_users: dict[str, set] = defaultdict(set)
    if person:
        for r in conn.execute("SELECT met_on, user_id FROM meetings WHERE person_id = ?", (person["id"],)):
            my_meet[_month(r["met_on"])] += 1
            my_users[_month(r["met_on"])].add(r["user_id"])
    for r in conn.execute("SELECT received_on, amount, user_id FROM receipts WHERE shop_id = ?", (shop_id,)):
        my_spend[_month(r["received_on"])] += r["amount"]
        my_users[_month(r["received_on"])].add(r["user_id"])
    # 地域（同じ地区）と島全体の店平均
    n_shops = max(1, conn.execute("SELECT COUNT(*) FROM shops").fetchone()[0])
    area_shops = max(1, conn.execute("SELECT COUNT(*) FROM shops WHERE area = ?", (sh["area"],)).fetchone()[0])
    all_meet = defaultdict(int)
    area_meet = defaultdict(int)
    all_spend = defaultdict(int)
    area_spend = defaultdict(int)
    for r in conn.execute("SELECT m.met_on, s.area FROM meetings m JOIN people p ON p.id = m.person_id JOIN shops s ON s.id = p.shop_id"):
        all_meet[_month(r["met_on"])] += 1
        if r["area"] == sh["area"]:
            area_meet[_month(r["met_on"])] += 1
    for r in conn.execute("SELECT r.received_on, r.amount, s.area FROM receipts r JOIN shops s ON s.id = r.shop_id"):
        all_spend[_month(r["received_on"])] += r["amount"]
        if r["area"] == sh["area"]:
            area_spend[_month(r["received_on"])] += r["amount"]
    series = [
        {
            "month": m, "meetings": my_meet.get(m, 0), "spend": my_spend.get(m, 0), "visitors": len(my_users.get(m, set())),
            "meetings_area_avg": round(area_meet.get(m, 0) / area_shops, 1), "meetings_island_avg": round(all_meet.get(m, 0) / n_shops, 1),
            "spend_area_avg": round(area_spend.get(m, 0) / area_shops), "spend_island_avg": round(all_spend.get(m, 0) / n_shops),
        }
        for m in months
    ]
    rel = {"first": 0, "again": 0, "regular": 0}
    if person:
        for r in conn.execute("SELECT user_id, COUNT(DISTINCT met_on) AS d FROM meetings WHERE person_id = ? GROUP BY user_id", (person["id"],)):
            rel["first" if r["d"] == 1 else "again" if r["d"] <= 3 else "regular"] += 1
    upcoming = [dict(r) for r in conn.execute("SELECT * FROM events WHERE date >= ? ORDER BY date LIMIT 10", (now.date().isoformat(),))]
    visits = [
        dict(r) for r in conn.execute(
            "SELECT p.target_date AS date, COUNT(DISTINCT p.id) AS plans FROM plans p JOIN plan_items pi ON pi.plan_id = p.id "
            "WHERE pi.kind = 'spot' AND pi.target_id = ? AND p.target_date >= ? GROUP BY p.target_date ORDER BY p.target_date LIMIT 10",
            (sh["spot_id"], now.date().isoformat()),
        )
    ]
    msgs = [dict(r) for r in conn.execute("SELECT * FROM messages WHERE shop_id = ? ORDER BY id DESC LIMIT 10", (shop_id,))]
    coupons_used = conn.execute("SELECT COUNT(*), COALESCE(SUM(face_value),0) FROM coupons WHERE used_shop_id = ?", (shop_id,)).fetchone()
    return {
        "shop": {k: sh.get(k) for k in ("id", "name", "area", "category", "description", "access", "rate_percent", "spot_id", "recommend", "photo_path", "address", "phone", "url", "nearest", "notes", "open_time", "close_time", "closed_weekday")} | {"photo_url": f"/api/shops/{shop_id}/photo" if sh.get("photo_path") else None},
        "person": dict(person) if person else None,
        "months": months, "series": series, "relationships": rel,
        "upcoming_events": upcoming, "upcoming_visits": visits, "messages": msgs,
        "coupons_used": {"count": coupons_used[0], "amount": coupons_used[1]},
        "reach": _reach(conn, shop_id),
    }


def _reach(conn: sqlite3.Connection, shop_id: int) -> int:
    """便りが届く人数 = この店の人に会ったことがある（ダミーでない）利用者。"""
    row = conn.execute(
        "SELECT COUNT(DISTINCT m.user_id) FROM meetings m JOIN people p ON p.id = m.person_id WHERE p.shop_id = ? AND m.is_dummy = 0", (shop_id,)
    ).fetchone()
    return row[0]


def update_shop(conn: sqlite3.Connection, shop_id: int, patch: dict, now: datetime) -> dict:
    sh = master.shop(conn, shop_id)
    if sh is None:
        raise AppError(404, "shop_not_found", "お店が見つかりません")
    keys = ("description", "access", "recommend", "address", "phone", "url", "nearest", "notes", "open_time", "close_time")
    before = {k: sh.get(k) for k in keys}
    after = dict(before)
    for k in keys:
        if patch.get(k) is not None:
            after[k] = patch[k].strip()[:300]
    if "closed_weekday" in patch:
        before["closed_weekday"] = sh.get("closed_weekday")
        after["closed_weekday"] = patch["closed_weekday"]
    if after != before:
        conn.execute(
            "UPDATE shops SET description = ?, access = ?, recommend = ?, address = ?, phone = ?, url = ?, nearest = ?, notes = ?, open_time = ?, close_time = ?, closed_weekday = ? WHERE id = ?",
            (after["description"], after["access"], after["recommend"], after["address"], after["phone"], after["url"], after["nearest"], after["notes"],
             after["open_time"] or sh["open_time"], after["close_time"] or sh["close_time"], after.get("closed_weekday", sh.get("closed_weekday")), shop_id),
        )
        from .admin import _hist
        _hist(conn, now, "shop_edit", f"shop:{shop_id} {sh['name']}", {k: v for k, v in before.items() if before[k] != after[k]}, {k: v for k, v in after.items() if before[k] != after[k]})
    return dict(master.shop(conn, shop_id) or {})


def set_shop_photo(conn: sqlite3.Connection, shop_id: int, data: bytes, now: datetime) -> str:
    sh = master.shop(conn, shop_id)
    if sh is None:
        raise AppError(404, "shop_not_found", "お店が見つかりません")
    if len(data) > settings.receipt_max_bytes:
        raise AppError(413, "image_too_large", "画像は 5MB までです")
    mime, ext = sniff_image(data)
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    path = settings.uploads_dir / f"shop_{shop_id}_{uuid.uuid4().hex[:8]}{ext}"
    path.write_bytes(data)
    conn.execute("UPDATE shops SET photo_path = ? WHERE id = ?", (str(path), shop_id))
    from .admin import _hist
    _hist(conn, now, "shop_photo", f"shop:{shop_id} {sh['name']}", None, {"photo": path.name})
    return mime


def shop_photo_path(conn: sqlite3.Connection, shop_id: int) -> str | None:
    r = conn.execute("SELECT photo_path FROM shops WHERE id = ?", (shop_id,)).fetchone()
    return r["photo_path"] if r and r["photo_path"] else None


# ---- イベントのお知らせ（DMO → 店）
def list_events(conn: sqlite3.Connection, now: datetime) -> list[dict]:
    return [dict(r) for r in conn.execute("SELECT * FROM events WHERE date >= ? ORDER BY date LIMIT 50", ((now.date() - timedelta(days=1)).isoformat(),))]


def add_event(conn: sqlite3.Connection, now: datetime, date_s: str, title: str, kind: str, expected: int | None, note: str | None, source: str) -> dict:
    try:
        date.fromisoformat(date_s)
    except ValueError:
        raise AppError(422, "bad_date", "日付の形式が不正です")
    cur = conn.execute(
        "INSERT INTO events(date, title, kind, expected, note, source, created_at) VALUES(?,?,?,?,?,?,?)",
        (date_s, title.strip()[:60], kind, expected, (note or "").strip()[:200] or None, source, now.isoformat(timespec="seconds")),
    )
    return dict(conn.execute("SELECT * FROM events WHERE id = ?", (cur.lastrowid,)).fetchone())


def delete_event(conn: sqlite3.Connection, event_id: int) -> None:
    conn.execute("DELETE FROM events WHERE id = ?", (event_id,))


# ---- お店からの便り（店 → 旅行者）。クーポンを添えられる。
def send_message(conn: sqlite3.Connection, shop_id: int, now: datetime, title: str, body: str, coupon_face_value: int | None, coupon_days: int | None,
                 stages: list[str] | None = None, seeds: list[str] | None = None) -> dict:
    sh = master.shop(conn, shop_id)
    if sh is None:
        raise AppError(404, "shop_not_found", "お店が見つかりません")
    person = conn.execute("SELECT id, name FROM people WHERE shop_id = ?", (shop_id,)).fetchone()
    from .advice import audience
    recipients = audience(conn, shop_id, now, stages, seeds)["users"]
    cur = conn.execute(
        "INSERT INTO messages(shop_id, title, body, coupon_face_value, coupon_days, created_at, sent_to) VALUES(?,?,?,?,?,?,?)",
        (shop_id, title.strip()[:60], body.strip()[:400], coupon_face_value, coupon_days, now.isoformat(timespec="seconds"), len(recipients)),
    )
    mid = cur.lastrowid
    if coupon_face_value and coupon_days:
        today = now.date()
        for uid in recipients:
            conn.execute(
                "INSERT INTO coupons(user_id, prize_id, category, name, face_value, won_on, valid_from, valid_until) VALUES(?,?,?,?,?,?,?,?)",
                (uid, _message_prize_id(conn), sh["category"], f"{(person['name'] if person else sh['name'])}からの便り: {coupon_face_value} 円引き",
                 coupon_face_value, today.isoformat(), today.isoformat(), (today + timedelta(days=coupon_days)).isoformat()),
            )
    from .admin import _hist
    _hist(conn, now, "message", f"shop:{shop_id} {sh['name']}", None, {"title": title, "sent_to": len(recipients), "coupon": coupon_face_value})
    return dict(conn.execute("SELECT * FROM messages WHERE id = ?", (mid,)).fetchone())


def _message_prize_id(conn: sqlite3.Connection) -> int:
    """便りに添えるクーポン用の商品行（在庫なし・重み 0。抽選には出ない）。"""
    r = conn.execute("SELECT id FROM prizes WHERE name = 'お店からの便り' LIMIT 1").fetchone()
    if r:
        return r["id"]
    cur = conn.execute("INSERT INTO prizes(category, name, face_value, weight, stock, enabled) VALUES('飲食', 'お店からの便り', 0, 0, 0, 0)")
    return cur.lastrowid


def user_messages(conn: sqlite3.Connection, uid: int) -> list[dict]:
    """自分が会ったことのある人の店からの便り。"""
    rows = conn.execute(
        "SELECT ms.*, s.name AS shop_name, s.spot_id, p.name AS person_name, p.svg_key, p.id AS person_id, "
        "(SELECT 1 FROM message_reads mr WHERE mr.message_id = ms.id AND mr.user_id = ?) AS read "
        "FROM messages ms JOIN shops s ON s.id = ms.shop_id LEFT JOIN people p ON p.shop_id = s.id "
        "WHERE ms.shop_id IN (SELECT p2.shop_id FROM meetings m JOIN people p2 ON p2.id = m.person_id WHERE m.user_id = ?) "
        "ORDER BY ms.id DESC",
        (uid, uid),
    ).fetchall()
    out = []
    for r in rows:
        d = dict(r)
        d["read"] = bool(d["read"])
        d["person_image"] = f"/img/people/{d['svg_key']}.png" if d["svg_key"] else None
        d["date"] = d["created_at"][:10]
        out.append(d)
    return out


def mark_read(conn: sqlite3.Connection, uid: int, message_id: int, now: datetime) -> None:
    conn.execute("INSERT OR IGNORE INTO message_reads(message_id, user_id, read_at) VALUES(?,?,?)", (message_id, uid, now.isoformat(timespec="seconds")))
