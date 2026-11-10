"""関係 = その人に会えた別日数。1=はじめまして / 2=また会えたね / 3+=おなじみ、おかえり。帯の色は 銅・銀・金。"""
from __future__ import annotations

import sqlite3


def stage_of(days: int) -> dict:
    if days <= 0:
        return {"days": 0, "stage": "none", "label": "まだ会っていない"}
    if days == 1:
        return {"days": days, "stage": "first", "label": "はじめまして"}
    if days == 2:
        return {"days": days, "stage": "again", "label": "また会えたね"}
    return {"days": days, "stage": "regular", "label": "おなじみ、おかえり"}


def met_days(conn: sqlite3.Connection, user_id: int, person_id: int) -> int:
    return conn.execute(
        "SELECT COUNT(DISTINCT met_on) FROM meetings WHERE user_id = ? AND person_id = ?", (user_id, person_id)
    ).fetchone()[0]


def relationship(conn: sqlite3.Connection, user_id: int, person_id: int) -> dict:
    return stage_of(met_days(conn, user_id, person_id))


def met_on(conn: sqlite3.Connection, user_id: int, person_id: int, day: str) -> bool:
    return conn.execute(
        "SELECT 1 FROM meetings WHERE user_id = ? AND person_id = ? AND met_on = ?", (user_id, person_id, day)
    ).fetchone() is not None
