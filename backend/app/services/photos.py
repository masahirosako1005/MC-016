"""AR フォト。合成はブラウザ側（カメラ映像 + SVG）。サーバーは解放条件の確認と保存だけ。
- 人と撮る: 今日その人に「会えた」日だけ。スポットで撮る: 今日そのスポットに「行けた」日だけ。
- PNG のみ（先頭バイト判定）、5MB まで。保存名はサーバーが決める。削除しない。
- サンプル写真（SVG）を seed して、発表中のカメラ不調時のバックアップにする。
"""
from __future__ import annotations

import sqlite3
import uuid
from datetime import date, datetime
from pathlib import Path

from ..config import settings
from ..errors import AppError
from ..repositories import master
from .season import LABEL, next_season, season_of

MAX_BYTES = 5 * 1024 * 1024


def frame_info(conn: sqlite3.Connection, uid: int, kind: str, target_id: int, now: datetime) -> dict:
    today = now.date()
    day = today.isoformat()
    season = season_of(today)
    if kind == "person":
        p = master.person(conn, target_id)
        if p is None:
            raise AppError(404, "person_not_found", "お店の人が見つかりません")
        unlocked = conn.execute("SELECT 1 FROM meetings WHERE user_id = ? AND person_id = ? AND met_on = ?", (uid, target_id, day)).fetchone() is not None
        sp = master.spot(conn, p["spot_id"])
        nxt = master.promise(conn, target_id, next_season(season))
        from ..seed.mascots import mascot_for
        return {
            "mascot": mascot_for(p["spot_id"], season),
            "spot_id": p["spot_id"],
            "kind": "person", "id": target_id, "unlocked": unlocked,
            "reason": "" if unlocked else "今日その人に「会えた」を押した日だけ撮れます",
            "title": p["name"], "subtitle": p["shop_name"], "area": p["area"], "role": p.get("role", "店主"),
            "person_svg_key": p["svg_key"], "person_image": f"/img/people/{p['svg_key']}.png",
            "scene_svg_key": sp["svg_key"] if sp else "street", "scene_image": f"/img/places/{sp['svg_key']}.jpg" if sp else None,
            "place_name": sp["name"].split("（")[0] if sp else "",
            "date": day, "season": season, "season_label": LABEL[season],
            "promise": {"season_label": LABEL[nxt["season"]], "title": nxt["title"]} if nxt else None,
        }
    raise AppError(404, "not_found", "AR フォトは「今日会えた人」といっしょに撮ります")


def save_photo(conn: sqlite3.Connection, uid: int, kind: str, target_id: int, data: bytes, now: datetime) -> dict:
    info = frame_info(conn, uid, kind, target_id, now)
    if not info["unlocked"]:
        raise AppError(409, "frame_locked", info["reason"])
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise AppError(415, "unsupported_image", "写真は PNG で保存してください")
    if len(data) > MAX_BYTES:
        raise AppError(413, "image_too_large", "写真は 5MB までです")
    settings.photos_dir.mkdir(parents=True, exist_ok=True)
    path = settings.photos_dir / f"{uuid.uuid4().hex}.png"
    path.write_bytes(data)
    cur = conn.execute(
        "INSERT INTO photos(user_id, kind, person_id, spot_id, taken_on, path, is_sample, created_at) VALUES(?,?,?,?,?,?,0,?)",
        (uid, kind, target_id if kind == "person" else None, target_id if kind == "spot" else None,
         now.date().isoformat(), str(path), now.isoformat(timespec="seconds")),
    )
    return photo_detail(conn, uid, cur.lastrowid)


def _row_to_item(conn: sqlite3.Connection, r: sqlite3.Row) -> dict:
    d = dict(r)
    if d["kind"] == "person":
        p = master.person(conn, d["person_id"])
        d["title"] = p["name"] if p else ""
        d["subtitle"] = p["shop_name"] if p else ""
        d["area"] = p["area"] if p else ""
        d["person_svg_key"] = p["svg_key"] if p else None
        d["person_image"] = f"/img/people/{p['svg_key']}.png" if p else None
    else:
        s = master.spot(conn, d["spot_id"])
        d["title"] = s["name"].split("（")[0] if s else ""
        d["subtitle"] = f"{s['area']}の風景" if s else ""
        d["area"] = s["area"] if s else ""
        d["person_svg_key"] = None
        d["person_image"] = None
    d["url"] = f"/api/photos/{d['id']}/image"
    d["is_sample"] = bool(d["is_sample"])
    d["season_label"] = LABEL[season_of(date.fromisoformat(d["taken_on"]))]
    d.pop("path", None)
    return d


def album(conn: sqlite3.Connection, uid: int) -> list[dict]:
    return [_row_to_item(conn, r) for r in conn.execute("SELECT * FROM photos WHERE user_id = ? ORDER BY taken_on DESC, id DESC", (uid,))]


