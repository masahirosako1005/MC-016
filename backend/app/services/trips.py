"""旅 = 活動日の間隔が gap 日以内なら同じ旅。"""
from __future__ import annotations

from datetime import date
from typing import Iterable


def cluster_trips(days: Iterable[date], gap_days: int = 2) -> list[tuple[date, date]]:
    ds = sorted(set(days))
    trips: list[tuple[date, date]] = []
    for d in ds:
        if trips and (d - trips[-1][1]).days <= gap_days:
            trips[-1] = (trips[-1][0], d)
        else:
            trips.append((d, d))
    return trips


def median(values: list[float]) -> float | None:
    if not values:
        return None
    v = sorted(values)
    n = len(v)
    mid = n // 2
    return float(v[mid]) if n % 2 else (v[mid - 1] + v[mid]) / 2
