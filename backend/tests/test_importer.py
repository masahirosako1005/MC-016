from pathlib import Path

from app.services.dummy import generate_dummy
from app.services.importer import import_dir, import_text

SAMPLE = Path(r"C:\AI-Sprint\sample-data")


def test_import_visits_validates_rows(conn):
    text = (
        "\ufeffユーザID,RAUND管理ユーザ名,ユーザ名,LINEログイン,周回,スタンプ名,スポット名,獲得日時\n"
        "8800001,,t,0,1,x,灯雲の石畳通り（星綴港）,2026-10-14 17:15:42\n"
        "abc,,t,0,1,x,灯雲の石畳通り（星綴港）,2026-10-14 17:15:42\n"
        "8800002,,t,0,1,x,存在しないスポット,2026-10-14 17:15:42\n"
        "8800003,,t,0,1,x,灯雲の石畳通り（星綴港）,2026/10/14\n"
    )
    r = import_text(conn, "12.csv", text.lstrip("\ufeff"))
    assert r.kind == "spot_visits"
    assert r.total == 4 and r.ok == 1 and r.inserted == 1
    reasons = [f["reason"] for f in r.failed]
    assert any("整数" in x for x in reasons)
    assert any("マスタ" in x for x in reasons)
    assert any("日時" in x for x in reasons)
    # 2 回目は増えない
    r2 = import_text(conn, "12.csv", text.lstrip("\ufeff"))
    assert r2.inserted == 0
    assert conn.execute("SELECT COUNT(*) FROM spot_visits").fetchone()[0] == 1


def test_import_unknown_header(conn):
    r = import_text(conn, "x.csv", "a,b\n1,2\n")
    assert r.kind == "unknown" and r.failed


def test_import_sample_dir_idempotent(conn):
    if not SAMPLE.exists():
        return
    first = import_dir(conn, SAMPLE)
    assert {r.kind for r in first} == {"users", "spot_visits", "legacy_rewards", "survey_post", "survey_reg"}
    counts1 = {k: conn.execute(f"SELECT COUNT(*) FROM {k}").fetchone()[0] for k in
               ("users", "spot_visits", "legacy_rewards", "survey_post", "survey_reg")}
    assert counts1["users"] >= 500
    assert counts1["spot_visits"] > 2000
    second = import_dir(conn, SAMPLE)
    assert all(r.inserted == 0 for r in second)
    counts2 = {k: conn.execute(f"SELECT COUNT(*) FROM {k}").fetchone()[0] for k in counts1}
    assert counts1 == counts2
    # 主人公のスタンプ 4 件
    assert conn.execute("SELECT COUNT(*) FROM spot_visits WHERE user_id = 8800001").fetchone()[0] == 4


def test_dummy_is_deterministic_and_idempotent(conn):
    if not SAMPLE.exists():
        return
    import_dir(conn, SAMPLE)
    n1 = generate_dummy(conn)
    assert n1 > 0
    assert conn.execute("SELECT COUNT(*) FROM meetings WHERE user_id = 8800001").fetchone()[0] == 0
    assert generate_dummy(conn) == 0
    assert conn.execute("SELECT COUNT(*) FROM meetings WHERE is_dummy = 0").fetchone()[0] == 0
