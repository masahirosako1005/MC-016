from datetime import date

from app.services.season import md_in_range, next_season, season_of, weeks_until_next_season
from app.services.trips import cluster_trips, median


def test_season_boundaries():
    assert season_of(date(2026, 3, 1)) == "spring"
    assert season_of(date(2026, 5, 31)) == "spring"
    assert season_of(date(2026, 6, 1)) == "summer"
    assert season_of(date(2026, 9, 1)) == "autumn"
    assert season_of(date(2026, 11, 30)) == "autumn"
    assert season_of(date(2026, 12, 1)) == "winter"
    assert season_of(date(2027, 2, 28)) == "winter"
    assert next_season("autumn") == "winter"
    assert next_season("winter") == "spring"


def test_weeks_until_next_season():
    assert weeks_until_next_season(date(2026, 11, 23)) == 1  # 12/1 まで 8 日
    assert weeks_until_next_season(date(2026, 12, 1)) == 12  # 3/1 まで 90 日
    assert weeks_until_next_season(date(2027, 1, 15)) == 6


def test_md_in_range_wraps_year():
    assert md_in_range(date(2026, 12, 15), "12-01", "02-28")
    assert md_in_range(date(2027, 1, 10), "12-01", "02-28")
    assert not md_in_range(date(2026, 6, 1), "12-01", "02-28")
    assert not md_in_range(date(2026, 6, 1), None, None)


def test_cluster_trips_gap_2_days():
    days = [date(2026, 10, 14), date(2026, 10, 15), date(2026, 10, 16), date(2026, 10, 24), date(2026, 11, 23)]
    trips = cluster_trips(days, 2)
    assert trips == [
        (date(2026, 10, 14), date(2026, 10, 16)),
        (date(2026, 10, 24), date(2026, 10, 24)),
        (date(2026, 11, 23), date(2026, 11, 23)),
    ]
    assert median([3, 1, 2]) == 2
    assert median([1, 2, 3, 4]) == 2.5
    assert median([]) is None


def test_health_and_404(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["demo_mode"] is True
    assert body["date"] == "2026-10-17"
    assert body["season"] == "autumn"
    assert "Content-Security-Policy" in r.headers

    r = client.get("/api/nothing-here")
    assert r.status_code == 404
    j = r.json()
    assert set(j) == {"detail", "code", "request_id"}
    assert j["code"] == "not_found"


def test_spa_never_serves_outside_dist(client):
    """SPA 配信は dist の外を返さない（%2F・%2e・%5C でエンコードした .. も含む）。"""
    import pytest

    from app.config import settings

    if not settings.frontend_dist.exists():
        pytest.skip("frontend/dist がない（npm run build 前）")
    for p in ("/..%2F..%2Fpyproject.toml", "/%2e%2e/%2e%2e/pyproject.toml", "/..%5C..%5Cpyproject.toml", "/x/..%2F..%2F..%2Fpyproject.toml"):
        r = client.get(p)
        assert r.status_code == 200, p
        assert r.headers["content-type"].startswith("text/html"), p
        assert "[project]" not in r.text, p
    # 正規の静的ファイルと SPA フォールバックは今まで通り
    assert client.get("/index.html").status_code == 200
    assert "<!doctype html>" in client.get("/plan").text.lower()


def test_people_have_natural_names_and_old_names_are_replaced(conn):
    """会える人は苗字 + さん。旧名が残っている既存の文章（店の紹介・便りなど）は、起動時の置き換えで新しい名前になる（何度やっても同じ）。"""
    from app.seed.master import PEOPLE_RENAMES, rename_people, seed_master

    names = [r["name"] for r in conn.execute("SELECT name FROM people ORDER BY id")]
    assert names == ["明石さん", "水野さん", "望月さん", "三浦さん", "藤井さん", "鈴木さん", "浜田さん", "舟木さん"]
    # 旧版の DB を再現
    conn.execute("UPDATE people SET name = '瑠衣さん' WHERE id = 2")
    conn.execute("UPDATE shops SET description = '朝霧の時間が一番きれいだと瑠衣さんは言う。', recommend = '鈴さんのお茶もどうぞ' WHERE id = 4")
    conn.execute("INSERT INTO messages(shop_id, title, body, created_at, sent_to) VALUES(4, '冬のお知らせ', '窓際の席を温めて待っています。瑠衣さんより', '2026-10-24T10:00:00', 1)")
    seed_master(conn)
    assert conn.execute("SELECT name FROM people WHERE id = 2").fetchone()[0] == "水野さん"
    sh = conn.execute("SELECT description, recommend FROM shops WHERE id = 4").fetchone()
    assert "水野さん" in sh["description"] and sh["recommend"] == "鈴木さんのお茶もどうぞ"
    assert conn.execute("SELECT body FROM messages").fetchone()[0].endswith("水野さんより")
    assert rename_people(conn) == 0  # 2 回目は何も変えない
    olds = [o for o, _ in PEOPLE_RENAMES]
    for table, col in (("shops", "description"), ("promises", "note"), ("voices", "text")):
        for r in conn.execute(f"SELECT {col} FROM {table}"):
            assert not any(o in (r[0] or "") for o in olds)
