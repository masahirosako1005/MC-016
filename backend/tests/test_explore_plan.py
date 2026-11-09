def test_explore_filters_and_no_ranking(client):
    r = client.get("/api/explore")
    assert r.status_code == 200
    body = r.json()
    assert len(body["cards"]) == 15  # 7 スポット + 8 店
    assert len(body["spots_for_map"]) == 7
    # 件数・いいね・順位のような項目を返さない
    for c in body["cards"]:
        assert "likes" not in c and "rank" not in c and "count" not in c
        for v in c["voices"]:
            assert set(v) == {"id", "season", "season_label", "author", "text", "hashtags"}

    r = client.get("/api/explore", params={"category": "宿泊"})
    assert [c["name"] for c in r.json()["cards"]] == ["石畳の宿 灯雲荘"]

    r = client.get("/api/explore", params={"q": "紅葉"})
    names = [c["name"] for c in r.json()["cards"]]
    assert "瑠璃凪の水鏡湖（雫森谷）" in names

    r = client.get("/api/explore", params={"area": "星綴港"})
    assert len(r.json()["cards"]) == 3

    r = client.get("/api/explore", params={"season": "bogus"})
    assert r.status_code == 422


def test_place_detail_and_plan_flow(client):
    r = client.get("/api/place/shop/4")
    assert r.status_code == 200
    d = r.json()
    assert d["person"]["name"] == "瑠衣さん" and len(d["person"]["promises"]) == 4
    assert d["in_plan"] is False
    assert client.get("/api/place/spot/99").status_code == 404

    p = client.get("/api/plan").json()
    assert p["exists"] is False

    r = client.post("/api/plan/items", json={"kind": "shop", "target_id": 4})
    assert r.status_code == 200 and r.json()["added"] is True
    r = client.post("/api/plan/items", json={"kind": "shop", "target_id": 4})
    assert r.json()["added"] is False
    client.post("/api/plan/items", json={"kind": "spot", "target_id": 4})
    assert client.post("/api/plan/items", json={"kind": "spot", "target_id": 999}).status_code == 404

    r = client.put("/api/plan", json={"target_date": "2026-10-24"})
    p = r.json()
    assert p["days_until"] == 7 and p["season_label"] == "秋" and len(p["items"]) == 2
    assert client.put("/api/plan", json={"target_date": "24/10/2026"}).status_code == 422

    assert client.get("/api/place/shop/4").json()["in_plan"] is True
    client.delete("/api/plan/items/spot/4")
    assert len(client.get("/api/plan").json()["items"]) == 1

    # 店ページ
    r = client.get("/api/shops/4")
    assert r.status_code == 200 and r.json()["person"]["name"] == "瑠衣さん"
    assert client.get("/api/shops/99").status_code == 404
