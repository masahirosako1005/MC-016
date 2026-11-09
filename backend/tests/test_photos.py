from .test_wallet import tiny_png


def test_frame_lock_and_save(client):
    # サンプル写真が seed されている
    album = client.get("/api/photos").json()["photos"]
    assert len(album) == 4 and all(p["is_sample"] for p in album)
    assert client.get(album[0]["url"]).status_code == 200

    f = client.get("/api/photos/frame/person/1").json()
    assert f["unlocked"] is False and "会えた" in f["reason"]
    r = client.post("/api/photos", data={"kind": "person", "target_id": 1}, files={"image": ("a.png", tiny_png(5), "image/png")})
    assert r.status_code == 409 and r.json()["code"] == "frame_locked"

    client.post("/api/meetings", json={"person_id": 1})
    f = client.get("/api/photos/frame/person/1").json()
    assert f["unlocked"] is True and f["promise"]["season_label"] == "冬"
    r = client.post("/api/photos", data={"kind": "person", "target_id": 1}, files={"image": ("a.png", tiny_png(5), "image/png")})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["kind"] == "person" and d["title"] == "灯里さん" and d["promise"]["title"] == "星凪おでん"
    assert client.get(d["url"]).headers["content-type"].startswith("image/png")
    assert client.get(f"/api/photos/{d['id']}/print").status_code == 200

    # スポットは「行けた」が必要
    r = client.post("/api/photos", data={"kind": "spot", "target_id": 2}, files={"image": ("a.png", tiny_png(6), "image/png")})
    assert r.status_code == 409
    client.post("/api/checkins", json={"spot_id": 2})
    r = client.post("/api/photos", data={"kind": "spot", "target_id": 2}, files={"image": ("a.png", tiny_png(6), "image/png")})
    assert r.status_code == 200 and r.json()["kind"] == "spot"
    # PNG 以外は拒否
    r = client.post("/api/photos", data={"kind": "spot", "target_id": 2}, files={"image": ("a.jpg", b"\xff\xd8\xff" + b"0" * 10, "image/jpeg")})
    assert r.status_code == 415
    assert len(client.get("/api/photos").json()["photos"]) == 6
    assert client.get("/api/photos/999").status_code == 404
