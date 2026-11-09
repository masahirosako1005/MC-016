"""ほしまるの UI 用ポーズ差分（背景透過）と AR フォト用フレームを作る。

使い方: python scripts/mascot/gen_hoshimaru_ui.py
出力:
  frontend/public/img/mascot/ui/hoshimaru_<pose>.svg   … 背景透過・360×360（viewBox 20 20 360 360）
  frontend/public/img/frames/frame_<key>.svg           … 900×1200（AR フォトの canvas と同じ 3:4）、写真の部分は透明
体・顔・星の部品は gen_hoshimaru.py と共通。
"""
from __future__ import annotations

import math
from pathlib import Path

from gen_hoshimaru import (BLUSH, BODY_D, GOLD, INK, INK2, INK3, PAPER, REST_LEFT, SPOT, SW, TAIL, WARM,
                           WAVE_LEFT, band, band_dots, body_close, body_fill, flipper, head_star, scarf_knot,
                           sparkle, star_points)

ROOT = Path(__file__).resolve().parents[2] / "frontend" / "public" / "img"
UI_OUT = ROOT / "mascot" / "ui"
FRAME_OUT = ROOT / "frames"
MINCHO = "'Yu Mincho','YuMincho','Hiragino Mincho ProN',serif"
GOTHIC = "'Yu Gothic UI','Yu Gothic','Hiragino Sans',sans-serif"

DEFS = (f'<clipPath id="body"><path d="{BODY_D}"/></clipPath>'
        '<symbol id="spark" viewBox="-10 -10 20 20"><path d="M0 -10 Q1.6 -1.6 10 0 Q1.6 1.6 0 10 '
        'Q-1.6 1.6 -10 0 Q-1.6 -1.6 0 -10 Z"/></symbol>')


# ---------- 顔（UI 用に表情を増やしたもの） ----------
def face(eyes="open", mouth="w", look=(0, 0)) -> str:
    lx, ly = look
    s = '<g transform="translate(0 12)">'
    s += (f'<ellipse cx="138" cy="226" rx="17" ry="10" fill="{BLUSH}" opacity="0.6"/>'
          f'<ellipse cx="262" cy="226" rx="17" ry="10" fill="{BLUSH}" opacity="0.6"/>')
    for x in (160, 240):
        if eyes == "happy":
            s += f'<path d="M{x - 12} 204 Q{x} 190 {x + 12} 204" fill="none" stroke="{INK}" stroke-width="5" stroke-linecap="round"/>'
        elif eyes == "closed":
            s += f'<path d="M{x - 12} 200 Q{x} 211 {x + 12} 200" fill="none" stroke="{INK}" stroke-width="5" stroke-linecap="round"/>'
        elif eyes == "xx":
            d = 1 if x < 200 else -1
            s += (f'<path d="M{x - 10 * d} 190 L{x + 8 * d} 200 L{x - 10 * d} 210" fill="none" stroke="{INK}" '
                  f'stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>')
        else:
            s += (f'<ellipse cx="{x + lx}" cy="{200 + ly}" rx="12" ry="15" fill="{INK}"/>'
                  f'<circle cx="{x + 3 + lx * 1.4}" cy="{193 + ly * 1.4}" r="4.5" fill="#ffffff"/>'
                  f'<circle cx="{x - 4 + lx}" cy="{207 + ly}" r="2" fill="#ffffff"/>')
    s += f'<ellipse cx="200" cy="218" rx="7.5" ry="5.5" fill="{INK}"/>'
    if mouth == "open":
        s += (f'<path d="M188 227 Q200 247 212 227 Q200 231 188 227 Z" fill="{INK}" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>'
              f'<ellipse cx="200" cy="237" rx="5" ry="3" fill="{BLUSH}"/>')
    elif mouth == "small":
        s += f'<ellipse cx="200" cy="232" rx="4.5" ry="5" fill="{INK}"/>'
    elif mouth == "wavy":
        s += f'<path d="M184 232 q4 -6 8 0 t8 0 t8 0 t8 0" fill="none" stroke="{INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
    else:
        s += f'<path d="M186 226 Q193 236 200 226 Q207 236 214 226" fill="none" stroke="{INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
    s += (f'<g fill="#9aabc6"><circle cx="178" cy="222" r="1.8"/><circle cx="172" cy="229" r="1.8"/>'
          f'<circle cx="222" cy="222" r="1.8"/><circle cx="228" cy="229" r="1.8"/></g></g>')
    return s


def character(behind="", face_svg=None, front="", hat="", star=None, extra="") -> str:
    return (behind + body_fill() + band() + band_dots() + body_close()
            + (face_svg if face_svg is not None else face()) + hat
            + (star if star is not None else head_star()) + front + extra)


BOTH_FRONT = flipper(170, 306, 13, 22, 35) + flipper(230, 306, 13, 22, -35)
RIGHT_FRONT = flipper(292, 300, 13, 22, -30)

ENVELOPE = (f'<g transform="translate(0 8) rotate(-8 252 306)">'
            f'<rect x="212" y="282" width="80" height="52" rx="6" fill="{PAPER}" stroke="{INK}" stroke-width="4.5"/>'
            f'<path d="M215 286 L252 312 L289 286" fill="none" stroke="{INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>'
            f'<circle cx="252" cy="312" r="8" fill="{INK}"/>'
            f'<use href="#spark" x="246" y="306" width="12" height="12" fill="{PAPER}"/></g>'
            f'<path d="M298 276 C308 288 306 308 294 316 C284 322 274 314 276 302 C278 290 286 278 298 276 Z" '
            f'fill="#f1f5fb" stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round"/>')


