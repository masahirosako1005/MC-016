"""時刻はここからだけ取る。DEMO_MODE のときは DB の settings.demo_clock。"""
from __future__ import annotations

import sqlite3
from datetime import date, datetime

from .config import settings

DEMO_CLOCK_KEY = "demo_clock"


def now(conn: sqlite3.Connection | None = None) -> datetime:
    if settings.demo_mode and conn is not None:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (DEMO_CLOCK_KEY,)).fetchone()
        if row is not None:
            return datetime.fromisoformat(row["value"])
        return datetime.fromisoformat(settings.demo_start)
    return datetime.now().replace(microsecond=0)


def today(conn: sqlite3.Connection | None = None) -> date:
    return now(conn).date()


def set_demo_clock(conn: sqlite3.Connection, value: datetime) -> None:
    conn.execute(
        "INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (DEMO_CLOCK_KEY, value.isoformat(timespec="seconds")),
    )
