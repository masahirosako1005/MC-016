"""足りない履歴を固定の乱数でダミー生成する。人・店・商品・主人公には付けない。
生成行には is_dummy=1。2 回呼んでも増えない（ダミーが 1 行でもあれば何もしない）。
"""
from __future__ import annotations

import hashlib
import random
import sqlite3
from datetime import date, datetime, timedelta

from ..config import settings


def generate_dummy(conn: sqlite3.Connection) -> int:
    if conn.execute("SELECT 1 FROM meetings WHERE is_dummy = 1 LIMIT 1").fetchone():
        return 0
    rng = random.Random(settings.dummy_seed)
    users = [
        r["id"]
        for r in conn.execute("SELECT id FROM users WHERE id != ? AND is_dummy = 0 ORDER BY id", (settings.hero_user_id,))
    ]
    if not users:
        return 0
    people = [r["id"] for r in conn.execute("SELECT id FROM people ORDER BY id")]
    shops = [dict(r) for r in conn.execute("SELECT id, rate_percent FROM shops ORDER BY id")]
    prizes = [dict(r) for r in conn.execute("SELECT id, category, name, face_value FROM prizes WHERE category != 'miss'")]
    chosen = rng.sample(users, min(settings.dummy_user_count, len(users)))
    base = date(2026, 10, 1)
    count = 0
    for uid in chosen:
        n_trips = rng.choices([1, 2, 3], weights=[55, 30, 15])[0]
        start = base + timedelta(days=rng.randint(0, 20))
        trip_days: list[date] = []
        for t in range(n_trips):
            length = rng.randint(1, 2)
            days = [start + timedelta(days=k) for k in range(length)]
            trip_days.append(days[-1])
            for d in days:
                for pid in rng.sample(people, rng.randint(1, 2)):
                    conn.execute(
                        "INSERT OR IGNORE INTO meetings(user_id, person_id, met_on, created_at, is_dummy) VALUES(?,?,?,?,1)",
                        (uid, pid, d.isoformat(), f"{d.isoformat()}T{rng.randint(10, 17):02d}:00:00"),
                    )
                    count += 1
                if rng.random() < 0.8:
                    shop = rng.choice(shops)
                    amount = rng.randint(5, 120) * 100
                    pts = amount * shop["rate_percent"] // 100
                    sha = hashlib.sha256(f"dummy-{uid}-{d}-{shop['id']}".encode()).hexdigest()
                    conn.execute(
                        "INSERT OR IGNORE INTO receipts(user_id, shop_id, amount, rate_percent, points, sha256, received_on, created_at, is_dummy) "
                        "VALUES(?,?,?,?,?,?,?,?,1)",
                        (uid, shop["id"], amount, shop["rate_percent"], pts, sha, d.isoformat(),
                         f"{d.isoformat()}T{rng.randint(10, 18):02d}:30:00"),
                    )
                    count += 1
            # 旅の後の起動（おもいで便を開いた）
            if rng.random() < 0.6:
                opened = days[-1] + timedelta(days=rng.randint(0, 3))
                conn.execute(
                    "INSERT INTO letter_opens(user_id, letter_day, opened_at, is_dummy) VALUES(?,?,?,1)",
                    (uid, days[-1].isoformat(), f"{opened.isoformat()}T{rng.randint(18, 22):02d}:00:00"),
                )
                count += 1
            # 次の旅までの間隔
            start = days[-1] + timedelta(days=rng.randint(14, 90))
        # クーポン（当たり → 一部は次の旅で使用）
        if rng.random() < 0.5 and prizes:
            pr = rng.choice(prizes)
            won = trip_days[0]
            used_on = None
            used_shop = None
            if n_trips >= 2 and rng.random() < 0.6:
                used_on = trip_days[1].isoformat()
                used_shop = rng.choice(shops)["id"]
            conn.execute(
                "INSERT INTO coupons(user_id, prize_id, category, name, face_value, won_on, valid_from, valid_until, used_on, used_shop_id, used_at, is_dummy) "
                "VALUES(?,?,?,?,?,?,?,?,?,?,?,1)",
                (uid, pr["id"], pr["category"], pr["name"], pr["face_value"], won.isoformat(),
                 (won + timedelta(days=1)).isoformat(), (won + timedelta(days=365)).isoformat(),
                 used_on, used_shop, f"{used_on}T12:00:00" if used_on else None),
            )
            count += 1
        # つぎの旅（計画）→ 来訪
        if rng.random() < 0.4:
            planned = trip_days[0] - timedelta(days=rng.randint(3, 14))
            visited = n_trips >= 1 and rng.random() < 0.7
            conn.execute(
                "INSERT INTO plans(user_id, target_date, created_at, archived, is_dummy) VALUES(?,?,?,?,1)",
                (uid, trip_days[0].isoformat() if visited else (trip_days[-1] + timedelta(days=30)).isoformat(),
                 f"{planned.isoformat()}T20:00:00", 1 if visited else 0),
            )
            count += 1
    return count


def dummy_summary(conn: sqlite3.Connection) -> dict:
    def c(sql: str) -> int:
        return conn.execute(sql).fetchone()[0]

    return {
        "meetings": c("SELECT COUNT(*) FROM meetings WHERE is_dummy = 1"),
        "receipts": c("SELECT COUNT(*) FROM receipts WHERE is_dummy = 1"),
        "letter_opens": c("SELECT COUNT(*) FROM letter_opens WHERE is_dummy = 1"),
        "coupons": c("SELECT COUNT(*) FROM coupons WHERE is_dummy = 1"),
        "plans": c("SELECT COUNT(*) FROM plans WHERE is_dummy = 1"),
    }


def _unused(_: datetime) -> None:  # pragma: no cover
    pass
