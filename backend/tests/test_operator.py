from datetime import datetime

from app import clock

from .test_wallet import tiny_png


def test_dmo_dashboard_and_events(client):
    d = client.get("/api/admin/dashboard").json()
    assert len(d["series"]) == 6 and "spend" in d["series"][0] and "visitors" in d["series"][0]
    r = client.post("/api/admin/events", json={"date": "2026-10-25", "title": "J1 ホームゲーム", "kind": "スポーツ", "expected": 15000, "note": "16 時キックオフ"})
    assert r.status_code == 200 and r.json()["title"] == "J1 ホームゲーム"
    assert client.post("/api/admin/events", json={"date": "2026/10/25", "title": "x"}).status_code == 422
    ev = client.get("/api/admin/events").json()["events"]
    assert len(ev) == 1
    client.delete(f"/api/admin/events/{ev[0]['id']}")
    assert client.get("/api/admin/events").json()["events"] == []


def test_shop_edit_photo_and_dashboard(client):
    r = client.put("/api/admin/shops/4", json={"recommend": "朝霧の時間が一番きれいです", "description": "湖の岸に立つ木の小屋。"})
    assert r.status_code == 200 and r.json()["recommend"].startswith("朝霧")
    assert client.get("/api/shops/4/photo").status_code == 404
    r = client.post("/api/admin/shops/4/photo", files={"image": ("p.png", tiny_png(21), "image/png")})
    assert r.status_code == 200
    assert client.get("/api/shops/4/photo").status_code == 200
    # 場所カードの写真とおすすめが店の編集に追従する
    pl = client.get("/api/places/4").json()
    assert pl["image"] == "/api/shops/4/photo" and pl["recommend"].startswith("朝霧")
    assert client.put("/api/admin/shops/99", json={"recommend": "x"}).status_code == 404
    sd = client.get("/api/admin/shops/4/dashboard").json()
    assert sd["shop"]["id"] == 4 and len(sd["series"]) == 6 and "meetings_area_avg" in sd["series"][0]
    assert client.get("/api/admin/shops/99/dashboard").status_code == 404


def test_shop_message_with_coupon_reaches_traveler(client):
    conn = client.app.state.conn
    clock.set_demo_clock(conn, datetime(2026, 10, 24, 11, 0))
    # まだ会っていない → 届かない
    r = client.post("/api/admin/shops/8/messages", json={"title": "雪見ぜんざい、はじめました", "body": "また来てね", "coupon_face_value": 300, "coupon_days": 60})
    assert r.status_code == 200 and r.json()["sent_to"] == 0
    assert client.get("/api/messages").json()["messages"] == []
    # 鈴さんに会う → 便りが届き、クーポンも付く
    client.post("/api/meetings", json={"person_id": 6})
    r = client.post("/api/admin/shops/8/messages", json={"title": "冬のお知らせ", "body": "雪見ぜんざいを用意しています", "coupon_face_value": 300, "coupon_days": 60})
    assert r.json()["sent_to"] == 1
    msgs = client.get("/api/messages").json()["messages"]
    assert len(msgs) == 2 and msgs[0]["title"] == "冬のお知らせ" and msgs[0]["read"] is False and msgs[0]["person_name"] == "鈴さん"
    client.post(f"/api/messages/{msgs[0]['id']}/read")
    assert client.get("/api/messages").json()["messages"][0]["read"] is True
    w = client.get("/api/wallet").json()
    c = next(x for x in w["coupons"] if "便り" in x["name"])
    assert c["face_value"] == 300 and c["state"] == "usable" and c["category"] == "飲食"
    # 抽選の確率表には出ない
    assert all(p["name"] != "お店からの便り" for p in w["prizes"])


