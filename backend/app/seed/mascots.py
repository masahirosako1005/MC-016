"""星凪諸島のゆるキャラ「ほしまる」（自作。IP に頼らない）。
凪の海のごまふアザラシの子。頭に山吹の星、藍染のスカーフ、おもいで便の手紙を持つ。
場所ごとに姿・持ち物・ポーズが変わる絵（img/mascot/hoshimaru_<svg_key>.png）と、
AR フォト用のフレーム（img/frames/）がある。UI 用のポーズ差分は img/mascot/ui/。
"""
from __future__ import annotations

# spot_id → 場所ごとのほしまる
MASCOTS = {
    1: {"key": "lighthouse", "name": "灯台守ほしまる", "about": "灯台の帽子をかぶって、風の音を聞いている。", "pose": "風に向かってひれを広げる"},
    2: {"key": "cape", "name": "星見ほしまる", "about": "望遠鏡を抱えて、干潮の星の岩を待っている。", "pose": "望遠鏡をのぞく"},
    3: {"key": "market", "name": "夜市ほしまる", "about": "赤い提灯をさげて、夜市を案内する。", "pose": "提灯をさげて手招き"},
    4: {"key": "lake", "name": "湖畔ほしまる", "about": "湖の雫の耳あてをつけて、朝霧を眺める。", "pose": "湖面をのぞきこむ"},
    5: {"key": "windmill", "name": "風車ほしまる", "about": "麦わら帽子に菜の花。風車の丘で風を受ける。", "pose": "丘でジャンプ"},
    6: {"key": "street", "name": "石畳ほしまる", "about": "夕焼け雲のストールを巻いて、石畳にすわる。", "pose": "石畳にすわって手をふる"},
    7: {"key": "hall", "name": "音楽堂ほしまる", "about": "鈴の首かざりをつけて、ちりんと歌う。", "pose": "鈴をふって歌う"},
}

SEASON_OUTFIT = {
    "spring": "花かんむり",
    "summer": "麦わら帽子",
    "autumn": "もみじのマフラー",
    "winter": "雪の耳あてと藍染のマフラー",
}

COMMON_FRAMES = [
    {"key": "ai", "label": "藍の縁"},
    {"key": "hoshizora", "label": "星空"},
    {"key": "hagaki", "label": "おもいで便の切手"},
    {"key": "cheki", "label": "和紙のチェキ"},
    {"key": "hyokkori", "label": "ひょっこり"},
]


def frames_for(svg_key: str, place_name: str) -> list[dict]:
    out = [{"key": f"spot_{svg_key}", "label": f"{place_name}のフレーム", "png": f"/img/frames/frame_spot_{svg_key}.png", "spot": True}]
    out += [{"key": f["key"], "label": f["label"], "png": f"/img/frames/frame_{f['key']}.png", "spot": False} for f in COMMON_FRAMES]
    out.append({"key": "none", "label": "フレームなし（ほしまるを動かす）", "png": None, "spot": False})
    return out


def mascot_for(spot_id: int, season: str) -> dict | None:
    m = MASCOTS.get(spot_id)
    if not m:
        return None
    return dict(m, season=season, outfit=SEASON_OUTFIT.get(season, ""), base="ほしまる", image=f"/img/mascot/hoshimaru_{m['key']}.png")
