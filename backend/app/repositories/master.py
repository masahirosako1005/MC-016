"""マスタ参照。"""
from __future__ import annotations

import sqlite3


def rows(conn: sqlite3.Connection, sql: str, params: tuple = ()) -> list[dict]:
    return [dict(r) for r in conn.execute(sql, params).fetchall()]


def one(conn: sqlite3.Connection, sql: str, params: tuple = ()) -> dict | None:
    r = conn.execute(sql, params).fetchone()
    return dict(r) if r else None


def spots(conn: sqlite3.Connection) -> list[dict]:
    return rows(conn, "SELECT * FROM spots ORDER BY id")


def spot(conn: sqlite3.Connection, spot_id: int) -> dict | None:
    return one(conn, "SELECT * FROM spots WHERE id = ?", (spot_id,))


def shops(conn: sqlite3.Connection) -> list[dict]:
    return rows(conn, "SELECT * FROM shops ORDER BY id")


def shop(conn: sqlite3.Connection, shop_id: int) -> dict | None:
    return one(conn, "SELECT * FROM shops WHERE id = ?", (shop_id,))


def people(conn: sqlite3.Connection) -> list[dict]:
    return rows(
        conn,
        "SELECT p.*, s.name AS shop_name, s.spot_id, s.area, s.category, s.open_time, s.close_time, s.closed_weekday, s.svg_key AS shop_svg_key, s.description AS shop_description "
        "FROM people p JOIN shops s ON s.id = p.shop_id ORDER BY p.id",
    )


def person(conn: sqlite3.Connection, person_id: int) -> dict | None:
    return one(
        conn,
        "SELECT p.*, s.name AS shop_name, s.spot_id, s.area, s.category, s.open_time, s.close_time, s.closed_weekday, s.svg_key AS shop_svg_key "
        "FROM people p JOIN shops s ON s.id = p.shop_id WHERE p.id = ?",
        (person_id,),
    )


def promises_of(conn: sqlite3.Connection, person_id: int) -> list[dict]:
    return rows(conn, "SELECT * FROM promises WHERE person_id = ? ORDER BY CASE season WHEN 'spring' THEN 0 WHEN 'summer' THEN 1 WHEN 'autumn' THEN 2 ELSE 3 END", (person_id,))


def promise(conn: sqlite3.Connection, person_id: int, season: str) -> dict | None:
    return one(conn, "SELECT * FROM promises WHERE person_id = ? AND season = ?", (person_id, season))


def voices_for(conn: sqlite3.Connection, target_type: str, target_id: int) -> list[dict]:
    return rows(
        conn,
        "SELECT * FROM voices WHERE target_type = ? AND target_id = ? ORDER BY CASE season WHEN 'spring' THEN 0 WHEN 'summer' THEN 1 WHEN 'autumn' THEN 2 ELSE 3 END, id",
        (target_type, target_id),
    )
