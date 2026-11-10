import importlib
import os
import subprocess
import sys
from pathlib import Path

from .test_wallet import tiny_png


def test_demo_scenes_and_reset(client):
    s = client.get("/api/demo/state").json()
    assert s["scene"] == "pre" and s["date"] == "2026-10-17" and len(s["scenes"]) == 6
    assert client.post("/api/demo/trip-day").json()["date"] == "2026-10-24"
    client.post("/api/meetings", json={"person_id": 2})
    client.post("/api/receipts", data={"shop_id": 4, "amount": 1000}, files={"image": ("r.png", tiny_png(9), "image/png")})
    assert client.post("/api/demo/night").json()["now"] == "2026-10-24T19:00:00"
    assert client.get("/api/today").json()["letter_ready"] is True
    assert client.post("/api/demo/after30").json()["scene"] == "after30"
    assert client.post("/api/demo/next-season").json()["season"] == "winter"
    # 次の季節に会えた日だけ、花を長押し
    client.post("/api/meetings", json={"person_id": 2})
    book = client.get("/api/book").json()
    p = next(x for x in book["people"] if x["id"] == 2)
    assert p["seed"]["state"] == "flower" and p["seed"]["can_fulfill"] is True
    r = client.post(f"/api/seeds/{p['seed']['id']}/fulfill").json()
    assert r["next"]["season_label"] == "春"
    # 固定当たり
    assert client.post("/api/demo/fix-lottery", json={"prize_id": 3}).json()["fixed_prize"] == 3
    assert client.post("/api/demo/fix-lottery", json={}).json()["fixed_prize"] is None
    assert client.post("/api/demo/clock", json={"at": "2026-10-24T12:30"}).json()["now"] == "2026-10-24T12:30:00"
    assert client.post("/api/demo/clock", json={"at": "bad-datetime-xx"}).status_code == 422
    # 初期化
    s = client.post("/api/demo/reset").json()
    assert s["date"] == "2026-10-17"
    assert client.get("/api/wallet").json()["balance"] == 0
    assert client.get("/api/book").json()["people"][0]["relationship"]["days"] == 0
    assert len(client.get("/api/photos").json()["photos"]) == 4


def test_demo_404_when_disabled(tmp_path: Path):
    """DEMO_MODE=0 の別プロセスで /api/demo/* が JSON 404 になること。"""
    root = Path(__file__).resolve().parents[2]
    code = (
        "import os, json\n"
        "os.environ['DEMO_MODE']='0'\n"
        f"os.environ['DB_PATH']=r'{tmp_path / 'x.db'}'\n"
        f"os.environ['UPLOADS_DIR']=r'{tmp_path / 'u'}'\n"
        f"os.environ['PHOTOS_DIR']=r'{tmp_path / 'p'}'\n"
        "from fastapi.testclient import TestClient\n"
        "from app.main import create_app\n"
        "with TestClient(create_app()) as c:\n"
        "    r = c.get('/api/demo/state'); print(r.status_code, json.dumps(r.json(), ensure_ascii=False))\n"
        "    r = c.post('/api/demo/reset'); print(r.status_code)\n"
        "    print(c.get('/api/health').json()['demo_mode'])\n"
    )
    env = dict(os.environ)
    env["PYTHONPATH"] = str(root / "backend")
    env["PYTHONUTF8"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, env=env, cwd=str(root), encoding="utf-8")
    assert out.returncode == 0, out.stderr
    lines = out.stdout.strip().splitlines()
    assert lines[0].startswith("404") and '"code": "not_found"' in lines[0]
    assert lines[1] == "404"
    assert lines[2] == "False"
    importlib.invalidate_caches()


def test_reset_clears_survey_answer(client):
    """初期化すると、主人公のアンケート回答も消える（デモをやり直すたびに、その夜の画面で回答を促せる）。ダミーの回答は残す。"""
    conn = client.app.state.conn
    conn.execute(
        "INSERT INTO trip_surveys(user_id, satisfaction, revisit, good, trouble, spot_id, comment, answered_on, created_at, is_dummy) VALUES(9001,4,4,'people','none',NULL,NULL,'2026-10-10','2026-10-10T20:00:00',1)"
    )
    assert client.post("/api/survey", json={"satisfaction": 5, "revisit": 5}).status_code == 200
    assert client.get("/api/survey").json()["answered"] is True and client.get("/api/gifts").json()["unlocked"] is True
    assert client.post("/api/demo/reset").status_code == 200
    assert client.get("/api/survey").json()["answered"] is False and client.get("/api/gifts").json()["unlocked"] is False
    assert conn.execute("SELECT COUNT(*) FROM trip_surveys WHERE is_dummy = 1").fetchone()[0] == 1
