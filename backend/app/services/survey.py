"""旅のあとの任意アンケート。
- 旅行者: 満足度・また来たいか・よかったこと・困ったこと・（任意）どの場所の声か・ひとこと。答えると ほしまるのお礼（待ち受けなど）が開く。
- 運営: 地域（DMO）は全体の集計、お店は自分の場所についての声（タグと文章）だけを見る。
  店や人ごとの点数・順位は作らない（満足度の平均は島全体でだけ出す）。3 人未満の集計は出さない。
- 不足はシード固定のダミー（is_dummy）。
"""
from __future__ import annotations

import json
import random
import sqlite3
from datetime import date, datetime, timedelta

from ..config import settings
from ..errors import AppError
from ..repositories import master

GOOD = [("people", "人との出会い"), ("scenery", "景色"), ("food", "食べもの"), ("experience", "体験"), ("photo", "AR フォト"), ("app", "アプリの使いやすさ")]
TROUBLE = [("access", "移動・アクセス"), ("hours", "営業時間が合わなかった"), ("info", "情報が足りなかった"), ("crowd", "混雑"), ("payment", "支払い方法"), ("none", "特になし")]
SCALE = {1: "不満", 2: "やや不満", 3: "ふつう", 4: "やや満足", 5: "大変満足"}
REVISIT = {1: "たぶん来ない", 2: "あまり", 3: "わからない", 4: "また来たい", 5: "ぜひまた来たい"}
MIN_N = 3  # これ未満は集計を出さない


def _keys(csv: str | None) -> list[str]:
    return [k for k in (csv or "").split(",") if k]


def answered(conn: sqlite3.Connection, uid: int) -> bool:
    return conn.execute("SELECT 1 FROM trip_surveys WHERE user_id = ? AND is_dummy = 0 LIMIT 1", (uid,)).fetchone() is not None


def form(conn: sqlite3.Connection, uid: int) -> dict:
    last = conn.execute("SELECT * FROM trip_surveys WHERE user_id = ? AND is_dummy = 0 ORDER BY id DESC LIMIT 1", (uid,)).fetchone()
    # どの場所の声か: 行ったことのある場所を先に
    visited = {r[0] for r in conn.execute(
        "SELECT DISTINCT sh.spot_id FROM meetings m JOIN people p ON p.id = m.person_id JOIN shops sh ON sh.id = p.shop_id WHERE m.user_id = ?", (uid,))}
    places = [{"id": s["id"], "name": s["name"].split("（")[0], "visited": s["id"] in visited} for s in master.spots(conn)]
    places.sort(key=lambda p: (0 if p["visited"] else 1, p["id"]))
    return {
        "answered": last is not None,
        "last": {"satisfaction": last["satisfaction"], "revisit": last["revisit"], "good": _keys(last["good"]), "trouble": _keys(last["trouble"]),
                 "spot_id": last["spot_id"], "comment": last["comment"] or "", "answered_on": last["answered_on"]} if last else None,
        "good": [{"key": k, "label": v} for k, v in GOOD],
        "trouble": [{"key": k, "label": v} for k, v in TROUBLE],
        "scale": [{"value": k, "label": v} for k, v in SCALE.items()],
        "revisit": [{"value": k, "label": v} for k, v in REVISIT.items()],
        "places": places,
        "gift_count": len(_gift_items()),
    }


def submit(conn: sqlite3.Connection, uid: int, now: datetime, satisfaction: int, revisit: int, good: list[str], trouble: list[str],
           spot_id: int | None, comment: str | None) -> dict:
    """呼び出し側で write_tx に入れること。同じ日の回答は上書き。"""
    gk = {k for k, _ in GOOD}
    tk = {k for k, _ in TROUBLE}
    good = [k for k in dict.fromkeys(good) if k in gk]
    trouble = [k for k in dict.fromkeys(trouble) if k in tk]
    if "none" in trouble:
        trouble = ["none"]
    if spot_id is not None and master.spot(conn, spot_id) is None:
        raise AppError(422, "bad_spot", "場所が見つかりません")
    day = now.date().isoformat()
    conn.execute("DELETE FROM trip_surveys WHERE user_id = ? AND answered_on = ? AND is_dummy = 0", (uid, day))
    conn.execute(
        "INSERT INTO trip_surveys(user_id, satisfaction, revisit, good, trouble, spot_id, comment, answered_on, created_at, is_dummy) VALUES(?,?,?,?,?,?,?,?,?,0)",
        (uid, satisfaction, revisit, ",".join(good), ",".join(trouble), spot_id, (comment or "").strip()[:300] or None, day, now.isoformat(timespec="seconds")),
    )
    return {"ok": True, "gifts_unlocked": True, "gift_count": len(_gift_items())}


# ---- お礼（ほしまるの素材） ----
_TYPE_LABEL = {"wallpaper": "待ち受け", "sticker": "スタンプ", "nurie": "ぬりえ", "card": "なかま証", "ar_frame": "AR フレーム"}


