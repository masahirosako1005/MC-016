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
