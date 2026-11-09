"""FastAPI 依存: DB 接続（1 プロセス 1 接続、書き込みはロック付き tx）。"""
from __future__ import annotations

import sqlite3
import threading
from contextlib import contextmanager
from typing import Iterator

from fastapi import Request

_lock = threading.RLock()


def get_conn(request: Request) -> sqlite3.Connection:
    return request.app.state.conn


@contextmanager
def write_tx(conn: sqlite3.Connection) -> Iterator[sqlite3.Connection]:
    with _lock:
        conn.execute("BEGIN IMMEDIATE")
        try:
            yield conn
            conn.execute("COMMIT")
        except BaseException:
            conn.execute("ROLLBACK")
            raise