def photo_detail(conn: sqlite3.Connection, uid: int, photo_id: int) -> dict:
    r = conn.execute("SELECT * FROM photos WHERE id = ? AND user_id = ?", (photo_id, uid)).fetchone()
    if r is None:
        raise AppError(404, "photo_not_found", "写真が見つかりません")
    d = _row_to_item(conn, r)
    # 印刷用: その人の次の季節の約束（人の写真のとき）
    d["promise"] = None
    if d["kind"] == "person" and d["person_id"]:
        taken = date.fromisoformat(d["taken_on"])
        pr = master.promise(conn, d["person_id"], next_season(season_of(taken)))
        if pr:
            d["promise"] = {"season_label": LABEL[pr["season"]], "title": pr["title"], "note": pr["note"]}
    d["share_text"] = f"{d['title']}と撮った一枚 #ひとめぐり便 #星凪諸島 #{d['area']}" if d["kind"] == "person" else f"{d['title']}で撮った一枚 #ひとめぐり便 #星凪諸島"
    # 戻り先（場所の画面）
    if d["kind"] == "person" and d["person_id"]:
        p = master.person(conn, d["person_id"])
        d["spot_id"] = p["spot_id"] if p else None
        from ..seed.mascots import mascot_for
        d["mascot"] = mascot_for(p["spot_id"], season_of(date.fromisoformat(d["taken_on"]))) if p else None
    else:
        d["mascot"] = None
    return d


def photo_file(conn: sqlite3.Connection, uid: int, photo_id: int) -> tuple[Path, str]:
    r = conn.execute("SELECT path FROM photos WHERE id = ? AND user_id = ?", (photo_id, uid)).fetchone()
    if r is None:
        raise AppError(404, "photo_not_found", "写真が見つかりません")
    p = Path(r["path"])
    if not p.exists():
        raise AppError(404, "photo_not_found", "写真ファイルが見つかりません")
    return p, ("image/svg+xml" if p.suffix == ".svg" else "image/png")


# ---- サンプル写真（SVG）。主人公の前回の旅（10/14〜16 のスタンプ）に合わせる。
_SAMPLE = [
    ("spot", 6, "2026-10-14", "#f1d6b8", "#8d6e63"),
    ("spot", 3, "2026-10-14", "#2d2a3a", "#ff8a65"),
    ("spot", 1, "2026-10-15", "#dbeaf3", "#7fb3c8"),
    ("spot", 4, "2026-10-16", "#f6ecdd", "#7d9b76"),
]


def seed_sample_photos(conn: sqlite3.Connection, uid: int) -> int:
    if conn.execute("SELECT 1 FROM photos WHERE user_id = ? AND is_sample = 1 LIMIT 1", (uid,)).fetchone():
        return 0
    settings.photos_dir.mkdir(parents=True, exist_ok=True)
    n = 0
    for kind, sid, day, bg, fg in _SAMPLE:
        s = master.spot(conn, sid)
        if not s:
            continue
        title = s["name"].replace("（", " ").replace("）", "")
        svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1200" width="900" height="1200">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{bg}"/><stop offset="1" stop-color="{fg}"/></linearGradient></defs>
<rect width="900" height="1200" fill="url(#g)"/>
<circle cx="700" cy="220" r="90" fill="#fff6d5" opacity=".9"/>
<path d="M0 900 Q225 780 450 880 T900 860 L900 1200 L0 1200Z" fill="{fg}" opacity=".8"/>
<path d="M0 980 Q300 900 600 980 T900 960 L900 1200 L0 1200Z" fill="#3b3a36" opacity=".55"/>
<g opacity=".95"><circle cx="450" cy="760" r="120" fill="#f4d7c2"/><path d="M330 740 Q450 600 570 740 L570 700 Q450 640 330 700Z" fill="#5d4037"/>
<circle cx="410" cy="770" r="10" fill="#333"/><circle cx="490" cy="770" r="10" fill="#333"/><path d="M415 815 Q450 845 485 815" stroke="#a0522d" stroke-width="8" fill="none" stroke-linecap="round"/>
<path d="M300 1200 Q450 980 600 1200Z" fill="#2f5d62"/></g>
<rect x="40" y="40" width="820" height="110" rx="20" fill="#ffffff" opacity=".85"/>
<text x="70" y="88" font-size="40" font-family="sans-serif" font-weight="700" fill="#27323a">{title}</text>
<text x="70" y="130" font-size="30" font-family="sans-serif" fill="#2f5d62">{day.replace('-', '/')}・秋・AR フォト（サンプル）</text>
</svg>"""
        path = settings.photos_dir / f"sample_{sid}_{day}.svg"
        path.write_text(svg, encoding="utf-8")
        conn.execute(
            "INSERT INTO photos(user_id, kind, person_id, spot_id, taken_on, path, is_sample, created_at) VALUES(?,?,?,?,?,?,1,?)",
            (uid, kind, None, sid, day, str(path), f"{day}T15:00:00"),
        )
        n += 1
    return n
