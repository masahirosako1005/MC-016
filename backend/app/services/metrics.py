"""指標 GET /api/metrics。各値に n（対象人数）と dummy_n（うちダミー）を添える。3 人未満の区分は null。
格付け・順位は作らない。
"""
from __future__ import annotations

import sqlite3
from collections import defaultdict
from datetime import date, datetime

from ..config import settings
from .trips import cluster_trips, median

MIN_N = 3


def _user_days(conn: sqlite3.Connection) -> tuple[dict[int, set[date]], set[int]]:
    """利用者ごとの活動日。ダミー利用者（ダミー履歴のみの人）の集合も返す。"""
    days: dict[int, set[date]] = defaultdict(set)
    dummy_users: set[int] = set()
    real_users: set[int] = set()
    for sql, flag in (
        ("SELECT user_id, met_on AS d, is_dummy FROM meetings", True),
        ("SELECT user_id, received_on AS d, is_dummy FROM receipts", True),
        ("SELECT user_id, day AS d, 0 AS is_dummy FROM spot_checkins", False),
        ("SELECT user_id, substr(visited_at,1,10) AS d, 0 AS is_dummy FROM spot_visits", False),
    ):
        for r in conn.execute(sql):
            days[r["user_id"]].add(date.fromisoformat(r["d"]))
            if flag and r["is_dummy"]:
                dummy_users.add(r["user_id"])
            else:
                real_users.add(r["user_id"])
    return days, dummy_users


def _val(value, n: int, dummy_n: int, unit: str = "") -> dict:
    return {"value": value if n >= MIN_N else None, "n": n, "dummy_n": dummy_n, "unit": unit, "suppressed": n < MIN_N}


def compute_metrics(conn: sqlite3.Connection, now: datetime) -> dict:
    days, dummy_users = _user_days(conn)
    trips = {uid: cluster_trips(ds, settings.trip_gap_days) for uid, ds in days.items()}
    users_with_trip = [u for u, t in trips.items() if t]
    n = len(users_with_trip)
    dn = len([u for u in users_with_trip if u in dummy_users])

    # 再訪率
    revisit = [u for u in users_with_trip if len(trips[u]) >= 2]
    revisit_rate = round(len(revisit) / n, 3) if n else None

    # 訪問間隔の中央値（日）
    gaps: list[float] = []
    for u in users_with_trip:
        t = trips[u]
        for a, b in zip(t, t[1:]):
            gaps.append((b[0] - a[1]).days)
    gap_median = median(gaps)

    # 旅の後の起動率: 旅の終了後に おもいで便 を開いた人の割合
    opened_after = set()
    for r in conn.execute("SELECT user_id, letter_day, opened_at FROM letter_opens"):
        u = r["user_id"]
        if u not in trips:
            continue
        od = date.fromisoformat(r["opened_at"][:10])
        for s, e in trips[u]:
            if s <= date.fromisoformat(r["letter_day"]) <= e and od > e:
                opened_after.add(u)
    post_trip_open_rate = round(len(opened_after) / n, 3) if n else None

    # 満足なのに再訪していない割合（参加後アンケートで 大変満足/やや満足 の人のうち、旅が 1 回だけ）
    satisfied = {r["user_id"] for r in conn.execute("SELECT user_id FROM survey_post WHERE satisfaction IN ('大変満足','やや満足')")}
    sat_with_trip = [u for u in satisfied if u in trips and trips[u]]
    sat_no_revisit = [u for u in sat_with_trip if len(trips[u]) == 1]
    sat_rate = round(len(sat_no_revisit) / len(sat_with_trip), 3) if sat_with_trip else None
    sat_n = len(sat_with_trip)
    sat_dn = len([u for u in sat_with_trip if u in dummy_users])

    # 地域（地区）ごとの消費額
    by_area: dict[str, dict] = {}
    for r in conn.execute(
        "SELECT s.area, SUM(r.amount) AS total, COUNT(DISTINCT r.user_id) AS n, COUNT(DISTINCT CASE WHEN r.is_dummy = 1 THEN r.user_id END) AS dn "
        "FROM receipts r JOIN shops s ON s.id = r.shop_id GROUP BY s.area ORDER BY s.area"
    ):
        by_area[r["area"]] = _val(r["total"], r["n"], r["dn"], "円")
    total_spent = conn.execute("SELECT COALESCE(SUM(amount),0), COUNT(DISTINCT user_id), COUNT(DISTINCT CASE WHEN is_dummy=1 THEN user_id END) FROM receipts").fetchone()

    # クーポンを使った再訪（クーポン使用日を含む旅で、その利用者の 2 回目以降の旅）
    coupon_revisits = 0
    coupon_users = set()
    coupon_dummy = set()
    for r in conn.execute("SELECT user_id, used_on, is_dummy FROM coupons WHERE used_on IS NOT NULL"):
        u = r["user_id"]
        ud = date.fromisoformat(r["used_on"])
        t = trips.get(u, [])
        for i, (s, e) in enumerate(t):
            if s <= ud <= e and i >= 1:
                coupon_revisits += 1
                coupon_users.add(u)
                if r["is_dummy"]:
                    coupon_dummy.add(u)
                break
    won_users = conn.execute("SELECT COUNT(DISTINCT user_id), COUNT(DISTINCT CASE WHEN is_dummy=1 THEN user_id END) FROM coupons").fetchone()

    # つぎの旅を作った人のうち来訪した割合（予定日以降に旅がある）
    plan_users = {}
    for r in conn.execute("SELECT user_id, target_date, is_dummy FROM plans WHERE target_date IS NOT NULL"):
        plan_users.setdefault(r["user_id"], []).append((date.fromisoformat(r["target_date"]), r["is_dummy"]))
    plan_visited = 0
    for u, lst in plan_users.items():
        t = trips.get(u, [])
        if any(any(s <= td <= e or (s >= td and s - td <= __import__("datetime").timedelta(days=7)) for s, e in t) for td, _ in lst):
            plan_visited += 1
    plan_n = len(plan_users)
    plan_dn = len([u for u, lst in plan_users.items() if any(d for _, d in lst)])

    return {
        "as_of": now.isoformat(timespec="seconds"),
        "note": "値ごとの n は対象人数、dummy_n はうちダミー履歴の人数。3 人未満の区分は数字を示しません。",
        "revisit_rate": _val(revisit_rate, n, dn, "割合"),
        "visit_interval_median_days": _val(gap_median, len(revisit), len([u for u in revisit if u in dummy_users]), "日"),
        "post_trip_open_rate": _val(post_trip_open_rate, n, dn, "割合"),
        "satisfied_but_no_revisit_rate": _val(sat_rate, sat_n, sat_dn, "割合"),
        "spend_by_area": by_area,
        "spend_total": _val(total_spent[0], total_spent[1], total_spent[2], "円"),
        "coupon_revisits": _val(coupon_revisits, won_users[0], won_users[1], "回"),
        "plan_to_visit_rate": _val(round(plan_visited / plan_n, 3) if plan_n else None, plan_n, plan_dn, "割合"),
        "counts": {
            "users": conn.execute("SELECT COUNT(*) FROM users").fetchone()[0],
            "users_with_trip": n,
            "meetings": conn.execute("SELECT COUNT(*) FROM meetings").fetchone()[0],
            "receipts": conn.execute("SELECT COUNT(*) FROM receipts").fetchone()[0],
            "photos": conn.execute("SELECT COUNT(*) FROM photos").fetchone()[0],
            "coupons_used": conn.execute("SELECT COUNT(*) FROM coupons WHERE used_on IS NOT NULL").fetchone()[0],
        },
    }
