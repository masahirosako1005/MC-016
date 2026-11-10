"""設定。環境変数から読む。値は起動時に 1 回だけ決まる。"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _env_bool(name: str, default: bool = False) -> bool:
    v = os.environ.get(name)
    if v is None:
        return default
    return v.strip() in ("1", "true", "TRUE", "yes", "on")


@dataclass(frozen=True)
class Settings:
    demo_mode: bool = field(default_factory=lambda: _env_bool("DEMO_MODE", False))
    db_path: Path = field(default_factory=lambda: Path(os.environ.get("DB_PATH", ROOT / "data" / "app.db")))
    uploads_dir: Path = field(default_factory=lambda: Path(os.environ.get("UPLOADS_DIR", ROOT / "data" / "uploads")))
    photos_dir: Path = field(default_factory=lambda: Path(os.environ.get("PHOTOS_DIR", ROOT / "data" / "photos")))
    sample_data_dir: Path = field(
        default_factory=lambda: Path(os.environ.get("SAMPLE_DATA_DIR", r"C:\AI-Sprint\sample-data"))
    )
    frontend_dist: Path = field(default_factory=lambda: ROOT / "frontend" / "dist")
    hero_user_id: int = 8800001
    receipt_image_keep_days: int = 7
    receipt_max_bytes: int = 5 * 1024 * 1024
    points_per_draw: int = 100
    coupon_valid_days: int = 365
    letter_open_hour: int = 18
    trip_gap_days: int = 2
    dummy_seed: int = 42
    dummy_user_count: int = 150
    # デモ時計の各場面
    demo_start: str = "2026-10-17T10:00:00"
    demo_trip_day: str = "2026-10-24T10:00:00"
    demo_night: str = "2026-10-24T19:00:00"
    demo_after30: str = "2026-11-23T10:00:00"
    demo_next_season: str = "2026-12-01T10:00:00"


settings = Settings()
