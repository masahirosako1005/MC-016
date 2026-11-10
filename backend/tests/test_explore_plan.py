def test_places_and_people_no_ranking(client):
    r = client.get("/api/places")
    assert r.status_code == 200
    body = r.json()
    assert len(body["places"]) == 7 and len(body["map"]) == 7
    # 全部の場所に人がいる（無人店はなくなった）
    assert all(len(p["people"]) >= 1 for p in body["places"])
    assert sum(len(p["people"]) for p in body["places"]) == 8
    for p in body["places"]:
        assert "rank" not in p and "likes" not in p
        for q in p["people"]:
            assert q["role"] in ("店主", "宿の主人", "職人", "観光案内所", "ガイド")
            assert q["image"].startswith("/img/people/")

    r = client.get("/api/places", params={"area": "星綴港"})
    names = [p["name"] for p in r.json()["places"]]
    assert names == ["灯雲の石畳通り"]
    assert len(r.json()["places"][0]["people"]) == 2  # 三浦さん・藤井さん

    r = client.get("/api/places", params={"q": "ガイド"})
    assert [p["name"] for p in r.json()["places"]] == ["風詠みの灯台"]
    assert client.get("/api/places", params={"season": "bogus"}).status_code == 422

    d = client.get("/api/places/4").json()
    assert d["people"][0]["name"] == "水野さん" and d["voices"] and d["in_plan"] is False
    assert client.get("/api/places/99").status_code == 404

    p = client.get("/api/people/8").json()
    assert p["name"] == "舟木さん" and p["role"] == "ガイド" and len(p["promises"]) == 4 and p["place"]["name"] == "風詠みの灯台"
    assert client.get("/api/people/99").status_code == 404


def test_plan_flow_with_places(client):
    p = client.get("/api/plan").json()
    assert p["exists"] is False

    r = client.post("/api/plan/items", json={"kind": "spot", "target_id": 4})
    assert r.status_code == 200 and r.json()["added"] is True
    assert client.post("/api/plan/items", json={"kind": "spot", "target_id": 4}).json()["added"] is False
    client.post("/api/plan/items", json={"kind": "spot", "target_id": 7})
    assert client.post("/api/plan/items", json={"kind": "spot", "target_id": 999}).status_code == 404

    r = client.put("/api/plan", json={"target_date": "2026-10-24"})
    p = r.json()
    assert p["days_until"] == 7 and p["season_label"] == "秋" and p["weekday"] == "土" and len(p["items"]) == 2
    assert p["items"][0]["people"][0]["name"] == "水野さん"
    assert {x["name"] for x in p["people_that_day"]} == {"水野さん", "鈴木さん"}
    assert all(x["available"] for x in p["people_that_day"])
    # 火曜は水野さんが定休
    p = client.put("/api/plan", json={"target_date": "2026-10-27"}).json()
    assert next(x for x in p["people_that_day"] if x["name"] == "水野さん")["available"] is False
    assert client.put("/api/plan", json={"target_date": "24/10/2026"}).status_code == 422

    assert client.get("/api/places/4").json()["in_plan"] is True
    assert client.get("/api/places").json()["places"][0]["in_plan"] is True  # 計画の場所が先頭
    client.delete("/api/plan/items/spot/4")
    assert len(client.get("/api/plan").json()["items"]) == 1

    r = client.get("/api/shops/4")
    assert r.status_code == 200 and r.json()["person"]["name"] == "水野さん" and r.json()["place"]["name"] == "瑠璃凪の水鏡湖"
    assert client.get("/api/shops/99").status_code == 404
    # 旧 API は消えている
    assert client.get("/api/explore").status_code == 404
    assert client.post("/api/checkins", json={"spot_id": 1}).status_code == 404


def test_plan_history_and_leftovers(client):
    from datetime import datetime
    from app import clock

    conn = client.app.state.conn
    client.post("/api/plan/items", json={"kind": "spot", "target_id": 4})
    client.post("/api/plan/items", json={"kind": "spot", "target_id": 7})
    client.put("/api/plan", json={"target_date": "2026-10-24", "title": "秋の旅"})
    h = client.get("/api/plan/history").json()
    assert h["active"]["title"] == "秋の旅" and len(h["active"]["items"]) == 2 and h["leftovers"] == []
    # 旅の日: 水野さん（場所 4）にだけ会う
    clock.set_demo_clock(conn, datetime(2026, 10, 24, 11, 0))
    client.post("/api/meetings", json={"person_id": 2})
    # 旅が終わると計画は閉じ、行けなかった場所（7）が残る
    clock.set_demo_clock(conn, datetime(2026, 11, 23, 10, 0))
    h = client.get("/api/plan/history").json()
    assert h["active"] is None
    done = h["plans"][0]
    assert done["archived"] is True and {i["id"]: i["visited"] for i in done["items"]} == {4: True, 7: False}
    assert [l["id"] for l in h["leftovers"]] == [7] and h["leftovers"][0]["from_title"] == "秋の旅"
    # 新しい旅をつくると、いまの計画が空で始まる
    r = client.post("/api/plan/new", json={"title": "冬の旅"})
    assert r.status_code == 200 and r.json()["title"] == "冬の旅" and r.json()["items"] == []
    client.post("/api/plan/items", json={"kind": "spot", "target_id": 7})
    assert client.get("/api/plan/history").json()["leftovers"] == []