def test_audience_targeting_and_advice(client):
    conn = client.app.state.conn
    clock.set_demo_clock(conn, datetime(2026, 10, 24, 11, 0))
    client.post("/api/meetings", json={"person_id": 6})  # 鈴さん → はじめまして・冬の種（つぼみ）
    a = client.get("/api/admin/shops/8/audience").json()
    assert a["total"] == 1 and a["stages"]["first"] == 1 and a["seeds"]["bud"] == 1
    assert client.get("/api/admin/shops/8/audience", params={"stages": "regular"}).json()["selected"] == 0
    assert client.get("/api/admin/shops/8/audience", params={"seeds": "bud"}).json()["selected"] == 1
    # 絞り込んだ宛先にだけ届く
    r = client.post("/api/admin/shops/8/messages", json={"title": "x", "body": "y", "stages": ["regular"]})
    assert r.json()["sent_to"] == 0
    r = client.post("/api/admin/shops/8/messages", json={"title": "x", "body": "y", "seeds": ["bud"], "coupon_face_value": 300, "coupon_days": 30})
    assert r.json()["sent_to"] == 1
    # 次の一手
    adv = client.get("/api/admin/shops/8/advice").json()
    assert adv["advice"] and any("会った" in x["title"] for x in adv["advice"])
    assert all(set(x) >= {"priority", "title", "why", "action"} for x in adv["advice"])
    d = client.get("/api/admin/advice").json()
    assert "advice" in d and "生成 AI" in d["note"]
    # 店の旅行情報
    sd = client.get("/api/admin/shops/8/dashboard").json()
    assert sd["shop"]["address"].startswith("星凪諸島") and sd["shop"]["phone"]
    r = client.put("/api/admin/shops/8", json={"address": "星凪諸島 鈴風高原 1-2-3", "closed_weekday": 3, "open_time": "09:30", "close_time": "16:30"})
    assert r.status_code == 200 and r.json()["address"].endswith("1-2-3") and r.json()["closed_weekday"] == 3 and r.json()["open_time"] == "09:30"
    p = client.get("/api/people/6").json()
    assert p["shop"]["address"].endswith("1-2-3") and p["shop"]["phone"]
    f = client.get("/api/photos/frame/person/6").json()
    assert f["mascot"]["image"] == "/img/mascot/hoshimaru_hall.png" and f["frames"][0]["key"] == "spot_hall" and f["frames"][-1]["key"] == "none"


def test_shop_edit_keeps_closed_weekday_and_rejects_bad_time(client):
    """一部の項目だけ PUT しても定休日は消えない。null を明示したときだけ無休になる。実在しない時刻は 422。"""
    sh = client.get("/api/admin/shops/4/dashboard").json()["shop"]
    assert sh["closed_weekday"] == 1
    r = client.put("/api/admin/shops/4", json={"recommend": "朝が静かです"})
    assert r.status_code == 200 and r.json()["closed_weekday"] == 1 and r.json()["open_time"] == "09:00"
    r = client.put("/api/admin/shops/4", json={"closed_weekday": None})
    assert r.status_code == 200 and r.json()["closed_weekday"] is None
    r = client.put("/api/admin/shops/4", json={"closed_weekday": 5, "open_time": "10:30"})
    assert r.json()["closed_weekday"] == 5 and r.json()["open_time"] == "10:30"
    for bad in ({"open_time": "99:99"}, {"close_time": "12:60"}, {"open_time": "24:00"}):
        assert client.put("/api/admin/shops/4", json=bad).status_code == 422, bad
    # 利用者側の画面は落ちない
    assert client.get("/api/today").status_code == 200
    assert client.get("/api/places").status_code == 200
    # 起動のたびに走るマスタ seed で編集が消えない
    from app.seed.master import seed_master

    seed_master(client.app.state.conn)
    sh = client.get("/api/admin/shops/4/dashboard").json()["shop"]
    assert sh["closed_weekday"] == 5 and sh["open_time"] == "10:30"


def test_audience_follows_demo_clock(client):
    """便りの宛先の「花」判定はデモ時計で決まる（実時刻ではない）。"""
    conn = client.app.state.conn
    clock.set_demo_clock(conn, datetime(2026, 10, 24, 11, 0))
    client.post("/api/meetings", json={"person_id": 6})  # 秋に会う → 冬の種
    assert client.get("/api/admin/shops/8/audience").json()["seeds"] == {"none": 0, "bud": 1, "flower": 0}
    clock.set_demo_clock(conn, datetime(2026, 12, 1, 10, 0))  # 冬 → 花
    a = client.get("/api/admin/shops/8/audience").json()
    assert a["seeds"] == {"none": 0, "bud": 0, "flower": 1}
    assert client.get("/api/admin/shops/8/audience", params={"seeds": "flower"}).json()["selected"] == 1
    adv = client.get("/api/admin/shops/8/advice").json()["advice"]
    assert any("会った" in x["title"] for x in adv)
    # 花の人にだけ送る
    r = client.post("/api/admin/shops/8/messages", json={"title": "花", "body": "y", "seeds": ["flower"]})
    assert r.json()["sent_to"] == 1