def _gift_items() -> list[dict]:
    for base in (settings.frontend_dist, settings.frontend_dist.parent / "public"):
        p = base / "img" / "gifts" / "gifts.json"
        if p.exists():
            try:
                return json.loads(p.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                return []
    return []


def gifts(conn: sqlite3.Connection, uid: int) -> dict:
    ok = answered(conn, uid)
    items = _gift_items()
    groups: dict[str, list[dict]] = {}
    for it in items:
        groups.setdefault(it.get("type", "other"), []).append(
            {"key": it.get("key"), "label": it.get("label"), "png": it.get("png"), "width": it.get("width"), "height": it.get("height")} if ok else {"key": it.get("key"), "label": it.get("label")}
        )
    return {
        "unlocked": ok,
        "count": len(items),
        "groups": [{"type": t, "label": _TYPE_LABEL.get(t, t), "items": v} for t, v in groups.items()],
    }


# ---- 集計（運営の窓） ----
def summary(conn: sqlite3.Connection, spot_id: int | None = None) -> dict:
    """spot_id なし = 島全体（満足度の分布も出す）。あり = その場所についての声（タグと文章だけ。点数は出さない）。"""
    where, args = ("WHERE spot_id = ?", (spot_id,)) if spot_id is not None else ("", ())
    rows = [dict(r) for r in conn.execute(f"SELECT * FROM trip_surveys {where} ORDER BY created_at DESC, id DESC", args)]
    n = len(rows)
    dummy_n = sum(1 for r in rows if r["is_dummy"])
    out: dict = {"n": n, "dummy_n": dummy_n, "suppressed": n < MIN_N, "scope": "place" if spot_id is not None else "island"}
    if n < MIN_N:
        out.update({"good": [], "trouble": [], "comments": [], "satisfaction": None, "revisit": None})
        return out

    def tally(col: str, defs: list[tuple[str, str]]) -> list[dict]:
        c: dict[str, int] = {k: 0 for k, _ in defs}
        for r in rows:
            for k in _keys(r[col]):
                if k in c:
                    c[k] += 1
        # 表示は定義の順（多い順に並べ替えない）
        return [{"key": k, "label": v, "count": c[k]} for k, v in defs]

    out["good"] = tally("good", GOOD)
    out["trouble"] = tally("trouble", TROUBLE)
    names = {s["id"]: s["name"].split("（")[0] for s in master.spots(conn)}
    out["comments"] = [
        {"date": r["answered_on"], "place": names.get(r["spot_id"]) if r["spot_id"] else None, "text": r["comment"],
         "trouble": [dict(TROUBLE).get(k, k) for k in _keys(r["trouble"]) if k != "none"], "is_dummy": bool(r["is_dummy"])}
        for r in rows if r["comment"]
    ][:12]
    if spot_id is None:
        def dist(col: str, labels: dict[int, str]) -> dict:
            counts = [sum(1 for r in rows if r[col] == v) for v in (1, 2, 3, 4, 5)]
            return {"avg": round(sum(r[col] for r in rows) / n, 2), "labels": [labels[v] for v in (1, 2, 3, 4, 5)], "counts": counts,
                    "top2_rate": round((counts[3] + counts[4]) / n, 3)}
        out["satisfaction"] = dist("satisfaction", SCALE)
        out["revisit"] = dist("revisit", REVISIT)
    else:
        out["satisfaction"] = None
        out["revisit"] = None
    return out


# ---- ダミー ----
_COMMENTS = [
    ("access", "連絡船の時刻が分かりにくく、乗り継ぎで迷いました。"),
    ("hours", "着いたら定休日でした。行く前に分かるとうれしいです。"),
    ("info", "どこで何が食べられるか、もう少し情報がほしい。"),
    ("crowd", "夜市は楽しかったけれど、少し混んでいました。"),
    ("payment", "現金のみのお店が多く、手持ちが足りなくなりそうでした。"),
    ("none", "お店の人が顔を覚えていてくれて、うれしかったです。"),
    ("none", "ほしまるとの写真がいい記念になりました。また行きます。"),
    ("none", "次は別の季節に来て、同じ人に会いたいです。"),
    ("access", "巡回バスの本数がもう少しあると回りやすいです。"),
    ("info", "雨の日の過ごし方の案内があると助かります。"),
]


def seed_dummy(conn: sqlite3.Connection) -> int:
    """運営の窓の集計が空にならないよう、ほかの利用者の回答をシード固定で作る（主人公には付けない）。"""
    if conn.execute("SELECT 1 FROM trip_surveys WHERE is_dummy = 1 LIMIT 1").fetchone():
        return 0
    users = [r["id"] for r in conn.execute("SELECT id FROM users WHERE id != ? ORDER BY id", (settings.hero_user_id,))]
    if len(users) < 10:
        return 0
    spots = [s["id"] for s in master.spots(conn)]
    rng = random.Random(settings.dummy_seed + 7)
    base = date(2026, 9, 20)
    n = 0
    for uid in rng.sample(users, min(72, len(users))):
        sat = rng.choices([1, 2, 3, 4, 5], weights=[2, 5, 15, 40, 38])[0]
        rev = max(1, min(5, sat + rng.choice([-1, 0, 0, 0, 1])))
        good = rng.sample([k for k, _ in GOOD], rng.randint(1, 3))
        tr, text = rng.choice(_COMMENTS) if rng.random() < 0.55 else (rng.choices([k for k, _ in TROUBLE], weights=[22, 18, 14, 10, 8, 28])[0], None)
        trouble = [tr]
        if tr != "none" and rng.random() < 0.25:
            other = rng.choice([k for k, _ in TROUBLE if k not in ("none", tr)])
            trouble.append(other)
        spot = rng.choice(spots) if rng.random() < 0.7 else None
        day = base + timedelta(days=rng.randint(0, 34))
        conn.execute(
            "INSERT INTO trip_surveys(user_id, satisfaction, revisit, good, trouble, spot_id, comment, answered_on, created_at, is_dummy) VALUES(?,?,?,?,?,?,?,?,?,1)",
            (uid, sat, rev, ",".join(good), ",".join(trouble), spot, text, day.isoformat(), f"{day.isoformat()}T20:30:00"),
        )
        n += 1
    return n
