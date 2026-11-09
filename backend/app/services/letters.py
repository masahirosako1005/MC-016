"""おもいで便。中身は保存せず、開くたびに記録から組み立てる。
保存するのは一言日記（140 字）と「行きたい」だけ。
- 活動日（会えた・行けた・レシート・写真・スポット訪問）の 18:00 以降に、その日の便が開ける。
- 旅（活動日の間隔 2 日以内）の最終日 + 30 日以降は、同じ便が「もう一度届く」。
  行きたいを先頭に出し、次の季節まで あと N 週間 を添える。
"""
from __future__ import annotations

import sqlite3
from datetime import date, datetime, timedelta

from ..config import settings
from ..errors import AppError
from ..repositories import master
from .relationship import relationship
from .season import LABEL, WEEKDAY_JA, next_season, season_of, season_start_after, weeks_until_next_season
from .trips import cluster_trips


def activity_days(conn: sqlite3.Connection, uid: int) -> set[date]:
    days: set[date] = set()
    for sql in (
        "SELECT met_on AS d FROM meetings WHERE user_id = ? AND is_dummy = 0",
        "SELECT day AS d FROM spot_checkins WHERE user_id = ?",
        "SELECT received_on AS d FROM receipts WHERE user_id = ? AND is_dummy = 0",
        "SELECT taken_on AS d FROM photos WHERE user_id = ?",
        "SELECT substr(visited_at, 1, 10) AS d FROM spot_visits WHERE user_id = ?",
    ):
        for r in conn.execute(sql, (uid,)):
            days.add(date.fromisoformat(r["d"]))
    return days


def letters_index(conn: sqlite3.Connection, uid: int, now: datetime) -> dict:
    days = activity_days(conn, uid)
    today = now.date()
    trips = cluster_trips(days, settings.trip_gap_days)
    wished = {(w["kind"], w["target_type"], w["target_id"]) for w in conn.execute("SELECT kind, target_type, target_id FROM wishes WHERE user_id = ?", (uid,))}
    items = []
    for start, end in trips:
        redelivered = today >= end + timedelta(days=30)
        for d in sorted(x for x in days if start <= x <= end):
            available = d < today or (d == today and now.hour >= settings.letter_open_hour)
            if not available:
                continue
            opened = conn.execute("SELECT 1 FROM letter_opens WHERE user_id = ? AND letter_day = ? LIMIT 1", (uid, d.isoformat())).fetchone() is not None
            items.append({
                "day": d.isoformat(), "weekday": WEEKDAY_JA[d.weekday()], "season_label": LABEL[season_of(d)],
                "trip_start": start.isoformat(), "trip_end": end.isoformat(),
                "redelivered": redelivered, "opened": opened,
                "summary": _summary(conn, uid, d),
            })
    items.sort(key=lambda x: x["day"], reverse=True)
    pending_today = today in days and now.hour < settings.letter_open_hour
    return {
        "letters": items,
        "pending_today": pending_today,
        "open_hour": settings.letter_open_hour,
        "wish_count": len(wished),
    }


def _summary(conn: sqlite3.Connection, uid: int, d: date) -> str:
    day = d.isoformat()
    people = [r["name"] for r in conn.execute("SELECT p.name FROM meetings m JOIN people p ON p.id = m.person_id WHERE m.user_id = ? AND m.met_on = ? ORDER BY m.id", (uid, day))]
    spots = {r["name"] for r in conn.execute("SELECT s.name FROM spot_checkins c JOIN spots s ON s.id = c.spot_id WHERE c.user_id = ? AND c.day = ?", (uid, day))}
    spots |= {r["spot_name"] for r in conn.execute("SELECT spot_name FROM spot_visits WHERE user_id = ? AND substr(visited_at,1,10) = ?", (uid, day))}
    parts = []
    if people:
        parts.append("、".join(people) + "に会えた")
    if spots:
        parts.append("、".join(s.split("（")[0] for s in sorted(spots)))
    return " / ".join(parts) or "記録"


