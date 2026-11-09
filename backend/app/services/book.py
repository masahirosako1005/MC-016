"""ひとめぐり帖: 人と関係・種と花・アルバム・過去の旅。格付けや順位は出さない。"""
from __future__ import annotations

import sqlite3
from datetime import date, datetime

from ..config import settings
from ..repositories import master
from .letters import activity_days
from .photos import album
from .relationship import met_on, relationship
from .season import LABEL, WEEKDAY_JA, season_of
from .seeds import active_seed, describe, fulfilled_seeds
from .trips import cluster_trips


def book_view(conn: sqlite3.Connection, uid: int, now: datetime) -> dict:
    today = now.date()
    day = today.isoformat()
    people = []
    for p in master.people(conn):
        met_today = met_on(conn, uid, p["id"], day)
        days = [r["met_on"] for r in conn.execute("SELECT met_on FROM meetings WHERE user_id = ? AND person_id = ? ORDER BY met_on", (uid, p["id"]))]
        people.append({
            "id": p["id"], "name": p["name"], "intro": p["intro"], "svg_key": p["svg_key"], "image": f"/img/people/{p['svg_key']}.png", "role": p.get("role", "店主"),
            "shop": {"id": p["shop_id"], "name": p["shop_name"], "area": p["area"]},
            "relationship": relationship(conn, uid, p["id"]),
            "met_days": days, "met_today": met_today,
            "seed": describe(active_seed(conn, uid, p["id"]), today, met_today),
            "fulfilled": [{"title": f["title"], "season_label": LABEL[f["season"]], "fulfilled_on": f["fulfilled_on"]} for f in fulfilled_seeds(conn, uid, p["id"])],
        })
    # 会えた人を先に（順位ではなく、会ったかどうかの区分）
    people.sort(key=lambda x: (0 if x["relationship"]["days"] > 0 else 1, x["id"]))

    days = activity_days(conn, uid)
    trips = []
    for start, end in reversed(cluster_trips(days, settings.trip_gap_days)):
        s, e = start.isoformat(), end.isoformat()
        spot_names = {r["spot_name"] for r in conn.execute("SELECT spot_name FROM spot_visits WHERE user_id = ? AND substr(visited_at,1,10) BETWEEN ? AND ?", (uid, s, e))}
        spot_names |= {r["name"] for r in conn.execute("SELECT sp.name FROM spot_checkins c JOIN spots sp ON sp.id = c.spot_id WHERE c.user_id = ? AND c.day BETWEEN ? AND ?", (uid, s, e))}
        spot_names |= {
            r["name"] for r in conn.execute(
                "SELECT DISTINCT sp.name FROM meetings m JOIN people p ON p.id = m.person_id JOIN shops sh ON sh.id = p.shop_id JOIN spots sp ON sp.id = sh.spot_id WHERE m.user_id = ? AND m.met_on BETWEEN ? AND ?",
                (uid, s, e),
            )
        }
        ppl = [r["name"] for r in conn.execute("SELECT DISTINCT p.name FROM meetings m JOIN people p ON p.id = m.person_id WHERE m.user_id = ? AND m.met_on BETWEEN ? AND ? ORDER BY p.id", (uid, s, e))]
        n_photos = conn.execute("SELECT COUNT(*) FROM photos WHERE user_id = ? AND taken_on BETWEEN ? AND ?", (uid, s, e)).fetchone()[0]
        total = conn.execute("SELECT COALESCE(SUM(amount),0) FROM receipts WHERE user_id = ? AND received_on BETWEEN ? AND ? AND is_dummy = 0", (uid, s, e)).fetchone()[0]
        trips.append({
            "start": s, "end": e, "days": (end - start).days + 1, "season_label": LABEL[season_of(start)],
            "weekday_start": WEEKDAY_JA[start.weekday()],
            "spots": sorted(x.split("（")[0] for x in spot_names), "people": ppl, "photos": n_photos, "spent": total,
            "current": start <= today <= end,
        })
    return {
        "today": day, "season_label": LABEL[season_of(today)],
        "people": people,
        "album": album(conn, uid),
        "trips": trips,
    }


def _unused(_: date) -> None:  # pragma: no cover
    pass