# ---------- UI ポーズ ----------
def pose_wave():
    return character(WAVE_LEFT + TAIL, face("open", "w"), scarf_knot() + RIGHT_FRONT)


def pose_cheer():
    spk = sparkle(40, 120, 26, "#b3c1d8") + sparkle(334, 108, 22, "#b3c1d8") + sparkle(60, 64, 14, "#b3c1d8")
    return character(flipper(84, 168, 14, 34, -22) + flipper(316, 168, 14, 34, 22) + TAIL,
                     face("happy", "open"), scarf_knot(), extra=spk)


def pose_point():
    tip = sparkle(348, 196, 18, "#b3c1d8")
    return character(REST_LEFT + flipper(334, 230, 13, 30, 72) + TAIL, face("open", "open", look=(5, -1)),
                     scarf_knot(), extra=tip)


def pose_letter():
    return character(WAVE_LEFT + TAIL, face("open", "w"), scarf_knot() + ENVELOPE)


def pose_think():
    q = (f'<text x="292" y="150" font-family="{GOTHIC}" font-weight="700" font-size="56" fill="{INK3}">?</text>'
         f'<circle cx="270" cy="168" r="5" fill="#b3c1d8"/><circle cx="258" cy="182" r="3.5" fill="#b3c1d8"/>')
    return character(TAIL, face("open", "small", look=(-3, -4)), scarf_knot() + flipper(146, 268, 11, 20, 40),
                     extra=q)


def pose_sleep():
    z = (f'<g font-family="{GOTHIC}" font-weight="700" fill="{INK3}">'
         f'<text x="270" y="128" font-size="40">Z</text><text x="304" y="96" font-size="28">z</text>'
         f'<text x="328" y="72" font-size="20">z</text></g>')
    return character(REST_LEFT + TAIL, face("closed", "small"), scarf_knot(),
                     star=head_star(cx=230, cy=104, stem_from=(200, 124), rot=40), extra=z)


def pose_sorry():
    drop = (f'<path d="M292 148 Q306 170 300 180 Q292 190 284 180 Q278 170 292 148 Z" fill="#cfe1f1" '
            f'stroke="{INK}" stroke-width="3.5" stroke-linejoin="round"/>')
    return character(TAIL, face("xx", "wavy"), scarf_knot() + BOTH_FRONT, extra=drop)


def heart(x, y, s, fill=BLUSH) -> str:
    return (f'<path transform="translate({x} {y}) scale({s})" d="M0 6 C-10 -4 -20 4 -12 14 L0 26 L12 14 '
            f'C20 4 10 -4 0 6 Z" fill="{fill}"/>')


def pose_thanks():
    inner = character(TAIL, face("happy", "w"), scarf_knot() + BOTH_FRONT)
    return (f'<g transform="rotate(-8 200 330)">{inner}</g>'
            + heart(318, 120, 1.3) + heart(76, 150, 0.9) + heart(340, 176, 0.7))


def pose_camera():
    cam = (f'<rect x="180" y="268" width="22" height="12" rx="3" fill="{INK2}" stroke="{INK}" stroke-width="3.5"/>'
           f'<rect x="164" y="276" width="72" height="48" rx="9" fill="{INK2}" stroke="{INK}" stroke-width="4.5"/>'
           f'<circle cx="200" cy="300" r="15" fill="{PAPER}" stroke="{INK}" stroke-width="4"/>'
           f'<circle cx="200" cy="300" r="7" fill="{INK3}"/><circle cx="196" cy="296" r="2.5" fill="#ffffff"/>'
           f'<rect x="216" y="283" width="10" height="6" rx="2" fill="{WARM}"/>'
           + flipper(160, 304, 13, 22, 35) + flipper(240, 304, 13, 22, -35))
    return character(TAIL, face("happy", "open"), scarf_knot() + cam)


def pose_coupon():
    tk = (f'<g transform="rotate(-10 208 300)">'
          f'<path d="M158 276 H258 V292 A8 8 0 0 0 258 308 V324 H158 V308 A8 8 0 0 0 158 292 Z" '
          f'fill="{PAPER}" stroke="{INK}" stroke-width="4.5" stroke-linejoin="round"/>'
          f'<path d="M158 276 H192 V324 H158 V308 A8 8 0 0 0 158 292 Z" fill="{INK2}"/>'
          f'<path d="M192 280 V320" stroke="{INK}" stroke-width="2.5" stroke-dasharray="5 4"/>'
          f'<use href="#spark" x="167" y="292" width="16" height="16" fill="{PAPER}"/>'
          f'<path d="M204 292 H244 M204 304 H234" stroke="{INK3}" stroke-width="4" stroke-linecap="round"/></g>'
          + flipper(160, 306, 13, 22, 35) + flipper(256, 300, 13, 22, -35))
    return character(WAVE_LEFT + TAIL, face("open", "open"), scarf_knot() + tk)