def letter_view(conn: sqlite3.Connection, uid: int, day: str, now: datetime) -> dict:
    try:
        d = date.fromisoformat(day)
    except ValueError:
        raise AppError(422, "bad_date", "日付の形式が不正です")
    days = activity_days(conn, uid)
    if d not in days:
        raise AppError(404, "letter_not_found", "その日の便はありません")
    today = now.date()
    if d > today or (d == today and now.hour < settings.letter_open_hour):
        raise AppError(409, "letter_not_yet", f"この便は {settings.letter_open_hour}:00 に届きます")
    trip = next(((s, e) for s, e in cluster_trips(days, settings.trip_gap_days) if s <= d <= e), (d, d))
    redelivered = today >= trip[1] + timedelta(days=30)

    people = []
    for m in conn.execute(
        "SELECT p.id, p.name, p.svg_key, s.name AS shop_name FROM meetings m JOIN people p ON p.id = m.person_id JOIN shops s ON s.id = p.shop_id WHERE m.user_id = ? AND m.met_on = ? ORDER BY m.id",
        (uid, day),
    ):
        people.append({"id": m["id"], "name": m["name"], "svg_key": m["svg_key"], "image": f"/img/people/{m['svg_key']}.png", "shop_name": m["shop_name"], "relationship": relationship(conn, uid, m["id"])})
    # 行った場所 = 会えた人のいる場所 + （旧データ）スポット訪問
    spot_names = {r["spot_name"] for r in conn.execute("SELECT spot_name FROM spot_visits WHERE user_id = ? AND substr(visited_at,1,10) = ?", (uid, day))}
    spot_names |= {r["name"] for r in conn.execute("SELECT s.name FROM spot_checkins c JOIN spots s ON s.id = c.spot_id WHERE c.user_id = ? AND c.day = ?", (uid, day))}
    spot_names |= {
        r["name"] for r in conn.execute(
            "SELECT DISTINCT sp.name FROM meetings m JOIN people p ON p.id = m.person_id JOIN shops sh ON sh.id = p.shop_id JOIN spots sp ON sp.id = sh.spot_id WHERE m.user_id = ? AND m.met_on = ?",
            (uid, day),
        )
    }
    spots = [{"id": s["id"], "name": s["name"].split("（")[0], "area": s["area"], "svg_key": s["svg_key"], "image": f"/img/places/{s['svg_key']}.jpg"} for s in master.spots(conn) if s["name"] in spot_names]
    photos = [
        {"id": p["id"], "url": f"/api/photos/{p['id']}/image", "kind": p["kind"], "is_sample": bool(p["is_sample"])}
        for p in conn.execute("SELECT id, kind, is_sample FROM photos WHERE user_id = ? AND taken_on = ? ORDER BY id", (uid, day))
    ]
    receipts = conn.execute(
        "SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS total, COALESCE(SUM(points),0) AS pts FROM receipts WHERE user_id = ? AND received_on = ? AND is_dummy = 0", (uid, day)
    ).fetchone()
    diary = conn.execute("SELECT text, updated_at FROM diaries WHERE user_id = ? AND day = ?", (uid, day)).fetchone()
    wished = {(w["kind"], w["target_type"], w["target_id"]) for w in conn.execute("SELECT kind, target_type, target_id FROM wishes WHERE user_id = ?", (uid,))}
    suggestions = _suggestions(conn, uid, d, people, spots, wished)
    if redelivered:
        suggestions.sort(key=lambda s: 0 if s["wished"] else 1)
    nxt = season_start_after(today if redelivered else d)
    return {
        "day": day, "weekday": WEEKDAY_JA[d.weekday()], "season": season_of(d), "season_label": LABEL[season_of(d)],
        "trip_start": trip[0].isoformat(), "trip_end": trip[1].isoformat(), "redelivered": redelivered,
        "days_since_trip": (today - trip[1]).days,
        "people": people, "spots": spots, "photos": photos,
        "receipts": {"count": receipts["n"], "total": receipts["total"], "points": receipts["pts"]},
        "diary": diary["text"] if diary else "", "diary_updated_at": diary["updated_at"] if diary else None,
        "suggestions": suggestions,
        "next_season_label": LABEL[season_of(nxt)], "next_season_start": nxt.isoformat(),
        "weeks_to_next_season": weeks_until_next_season(today if redelivered else d),
        "greeting": _greeting(d, people, spots, redelivered),
    }


def _greeting(d: date, people: list[dict], spots: list[dict], redelivered: bool) -> str:
    if redelivered:
        return "あの日から 30 日。星凪諸島から、もう一度おもいで便が届きました。"
    if people:
        return f"{d.month}/{d.day}、{people[0]['name']}に会えた日のおもいで便です。"
    if spots:
        return f"{d.month}/{d.day}、{spots[0]['name'].split('（')[0]}を歩いた日のおもいで便です。"
    return f"{d.month}/{d.day} のおもいで便です。"


