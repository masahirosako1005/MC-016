from datetime import datetime

from app import clock


def test_letter_timing_redelivery_and_wishes(client):
    conn = client.app.state.conn
    # サンプル写真(10/14〜16)で前回の旅の便がある
    idx = client.get("/api/letters").json()
    assert [l["day"] for l in idx["letters"]] == ["2026-10-16", "2026-10-15", "2026-10-14"]
    assert all(l["redelivered"] is False for l in idx["letters"])

    # 10/24 の旅中、18:00 前は届かない
    clock.set_demo_clock(conn, datetime(2026, 10, 24, 10, 0))
    client.post("/api/meetings", json={"person_id": 2})
    idx = client.get("/api/letters").json()
    assert idx["pending_today"] is True
    assert "2026-10-24" not in [l["day"] for l in idx["letters"]]
    r = client.get("/api/letters/2026-10-24")
    assert r.status_code == 409 and r.json()["code"] == "letter_not_yet"

    # 19:00 になると届く
    clock.set_demo_clock(conn, datetime(2026, 10, 24, 19, 0))
    r = client.get("/api/letters/2026-10-24")
    assert r.status_code == 200
    L = r.json()
    assert L["people"][0]["name"] == "水野さん" and L["redelivered"] is False
    assert len(L["suggestions"]) == 3 and [s["kind"] for s in L["suggestions"]] == ["season", "event", "shop"]
    assert L["suggestions"][0]["title"].startswith("冬に、水野さん")
    assert client.post("/api/letters/2026-10-24/open").status_code == 200
    assert conn.execute("SELECT COUNT(*) FROM letter_opens WHERE user_id = 8800001").fetchone()[0] == 1

    # 日記 140 字
    assert client.put("/api/diaries/2026-10-24", json={"text": "湖が空を映していた。"}).status_code == 200
    assert client.put("/api/diaries/2026-10-24", json={"text": "あ" * 141}).status_code == 422
    assert client.get("/api/letters/2026-10-24").json()["diary"] == "湖が空を映していた。"

    # 行きたい → つぎの旅の候補に入る
    s = L["suggestions"][2]
    r = client.post("/api/wishes", json={"kind": s["kind"], "target_type": s["target_type"], "target_id": s["target_id"], "label": s["title"]})
    assert r.status_code == 200 and r.json()["added"] is True
    plan = client.get("/api/plan").json()
    assert r.json()["spot_id"] is not None
    assert any(i["kind"] == "spot" and i["id"] == r.json()["spot_id"] and i["source"] == "wish" for i in plan["items"])
    assert s["title"].startswith("まだ行っていない場所")

    # 30 日後: 同じ便がもう一度、行きたいが先頭、次の季節まで何週間
    clock.set_demo_clock(conn, datetime(2026, 11, 23, 10, 0))
    L2 = client.get("/api/letters/2026-10-24").json()
    assert L2["redelivered"] is True and L2["suggestions"][0]["wished"] is True
    assert L2["next_season_label"] == "冬" and L2["weeks_to_next_season"] == 1
    assert client.get("/api/letters/1999-13-99").status_code == 422
    assert client.get("/api/letters/2026-10-20").status_code == 404


def test_book_view(client):
    conn = client.app.state.conn
    clock.set_demo_clock(conn, datetime(2026, 10, 24, 10, 0))
    client.post("/api/meetings", json={"person_id": 3})
    b = client.get("/api/book").json()
    assert b["people"][0]["name"] == "望月さん" and b["people"][0]["relationship"]["label"] == "はじめまして"
    assert b["people"][0]["seed"]["season_label"] == "冬"
    assert len(b["album"]) == 4
    assert b["trips"][0]["current"] is True and b["trips"][1]["start"] == "2026-10-14" and b["trips"][1]["days"] == 3


def test_reminder_after_30_days_and_ics(client):
    conn = client.app.state.conn
    clock.set_demo_clock(conn, datetime(2026, 10, 24, 19, 0))
    client.post("/api/meetings", json={"person_id": 6})
    L = client.get("/api/letters/2026-10-24").json()
    s = L["suggestions"][0]
    assert s["image"] and s["person"]["name"]
    client.post("/api/wishes", json={"kind": s["kind"], "target_type": s["target_type"], "target_id": s["target_id"], "label": s["title"]})
    idx = client.get("/api/letters").json()
    assert idx["reminders"] == []
    clock.set_demo_clock(conn, datetime(2026, 11, 23, 10, 0))
    idx = client.get("/api/letters").json()
    r = next(x for x in idx["reminders"] if x["trip_start"] == "2026-10-24")
    assert r["date"] == "2026-11-23" and r["people"] == ["鈴木さん"] and len(r["wishes"]) == 1 and r["wishes"][0]["image"]
    assert r["next_season_label"] == "冬" and r["weeks_to_next_season"] == 1
    # ics
    assert client.get("/api/plan/ics").status_code == 404
    client.put("/api/plan", json={"target_date": "2026-12-01"})
    ics = client.get("/api/plan/ics")
    assert ics.status_code == 200 and "DTSTART;VALUE=DATE:20261201" in ics.text and "text/calendar" in ics.headers["content-type"]
    # 来訪予定（運営）
    v = client.get("/api/admin/visits").json()
    assert any(x["date"] == "2026-12-01" and x["plans"] >= 1 for x in v["visits"])
    # ゆるキャラ
    f = client.get("/api/photos/frame/person/6").json()
    assert f["mascot"]["key"] == "hall" and f["mascot"]["outfit"]
