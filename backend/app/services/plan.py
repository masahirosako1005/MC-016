"""つぎの旅（計画）。利用者につき有効な計画は 1 つ。"""
from __future__ import annotations

import sqlite3
from datetime import date, datetime, timedelta

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
        return {"exists": False, "title": None, "target_date": None, "weekday": None, "days_until": None, "items": [], "people_that_day": [], "seeds_in_season": [], "coupons_usable": [], "season_label": None}
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
        "title": plan["title"],
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


def _visited_spot_ids(conn: sqlite3.Connection, uid: int, target_date: str | None) -> set[int]:
    """その旅（予定日の前後 2 日）に会えた人・レシートの店がある場所。"""
    if not target_date:
        return set()
    d = date.fromisoformat(target_date)
    s, e = (d - timedelta(days=2)).isoformat(), (d + timedelta(days=2)).isoformat()
    ids = {
        r["spot_id"] for r in conn.execute(
            "SELECT sh.spot_id FROM meetings m JOIN people p ON p.id = m.person_id JOIN shops sh ON sh.id = p.shop_id WHERE m.user_id = ? AND m.met_on BETWEEN ? AND ?",
            (uid, s, e),
        )
    }
    ids |= {r["spot_id"] for r in conn.execute("SELECT sh.spot_id FROM receipts r JOIN shops sh ON sh.id = r.shop_id WHERE r.user_id = ? AND r.received_on BETWEEN ? AND ?", (uid, s, e))}
    return ids


def plan_history(conn: sqlite3.Connection, uid: int, now: datetime) -> dict:
    """旅のプラン一覧。終わった旅は「行けた／行けなかった」を付ける。"""
    archive_if_done(conn, uid, now)
    out = []
    for p in conn.execute("SELECT * FROM plans WHERE user_id = ? AND is_dummy = 0 ORDER BY archived ASC, id DESC", (uid,)):
        items = []
        visited = _visited_spot_ids(conn, uid, p["target_date"]) if p["archived"] else set()
        for it in conn.execute("SELECT * FROM plan_items WHERE plan_id = ? AND kind = 'spot' ORDER BY id", (p["id"],)):
            sp = master.spot(conn, it["target_id"])
            if sp:
                items.append({"id": sp["id"], "name": sp["name"].split("（")[0], "image": f"/img/places/{sp['svg_key']}.jpg", "visited": sp["id"] in visited})
        out.append({
            "id": p["id"], "title": p["title"] or ("つぎの旅" if not p["archived"] else "旅"), "target_date": p["target_date"],
            "weekday": WEEKDAY_JA[date.fromisoformat(p["target_date"]).weekday()] if p["target_date"] else None,
            "archived": bool(p["archived"]), "created_at": p["created_at"], "items": items,
            "unvisited": [i for i in items if not i["visited"]] if p["archived"] else [],
        })
    # 行けなかった場所（終わった旅から。いまの計画に入っていないもの）
    active = next((p for p in out if not p["archived"]), None)
    active_ids = {i["id"] for i in active["items"]} if active else set()
    leftovers: dict[int, dict] = {}
    for p in out:
        if p["archived"]:
            for i in p["unvisited"]:
                if i["id"] not in active_ids and i["id"] not in leftovers:
                    leftovers[i["id"]] = dict(i, from_title=p["title"], from_date=p["target_date"])
    return {"plans": out, "active": active, "leftovers": list(leftovers.values())}


def new_plan(conn: sqlite3.Connection, uid: int, now: datetime, title: str | None) -> int:
    """いまの計画を閉じて、新しい旅をつくる。"""
    conn.execute("UPDATE plans SET archived = 1 WHERE user_id = ? AND archived = 0", (uid,))
    cur = conn.execute("INSERT INTO plans(user_id, target_date, created_at, title) VALUES(?, NULL, ?, ?)", (uid, now.isoformat(timespec="seconds"), (title or "").strip()[:30] or None))
    return cur.lastrowid


def set_title(conn: sqlite3.Connection, uid: int, now: datetime, title: str) -> None:
    pid = active_plan_id(conn, uid, True, now)
    conn.execute("UPDATE plans SET title = ? WHERE id = ?", (title.strip()[:30] or None, pid))
