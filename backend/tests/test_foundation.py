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
