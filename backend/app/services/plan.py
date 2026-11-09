"""つぎの旅（計画）。利用者につき有効な計画は 1 つ。"""
from __future__ import annotations

import sqlite3
from datetime import date, datetime

from ..errors import AppError
from ..repositories import master
from .season import LABEL, WEEKDAY_JA, season_of


def active_plan_id(conn: sqlite3.Connection, uid: int, create: bool, now: datetime) -> int | None:
    r = conn.execute("SELECT id FROM plans WHERE user_id = ? AND archived = 0 ORDER BY id DESC LIMIT 1", (uid,)).fetchone()
    if r:
        return r["id"]
    if not create:
        return None
    cur = conn.execute("INSERT INTO plans(user_id, target_date, created_at) VALUES(?, NULL, ?)", (uid, now.isoformat(timespec="seconds")))
    return cur.lastrowid


def plan_view(conn: sqlite3.Connection, uid: int, now: datetime) -> dict:
    pid = active_plan_id(conn, uid, False, now)
    today = now.date()
    if pid is None:
        return {"exists": False, "target_date": None, "weekday": None, "days_until": None, "items": [], "people_that_day": [], "seeds_in_season": [], "coupons_usable": [], "season_label": None}
    plan = conn.execute("SELECT * FROM plans WHERE id = ?", (pid,)).fetchone()
    items = []
    people_all = master.people(conn)
    for it in conn.execute("SELECT * FROM plan_items WHERE plan_id = ? ORDER BY id", (pid,)):
        if it["kind"] == "spot":
            m = master.spot(conn, it["target_id"])
            if m:
                ppl = [{"id": p["id"], "name": p["name"], "role": p.get("role", "店主"), "svg_key": p["svg_key"], "image": f"/img/people/{p['svg_key']}.png", "shop_name": p["shop_name"]}
                       for p in people_all if p["spot_id"] == m["id"]]
                items.append({"kind": "spot", "id": m["id"], "name": m["name"].split("（")[0], "full_name": m["name"], "area": m["area"], "svg_key": m["svg_key"],
                              "image": f"/img/places/{m['svg_key']}.jpg", "category": "場所", "source": it["source"], "people": ppl})
        else:
            m = master.shop(conn, it["target_id"])
            if m:
                items.append({"kind": "shop", "id": m["id"], "name": m["name"], "area": m["area"], "svg_key": m["svg_key"], "image": None, "category": m["category"], "source": it["source"], "people": []})
    target = date.fromisoformat(plan["target_date"]) if plan["target_date"] else None
    season = season_of(target) if target else None
    seeds = []
    if season:
        for s in conn.execute(
            "SELECT s.id, s.season, p.title, pe.name AS person_name FROM seeds s JOIN promises p ON p.id = s.promise_id JOIN people pe ON pe.id = s.person_id "
            "WHERE s.user_id = ? AND s.fulfilled_on IS NULL AND s.season = ?",
            (uid, season),
        ):
            seeds.append({"id": s["id"], "title": s["title"], "person_name": s["person_name"], "season_label": LABEL[s["season"]]})
    coupons = []
    if target:
        for c in conn.execute(
            "SELECT id, category, name, face_value FROM coupons WHERE user_id = ? AND used_on IS NULL AND valid_from <= ? AND valid_until >= ? ORDER BY id",
            (uid, target.isoformat(), target.isoformat()),
        ):
            coupons.append(dict(c))
    # その日に会えそうな人（定休日だけで判定。時刻は分からないので営業時間は見ない）
    people_that_day = []
    if target:
        wd = target.weekday()
        for it in items:
            for p in it.get("people", []):
                row = next((x for x in people_all if x["id"] == p["id"]), None)
                if row is None:
                    continue
                closed = row["closed_weekday"] is not None and int(row["closed_weekday"]) == wd
                people_that_day.append(dict(p, place_name=it["name"], available=not closed,
                                            note=("その日は定休日" if closed else f"{row['open_time']}–{row['close_time']}")))
    return {
        "exists": True,
        "id": pid,
        "target_date": plan["target_date"],
        "weekday": WEEKDAY_JA[target.weekday()] if target else None,
        "days_until": (target - today).days if target else None,
        "season_label": LABEL[season] if season else None,
        "items": items,
        "people_that_day": people_that_day,
        "seeds_in_season": seeds,
        "coupons_usable": coupons,
    }


def set_target(conn: sqlite3.Connection, uid: int, now: datetime, target_date: str | None) -> None:
    pid = active_plan_id(conn, uid, True, now)
    if target_date:
        try:
            date.fromisoformat(target_date)
        except ValueError:
            raise AppError(422, "bad_date", "日付の形式が不正です")
    conn.execute("UPDATE plans SET target_date = ? WHERE id = ?", (target_date, pid))


def add_item(conn: sqlite3.Connection, uid: int, now: datetime, kind: str, target_id: int, source: str = "manual") -> bool:
    if kind not in ("spot", "shop"):
        raise AppError(422, "bad_kind", "種類が不正です")
    exists = master.spot(conn, target_id) if kind == "spot" else master.shop(conn, target_id)
    if not exists:
        raise AppError(404, "target_not_found", "場所が見つかりません")
    pid = active_plan_id(conn, uid, True, now)
    cur = conn.execute(
        "INSERT OR IGNORE INTO plan_items(plan_id, kind, target_id, source, created_at) VALUES(?,?,?,?,?)",
        (pid, kind, target_id, source, now.isoformat(timespec="seconds")),
    )
    return cur.rowcount > 0


def remove_item(conn: sqlite3.Connection, uid: int, now: datetime, kind: str, target_id: int) -> None:
    pid = active_plan_id(conn, uid, False, now)
    if pid is None:
        return
    conn.execute("DELETE FROM plan_items WHERE plan_id = ? AND kind = ? AND target_id = ?", (pid, kind, target_id))


def archive_if_done(conn: sqlite3.Connection, uid: int, now: datetime) -> None:
    """予定日を過ぎた計画は旅の後に閉じる（指標「つぎの旅→来訪」に使う）。"""
    conn.execute(
        "UPDATE plans SET archived = 1 WHERE user_id = ? AND archived = 0 AND target_date IS NOT NULL AND target_date < ?",
        (uid, now.date().isoformat()),
    )
