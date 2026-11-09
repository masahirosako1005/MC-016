"""今日会えそうかの予報。材料は店の定休日・営業時間と、約束の期間だけ。"""
from __future__ import annotations

from datetime import date, datetime, time

from .season import WEEKDAY_JA, md_in_range, season_of

STATUS_LABEL = {
    "open": "会えそう",
    "closing_soon": "もうすぐ閉まる",
    "not_yet": "まだ開いてない",
    "closed_now": "今日はもう閉店",
    "closed_today": "今日はお休み",
}


def _t(s: str) -> time:
    h, m = s.split(":")
    return time(int(h), int(m))


def forecast(shop: dict, now: datetime) -> dict:
    """shop: open_time, close_time, closed_weekday を持つ dict。"""
    wd = now.weekday()
    open_t, close_t = _t(shop["open_time"]), _t(shop["close_time"])
    hours = f"{shop['open_time']}–{shop['close_time']}"
    if shop.get("closed_weekday") is not None and int(shop["closed_weekday"]) == wd:
        return {"status": "closed_today", "label": STATUS_LABEL["closed_today"],
                "reason": f"{WEEKDAY_JA[wd]}曜定休", "hours": hours}
    t = now.time()
    if t < open_t:
        return {"status": "not_yet", "label": STATUS_LABEL["not_yet"],
                "reason": f"{shop['open_time']} に開きます（{hours}）", "hours": hours}
    if t >= close_t:
        return {"status": "closed_now", "label": STATUS_LABEL["closed_now"],
                "reason": f"営業時間 {hours}", "hours": hours}
    mins_left = (close_t.hour * 60 + close_t.minute) - (t.hour * 60 + t.minute)
    if mins_left <= 60:
        return {"status": "closing_soon", "label": STATUS_LABEL["closing_soon"],
                "reason": f"〜{shop['close_time']}（あと {mins_left} 分）", "hours": hours}
    return {"status": "open", "label": STATUS_LABEL["open"], "reason": f"営業中 {hours}", "hours": hours}


def current_event(promises: list[dict], today: date) -> dict | None:
    """今日が期間内の約束（= 季節イベント）。なければ None。"""
    season = season_of(today)
    for p in promises:
        if p["season"] == season and md_in_range(today, p.get("start_md"), p.get("end_md")):
            return {"id": p["id"], "title": p["title"], "note": p["note"], "label": f"いま「{p['title']}」の時期"}
    return None


ORDER = {"open": 0, "closing_soon": 1, "not_yet": 2, "closed_now": 3, "closed_today": 4}


def sort_key(item: dict) -> tuple:
    return (ORDER[item["forecast"]["status"]], 0 if item.get("event") else 1, item["person"]["id"])
