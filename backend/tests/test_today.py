from datetime import date, datetime

from app.services.forecast import current_event, forecast
from app.services.relationship import stage_of


def test_forecast_statuses():
    shop = {"open_time": "10:00", "close_time": "17:00", "closed_weekday": 1}
    assert forecast(shop, datetime(2026, 10, 20, 12, 0))["status"] == "closed_today"  # 火曜
    assert forecast(shop, datetime(2026, 10, 24, 9, 0))["status"] == "not_yet"
    assert forecast(shop, datetime(2026, 10, 24, 12, 0))["status"] == "open"
    assert forecast(shop, datetime(2026, 10, 24, 16, 30))["status"] == "closing_soon"
    assert forecast(shop, datetime(2026, 10, 24, 17, 0))["status"] == "closed_now"
    assert "火曜定休" in forecast(shop, datetime(2026, 10, 20, 12, 0))["reason"]


def test_current_event_by_md_range():
    promises = [{"id": 7, "season": "autumn", "title": "紅葉の湖面ラテ", "note": "", "start_md": "10-20", "end_md": "11-15"}]
    assert current_event(promises, date(2026, 10, 24))["id"] == 7
    assert current_event(promises, date(2026, 10, 10)) is None
    assert current_event(promises, date(2026, 12, 1)) is None


def test_stage_thresholds():
    assert stage_of(0)["stage"] == "none"
    assert stage_of(1)["label"] == "はじめまして"
    assert stage_of(2)["label"] == "また会えたね"
    assert stage_of(3)["label"] == "おなじみ、おかえり"


def test_meet_once_per_day_and_seed(client):
    # デモ初日 2026-10-17 (土・秋)
    r = client.get("/api/today")
    assert r.status_code == 200
    body = r.json()
    assert body["date"] == "2026-10-17" and body["weekday"] == "土"
    assert len(body["places"]) == 7 and sum(len(p["people"]) for p in body["places"]) == 8
    assert body["todo"]["kind"] == "explore" and body["has_plan"] is False
    # 計画の場所が先頭に来て、いまやることが「会えたら押す」になる
    client.post("/api/plan/items", json={"kind": "spot", "target_id": 7})
    body = client.get("/api/today").json()
    assert body["places"][0]["id"] == 7 and body["places"][0]["in_plan"] is True
    assert body["todo"]["kind"] == "meet" and "鈴木さん" in body["todo"]["text"]

    r = client.post("/api/meetings", json={"person_id": 2})
    assert r.status_code == 200
    j = r.json()
    assert j["already"] is False and j["new_seed"] is True
    assert j["relationship"]["label"] == "はじめまして"
    assert j["seed"]["season"] == "winter" and j["seed"]["state"] == "bud"

    r = client.post("/api/meetings", json={"person_id": 2})
    assert r.json()["already"] is True and r.json()["new_seed"] is False

    # 季節外なので果たせない
    r = client.post(f"/api/seeds/{j['seed']['id']}/fulfill")
    assert r.status_code == 409 and r.json()["code"] == "seed_not_in_season"

    r = client.post("/api/meetings", json={"person_id": 999})
    assert r.status_code == 404

    body = client.get("/api/today").json()
    lake = next(p for p in body["places"] if p["id"] == 4)
    assert lake["met_today"] is True and lake["people"][0]["met_today"] is True
    assert body["met_today"] == [{"id": 2, "name": "水野さん"}]
