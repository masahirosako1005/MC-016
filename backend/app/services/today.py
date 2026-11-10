"""マップ（旅中）: 場所ごとに、そこにいる人。計画の場所を先頭に。"""
from __future__ import annotations

import sqlite3
from datetime import datetime

from ..config import settings
from ..repositories import master
from .places import place_card, plan_spot_ids
from .season import LABEL, WEEKDAY_JA, season_of


def today_view(conn: sqlite3.Connection, now: datetime) -> dict:
    uid = settings.hero_user_id
    today = now.date()
    day = today.isoformat()
    season = season_of(today)
    from .plan import archive_if_done
    archive_if_done(conn, uid, now)
    plan_ids = plan_spot_ids(conn, uid)
    plan = conn.execute("SELECT target_date FROM plans WHERE user_id = ? AND archived = 0 ORDER BY id DESC LIMIT 1", (uid,)).fetchone()
    plan_today = bool(plan and plan["target_date"] == day)

    places = [place_card(conn, s, now, uid, plan_ids) for s in master.spots(conn)]
    order = {"open": 0, "not_yet": 1, "closed": 2}
    places.sort(key=lambda c: (0 if c["in_plan"] else 1, order[c["status"]], c["id"]))

    people = [p for c in places for p in c["people"]]
    met_today = [p for p in people if p["met_today"]]
    activity_today = bool(
        met_today
        or conn.execute("SELECT 1 FROM receipts WHERE user_id = ? AND received_on = ? LIMIT 1", (uid, day)).fetchone()
        or conn.execute("SELECT 1 FROM photos WHERE user_id = ? AND taken_on = ? LIMIT 1", (uid, day)).fetchone()
    )
    letter_ready = activity_today and now.hour >= settings.letter_open_hour

    # いまやること（主ボタン 1 つ）
    if letter_ready:
        todo = {"kind": "letter", "text": "今夜のおもいで便が届いています", "button": "便を開く", "path": "/memories/letters"}
    elif plan_ids:
        first = next((c for c in places if c["in_plan"] and not c["met_today"]), None)
        if first and first["people"]:
            todo = {"kind": "meet", "text": f"{first['name']}に着いたら、{first['people'][0]['name']}に会えたら「会えた」を押しましょう", "button": None, "path": None, "place_id": first["id"]}
        else:
            todo = {"kind": "done", "text": "計画の場所はぜんぶ回れました。レシートを登録してポイントをもらいましょう", "button": "レシートを登録", "path": "/wallet?receipt=1"}
    else:
        todo = {"kind": "explore", "text": "地図の場所をタップして、そこにいる人に会いに行きましょう", "button": "行きたい場所を決める", "path": "/plan"}

    return {
        "now": now.isoformat(timespec="seconds"),
        "date": day,
        "weekday": WEEKDAY_JA[now.weekday()],
        "season": season,
        "season_label": LABEL[season],
        "plan_today": plan_today,
        "has_plan": bool(plan_ids),
        "places": places,
        "met_today": [{"id": p["id"], "name": p["name"]} for p in met_today],
        "activity_today": activity_today,
        "letter_ready": letter_ready,
        "todo": todo,
    }
