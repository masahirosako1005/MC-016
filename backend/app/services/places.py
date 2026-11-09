"""場所（7 つの名所）と、そこにいる人。旅前の「計画」と旅中の「マップ」の土台。
場所がメイン、人は「ここにいる人」として添える。順位・件数は出さない。
"""
from __future__ import annotations

import sqlite3
from datetime import datetime

from ..config import settings
from ..repositories import master
from .forecast import current_event, forecast
from .relationship import met_on, relationship
from .season import LABEL, season_of
from .seeds import active_seed, describe

SEASON_ORDER = {"spring": 0, "summer": 1, "autumn": 2, "winter": 3}


def _voices(conn: sqlite3.Connection, t: str, i: int) -> list[dict]:
    return [
        {"id": v["id"], "season": v["season"], "season_label": LABEL[v["season"]], "author": v["author"], "text": v["text"], "hashtags": v["hashtags"]}
        for v in master.voices_for(conn, t, i)
    ]


def person_card(conn: sqlite3.Connection, p: dict, now: datetime, uid: int, with_detail: bool = False) -> dict:
    """people 行（repositories.master.people の形）→ 人カード。"""
    today = now.date()
    season = season_of(today)
    promises = master.promises_of(conn, p["id"])
    cur = next((pr for pr in promises if pr["season"] == season), None)
    met = met_on(conn, uid, p["id"], today.isoformat())
    shop = {"id": p["shop_id"], "name": p["shop_name"], "area": p["area"], "category": p["category"],
            "open_time": p["open_time"], "close_time": p["close_time"], "closed_weekday": p["closed_weekday"],
            "hours": f"{p['open_time']}–{p['close_time']}"}
    card = {
        "id": p["id"], "name": p["name"], "role": p.get("role", "店主"), "intro": p["intro"], "svg_key": p["svg_key"],
        "image": f"/img/people/{p['svg_key']}.png",
        "shop": shop, "spot_id": p["spot_id"],
        "season_note": f"{LABEL[season]}は「{cur['title']}」" if cur else "",
        "current_promise": {"id": cur["id"], "title": cur["title"], "note": cur["note"]} if cur else None,
        "event": current_event(promises, today),
        "forecast": forecast(shop, now),
        "met_today": met,
        "relationship": relationship(conn, uid, p["id"]),
        "seed": describe(active_seed(conn, uid, p["id"]), today, met),
    }
    if with_detail:
        card["promises"] = [
            {"id": pr["id"], "season": pr["season"], "season_label": LABEL[pr["season"]], "title": pr["title"], "note": pr["note"],
             "start_md": pr["start_md"], "end_md": pr["end_md"], "current": pr["season"] == season}
            for pr in promises
        ]
        card["voices"] = _voices(conn, "shop", p["shop_id"])
        card["shop"]["description"] = conn.execute("SELECT description FROM shops WHERE id = ?", (p["shop_id"],)).fetchone()[0]
        card["shop"]["rate_percent"] = conn.execute("SELECT rate_percent FROM shops WHERE id = ?", (p["shop_id"],)).fetchone()[0]
        card["photos"] = [
            {"id": r["id"], "taken_on": r["taken_on"], "url": f"/api/photos/{r['id']}/image"}
            for r in conn.execute("SELECT id, taken_on FROM photos WHERE person_id = ? ORDER BY id DESC LIMIT 6", (p["id"],))
        ]
        card["fulfilled"] = [
            {"title": r["title"], "season_label": LABEL[r["season"]], "fulfilled_on": r["fulfilled_on"]}
            for r in conn.execute(
                "SELECT s.season, s.fulfilled_on, pr.title FROM seeds s JOIN promises pr ON pr.id = s.promise_id WHERE s.user_id = ? AND s.person_id = ? AND s.fulfilled_on IS NOT NULL ORDER BY s.fulfilled_on",
                (uid, p["id"]),
            )
        ]
    return card


