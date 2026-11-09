"""しらべる（旅前）。スポットと店のカード、旅人の声、季節の約束。件数・順位は出さない。"""
from __future__ import annotations

import sqlite3
from datetime import datetime

from ..repositories import master
from .forecast import forecast
from .season import LABEL, season_of

CATEGORY_CHIPS = ["景色", "飲食", "宿泊", "体験", "物販"]
SEASON_ORDER = {"spring": 0, "summer": 1, "autumn": 2, "winter": 3}


def _voices(conn: sqlite3.Connection, t: str, i: int) -> list[dict]:
    return [
        {"id": v["id"], "season": v["season"], "season_label": LABEL[v["season"]], "author": v["author"], "text": v["text"], "hashtags": v["hashtags"]}
        for v in master.voices_for(conn, t, i)
    ]


def _person_block(conn: sqlite3.Connection, shop_id: int) -> dict | None:
    p = conn.execute("SELECT * FROM people WHERE shop_id = ?", (shop_id,)).fetchone()
    if not p:
        return None
    promises = [
        {"id": pr["id"], "season": pr["season"], "season_label": LABEL[pr["season"]], "title": pr["title"], "note": pr["note"],
         "start_md": pr["start_md"], "end_md": pr["end_md"]}
        for pr in master.promises_of(conn, p["id"])
    ]
    return {"id": p["id"], "name": p["name"], "intro": p["intro"], "svg_key": p["svg_key"], "promises": promises}


def spot_card(conn: sqlite3.Connection, s: dict, now: datetime, with_detail: bool) -> dict:
    shops = [sh for sh in master.shops(conn) if sh["spot_id"] == s["id"]]
    card = {
        "kind": "spot", "id": s["id"], "name": s["name"], "area": s["area"], "svg_key": s["svg_key"],
        "description": s["description"], "access": s["access"], "best_season": s["best_season"],
        "best_season_label": LABEL[s["best_season"]], "category": "景色",
        "map_x": s["map_x"], "map_y": s["map_y"],
        "shops": [{"id": sh["id"], "name": sh["name"], "category": sh["category"]} for sh in shops],
        "voices": _voices(conn, "spot", s["id"]),
    }
    if with_detail:
        card["photos"] = _photos(conn, "spot", s["id"])
    return card


def shop_card(conn: sqlite3.Connection, sh: dict, now: datetime, with_detail: bool) -> dict:
    card = {
        "kind": "shop", "id": sh["id"], "name": sh["name"], "area": sh["area"], "svg_key": sh["svg_key"],
        "description": sh["description"], "access": sh["access"], "best_season": sh["best_season"],
        "best_season_label": LABEL[sh["best_season"]], "category": sh["category"], "spot_id": sh["spot_id"],
        "is_unmanned": bool(sh["is_unmanned"]), "hours": f"{sh['open_time']}–{sh['close_time']}",
        "closed_weekday": sh["closed_weekday"], "forecast": forecast(sh, now),
        "person": _person_block(conn, sh["id"]),
        "voices": _voices(conn, "shop", sh["id"]),
    }
    if with_detail:
        card["photos"] = _photos(conn, "shop", sh["id"])
    return card


def _photos(conn: sqlite3.Connection, kind: str, target_id: int) -> list[dict]:
    if kind == "spot":
        rows = conn.execute("SELECT id, taken_on, is_sample FROM photos WHERE spot_id = ? ORDER BY id DESC LIMIT 6", (target_id,)).fetchall()
    else:
        rows = conn.execute(
            "SELECT ph.id, ph.taken_on, ph.is_sample FROM photos ph JOIN people pe ON pe.id = ph.person_id WHERE pe.shop_id = ? ORDER BY ph.id DESC LIMIT 6",
            (target_id,),
        ).fetchall()
    return [{"id": r["id"], "taken_on": r["taken_on"], "is_sample": bool(r["is_sample"]), "url": f"/api/photos/{r['id']}/image"} for r in rows]


def _matches(card: dict, q: str) -> bool:
    if not q:
        return True
    q = q.lower()
    hay = [card["name"], card["area"], card["description"], card["access"], card["category"], card["best_season_label"]]
    hay += [v["text"] + " " + v["hashtags"] for v in card["voices"]]
    if card.get("person"):
        hay.append(card["person"]["name"])
        hay += [p["title"] for p in card["person"]["promises"]]
    return any(q in (h or "").lower() for h in hay)


def explore_view(conn: sqlite3.Connection, now: datetime, q: str = "", area: str = "", season: str = "", category: str = "") -> dict:
    cards = [spot_card(conn, s, now, False) for s in master.spots(conn)] + [shop_card(conn, sh, now, False) for sh in master.shops(conn)]
    out = []
    for c in cards:
        if area and c["area"] != area:
            continue
        if category and c["category"] != category:
            continue
        if season and not (c["best_season"] == season or any(v["season"] == season for v in c["voices"])):
            continue
        if not _matches(c, q):
            continue
        if season:
            c = dict(c, voices=[v for v in c["voices"] if v["season"] == season] or c["voices"])
        out.append(c)
    # 並びは固定: 季節 → 地区 → id（人気順・件数順にはしない）
    out.sort(key=lambda c: (SEASON_ORDER[c["best_season"]], c["area"], 0 if c["kind"] == "spot" else 1, c["id"]))
    areas = sorted({s["area"] for s in master.spots(conn)})
    return {
        "season": season_of(now.date()),
        "season_label": LABEL[season_of(now.date())],
        "areas": areas,
        "categories": CATEGORY_CHIPS,
        "cards": out,
        "spots_for_map": [{"id": s["id"], "name": s["name"], "area": s["area"], "map_x": s["map_x"], "map_y": s["map_y"], "svg_key": s["svg_key"]} for s in master.spots(conn)],
        "note": "「SNS で見かけた声」はデモ用の内部データです。本番では SNS 公式 API 等に差し替える前提です。",
    }


def place_detail(conn: sqlite3.Connection, now: datetime, kind: str, target_id: int) -> dict | None:
    if kind == "spot":
        s = master.spot(conn, target_id)
        return spot_card(conn, s, now, True) if s else None
    sh = master.shop(conn, target_id)
    return shop_card(conn, sh, now, True) if sh else None
