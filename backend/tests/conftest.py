from __future__ import annotations

import os
import sqlite3
from pathlib import Path

import pytest

os.environ.setdefault("DEMO_MODE", "1")
os.environ.setdefault("UPLOADS_DIR", str(Path(__file__).resolve().parent / "_tmp" / "uploads"))
os.environ.setdefault("PHOTOS_DIR", str(Path(__file__).resolve().parent / "_tmp" / "photos"))

from fastapi.testclient import TestClient  # noqa: E402

from app import db as dbmod  # noqa: E402
from app.main import create_app  # noqa: E402
from app.seed.master import seed_master  # noqa: E402


@pytest.fixture()
def conn() -> sqlite3.Connection:
    c = dbmod.connect(":memory:")
    dbmod.init_schema(c)
    seed_master(c)
    return c


@pytest.fixture()
def client(tmp_path: Path):
    app = create_app(db_path=tmp_path / "test.db")
    with TestClient(app) as c:
        yield c