POSES = {
    "wave": (pose_wave, "手をふる（あいさつ・初回ガイド）"),
    "cheer": (pose_cheer, "ばんざい（当選・達成・種が花に）"),
    "point": (pose_point, "右を指す（いまやること・案内）"),
    "letter": (pose_letter, "手紙を持つ（おもいで便）"),
    "think": (pose_think, "考え中（読み込み・しらべる）"),
    "sleep": (pose_sleep, "おやすみ（空の状態・夜・まだ開封できない便）"),
    "sorry": (pose_sorry, "ごめんね（エラー・通信失敗）"),
    "thanks": (pose_thanks, "ありがとう（完了・保存できた）"),
    "camera": (pose_camera, "カメラを持つ（AR フォト）"),
    "coupon": (pose_coupon, "クーポンを持つ（クーポン・抽選）"),
}


def ui_svg(title: str, body: str) -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="20 20 360 360" width="360" height="360" role="img" '
            f'aria-label="{title}"><title>{title}</title><defs>{DEFS}</defs>{body}</svg>\n')


# ---------- AR フレーム（900×1200） ----------
W, H = 900, 1200


def place(char: str, x: float, y: float, s: float) -> str:
    return f'<g transform="translate({x} {y}) scale({s})">{char}</g>'


def window_path(l, t, r, b, rad=18) -> str:
    """外枠 0,0-W,H から写真の窓（角丸）をくり抜く evenodd パス。"""
    return (f'M0 0H{W}V{H}H0Z M{l + rad} {t} H{r - rad} Q{r} {t} {r} {t + rad} V{b - rad} Q{r} {b} {r - rad} {b} '
            f'H{l + rad} Q{l} {b} {l} {b - rad} V{t + rad} Q{l} {t} {l + rad} {t} Z')


def frame_ai():
    l, t, r, b = 44, 44, W - 44, H - 150
    dots = "".join(f'<circle cx="{x}" cy="22" r="3" /><circle cx="{x}" cy="{H - 20}" r="3"/>' for x in range(40, W, 36))
    dots += "".join(f'<circle cx="22" cy="{y}" r="3"/><circle cx="{W - 22}" cy="{y}" r="3"/>' for y in range(58, H - 150, 36))
    return (f'<path fill-rule="evenodd" d="{window_path(l, t, r, b)}" fill="{INK}"/>'
            f'<g fill="{PAPER}" opacity="0.28">{dots}</g>'
            f'<text x="62" y="{H - 66}" font-family="{MINCHO}" font-size="54" font-weight="600" fill="{PAPER}" letter-spacing="6">星凪諸島</text>'
            f'<text x="66" y="{H - 30}" font-family="{GOTHIC}" font-size="20" fill="{PAPER}" opacity="0.75" letter-spacing="7">HOSHINAGI ISLANDS</text>'
            + place(character(WAVE_LEFT + TAIL, face("open", "w"), scarf_knot() + RIGHT_FRONT), 560, 862, 0.9))


def frame_hoshizora():
    l, t, r, b = 52, 52, W - 52, H - 160
    rnd = [(37, 120, 26, PAPER), (860, 300, 22, PAPER), (24, 520, 18, "#8fa3c6"), (874, 660, 20, "#8fa3c6"),
           (30, 860, 22, PAPER), (120, 24, 18, "#8fa3c6"), (420, 20, 22, PAPER), (620, 26, 16, "#8fa3c6"),
           (110, 120, 16, PAPER), (790, 160, 14, PAPER), (200, 90, 10, "#c8d3e6"), (720, 110, 12, "#c8d3e6")]
    sp = "".join(sparkle(x - s / 2, y - s / 2, s, c) for x, y, s, c in rnd)
    moon = (f'<mask id="moon"><rect width="{W}" height="{H}" fill="#fff"/><circle cx="848" cy="50" r="42" fill="#000"/></mask>'
            f'<circle cx="818" cy="74" r="48" fill="{WARM}" mask="url(#moon)"/>')
    return (f'<defs><linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2a44"/>'
            f'<stop offset="1" stop-color="#2b4069"/></linearGradient></defs>'
            f'<path fill-rule="evenodd" d="{window_path(l, t, r, b, 24)}" fill="url(#night)"/>' + moon + sp
            + f'<text x="{W - 64}" y="{H - 66}" text-anchor="end" font-family="{MINCHO}" font-size="46" font-weight="600" fill="{PAPER}" letter-spacing="5">星凪の夜</text>'
            f'<text x="{W - 66}" y="{H - 30}" text-anchor="end" font-family="{GOTHIC}" font-size="20" fill="#c8d3e6" letter-spacing="7">HOSHINAGI ISLANDS</text>'
            + place(character(flipper(84, 168, 14, 34, -22) + flipper(316, 168, 14, 34, 22) + TAIL,
                              face("open", "open", look=(0, -4)), scarf_knot(), star=head_star(glow=True)),
                    40, 856, 0.9))


