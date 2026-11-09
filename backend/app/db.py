"""SQLite 接続とスキーマ。SQL はすべてプレースホルダで書く。"""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

SCHEMA = """
CREATE TABLE IF NOT EXISTS settings(
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS spots(
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  area TEXT NOT NULL,
  svg_key TEXT NOT NULL,
  description TEXT NOT NULL,
  access TEXT NOT NULL,
  best_season TEXT NOT NULL,
  map_x REAL NOT NULL,
  map_y REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS shops(
  id INTEGER PRIMARY KEY,
  spot_id INTEGER NOT NULL REFERENCES spots(id),
  name TEXT NOT NULL UNIQUE,
  area TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('飲食','宿泊','体験','物販')),
  open_time TEXT NOT NULL,
  close_time TEXT NOT NULL,
  closed_weekday INTEGER,
  rate_percent INTEGER NOT NULL CHECK(rate_percent BETWEEN 1 AND 20),
  is_unmanned INTEGER NOT NULL DEFAULT 0,
  svg_key TEXT NOT NULL,
  description TEXT NOT NULL,
  access TEXT NOT NULL,
  best_season TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS people(
  id INTEGER PRIMARY KEY,
  shop_id INTEGER NOT NULL UNIQUE REFERENCES shops(id),
  name TEXT NOT NULL,
  intro TEXT NOT NULL,
  svg_key TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '店主'
);
CREATE TABLE IF NOT EXISTS promises(
  id INTEGER PRIMARY KEY,
  person_id INTEGER NOT NULL REFERENCES people(id),
  season TEXT NOT NULL CHECK(season IN ('spring','summer','autumn','winter')),
  title TEXT NOT NULL,
  note TEXT NOT NULL,
  start_md TEXT,
  end_md TEXT,
  UNIQUE(person_id, season)
);
CREATE TABLE IF NOT EXISTS voices(
  id INTEGER PRIMARY KEY,
  target_type TEXT NOT NULL CHECK(target_type IN ('spot','shop')),
  target_id INTEGER NOT NULL,
  season TEXT NOT NULL,
  author TEXT NOT NULL,
  text TEXT NOT NULL,
  hashtags TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  gender TEXT,
  age_band TEXT,
  region TEXT,
  registered_at TEXT,
  is_dummy INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'csv'
);
CREATE TABLE IF NOT EXISTS spot_visits(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  spot_name TEXT NOT NULL,
  visited_at TEXT NOT NULL,
  lap INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'csv',
  UNIQUE(user_id, spot_name, visited_at)
);
CREATE TABLE IF NOT EXISTS legacy_rewards(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  reward_name TEXT NOT NULL,
  prize_name TEXT NOT NULL,
  got_at TEXT NOT NULL,
  UNIQUE(user_id, reward_name, got_at)
);
CREATE TABLE IF NOT EXISTS survey_post(
  user_id INTEGER PRIMARY KEY,
  satisfaction TEXT NOT NULL,
  good_point TEXT,
  request TEXT
);
CREATE TABLE IF NOT EXISTS survey_reg(
  user_id INTEGER PRIMARY KEY,
  gender TEXT,
  age_band TEXT,
  residence TEXT,
  job TEXT,
  channels TEXT
);
CREATE TABLE IF NOT EXISTS meetings(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  person_id INTEGER NOT NULL REFERENCES people(id),
  met_on TEXT NOT NULL,
  created_at TEXT NOT NULL,
  is_dummy INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, person_id, met_on)
);
CREATE TABLE IF NOT EXISTS spot_checkins(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  spot_id INTEGER NOT NULL REFERENCES spots(id),
  day TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, spot_id, day)
);
CREATE TABLE IF NOT EXISTS seeds(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  person_id INTEGER NOT NULL REFERENCES people(id),
  promise_id INTEGER NOT NULL REFERENCES promises(id),
  season TEXT NOT NULL,
  given_on TEXT NOT NULL,
  fulfilled_on TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_seeds_active ON seeds(user_id, person_id) WHERE fulfilled_on IS NULL;
CREATE TABLE IF NOT EXISTS receipts(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  amount INTEGER NOT NULL,
  rate_percent INTEGER NOT NULL,
  points INTEGER NOT NULL,
  sha256 TEXT NOT NULL UNIQUE,
  image_path TEXT,
  image_mime TEXT,
  received_on TEXT NOT NULL,
  created_at TEXT NOT NULL,
  is_dummy INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS point_ledger(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref_type TEXT,
  ref_id INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS prizes(
  id INTEGER PRIMARY KEY,
  category TEXT NOT NULL CHECK(category IN ('飲食','宿泊','体験','物販','miss')),
  name TEXT NOT NULL,
  face_value INTEGER NOT NULL DEFAULT 0,
  weight INTEGER NOT NULL CHECK(weight >= 0),
  stock INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS draws(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  prize_id INTEGER NOT NULL REFERENCES prizes(id),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS coupons(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  prize_id INTEGER NOT NULL REFERENCES prizes(id),
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  face_value INTEGER NOT NULL,
  won_on TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  used_on TEXT,
  used_shop_id INTEGER REFERENCES shops(id),
  used_at TEXT,
  is_dummy INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS diaries(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  text TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, day)
);
CREATE TABLE IF NOT EXISTS wishes(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('season','event','shop')),
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, kind, target_type, target_id)
);
CREATE TABLE IF NOT EXISTS letter_opens(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  letter_day TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  is_dummy INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS photos(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('person','spot')),
  person_id INTEGER REFERENCES people(id),
  spot_id INTEGER REFERENCES spots(id),
  taken_on TEXT NOT NULL,
  path TEXT NOT NULL,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS plans(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  target_date TEXT,
  created_at TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  is_dummy INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS plan_items(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES plans(id),
  kind TEXT NOT NULL CHECK(kind IN ('spot','shop')),
  target_id INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL,
  UNIQUE(plan_id, kind, target_id)
);
CREATE TABLE IF NOT EXISTS admin_history(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  kind TEXT NOT NULL,
  target TEXT NOT NULL,
  before TEXT,
  after TEXT
);
CREATE TABLE IF NOT EXISTS import_runs(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  file TEXT NOT NULL,
  ok_count INTEGER NOT NULL,
  fail_count INTEGER NOT NULL
);
"""


