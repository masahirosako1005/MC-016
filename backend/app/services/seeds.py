"""種と花。
- 初めて会えた日に、その日の次の季節の約束が「種」になる（人ごとに未達の種は 1 つ）。
- 約束の季節が来ると「花」。その季節に会えた日だけ 1.2 秒長押しで果たす → さらに次の季節の種。
- 季節を逃しても枯れず「つぼみ」のまま翌年へ。
"""
from __future__ import annotations

import sqlite3
from datetime import date

from ..errors import AppError
from ..repositories import master
from .relationship import met_on
from .season import LABEL, next_season, season_of


def active_seed(conn: sqlite3.Connection, user_id: int, person_id: int) -> dict | None:
    r = conn.execute(
        "SELECT s.*, p.title, p.note, p.start_md, p.end_md FROM seeds s JOIN promises p ON p.id = s.promise_id "
        "WHERE s.user_id = ? AND s.person_id = ? AND s.fulfilled_on IS NULL",
        (user_id, person_id),
    ).fetchone()
    return dict(r) if r else None


def fulfilled_seeds(conn: sqlite3.Connection, user_id: int, person_id: int) -> list[dict]:
    return [
        dict(r)
        for r in conn.execute(
            "SELECT s.*, p.title FROM seeds s JOIN promises p ON p.id = s.promise_id "
            "WHERE s.user_id = ? AND s.person_id = ? AND s.fulfilled_on IS NOT NULL ORDER BY s.fulfilled_on",
            (user_id, person_id),
        )
    ]


def describe(seed: dict | None, today: date, met_today: bool) -> dict | None:
    if seed is None:
        return None
    cur = season_of(today)
    in_season = seed["season"] == cur
    if in_season:
        state = "flower"
        can_fulfill = met_today
        hint = "今日会えたので、長押しで約束を果たせます" if met_today else "その人に会えた日に長押しで約束を果たせます"
    else:
        state = "bud"
        can_fulfill = False
        hint = f"{LABEL[seed['season']]}になると花になります（枯れません）"
    return {
        "id": seed["id"],
        "season": seed["season"],
        "season_label": LABEL[seed["season"]],
        "title": seed["title"],
        "note": seed["note"],
        "given_on": seed["given_on"],
        "state": state,
        "can_fulfill": can_fulfill,
        "hint": hint,
    }


def give_seed_if_none(conn: sqlite3.Connection, user_id: int, person_id: int, today: date) -> dict | None:
    """初めて会えた（未達の種がない）ときだけ種を渡す。"""
    if active_seed(conn, user_id, person_id):
        return None
    season = next_season(season_of(today))
    pr = master.promise(conn, person_id, season)
    if pr is None:
        return None
    conn.execute(
        "INSERT INTO seeds(user_id, person_id, promise_id, season, given_on) VALUES(?,?,?,?,?)",
        (user_id, person_id, pr["id"], season, today.isoformat()),
    )
    return active_seed(conn, user_id, person_id)


def fulfill(conn: sqlite3.Connection, user_id: int, seed_id: int, today: date) -> dict:
    r = conn.execute("SELECT * FROM seeds WHERE id = ? AND user_id = ?", (seed_id, user_id)).fetchone()
    if r is None:
        raise AppError(404, "seed_not_found", "種が見つかりません")
    seed = dict(r)
    if seed["fulfilled_on"]:
        raise AppError(409, "seed_already_fulfilled", "この約束はもう果たしています")
    if season_of(today) != seed["season"]:
        raise AppError(409, "seed_not_in_season", f"{LABEL[seed['season']]}になってから果たせます")
    if not met_on(conn, user_id, seed["person_id"], today.isoformat()):
        raise AppError(409, "seed_not_met_today", "今日その人に会えた日だけ果たせます")
    conn.execute("UPDATE seeds SET fulfilled_on = ? WHERE id = ?", (today.isoformat(), seed_id))
    nxt = next_season(seed["season"])
    pr = master.promise(conn, seed["person_id"], nxt)
    new_seed = None
    if pr is not None:
        conn.execute(
            "INSERT INTO seeds(user_id, person_id, promise_id, season, given_on) VALUES(?,?,?,?,?)",
            (user_id, seed["person_id"], pr["id"], nxt, today.isoformat()),
        )
        new_seed = active_seed(conn, user_id, seed["person_id"])
    return {"fulfilled": seed_id, "next": describe(new_seed, today, True)}