def _suggestions(conn: sqlite3.Connection, uid: int, d: date, people: list[dict], spots: list[dict], wished: set) -> list[dict]:
    out: list[dict] = []
    season = season_of(d)
    nxt = next_season(season)
    # 1) 別の季節: 会えた人（いなければ最初の人）の次の季節の約束
    person_id = people[0]["id"] if people else 1
    pr = master.promise(conn, person_id, nxt)
    person = master.person(conn, person_id)
    if pr and person:
        out.append({
            "kind": "season", "target_type": "promise", "target_id": pr["id"],
            "title": f"{LABEL[nxt]}に、{person['name']}の「{pr['title']}」",
            "note": pr["note"], "shop_id": person["shop_id"], "wished": ("season", "promise", pr["id"]) in wished,
        })
    # 2) 別のイベント: 他の人の、期間つきの約束（次の季節 → その次）
    met_ids = {p["id"] for p in people}
    ev = None
    for s in (nxt, next_season(nxt)):
        row = conn.execute(
            "SELECT pr.*, pe.name AS person_name, pe.shop_id FROM promises pr JOIN people pe ON pe.id = pr.person_id "
            "WHERE pr.season = ? AND pr.start_md IS NOT NULL AND pr.person_id NOT IN (%s) ORDER BY pr.start_md LIMIT 1"
            % (",".join("?" * len(met_ids)) if met_ids else "0"),
            (s, *met_ids),
        ).fetchone()
        if row:
            ev = row
            break
    if ev:
        out.append({
            "kind": "event", "target_type": "promise", "target_id": ev["id"],
            "title": f"{LABEL[ev['season']]}の行事「{ev['title']}」（{ev['person_name']}・{ev['start_md'].replace('-', '/')}〜{ev['end_md'].replace('-', '/')}）",
            "note": ev["note"], "shop_id": ev["shop_id"], "wished": ("event", "promise", ev["id"]) in wished,
        })
    # 3) まだ行っていない場所（そこにいる人）
    visited_shops = {r["shop_id"] for r in conn.execute("SELECT shop_id FROM receipts WHERE user_id = ?", (uid,))}
    visited_shops |= {r["shop_id"] for r in conn.execute("SELECT p.shop_id FROM meetings m JOIN people p ON p.id = m.person_id WHERE m.user_id = ?", (uid,))}
    visited_spots = {sh["spot_id"] for sh in master.shops(conn) if sh["id"] in visited_shops} | {s["id"] for s in spots}
    cands = [s for s in master.spots(conn) if s["id"] not in visited_spots]
    if cands:
        sp = cands[0]
        ppl = [p for p in master.people(conn) if p["spot_id"] == sp["id"]]
        who = f"そこには{ppl[0]['name']}（{ppl[0].get('role', '店主')}）がいます。" if ppl else ""
        out.append({
            "kind": "shop", "target_type": "shop", "target_id": ppl[0]["shop_id"] if ppl else 0,
            "title": f"まだ行っていない場所「{sp['name'].split('（')[0]}」（{sp['area']}）",
            "note": f"{sp['description']} {who}".strip(), "shop_id": ppl[0]["shop_id"] if ppl else None,
            "spot_id": sp["id"], "wished": ("shop", "shop", ppl[0]["shop_id"] if ppl else 0) in wished,
        })
    return out


def open_letter(conn: sqlite3.Connection, uid: int, day: str, now: datetime) -> None:
    conn.execute(
        "INSERT INTO letter_opens(user_id, letter_day, opened_at) VALUES(?,?,?)", (uid, day, now.isoformat(timespec="seconds"))
    )


def save_diary(conn: sqlite3.Connection, uid: int, day: str, text: str, now: datetime) -> None:
    text = text.strip()
    if len(text) > 140:
        raise AppError(422, "diary_too_long", "日記は 140 字までです")
    conn.execute(
        "INSERT INTO diaries(user_id, day, text, updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id, day) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at",
        (uid, day, text, now.isoformat(timespec="seconds")),
    )


def add_wish(conn: sqlite3.Connection, uid: int, kind: str, target_type: str, target_id: int, label: str, now: datetime) -> dict:
    if kind not in ("season", "event", "shop") or target_type not in ("promise", "shop"):
        raise AppError(422, "bad_wish", "提案の種類が不正です")
    cur = conn.execute(
        "INSERT OR IGNORE INTO wishes(user_id, kind, target_type, target_id, label, created_at) VALUES(?,?,?,?,?,?)",
        (uid, kind, target_type, target_id, label[:100], now.isoformat(timespec="seconds")),
    )
    added = cur.rowcount > 0
    # つぎの旅の候補に、その人のいる「場所」を自動で入れる
    shop_id = None
    if target_type == "shop":
        shop_id = target_id
    else:
        row = conn.execute("SELECT pe.shop_id FROM promises pr JOIN people pe ON pe.id = pr.person_id WHERE pr.id = ?", (target_id,)).fetchone()
        shop_id = row["shop_id"] if row else None
    spot_id = None
    if shop_id:
        sh = master.shop(conn, shop_id)
        if sh:
            spot_id = sh["spot_id"]
            from .plan import add_item
            add_item(conn, uid, now, "spot", spot_id, source="wish")
    return {"added": added, "shop_id": shop_id, "spot_id": spot_id}