def frame_hagaki():
    l, t, r, b = 66, 66, W - 66, H - 196
    holes = "".join(f'<circle cx="{x}" cy="0" r="15"/><circle cx="{x}" cy="{H}" r="15"/>' for x in range(0, W + 1, 45))
    holes += "".join(f'<circle cx="0" cy="{y}" r="15"/><circle cx="{W}" cy="{y}" r="15"/>' for y in range(0, H + 1, 48))
    cancel = "".join(f'<path d="M420 {y} q30 -14 60 0 t60 0 t60 0 t60 0" fill="none" stroke="{INK3}" stroke-width="5" stroke-linecap="round"/>'
                     for y in (96, 122, 148))
    return (f'<defs><mask id="perf"><rect width="{W}" height="{H}" fill="#fff"/><g fill="#000">{holes}</g>'
            f'<rect x="{l}" y="{t}" width="{r - l}" height="{b - t}" rx="6" fill="#000"/></mask></defs>'
            f'<rect width="{W}" height="{H}" fill="{PAPER}" mask="url(#perf)"/>'
            f'<rect x="{l - 12}" y="{t - 12}" width="{r - l + 24}" height="{b - t + 24}" rx="10" fill="none" stroke="{INK}" stroke-width="4"/>'
            f'<g opacity="0.85">{cancel}'
            f'<circle cx="740" cy="128" r="84" fill="none" stroke="{INK3}" stroke-width="5"/>'
            f'<circle cx="740" cy="128" r="70" fill="none" stroke="{INK3}" stroke-width="2.5"/>'
            f'<text x="740" y="116" text-anchor="middle" font-family="{MINCHO}" font-size="34" font-weight="600" fill="{INK3}">星凪</text>'
            f'<text x="740" y="156" text-anchor="middle" font-family="{GOTHIC}" font-size="22" fill="{INK3}" letter-spacing="2">ひとめぐり</text></g>'
            f'<text x="86" y="{H - 104}" font-family="{MINCHO}" font-size="56" font-weight="600" fill="{INK}" letter-spacing="8">おもいで便</text>'
            f'<text x="90" y="{H - 62}" font-family="{GOTHIC}" font-size="22" fill="{INK3}" letter-spacing="6">星凪諸島より</text>'
            + place(character(WAVE_LEFT + TAIL, face("open", "w"), scarf_knot() + ENVELOPE), 600, 882, 0.86))


def frame_cheki():
    l, t, r, b = 44, 44, W - 44, H - 250
    tape = (f'<g transform="rotate(-4 450 40)"><rect x="350" y="12" width="200" height="56" fill="#dfe6f1" opacity="0.92"/>'
            + "".join(f'<circle cx="{x}" cy="40" r="4" fill="{INK3}" opacity="0.5"/>' for x in range(366, 550, 22)) + '</g>')
    return (f'<path fill-rule="evenodd" d="{window_path(l, t, r, b, 4)}" fill="{PAPER}"/>'
            f'<rect x="1" y="1" width="{W - 2}" height="{H - 2}" fill="none" stroke="#dfe6f1" stroke-width="2"/>'
            f'<text x="72" y="{H - 148}" font-family="{MINCHO}" font-size="60" font-weight="600" fill="{INK}" letter-spacing="8">星凪諸島</text>'
            f'<text x="76" y="{H - 100}" font-family="{GOTHIC}" font-size="26" fill="{INK3}" letter-spacing="4">ひとめぐりの旅</text>'
            f'<path d="M76 {H - 48} H470" stroke="#b3c1d8" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round"/>'
            f'<text x="480" y="{H - 40}" font-family="{GOTHIC}" font-size="24" fill="#9aabc6" letter-spacing="10">年 月 日</text>'
            + tape + place(character(flipper(84, 168, 14, 34, -22) + flipper(316, 168, 14, 34, 22) + TAIL,
                                     face("happy", "open"), scarf_knot()), 600, 828, 0.8))