def connect(path: Path | str) -> sqlite3.Connection:
    p = Path(path)
    if str(p) != ":memory:":
        p.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(p), check_same_thread=False, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


def init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
    # 旧版の DB への列追加（あれば何もしない）
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(people)")}
    if "role" not in cols:
        conn.execute("ALTER TABLE people ADD COLUMN role TEXT NOT NULL DEFAULT '店主'")
    pcols = {r["name"] for r in conn.execute("PRAGMA table_info(plans)")}
    if "title" not in pcols:
        conn.execute("ALTER TABLE plans ADD COLUMN title TEXT")
    scols = {r["name"] for r in conn.execute("PRAGMA table_info(shops)")}
    if "recommend" not in scols:
        conn.execute("ALTER TABLE shops ADD COLUMN recommend TEXT")
    if "photo_path" not in scols:
        conn.execute("ALTER TABLE shops ADD COLUMN photo_path TEXT")
    conn.executescript(
        """
CREATE TABLE IF NOT EXISTS events(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT '外部',
  expected INTEGER,
  note TEXT,
  source TEXT NOT NULL DEFAULT 'DMO',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  coupon_face_value INTEGER,
  coupon_days INTEGER,
  created_at TEXT NOT NULL,
  sent_to INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS message_reads(
  message_id INTEGER NOT NULL REFERENCES messages(id),
  user_id INTEGER NOT NULL,
  read_at TEXT NOT NULL,
  PRIMARY KEY(message_id, user_id)
);
"""
    )


@contextmanager
def tx(conn: sqlite3.Connection) -> Iterator[sqlite3.Connection]:
    """1 トランザクション。例外なら ROLLBACK。"""
    conn.execute("BEGIN IMMEDIATE")
    try:
        yield conn
        conn.execute("COMMIT")
    except BaseException:
        conn.execute("ROLLBACK")
        raise