def place_card(conn: sqlite3.Connection, s: dict, now: datetime, uid: int, plan_ids: set[int], with_detail: bool = False) -> dict:
    people = [person_card(conn, p, now, uid) for p in master.people(conn) if p["spot_id"] == s["id"]]
    # 場所の「会えそう」は中の人の状態から集約
    statuses = [p["forecast"]["status"] for p in people]
    if any(st in ("open", "closing_soon") for st in statuses):
        status = "open"
        status_label = "いま会えそう"
    elif any(st == "not_yet" for st in statuses):
        status = "not_yet"
        status_label = "まだ開いていない"
    else:
        status = "closed"
        status_label = "きょうはお休み"
    shop_photo = next((sh["id"] for sh in master.shops(conn) if sh["spot_id"] == s["id"] and sh.get("photo_path")), None)
    card = {
        "id": s["id"], "name": s["name"].split("（")[0], "full_name": s["name"], "area": s["area"], "svg_key": s["svg_key"],
        "image": f"/api/shops/{shop_photo}/photo" if shop_photo else f"/img/places/{s['svg_key']}.jpg",
        "recommend": next((sh["recommend"] for sh in master.shops(conn) if sh["spot_id"] == s["id"] and sh.get("recommend")), None),
        "description": s["description"], "access": s["access"],
        "best_season": s["best_season"], "best_season_label": LABEL[s["best_season"]],
        "map_x": s["map_x"], "map_y": s["map_y"],
        "in_plan": s["id"] in plan_ids,
        "people": people,
        "status": status, "status_label": status_label,
        "met_today": any(p["met_today"] for p in people),
    }
    if with_detail:
        card["voices"] = _voices(conn, "spot", s["id"])
        card["photos"] = [
            {"id": r["id"], "taken_on": r["taken_on"], "url": f"/api/photos/{r['id']}/image", "is_sample": bool(r["is_sample"])}
            for r in conn.execute(
                "SELECT ph.id, ph.taken_on, ph.is_sample FROM photos ph LEFT JOIN people pe ON pe.id = ph.person_id LEFT JOIN shops sh ON sh.id = pe.shop_id "
                "WHERE ph.user_id = ? AND (ph.spot_id = ? OR sh.spot_id = ?) ORDER BY ph.id DESC LIMIT 6",
                (uid, s["id"], s["id"]),
            )
        ]
    return card


def plan_spot_ids(conn: sqlite3.Connection, uid: int) -> set[int]:
    row = conn.execute("SELECT id FROM plans WHERE user_id = ? AND archived = 0 ORDER BY id DESC LIMIT 1", (uid,)).fetchone()
    if not row:
        return set()
    return {r["target_id"] for r in conn.execute("SELECT target_id FROM plan_items WHERE plan_id = ? AND kind = 'spot'", (row["id"],))}


def _matches(card: dict, q: str) -> bool:
    if not q:
        return True
    q = q.lower()
    hay = [card["full_name"], card["area"], card["description"], card["access"], card["best_season_label"]]
    for p in card["people"]:
        hay += [p["name"], p["role"], p["shop"]["name"], p["season_note"], p["intro"]]
    return any(q in (h or "").lower() for h in hay)


def places_view(conn: sqlite3.Connection, now: datetime, q: str = "", area: str = "", season: str = "") -> dict:
    uid = settings.hero_user_id
    plan_ids = plan_spot_ids(conn, uid)
    cards = [place_card(conn, s, now, uid, plan_ids) for s in master.spots(conn)]
    out = []
    for c in cards:
        if area and c["area"] != area:
            continue
        if season and c["best_season"] != season and not any(
            any(pr["season"] == season for pr in master.promises_of(conn, p["id"])) for p in c["people"]
        ):
            continue
        if not _matches(c, q):
            continue
        out.append(c)
    # 並びは固定（見ごろの季節 → id）。人気順にはしない
    out.sort(key=lambda c: (0 if c["in_plan"] else 1, SEASON_ORDER[c["best_season"]], c["id"]))
    return {
        "season": season_of(now.date()),
        "season_label": LABEL[season_of(now.date())],
        "areas": [s["area"] for s in master.spots(conn)],
        "places": out,
        "map": [{"id": c["id"], "name": c["name"], "map_x": c["map_x"], "map_y": c["map_y"], "in_plan": c["in_plan"],
                 "people": [{"id": p["id"], "svg_key": p["svg_key"], "image": p["image"], "status": p["forecast"]["status"], "met_today": p["met_today"]} for p in c["people"]]}
                for c in cards],
        "note": "「旅人の声」はデモ用の内部データです。本番では SNS 公式 API 等に差し替える前提です。",
    }


def place_detail(conn: sqlite3.Connection, now: datetime, spot_id: int) -> dict | None:
    s = master.spot(conn, spot_id)
    if s is None:
        return None
    uid = settings.hero_user_id
    return place_card(conn, s, now, uid, plan_spot_ids(conn, uid), with_detail=True)


def person_detail(conn: sqlite3.Connection, now: datetime, person_id: int) -> dict | None:
    p = next((x for x in master.people(conn) if x["id"] == person_id), None)
    if p is None:
        return None
    uid = settings.hero_user_id
    card = person_card(conn, p, now, uid, with_detail=True)
    s = master.spot(conn, p["spot_id"])
    card["place"] = {"id": s["id"], "name": s["name"].split("（")[0], "area": s["area"], "svg_key": s["svg_key"], "image": f"/img/places/{s['svg_key']}.jpg",
                     "in_plan": s["id"] in plan_spot_ids(conn, uid)} if s else None
    return card
