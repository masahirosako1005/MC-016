"""きょう: 今日会えそうなお店の人の予報、スポット、計画の品目。"""
from __future__ import annotations

import sqlite3
from datetime import datetime

from ..config import settings
from ..repositories import master
from .forecast import current_event, forecast, sort_key
from .relationship import met_on, relationship
from .season import WEEKDAY_JA, LABEL, season_of
from .seeds import active_seed, describe


def today_view(conn: sqlite3.Connection, now: datetime) -> dict:
    uid = settings.hero_user_id
    today = now.date()
    day = today.isoformat()
    season = season_of(today)
    plan_ids = _plan_targets(conn, uid, day)

    people_items = []
    for p in master.people(conn):
        shop = {k: p[k] for k in ("open_time", "close_time", "closed_weekday")}
        promises = master.promises_of(conn, p["id"])
        met = met_on(conn, uid, p["id"], day)
        item = {
            "person": {"id": p["id"], "name": p["name"], "intro": p["intro"], "svg_key": p["svg_key"]},
            "shop": {"id": p["shop_id"], "name": p["shop_name"], "area": p["area"], "category": p["category"],
                     "spot_id": p["spot_id"], "svg_key": p["shop_svg_key"]},
            "forecast": forecast(shop, now),
            "event": current_event(promises, today),
            "met_today": met,
            "relationship": relationship(conn, uid, p["id"]),
            "seed": describe(active_seed(conn, uid, p["id"]), today, met),
            "in_plan": ("shop", p["shop_id"]) in plan_ids,
        }
        people_items.append(item)
    people_items.sort(key=lambda it: (0 if it["in_plan"] else 1,) + sort_key(it))

    checked = {r["spot_id"] for r in conn.execute("SELECT spot_id FROM spot_checkins WHERE user_id = ? AND day = ?", (uid, day))}
    spots = []
    for s in master.spots(conn):
        spots.append({"id": s["id"], "name": s["name"], "area": s["area"], "svg_key": s["svg_key"],
                      "checked_in_today": s["id"] in checked, "in_plan": ("spot", s["id"]) in plan_ids})
    spots.sort(key=lambda x: (0 if x["in_plan"] else 1, x["id"]))

    unmanned = []
    for sh in master.shops(conn):
        if sh["is_unmanned"]:
            unmanned.append({"id": sh["id"], "name": sh["name"], "area": sh["area"], "category": sh["category"],
                             "svg_key": sh["svg_key"], "forecast": forecast(sh, now), "in_plan": ("shop", sh["id"]) in plan_ids})

    activity_today = bool(
        conn.execute("SELECT 1 FROM meetings WHERE user_id = ? AND met_on = ? LIMIT 1", (uid, day)).fetchone()
        or conn.execute("SELECT 1 FROM receipts WHERE user_id = ? AND received_on = ? LIMIT 1", (uid, day)).fetchone()
        or checked
    )
    return {
        "now": now.isoformat(timespec="seconds"),
        "date": day,
        "weekday": WEEKDAY_JA[now.weekday()],
        "season": season,
        "season_label": LABEL[season],
        "plan_today": bool(plan_ids),
        "people": people_items,
        "spots": spots,
        "unmanned_shops": unmanned,
        "activity_today": activity_today,
        "letter_ready": activity_today and now.hour >= settings.letter_open_hour,
    }


def _plan_targets(conn: sqlite3.Connection, uid: int, day: str) -> set[tuple[str, int]]:
    plan = conn.execute(
        "SELECT id FROM plans WHERE user_id = ? AND archived = 0 AND target_date = ? ORDER BY id DESC LIMIT 1", (uid, day)
    ).fetchone()
    if not plan:
        return set()
    return {(r["kind"], r["target_id"]) for r in conn.execute("SELECT kind, target_id FROM plan_items WHERE plan_id = ?", (plan["id"],))}
