import random
import struct
import zlib

from app.services import lottery
from app.services.points import sniff_image


def tiny_png(seed: int = 0) -> bytes:
    """1x1 の PNG。seed で中身を変えて別画像にする。"""
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    raw = b"\x00" + bytes([seed % 256, 0, 0])
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


def test_sniff_by_magic_bytes():
    assert sniff_image(tiny_png())[0] == "image/png"
    assert sniff_image(b"\xff\xd8\xff\xe0" + b"0" * 10)[0] == "image/jpeg"
    assert sniff_image(b"RIFF\x00\x00\x00\x00WEBPVP8 ")[0] == "image/webp"
    try:
        sniff_image(b"GIF89a")
        assert False
    except Exception as e:
        assert getattr(e, "code", "") == "unsupported_image"


def test_receipt_points_and_duplicate(client):
    r = client.post("/api/receipts", data={"shop_id": 4, "amount": 1234}, files={"image": ("r.png", tiny_png(1), "image/png")})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["rate_percent"] == 10 and j["points"] == 123 and j["balance"] == 123
    # 同じ画像は 409
    r = client.post("/api/receipts", data={"shop_id": 4, "amount": 999}, files={"image": ("r.png", tiny_png(1), "image/png")})
    assert r.status_code == 409 and r.json()["code"] == "duplicate_receipt"
    # 形式違い
    r = client.post("/api/receipts", data={"shop_id": 4, "amount": 100}, files={"image": ("r.gif", b"GIF89a....", "image/gif")})
    assert r.status_code == 415
    # 金額範囲
    r = client.post("/api/receipts", data={"shop_id": 4, "amount": 100001}, files={"image": ("r.png", tiny_png(2), "image/png")})
    assert r.status_code == 422
    # 一覧と画像
    w = client.get("/api/wallet").json()
    assert w["balance"] == 123 and len(w["receipts"]) == 1 and w["receipts"][0]["has_image"]
    img = client.get(w["receipts"][0]["image_url"])
    assert img.status_code == 200 and img.headers["content-type"].startswith("image/png")
    assert client.get("/api/receipts/999/image").status_code == 404


def test_draw_transaction_and_coupon_rules(client):
    # ポイント不足
    r = client.post("/api/draws")
    assert r.status_code == 409 and r.json()["code"] == "not_enough_points"
    client.post("/api/receipts", data={"shop_id": 3, "amount": 1000}, files={"image": ("r.png", tiny_png(3), "image/png")})
    assert client.get("/api/wallet").json()["balance"] == 100
    # 固定当たり（デモ機能）で宿泊を当てる
    conn = client.app.state.conn
    conn.execute("INSERT INTO settings(key, value) VALUES('demo_fixed_prize', '2')")
    before = conn.execute("SELECT stock FROM prizes WHERE id = 2").fetchone()[0]
    r = client.post("/api/draws")
    assert r.status_code == 200
    j = r.json()
    assert j["hit"] and j["prize"]["id"] == 2 and j["balance"] == 0
    assert conn.execute("SELECT stock FROM prizes WHERE id = 2").fetchone()[0] == before - 1
    cid = j["coupon"]["id"]
    assert j["coupon"]["valid_from"] == "2026-10-18" and j["coupon"]["valid_until"] == "2027-10-17"
    # 当日は使えない
    r = client.post(f"/api/coupons/{cid}/use", json={"shop_id": 6})
    assert r.status_code == 409 and r.json()["code"] == "coupon_not_yet"
    # カテゴリ違い
    from app import clock
    from datetime import datetime
    clock.set_demo_clock(conn, datetime(2026, 10, 24, 10, 0))
    r = client.post(f"/api/coupons/{cid}/use", json={"shop_id": 4})
    assert r.status_code == 409 and r.json()["code"] == "coupon_category_mismatch"
    r = client.post(f"/api/coupons/{cid}/use", json={"shop_id": 6})
    assert r.status_code == 200 and r.json()["used_on"] == "2026-10-24"
    r = client.post(f"/api/coupons/{cid}/use", json={"shop_id": 6})
    assert r.status_code == 409 and r.json()["code"] == "coupon_used"
    # 一覧の状態
    w = client.get("/api/wallet").json()
    assert w["coupons"][0]["state"] == "used"
    # 確率表の合計は 1
    assert abs(sum(p["probability"] for p in w["prizes"]) - 1.0) < 0.001


def test_out_of_stock_weight_goes_to_miss(conn):
    conn.execute("UPDATE prizes SET stock = 0 WHERE id = 2")
    table = lottery.prize_table(conn)
    miss = next(p for p in table if p["category"] == "miss")
    stay = next(p for p in table if p["id"] == 2)
    assert stay["effective_weight"] == 0 and miss["effective_weight"] == 30 + 5
    rng = random.Random(1)
    # 在庫 0 の商品は決して選ばれない
    cands = [p for p in table if p["effective_weight"] > 0]
    for _ in range(200):
        assert rng.choices(cands, weights=[p["effective_weight"] for p in cands])[0]["id"] != 2


def test_demo_first_draw_gives_coupon_from_someone_you_met(client):
    """デモのときだけ、最初の 1 回は「会えた人のいる区分」のクーポンが当たり、その人が渡す。本番（DEMO_MODE=0）は通常の抽選。"""
    import random

    from app.config import settings
    from app.services import lottery

    conn = client.app.state.conn
    client.post("/api/meetings", json={"person_id": 5})  # ガラス工房の職人（体験）
    for i in range(3):
        client.post("/api/receipts", data={"shop_id": 3, "amount": 1000 + i}, files={"image": ("r.png", tiny_png(40 + i), "image/png")})
    assert client.get("/api/wallet").json()["balance"] >= 300
    # 本番相当: 分岐に入らず、乱数どおりの抽選になる
    old = settings.demo_mode
    try:
        object.__setattr__(settings, "demo_mode", False)
        table = [p for p in lottery.prize_table(conn) if p["effective_weight"] > 0]
        expect = random.Random(7).choices(table, weights=[p["effective_weight"] for p in table])[0]
        conn.execute("BEGIN")
        got = lottery.draw(conn, settings.hero_user_id, __import__("datetime").datetime(2026, 10, 17, 12, 0), rng=random.Random(7))
        conn.execute("ROLLBACK")
        assert got["prize"]["id"] == expect["id"]
    finally:
        object.__setattr__(settings, "demo_mode", old)
    # デモ: 1 回目は会えた人の区分（体験）で、その人が渡す
    j = client.post("/api/draws").json()
    assert j["hit"] and j["prize"]["category"] == "体験" and j["presenter"]["id"] == 5
    # 2 回目からは通常の抽選（固定されない）。固定当たりの指定があれば、そちらが優先
    conn.execute("INSERT INTO settings(key, value) VALUES('demo_fixed_prize', '5')")
    j2 = client.post("/api/draws").json()
    assert j2["prize"]["id"] == 5 and j2["hit"] is False
