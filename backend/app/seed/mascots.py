"""星凪諸島のゆるキャラ「ほしまる」（自作。IP に頼らない）。
凪の海のごまふアザラシの子。頭に山吹の星、藍染のスカーフ、おもいで便の手紙を持つ。
場所ごとに姿・持ち物・ポーズが変わり、季節で衣装が変わる。絵は frontend/public/img/mascot/hoshimaru.png + SVG の小物。
"""
from __future__ import annotations

# spot_id → 場所ごとのほしまる
MASCOTS = {
    1: {"key": "toudai", "name": "灯台守ほしまる", "about": "灯台の帽子をかぶって、風の音を聞いている。", "pose": "風に向かってひれを広げる"},
    2: {"key": "hoshimi", "name": "星見ほしまる", "about": "望遠鏡を抱えて、干潮の星の岩を待っている。", "pose": "望遠鏡をのぞく"},
    3: {"key": "yoichi", "name": "夜市ほしまる", "about": "赤い提灯をさげて、夜市を案内する。", "pose": "提灯をさげて手招き"},
    4: {"key": "kohan", "name": "湖畔ほしまる", "about": "湖の雫の耳あてをつけて、朝霧を眺める。", "pose": "湖面をのぞきこむ"},
    5: {"key": "kazaguruma", "name": "風車ほしまる", "about": "風車の羽根を背負って、丘で風を受ける。", "pose": "丘でジャンプ"},
    6: {"key": "ishidatami", "name": "石畳ほしまる", "about": "夕焼け雲のストールを巻いて、石畳にすわる。", "pose": "石畳にすわって手をふる"},
    7: {"key": "ongakudo", "name": "音楽堂ほしまる", "about": "鈴の首かざりをつけて、ちりんと歌う。", "pose": "鈴をふって歌う"},
}

SEASON_OUTFIT = {
    "spring": "花かんむり",
    "summer": "麦わら帽子",
    "autumn": "もみじのマフラー",
    "winter": "雪の耳あてと藍染のマフラー",
}


def mascot_for(spot_id: int, season: str) -> dict | None:
    m = MASCOTS.get(spot_id)
    if not m:
        return None
    return dict(m, season=season, outfit=SEASON_OUTFIT.get(season, ""), base="ほしまる", image="/img/mascot/hoshimaru.png")
