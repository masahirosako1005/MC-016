from pathlib import Path

SAMPLE = Path(r"C:\AI-Sprint\sample-data")


def test_metrics_shape_and_suppression(client):
    m = client.get("/api/metrics").json()
    for k in ("revisit_rate", "visit_interval_median_days", "post_trip_open_rate", "satisfied_but_no_revisit_rate", "spend_total", "coupon_revisits", "plan_to_visit_rate"):
        assert set(m[k]) == {"value", "n", "dummy_n", "unit", "suppressed"}
    # 主人公 1 人だけ → 3 人未満なので値は出ない
    assert m["revisit_rate"]["value"] is None and m["revisit_rate"]["suppressed"] is True
    assert "rank" not in str(m).lower()


def test_import_and_metrics_with_dummy(client):
    if not SAMPLE.exists():
        return
    pv = client.post("/api/admin/import/preview").json()
    assert len(pv["results"]) == 5 and all(r["inserted"] == 0 for r in pv["results"])
    r = client.post("/api/admin/import").json()
    assert sum(x["inserted"] for x in r["results"]) > 3000 and r["dummy_rows"] > 0
    r2 = client.post("/api/admin/import").json()
    assert all(x["inserted"] == 0 for x in r2["results"]) and r2["dummy_rows"] == 0
    m = client.get("/api/metrics").json()
    assert m["revisit_rate"]["value"] is not None and m["revisit_rate"]["n"] >= 3
    assert m["revisit_rate"]["dummy_n"] <= m["revisit_rate"]["n"]
    assert m["visit_interval_median_days"]["value"] is not None
    assert m["satisfied_but_no_revisit_rate"]["n"] > 0
    assert m["spend_by_area"] and m["coupon_revisits"]["value"] is not None
    assert m["plan_to_visit_rate"]["n"] > 0
    ov = client.get("/api/admin/overview").json()
    assert ov["dummy"]["meetings"] > 0 and len(ov["import_runs"]) >= 5


def test_admin_rate_prize_reimbursement_history(client):
    r = client.put("/api/admin/shops/4/rate", json={"rate_percent": 15})
    assert r.status_code == 200 and r.json()["rate_percent"] == 15
    assert client.put("/api/admin/shops/4/rate", json={"rate_percent": 25}).status_code == 422
    assert client.get("/api/shops/4").json()["shop"]["rate_percent"] == 15

    r = client.put("/api/admin/prizes/2", json={"weight": 10, "stock": 3, "face_value": 1500})
    assert r.status_code == 200
    p2 = next(p for p in r.json()["prizes"] if p["id"] == 2)
    assert p2["weight"] == 10 and p2["stock"] == 3 and p2["face_value"] == 1500
    r = client.put("/api/admin/prizes/1", json={"unlimited": True})
    assert next(p for p in r.json()["prizes"] if p["id"] == 1)["stock"] is None
    assert client.put("/api/admin/prizes/99", json={"weight": 1}).status_code == 404

    h = client.get("/api/admin/history").json()["history"]
    assert len(h) >= 3 and h[-1]["kind"] == "rate" and h[-1]["after"] == {"rate_percent": 15}

    assert client.get("/api/admin/reimbursement", params={"month": "2026-10"}).json()["total_count"] == 0
    assert client.get("/api/admin/reimbursement", params={"month": "202610x"}).status_code == 422
    # クーポンを使う → 補填に出る
    conn = client.app.state.conn
    conn.execute(
        "INSERT INTO coupons(user_id, prize_id, category, name, face_value, won_on, valid_from, valid_until, used_on, used_shop_id, used_at) "
        "VALUES(8800001, 1, '飲食', 'x', 500, '2026-10-01', '2026-10-02', '2027-10-01', '2026-10-24', 4, '2026-10-24T12:00:00')"
    )
    rb = client.get("/api/admin/reimbursement", params={"month": "2026-10"}).json()
    assert rb["total_count"] == 1 and rb["total_amount"] == 500
    assert next(r for r in rb["rows"] if r["shop_id"] == 4)["amount"] == 500


def test_upload_csv(client):
    text = "\ufeffuser_id,user_name,is_line,アンケート①(満足度を教えてください),アンケート②（旅で良かった点）,アンケート③（要望がありましたら）\n9000001,t,0,大変満足,景観,\n9000002,t,0,ふつう,景観,\n"
    r = client.post("/api/admin/import/upload", params={"dry_run": "true"}, files={"file": ("08.csv", text.encode("utf-8"), "text/csv")})
    assert r.status_code == 200 and r.json()["ok"] == 1 and r.json()["fail_count"] == 1 and r.json()["inserted"] == 0
    r = client.post("/api/admin/import/upload", files={"file": ("08.csv", text.encode("utf-8"), "text/csv")})
    assert r.json()["inserted"] == 1
    r = client.post("/api/admin/import/upload", files={"file": ("bad.csv", "a,b\n1,2\n".encode("cp932"), "text/csv")})
    assert r.json()["kind"] == "unknown"