def seigaiha(clip_id: str, poly: str, x0: int, y0: int, w: int, h: int) -> str:
    r = 40
    out = f'<clipPath id="{clip_id}"><polygon points="{poly}"/></clipPath><g clip-path="url(#{clip_id})">'
    row = 0
    for y in range(y0 - r, y0 + h + r, r // 2):
        off = 0 if row % 2 == 0 else r
        for x in range(x0 - 2 * r + off, x0 + w + 2 * r, 2 * r):
            for rr, c in ((r, INK), (r - 8, PAPER), (r - 14, INK), (r - 22, PAPER), (r - 28, INK)):
                out += f'<circle cx="{x}" cy="{y}" r="{rr}" fill="{c}"/>'
        row += 1
    return out + '</g>'


def frame_hyokkori():
    # 枠なし。上の角に青海波、下からほしまるがひょっこり。
    tl = seigaiha("tl", "0,0 300,0 0,230", 0, 0, 300, 230)
    tr = seigaiha("tr", f"{W},0 {W - 300},0 {W},230", W - 300, 0, 300, 230)
    edge_tl = f'<path d="M300 0 L0 230" stroke="{PAPER}" stroke-width="6"/>'
    edge_tr = f'<path d="M{W - 300} 0 L{W} 230" stroke="{PAPER}" stroke-width="6"/>'
    peek = place(character(TAIL, face("open", "open", look=(0, -3))), 150, 740, 1.5)
    bar = f'<rect x="0" y="{H - 46}" width="{W}" height="46" fill="{INK}"/><rect x="0" y="{H - 52}" width="{W}" height="6" fill="{PAPER}"/>'
    hands = place(flipper(120, 266, 14, 22, 10) + flipper(280, 266, 14, 22, -10), 150, 740, 1.5)
    label = (f'<text x="{W - 30}" y="{H - 14}" text-anchor="end" font-family="{GOTHIC}" font-size="20" fill="{PAPER}" '
             f'letter-spacing="7">HOSHINAGI ISLANDS</text>')
    return tl + tr + edge_tl + edge_tr + peek + bar + hands + label


FRAMES = {
    "ai": (frame_ai, "藍の縁（手をふるほしまる）"),
    "hoshizora": (frame_hoshizora, "星空（夜・見上げるほしまる）"),
    "hagaki": (frame_hagaki, "おもいで便の切手（手紙を持つほしまる）"),
    "cheki": (frame_cheki, "和紙のチェキ（日付を書ける・ばんざい）"),
    "hyokkori": (frame_hyokkori, "ひょっこり（枠なし・角に青海波）"),
}


# ---------- 場所ごとの特別フレーム（spots.svg_key と同じキー） ----------
import random  # noqa: E402

import gen_hoshimaru as gh  # noqa: E402

SPOT_NAMES = {"lighthouse": "風詠みの灯台", "cape": "星綾の潮見台", "market": "虹灯りの夜市", "lake": "瑠璃凪の水鏡湖",
              "windmill": "月花の風車丘", "street": "灯雲の石畳通り", "hall": "雪雫の音楽堂"}


def spot_char(key: str) -> str:
    d = gh.SPOTS[key]()
    return (d["behind"] + body_fill() + d["neck"] + d.get("head_clip", "") + body_close()
            + d["face"] + d["hat"] + d["star"] + d["front"])


def tag(x, y, key, dark=False) -> str:
    name = SPOT_NAMES[key]
    w = len(name) * 44 + 56
    box, fg, sub = (INK2, PAPER, "#c8d3e6") if dark else (PAPER, INK, INK3)
    return (f'<rect x="{x}" y="{y}" width="{w}" height="96" rx="14" fill="{box}" opacity="0.96" stroke="{INK}" stroke-width="3"/>'
            f'<text x="{x + 28}" y="{y + 52}" font-family="{MINCHO}" font-size="42" font-weight="600" fill="{fg}" letter-spacing="2">{name}</text>'
            f'<text x="{x + 30}" y="{y + 80}" font-family="{GOTHIC}" font-size="15" fill="{sub}" letter-spacing="5">HOSHINAGI ISLANDS</text>')


def tag_w(key) -> int:
    return len(SPOT_NAMES[key]) * 44 + 56


def wave_band(y, fill, amp=16, wl=100) -> str:
    d = f"M0 {y} Q{wl / 4} {y - amp} {wl / 2} {y}"
    x = wl / 2
    while x < W:
        x += wl / 2
        d += f" T{x} {y}"
    return f'<path d="{d} V{H} H0 Z" fill="{fill}"/>'


def gull(x, y, s=1.0) -> str:
    return (f'<path transform="translate({x} {y}) scale({s})" d="M0 0 q12 -12 24 0 q12 -12 24 0" fill="none" '
            f'stroke="{INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>')


def flake(x, y, r) -> str:
    arms = "".join(f'<line x1="{x - r * math.cos(math.radians(a)):.1f}" y1="{y - r * math.sin(math.radians(a)):.1f}" '
                   f'x2="{x + r * math.cos(math.radians(a)):.1f}" y2="{y + r * math.sin(math.radians(a)):.1f}"/>' for a in (90, 30, 150))
    return (f'<g stroke-linecap="round"><g stroke="{INK3}" stroke-width="7" opacity="0.35">{arms}</g>'
            f'<g stroke="{PAPER}" stroke-width="4">{arms}</g></g>')


CHAR_R = (580, 872, 0.85)   # 右下に立つほしまる


def sf_lighthouse():
    l, t, r, b = 40, 40, W - 40, 1030
    clip = '<clipPath id="lt"><path d="M70 1010 L84 720 L116 720 L130 1010 Z"/></clipPath>'
    house = (clip + f'<linearGradient id="beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{WARM}" stop-opacity="0.75"/>'
             f'<stop offset="1" stop-color="{WARM}" stop-opacity="0"/></linearGradient>'
             f'<path d="M118 706 L470 620 L470 800 Z" fill="url(#beam)"/>'
             f'<path d="M70 1010 L84 720 L116 720 L130 1010 Z" fill="{PAPER}"/>'
             f'<g clip-path="url(#lt)" fill="{INK3}"><rect x="60" y="790" width="80" height="34"/><rect x="60" y="890" width="80" height="34"/></g>'
             f'<path d="M70 1010 L84 720 L116 720 L130 1010 Z" fill="none" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>'
             f'<rect x="80" y="690" width="40" height="32" rx="4" fill="{WARM}" stroke="{INK}" stroke-width="5"/>'
             f'<path d="M72 692 L100 662 L128 692 Z" fill="{INK}" stroke="{INK}" stroke-width="4" stroke-linejoin="round"/>')
    return (f'<path fill-rule="evenodd" d="{window_path(l, t, r, b, 22)}" fill="{PAPER}"/>'
            f'<rect x="{l - 10}" y="{t - 10}" width="{r - l + 20}" height="{b - t + 20}" rx="28" fill="none" stroke="{INK3}" stroke-width="6" stroke-dasharray="18 10"/>'
            + gull(640, 130, 1.6) + gull(740, 190, 1.1) + gull(560, 210, 0.8)
            + wave_band(1000, "#dfe6f1") + house + wave_band(1050, "#c9d4e6") + wave_band(1110, "#b3c1d8")
            + place(spot_char("lighthouse"), *CHAR_R) + tag(56, 1086, "lighthouse"))


def sf_cape():
    l, t, r, b = 48, 48, W - 48, 1000
    stars ="".join(sparkle(x - s / 2, y - s / 2, s, c) for x, y, s, c in [
        (24, 140, 22, PAPER), (876, 260, 20, PAPER), (24, 480, 16, "#8fa3c6"), (876, 560, 22, "#c8d3e6"),
        (24, 780, 18, PAPER), (876, 860, 16, "#8fa3c6"), (220, 24, 18, PAPER), (440, 22, 14, "#8fa3c6"),
        (640, 26, 20, PAPER), (780, 24, 12, "#c8d3e6"), (330, 120, 14, PAPER), (700, 170, 18, PAPER),
        (560, 90, 10, "#c8d3e6"), (160, 250, 12, PAPER), (800, 380, 12, PAPER)])
    moon = (f'<mask id="moon2"><rect width="{W}" height="{H}" fill="#fff"/><circle cx="110" cy="70" r="46" fill="#000"/></mask>'
            f'<circle cx="84" cy="96" r="54" fill="{WARM}" mask="url(#moon2)"/>')
    rocks = "".join(f'<polygon points="{star_points(x, y, rr, 0.5)}" fill="{INK}" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>'
                    for x, y, rr in [(560, 1130, 30), (660, 1170, 18), (430, 1176, 14)])
    return (f'<defs><linearGradient id="night2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2a44"/>'
            f'<stop offset="1" stop-color="#2b4069"/></linearGradient></defs>'
            f'<path fill-rule="evenodd" d="{window_path(l, t, r, b, 24)}" fill="url(#night2)"/>' + moon + stars
            + wave_band(990, "#2b4069", 14) + wave_band(1050, "#334a76", 14) + wave_band(1110, "#3b5482", 14) + rocks
            + place(spot_char("cape"), 34, 872, 0.85)
            + tag(W - 56 - tag_w("cape"), 1012, "cape", dark=True))


def sf_market():
    l, t, r, b = 30, 30, W - 30, 1020
    out = f'<path fill-rule="evenodd" d="{window_path(l, t, r, b, 12)}" fill="{INK}"/>'
    out += f'<path d="M0 50 Q450 300 900 50" fill="none" stroke="{INK}" stroke-width="4"/>'
    for i, tt in enumerate((0.07, 0.2, 0.33, 0.5, 0.67, 0.8, 0.93)):
        x = 2 * tt * (1 - tt) * 450 + 900 * tt * tt
        y = 50 * (1 - tt) ** 2 + 2 * tt * (1 - tt) * 300 + 50 * tt * tt
        cy = y + 44
        fill = WARM if i % 2 == 0 else PAPER
        out += (f'<circle cx="{x:.0f}" cy="{cy:.0f}" r="52" fill="{WARM}" opacity="0.28"/>'
                f'<line x1="{x:.0f}" y1="{y:.0f}" x2="{x:.0f}" y2="{cy - 30:.0f}" stroke="{INK}" stroke-width="4"/>'
                f'<ellipse cx="{x:.0f}" cy="{cy:.0f}" rx="27" ry="33" fill="{fill}" stroke="{INK}" stroke-width="5"/>'
                f'<path d="M{x - 26:.0f} {cy - 8:.0f} H{x + 26:.0f} M{x - 26:.0f} {cy + 8:.0f} H{x + 26:.0f}" stroke="{INK3}" stroke-width="2.5"/>'
                f'<rect x="{x - 13:.0f}" y="{cy - 40:.0f}" width="26" height="10" rx="3" fill="{INK}"/>'
                f'<rect x="{x - 13:.0f}" y="{cy + 30:.0f}" width="26" height="10" rx="3" fill="{INK}"/>')
    out += "".join(f'<circle cx="{x}" cy="1180" r="7" fill="{WARM}" opacity="0.7"/>' for x in range(30, W, 60))
    return out + place(spot_char("market"), 560, 866, 0.85) + tag(50, 1052, "market", dark=True)


def sf_lake():
    pines = "".join(f'<path d="M{x} 1012 L{x + w / 2} {1012 - h} L{x + w} 1012 Z" fill="{c}"/>' for x, w, h, c in [
        (-10, 60, 120, "#a3b3cd"), (36, 50, 90, "#b3c1d8"), (78, 44, 70, "#a3b3cd"),
        (790, 50, 90, "#b3c1d8"), (830, 60, 130, "#a3b3cd")])
    water = (f'<path d="M0 1010 Q225 996 450 1010 T900 1010 V{H} H0 Z" fill="#d6e1ee"/>'
             f'<path d="M0 1090 Q225 1076 450 1090 T900 1090 V{H} H0 Z" fill="#c7d4e6"/>'
             f'<g stroke="{PAPER}" stroke-width="5" stroke-linecap="round"><path d="M480 1040 H560"/><path d="M380 1130 H460"/>'
             f'<path d="M70 1160 H150"/><path d="M500 1170 H540"/></g>')
    lv = [(60, 70, 30, -20, "#d48a64"), (140, 44, 22, 20, "#e0a05a"), (40, 160, 20, 40, "#e0a05a"),
          (190, 112, 14, -30, "#cf7656"), (110, 220, 12, 10, "#d48a64"), (842, 90, 26, 15, "#d48a64"),
          (780, 46, 16, -25, "#e0a05a"), (870, 190, 14, 30, "#cf7656"), (300, 1060, 18, 25, "#d48a64"),
          (440, 1166, 14, -15, "#e0a05a")]
    leaves = "".join(gh.leaf(x, y, rr, rot, c) for x, y, rr, rot, c in lv)
    line = f'<rect x="22" y="22" width="{W - 44}" height="{H - 44}" rx="18" fill="none" stroke="{PAPER}" stroke-width="5" opacity="0.9"/>'
    return line + pines + water + leaves + place(spot_char("lake"), *CHAR_R) + tag(50, 1074, "lake")


def sf_windmill():
    blades = "".join(f'<rect x="108" y="680" width="24" height="112" rx="8" transform="rotate({a} 120 792)" '
                     f'fill="{PAPER}" stroke="{INK}" stroke-width="4"/>' for a in (20, 110, 200, 290))
    mill = (f'<path d="M86 1000 L98 800 L142 800 L154 1000 Z" fill="{PAPER}" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>'
            f'<path d="M92 806 L120 770 L148 806 Z" fill="{INK3}" stroke="{INK}" stroke-width="4" stroke-linejoin="round"/>'
            f'<rect x="108" y="950" width="24" height="40" rx="10" fill="{INK3}"/>' + blades
            + f'<circle cx="120" cy="792" r="10" fill="{INK}"/>')
    rnd = random.Random(7)
    flowers = "".join(f'<circle cx="{rnd.randint(0, W)}" cy="{rnd.randint(1010, 1195)}" r="{rnd.choice([6, 7, 9])}" fill="#efcf5a" '
                      f'stroke="#c9a53a" stroke-width="1.5"/>' for _ in range(70))
    hill = (f'<path d="M0 990 Q220 930 470 985 T900 950 V{H} H0 Z" fill="#d6e3cf"/>'
            f'<path d="M0 1070 Q260 1030 520 1074 T900 1050 V{H} H0 Z" fill="#c8d9be"/>')
    corner = "".join(f'<circle cx="{x}" cy="{y}" r="{rr}" fill="#efcf5a" stroke="#c9a53a" stroke-width="1.5"/>' for x, y, rr in [
        (40, 40, 12), (64, 30, 9), (30, 66, 9), (84, 52, 7), (52, 88, 7), (860, 40, 12), (836, 30, 9), (870, 66, 9)])
    bfly = (f'<g transform="translate(700 260) rotate(-15)"><ellipse cx="-9" cy="0" rx="10" ry="14" fill="{PAPER}" stroke="{INK}" stroke-width="3"/>'
            f'<ellipse cx="9" cy="0" rx="10" ry="14" fill="{PAPER}" stroke="{INK}" stroke-width="3"/>'
            f'<line x1="0" y1="-10" x2="0" y2="12" stroke="{INK}" stroke-width="4" stroke-linecap="round"/></g>')
    line = f'<rect x="22" y="22" width="{W - 44}" height="{H - 44}" rx="18" fill="none" stroke="{PAPER}" stroke-width="5" opacity="0.9"/>'
    return line + corner + bfly + hill + mill + flowers + place(spot_char("windmill"), *CHAR_R) + tag(50, 1084, "windmill")


def sf_street():
    houses = ""
    for x, w, h in [(-10, 130, 300), (120, 100, 230), (220, 110, 170), (560, 100, 180), (660, 120, 240), (780, 130, 310)]:
        top = 1110 - h
        houses += (f'<rect x="{x}" y="{top}" width="{w}" height="{h}" fill="{INK2}"/>'
                   f'<path d="M{x - 8} {top + 2} L{x + w / 2} {top - 34} L{x + w + 8} {top + 2} Z" fill="{INK}"/>'
                   f'<path d="M{x - 8} {top + 2} L{x + w / 2} {top - 34} L{x + w + 8} {top + 2}" fill="none" stroke="{PAPER}" stroke-width="5" stroke-linejoin="round"/>'
                   f'<rect x="{x + 20}" y="{top + 30}" width="24" height="28" rx="4" fill="{WARM}"/>'
                   f'<rect x="{x + w - 44}" y="{top + 80}" width="24" height="28" rx="4" fill="{WARM}"/>')
    stones = "".join(f'<rect x="{x}" y="{y}" width="70" height="24" rx="9" fill="#e6ebf2" stroke="#c1cbd9" stroke-width="3"/>'
                     for y, off in [(1118, 0), (1146, 38), (1174, 0)] for x in range(-30 + off, W, 78))
    rnd = random.Random(3)
    snow = "".join(f'<circle cx="{rnd.randint(10, 890)}" cy="{rnd.randint(10, 820)}" r="{rnd.choice([3, 4, 5, 6])}" fill="{PAPER}" '
                   f'stroke="{INK3}" stroke-opacity="0.35" stroke-width="1.5"/>' for _ in range(46))
    line = f'<rect x="22" y="22" width="{W - 44}" height="{H - 44}" rx="18" fill="none" stroke="{PAPER}" stroke-width="5" opacity="0.9"/>'
    return (line + snow + houses + f'<rect y="1106" width="{W}" height="{H - 1106}" fill="#dde3ec"/>' + stones
            + place(spot_char("street"), 280, 864, 0.85) + tag(40, 40, "street"))


def sf_hall():
    drift = "M0 0 H900 V70"
    xs = list(range(900, -1, -75))
    for i, x in enumerate(xs[1:]):
        drift += f" Q{x + 37} {110 if i % 2 == 0 else 96} {x} {70 if i % 2 == 0 else 78}"
    drift += " Z"
    icicles = "".join(f'<path d="M{x} 76 l8 {h} l8 -{h} Z" fill="{PAPER}" stroke="#c8d3e6" stroke-width="2"/>'
                      for x, h in [(120, 30), (260, 22), (410, 34), (560, 24), (700, 30), (820, 20)])
    hall = (f'<rect x="56" y="900" width="190" height="150" fill="#c2cee1" stroke="{INK}" stroke-width="4"/>'
            f'<path d="M40 906 L151 830 L262 906 Z" fill="{INK3}" stroke="{INK}" stroke-width="4" stroke-linejoin="round"/>'
            f'<path d="M40 906 L151 830 L262 906" fill="none" stroke="{PAPER}" stroke-width="10" stroke-linejoin="round"/>'
            + "".join(f'<rect x="{x}" y="930" width="30" height="42" rx="14" fill="{WARM}" stroke="{INK}" stroke-width="3"/>' for x in (80, 136, 192))
            + f'<rect x="132" y="990" width="38" height="60" rx="4" fill="{INK3}" stroke="{INK}" stroke-width="3"/>')
    ground = (f'<path d="M0 1040 Q300 990 600 1030 T900 1010 V{H} H0 Z" fill="{PAPER}"/>'
              f'<path d="M0 1040 Q300 990 600 1030 T900 1010" fill="none" stroke="#c8d3e6" stroke-width="4"/>')
    flakes = "".join(flake(x, y, rr) for x, y, rr in [(90, 210, 18), (250, 330, 12), (780, 250, 20), (640, 160, 12),
                                                     (420, 230, 10), (140, 520, 12), (830, 520, 14), (330, 640, 10)])
    notes = (f'<g stroke="{PAPER}" stroke-width="7" stroke-linejoin="round" paint-order="stroke">'
             + gh.note(560, 760, INK2) + gh.note(500, 840, INK3) + gh.note(820, 700, INK2) + '</g>')
    return (f'<path d="{drift}" fill="{PAPER}"/>' + icicles + flakes + hall + ground + notes
            + place(spot_char("hall"), *CHAR_R) + tag(50, 1084, "hall"))


SPOT_FRAMES = {
    "lighthouse": (sf_lighthouse, "風詠みの灯台（マリンの縁・灯台とかもめ）"),
    "cape": (sf_cape, "星綾の潮見台（星空と星の岩）"),
    "market": (sf_market, "虹灯りの夜市（提灯の灯り）"),
    "lake": (sf_lake, "瑠璃凪の水鏡湖（もみじと湖面）"),
    "windmill": (sf_windmill, "月花の風車丘（菜の花と風車）"),
    "street": (sf_street, "灯雲の石畳通り（家々の灯りと雪）"),
    "hall": (sf_hall, "雪雫の音楽堂（雪と音符）"),
}


def frame_svg(title: str, body: str) -> str:
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" '
            f'aria-label="{title}"><title>{title}</title><defs>{DEFS}</defs>{body}</svg>\n')


