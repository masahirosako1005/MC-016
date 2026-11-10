"""旅のあとの任意アンケート: 回答・お礼の解放・運営の集計（3 人未満は出さない、場所ごとの点数は出さない）・計画カードの「行きたい」タグ。"""
from __future__ import annotations

from datetime import datetime

from app import clock
from app.services import survey as svc


def test_survey_answer_unlocks_gifts(client):
    f = client.get("/api/survey").json()
    assert f["answered"] is False and len(f["places"]) == 7 and f["gift_count"] >= 1
    g = client.get("/api/gifts").json()
    assert g["unlocked"] is False and all("png" not in it for grp in g["groups"] for it in grp["items"])
    # 検証
    assert client.post("/api/survey", json={"satisfaction": 6, "revisit": 3}).status_code == 422
    assert client.post("/api/survey", json={"satisfaction": 4, "revisit": 5, "spot_id": 99}).status_code == 422
    r = client.post("/api/survey", json={"satisfaction": 4, "revisit": 5, "good": ["people", "xxx"], "trouble": ["hours", "none"], "spot_id": 4, "comment": "着いたら定休日でした"})
    assert r.status_code == 200 and r.json()["gifts_unlocked"] is True
    f = client.get("/api/survey").json()
    assert f["answered"] and f["last"]["good"] == ["people"] and f["last"]["trouble"] == ["none"]  # 「特になし」はほかと両立しない
    g = client.get("/api/gifts").json()
    assert g["unlocked"] and any(it.get("png") for grp in g["groups"] for it in grp["items"])
    # 同じ日の回答は上書き（増えない）
    client.post("/api/survey", json={"satisfaction": 5, "revisit": 5, "trouble": ["hours"], "spot_id": 4, "comment": "二回目"})
    conn = client.app.state.conn
    assert conn.execute("SELECT COUNT(*) FROM trip_surveys WHERE is_dummy = 0").fetchone()[0] == 1


def test_survey_summary_rules(client):
    conn = client.app.state.conn
    # 1 件だけでは集計を出さない
    client.post("/api/survey", json={"satisfaction": 4, "revisit": 4, "trouble": ["access"], "spot_id": 4, "comment": "バスが少ない"})
    s = client.get("/api/admin/survey").json()
    assert s["n"] == 1 and s["suppressed"] is True and s["satisfaction"] is None and s["comments"] == []
    # ほかの人の回答を足す
    for i, (sat, tr) in enumerate([(5, "access"), (3, "access"), (4, "hours"), (2, "none")]):
        conn.execute(
            "INSERT INTO trip_surveys(user_id, satisfaction, revisit, good, trouble, spot_id, comment, answered_on, created_at, is_dummy) VALUES(?,?,?,?,?,?,?,?,?,1)",
            (9000 + i, sat, sat, "people", tr, 4 if i < 2 else None, f"声 {i}", "2026-10-10", "2026-10-10T20:00:00"),
        )
    s = client.get("/api/admin/survey").json()
    assert s["n"] == 5 and s["dummy_n"] == 4 and not s["suppressed"]
    assert sum(s["satisfaction"]["counts"]) == 5 and s["satisfaction"]["avg"] == 3.6
    assert next(t for t in s["trouble"] if t["key"] == "access")["count"] == 3
    assert [t["key"] for t in s["trouble"]] == [k for k, _ in svc.TROUBLE]  # 定義の順。多い順に並べ替えない
    # お店は自分の場所の声だけ。点数は出さない
    sh = client.get("/api/admin/shops/4/dashboard").json()["shop"]
    p = client.get(f"/api/admin/shops/{sh['id']}/survey").json()
    assert p["scope"] == "place" and p["n"] == 3 and p["satisfaction"] is None and p["revisit"] is None
    assert all(c["place"] for c in p["comments"])
    assert client.get("/api/admin/shops/999/survey").status_code == 404
    # 次の一手にアンケートの声が出る
    adv = client.get("/api/admin/advice").json()["advice"]
    assert any(a["action"]["kind"] == "survey" for a in adv)


def test_wished_tag_on_place_cards(client):
    conn = client.app.state.conn
    clock.set_demo_clock(conn, datetime(2026, 10, 24, 19, 0))
    assert all(p["wished"] is None for p in client.get("/api/places").json()["places"])
    # 思い出から「行きたい」（お店 4 = 水鏡湖の店）
    r = client.post("/api/wishes", json={"kind": "shop", "target_type": "shop", "target_id": 4, "label": "湖畔カフェ 水鏡"})
    assert r.status_code == 200
    spot_id = r.json()["spot_id"]
    cards = {p["id"]: p for p in client.get("/api/places").json()["places"]}
    assert cards[spot_id]["wished"] == {"date": "2026-10-24"}
    assert sum(1 for p in cards.values() if p["wished"]) == 1
    # その後にそこへ行ったら、タグは消える
    person = cards[spot_id]["people"][0]["id"]
    clock.set_demo_clock(conn, datetime(2026, 12, 2, 11, 0))
    assert client.post("/api/meetings", json={"person_id": person}).status_code == 200
    clock.set_demo_clock(conn, datetime(2026, 12, 3, 11, 0))
    cards = {p["id"]: p for p in client.get("/api/places").json()["places"]}
    assert cards[spot_id]["wished"] is None and cards[spot_id]["last_visit"]["date"] == "2026-12-02"
