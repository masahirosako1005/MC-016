"""季節: 春 3–5 / 夏 6–8 / 秋 9–11 / 冬 12–2。"""
from __future__ import annotations

from datetime import date

SEASONS = ("spring", "summer", "autumn", "winter")
LABEL = {"spring": "春", "summer": "夏", "autumn": "秋", "winter": "冬"}
WEEKDAY_JA = ["月", "火", "水", "木", "金", "土", "日"]


def season_of(d: date) -> str:
    m = d.month
    if 3 <= m <= 5:
        return "spring"
    if 6 <= m <= 8:
        return "summer"
    if 9 <= m <= 11:
        return "autumn"
    return "winter"


def next_season(s: str) -> str:
    return SEASONS[(SEASONS.index(s) + 1) % 4]


def season_start_after(d: date) -> date:
    """d より後に最初に来る季節の初日。"""
    y, m = d.year, d.month
    if m in (12, 1, 2):
        return date(y + 1 if m == 12 else y, 3, 1)
    if m <= 5:
        return date(y, 6, 1)
    if m <= 8:
        return date(y, 9, 1)
    return date(y, 12, 1)


def weeks_until_next_season(d: date) -> int:
    return max(0, (season_start_after(d) - d).days // 7)


def md_in_range(d: date, start_md: str | None, end_md: str | None) -> bool:
    """'MM-DD' の範囲（年またぎ可）に d が入るか。範囲なしなら False。"""
    if not start_md or not end_md:
        return False
    cur = d.strftime("%m-%d")
    if start_md <= end_md:
        return start_md <= cur <= end_md
    return cur >= start_md or cur <= end_md


def season_label(s: str) -> str:
    return LABEL[s]