def main() -> None:
    UI_OUT.mkdir(parents=True, exist_ok=True)
    FRAME_OUT.mkdir(parents=True, exist_ok=True)
    for key, (fn, title) in POSES.items():
        (UI_OUT / f"hoshimaru_{key}.svg").write_text(ui_svg(f"ほしまる: {title}", fn()), encoding="utf-8")
    for key, (fn, title) in FRAMES.items():
        (FRAME_OUT / f"frame_{key}.svg").write_text(frame_svg(f"フレーム: {title}", fn()), encoding="utf-8")
    for key, (fn, title) in SPOT_FRAMES.items():
        (FRAME_OUT / f"frame_spot_{key}.svg").write_text(frame_svg(f"フレーム: {title}", fn()), encoding="utf-8")
    import json
    (UI_OUT / "poses.json").write_text(json.dumps(
        [{"key": k, "label": t, "svg": f"/img/mascot/ui/hoshimaru_{k}.svg", "png": f"/img/mascot/ui/hoshimaru_{k}.png"}
         for k, (_, t) in POSES.items()], ensure_ascii=False, indent=1), encoding="utf-8")
    (FRAME_OUT / "frames.json").write_text(json.dumps(
        [{"key": k, "label": t, "spot": None, "width": W, "height": H,
          "svg": f"/img/frames/frame_{k}.svg", "png": f"/img/frames/frame_{k}.png"}
         for k, (_, t) in FRAMES.items()]
        + [{"key": f"spot_{k}", "label": t, "spot": k, "width": W, "height": H,
            "svg": f"/img/frames/frame_spot_{k}.svg", "png": f"/img/frames/frame_spot_{k}.png"}
           for k, (_, t) in SPOT_FRAMES.items()], ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"poses={len(POSES)} frames={len(FRAMES)} spot_frames={len(SPOT_FRAMES)}")


if __name__ == "__main__":
    main()
