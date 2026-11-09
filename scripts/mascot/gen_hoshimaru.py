"""ゆるキャラ「ほしまる」のスポット別 SVG を作る。

使い方: python scripts/mascot/gen_hoshimaru.py
出力:   frontend/public/img/mascot/hoshimaru_<svg_key>.svg（svg_key は spots マスタと同じ）
体・顔・星は共通。スポットごとに背景・服・ポーズ・持ち物を変える。
"""
from __future__ import annotations

import math
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "frontend" / "public" / "img" / "mascot"

INK = "#1b2a44"      # 藍
INK2 = "#2e4266"     # 藍（中）
INK3 = "#3a5482"     # 藍（淡）
PAPER = "#fbfcfd"    # 紙
BODY = "#f1f5fb"
SHADE = "#dfe6f1"
SPOT = "#cfd9e8"
GOLD = "#e3a21a"     # 山吹（星だけ）
BLUSH = "#f2a7a7"
WARM = "#f7e3b4"     # 灯り
SW = 5               # 線の太さ

BODY_D = ("M200 120 C282 120 314 186 312 248 C310 306 266 332 200 332 "
          "C134 332 90 306 88 248 C86 186 118 120 200 120 Z")


# ---------- 部品 ----------
def star_points(cx: float, cy: float, r: float = 18, ratio: float = 0.44) -> str:
    pts = []
    for i in range(10):
        a = math.radians(-90 + 36 * i)
        rr = r if i % 2 == 0 else r * ratio
        pts.append(f"{cx + rr * math.cos(a):.1f},{cy + rr * math.sin(a):.1f}")
    return " ".join(pts)


def head_star(cx=208, cy=86, stem_from=(200, 124), glow=False, rot=12) -> str:
    s = ""
    if glow:
        s += f'<circle cx="{cx}" cy="{cy}" r="30" fill="{WARM}" opacity="0.35"/><circle cx="{cx}" cy="{cy}" r="22" fill="{WARM}" opacity="0.45"/>'
    if stem_from:
        x0, y0 = stem_from
        s += (f'<path d="M{x0} {y0} Q{x0 - 4} {(y0 + cy) / 2 + 2} {cx - 2} {cy + 12}" fill="none" '
              f'stroke="{INK}" stroke-width="{SW}" stroke-linecap="round"/>')
    s += (f'<polygon transform="rotate({rot} {cx} {cy})" points="{star_points(cx, cy)}" fill="{GOLD}" '
          f'stroke="{INK}" stroke-width="4.5" stroke-linejoin="round"/>')
    return s


def sparkle(x, y, size, fill) -> str:
    return f'<use href="#spark" x="{x}" y="{y}" width="{size}" height="{size}" fill="{fill}"/>'


def flipper(cx, cy, rx=14, ry=30, rot=0) -> str:
    return (f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" transform="rotate({rot} {cx} {cy})" '
            f'fill="{BODY}" stroke="{INK}" stroke-width="{SW}"/>')


WAVE_LEFT = flipper(86, 206, 14, 32, -42)          # 手をふる（体の後ろ）
REST_LEFT = flipper(96, 270, 13, 26, 28)           # 下ろした手（体の後ろ）
TAIL = (f'<path d="M292 300 C312 296 332 284 340 292 C346 300 330 316 312 322 C300 326 292 318 292 300 Z" '
        f'fill="{BODY}" stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round"/>')


def body_fill() -> str:
    return (f'<path d="{BODY_D}" fill="{BODY}"/>'
            f'<g clip-path="url(#body)">'
            f'<ellipse cx="200" cy="350" rx="150" ry="60" fill="{SHADE}"/>'
            f'<ellipse cx="150" cy="150" rx="34" ry="16" transform="rotate(-28 150 150)" fill="#ffffff"/>'
            f'<g fill="{SPOT}"><circle cx="232" cy="142" r="4"/><circle cx="246" cy="152" r="3"/>'
            f'<circle cx="236" cy="160" r="2.5"/><circle cx="270" cy="182" r="3.5"/>'
            f'<circle cx="124" cy="190" r="3"/><circle cx="114" cy="204" r="2.5"/></g>')


def body_close() -> str:
    return f'</g><path d="{BODY_D}" fill="none" stroke="{INK}" stroke-width="{SW}"/>'


def band(y0=266, y1=282, sag=30, fill=INK) -> str:
    """首まわりの帯（体でクリップされる前提）。"""
    return (f'<path d="M80 {y0} Q200 {y0 + sag} 320 {y0} L320 {y1} Q200 {y1 + sag + 2} 80 {y1} Z" fill="{fill}"/>')


def band_dots(y0=266, y1=282, sag=30, fill=PAPER, r=2.4) -> str:
    out = []
    for x in range(110, 310, 28):
        t = (x - 80) / 240
        k = 2 * t * (1 - t)
        mid = (y0 + y1) / 2 + k * (sag + 1)
        out.append(f'<circle cx="{x}" cy="{mid:.1f}" r="{r}"/>')
    return f'<g fill="{fill}" opacity="0.9">{"".join(out)}</g>'


def scarf_knot(x=125, y=287, fill=INK2) -> str:
    return (f'<path d="M{x - 5} {y + 1} C{x - 15} {y + 9} {x - 21} {y + 21} {x - 15} {y + 25} C{x - 9} {y + 27} {x - 1} {y + 15} {x + 1} {y + 5} Z" fill="{fill}" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>'
            f'<path d="M{x + 1} {y + 3} C{x + 3} {y + 15} {x + 9} {y + 25} {x + 16} {y + 24} C{x + 22} {y + 22} {x + 17} {y + 11} {x + 7} {y + 3} Z" fill="{fill}" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>'
            f'<ellipse cx="{x}" cy="{y}" rx="8" ry="7" fill="{fill}" stroke="{INK}" stroke-width="3"/>')


def face(eyes="open", mouth="w", dy=12) -> str:
    s = f'<g transform="translate(0 {dy})">'
    s += f'<ellipse cx="138" cy="226" rx="17" ry="10" fill="{BLUSH}" opacity="0.6"/><ellipse cx="262" cy="226" rx="17" ry="10" fill="{BLUSH}" opacity="0.6"/>'
    if eyes == "happy":
        for x in (160, 240):
            s += f'<path d="M{x - 12} {204} Q{x} {190} {x + 12} {204}" fill="none" stroke="{INK}" stroke-width="5" stroke-linecap="round"/>'
    else:
        up = -4 if eyes == "up" else 0
        for x in (160, 240):
            s += (f'<ellipse cx="{x}" cy="200" rx="12" ry="15" fill="{INK}"/>'
                  f'<circle cx="{x + 3}" cy="{193 + up}" r="4.5" fill="#ffffff"/>'
                  f'<circle cx="{x - 4}" cy="{207 + up / 2}" r="2" fill="#ffffff"/>')
    s += f'<ellipse cx="200" cy="218" rx="7.5" ry="5.5" fill="{INK}"/>'
    if mouth == "open":
        s += (f'<path d="M188 227 Q200 247 212 227 Q200 231 188 227 Z" fill="{INK}" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>'
              f'<ellipse cx="200" cy="237" rx="5" ry="3" fill="{BLUSH}"/>')
    else:
        s += f'<path d="M186 226 Q193 236 200 226 Q207 236 214 226" fill="none" stroke="{INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
    s += (f'<g fill="#9aabc6"><circle cx="178" cy="222" r="1.8"/><circle cx="172" cy="229" r="1.8"/>'
          f'<circle cx="222" cy="222" r="1.8"/><circle cx="228" cy="229" r="1.8"/></g></g>')
    return s


def waves(ys=(330, 356, 382), fills=("#dfe6f1", "#d0dae9", "#c1cde1")) -> str:
    out = ""
    for y, f in zip(ys, fills):
        out += f'<path d="M0 {y} Q25 {y - 12} 50 {y} T100 {y} T150 {y} T200 {y} T250 {y} T300 {y} T350 {y} T400 {y} V400 H0 Z" fill="{f}"/>'
    return out


def note(x, y, fill=INK) -> str:
    return (f'<g fill="{fill}"><ellipse cx="{x}" cy="{y}" rx="7" ry="5.5" transform="rotate(-20 {x} {y})"/>'
            f'<rect x="{x + 4.5}" y="{y - 26}" width="3" height="26"/>'
            f'<path d="M{x + 6} {y - 26} Q{x + 18} {y - 20} {x + 16} {y - 8} Q{x + 14} {y - 16} {x + 6} {y - 18} Z"/></g>')


def leaf(x, y, r, rot, fill) -> str:
    # もみじ（角の丸い 5 つ葉）
    return (f'<g transform="rotate({rot} {x} {y})"><polygon points="{star_points(x, y, r, 0.5)}" fill="{fill}" '
            f'stroke="{fill}" stroke-width="{r * 0.35:.1f}" stroke-linejoin="round"/>'
            f'<path d="M{x} {y} L{x} {y + r * 1.1:.1f}" stroke="{fill}" stroke-width="2" stroke-linecap="round"/></g>')


# ---------- スポット別 ----------
def lighthouse():
    bg = (f'<rect width="400" height="400" fill="#e9f0f8"/>'
          f'<path d="M37 134 L0 112 L0 160 Z" fill="{WARM}" opacity="0.6"/>'
          f'<clipPath id="tower"><path d="M30 330 L40 150 L60 150 L70 330 Z"/></clipPath>'
          f'<path d="M30 330 L40 150 L60 150 L70 330 Z" fill="{PAPER}"/>'
          f'<g clip-path="url(#tower)" fill="{INK3}"><rect x="20" y="190" width="60" height="22"/><rect x="20" y="250" width="60" height="22"/></g>'
          f'<path d="M30 330 L40 150 L60 150 L70 330 Z" fill="none" stroke="{INK}" stroke-width="3.5" stroke-linejoin="round"/>'
          f'<rect x="36" y="128" width="28" height="22" rx="3" fill="{WARM}" stroke="{INK}" stroke-width="3.5"/>'
          f'<path d="M32 129 L50 110 L68 129 Z" fill="{INK}" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>'
          f'<g fill="none" stroke="{INK3}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">'
          f'<path d="M292 112 q9 -9 18 0 q9 -9 18 0"/><path d="M330 150 q6 -6 12 0 q6 -6 12 0"/></g>'
          + waves() + sparkle(316, 78, 20, "#b3c1d8"))
    behind = REST_LEFT + flipper(314, 206, 14, 32, 42) + TAIL
    neck = (band(fill=PAPER) +
            f'<path d="M80 270 Q200 300 320 270" fill="none" stroke="{INK}" stroke-width="3"/>'
            f'<path d="M80 278 Q200 308 320 278" fill="none" stroke="{INK}" stroke-width="3"/>')
    front = (f'<path d="M200 292 L186 318 L200 312 L214 318 Z" fill="{INK}" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>'
             f'<circle cx="200" cy="294" r="6" fill="{INK}"/>')
    hat = (f'<g transform="rotate(-10 200 120)">'
           f'<path d="M150 130 Q150 96 200 94 Q250 96 250 130 Z" fill="{PAPER}" stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round"/>'
           f'<rect x="142" y="120" width="116" height="18" rx="9" fill="{INK}"/>'
           f'<path d="M150 129 L136 146 M156 131 L146 150" stroke="{INK}" stroke-width="4" stroke-linecap="round"/></g>')
    star = head_star(cx=201, cy=62, stem_from=(196, 97))
    salute = ""
    return dict(bg=bg, behind=behind, neck=neck, face=face("open", "open"), hat=hat, star=star,
                front=front + salute, title="灯台のほしまる（風詠みの灯台・夏）",
                memo="セーラー帽で手をふる。白と藍のマリンスカーフ、うしろに白い灯台とかもめ。")


def cape():
    bg = (f'<rect width="400" height="400" fill="#22355a"/>'
          f'<path d="M322 66 A26 26 0 1 0 344 112 A20 20 0 1 1 322 66 Z" fill="{WARM}"/>'
          + "".join(sparkle(x, y, s, c) for x, y, s, c in [
              (50, 90, 18, PAPER), (96, 50, 10, "#8fa3c6"), (284, 40, 12, PAPER), (330, 170, 14, "#8fa3c6"),
              (40, 190, 10, "#8fa3c6"), (120, 120, 8, PAPER), (270, 120, 9, "#8fa3c6")])
          + waves(fills=("#2b4069", "#334a76", "#3b5482"))
          + "".join(f'<polygon points="{star_points(x, y, r, 0.5)}" fill="{INK}" stroke="{INK}" stroke-width="4" stroke-linejoin="round"/>'
                    for x, y, r in [(52, 352, 14), (346, 348, 12), (84, 380, 9)]))
    up_left = flipper(82, 170, 14, 34, -20)
    behind = up_left + TAIL
    neck = (band(258, 290, 30, INK3) +
            "".join(f'<path d="M{x} 262 Q{x + 2} 285 {x} 300" stroke="#2c436d" stroke-width="2.5" fill="none"/>'
                    for x in range(104, 300, 16)))
    front = (f'<path d="M226 288 L232 336 Q244 338 252 334 L246 286 Z" fill="{INK3}" stroke="{INK}" stroke-width="4" stroke-linejoin="round"/>'
             f'<path d="M234 336 l-1 8 M240 337 l0 8 M246 336 l1 8" stroke="{INK}" stroke-width="3" stroke-linecap="round"/>'
             + flipper(296, 284, 13, 24, -30))
    return dict(bg=bg, behind=behind, neck=neck, face=face("up", "open"), hat="",
                star=head_star(glow=True), front=front, shadow_op=0.3,
                title="潮見台のほしまる（星綾の潮見台・秋の夜）",
                memo="夜空の星を指さして見上げる。秋のマフラー、海には星の形の岩、頭の星がほんのり光る。")


def market():
    bg = f'<rect width="400" height="400" fill="#e8edf6"/><path d="M10 74 Q200 150 390 74" fill="none" stroke="{INK}" stroke-width="2.5"/>'
    for i, t in enumerate((0.1, 0.27, 0.73, 0.9)):
        x = 10 * (1 - t) ** 2 + 2 * t * (1 - t) * 200 + 390 * t * t
        y = 74 * (1 - t) ** 2 + 2 * t * (1 - t) * 150 + 74 * t * t
        fill = WARM if i % 2 == 0 else PAPER
        cy = y + 22
        bg += (f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{x:.1f}" y2="{cy - 16:.1f}" stroke="{INK}" stroke-width="2.5"/>'
               f'<ellipse cx="{x:.1f}" cy="{cy:.1f}" rx="14" ry="17" fill="{fill}" stroke="{INK}" stroke-width="3"/>'
               f'<path d="M{x - 13:.1f} {cy:.1f} H{x + 13:.1f}" stroke="{INK3}" stroke-width="2"/>'
               f'<rect x="{x - 7:.1f}" y="{cy - 20:.1f}" width="14" height="5" rx="2" fill="{INK}"/>'
               f'<rect x="{x - 7:.1f}" y="{cy + 15:.1f}" width="14" height="5" rx="2" fill="{INK}"/>')
    bg += f'<rect y="326" width="400" height="80" fill="#dfe6f1"/><path d="M0 326 H400" stroke="#cbd5e4" stroke-width="3"/>'
    behind = WAVE_LEFT + TAIL
    neck = band() + band_dots()
    hachi = (f'<path d="M80 146 Q200 124 320 146 L320 162 Q200 140 80 162 Z" fill="{INK}"/>'
             + "".join(f'<circle cx="{x}" cy="{150 - 2 * (1 - abs(x - 200) / 120) * 9:.1f}" r="2.2" fill="{PAPER}"/>' for x in range(130, 280, 22)))
    hachi_knot = (f'<path d="M282 150 L318 134 L314 150 Z" fill="{INK}" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>'
                  f'<path d="M284 152 L316 164 L304 172 Z" fill="{INK2}" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>'
                  f'<ellipse cx="282" cy="151" rx="8" ry="7" fill="{INK2}" stroke="{INK}" stroke-width="3"/>')
    fan = (f'<line x1="274" y1="316" x2="300" y2="276" stroke="{INK}" stroke-width="5" stroke-linecap="round"/>'
           f'<circle cx="310" cy="252" r="30" fill="{INK}" stroke="{INK}" stroke-width="4"/>'
           f'<path d="M288 258 Q298 246 310 258 T332 258" fill="none" stroke="{PAPER}" stroke-width="3.5" stroke-linecap="round"/>'
           f'<path d="M292 270 Q302 260 312 270 T330 268" fill="none" stroke="{PAPER}" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>'
           + flipper(282, 300, 13, 24, -30))
    return dict(bg=bg, behind=behind, neck=neck, head_clip=hachi, face=face("happy", "open"), hat=hachi_knot,
                star=head_star(), front=scarf_knot() + fan,
                title="夜市のほしまる（虹灯りの夜市・夏）",
                memo="ねじり鉢巻きにうちわ、提灯の下でにっこり。")


def lake():
    bg = (f'<rect width="400" height="400" fill="#edf1f7"/>'
          f'<path d="M0 250 Q80 200 160 236 T320 222 T400 236 V400 H0 Z" fill="#d3dceb"/>'
          + "".join(f'<path d="M{x} 300 L{x + 12} {300 - h} L{x + 24} 300 Z" fill="{c}"/>'
                    for x, h, c in [(0, 50, "#b3c1d8"), (20, 70, "#a3b3cd"), (44, 46, "#b3c1d8"),
                                    (318, 56, "#b3c1d8"), (340, 74, "#a3b3cd"), (366, 50, "#b3c1d8")])
          + f'<rect y="298" width="400" height="110" fill="#d6e1ee"/>'
          f'<g stroke="{PAPER}" stroke-width="3" stroke-linecap="round"><path d="M30 320 H90"/><path d="M300 330 H370"/><path d="M60 360 H110"/><path d="M290 372 H340"/></g>'
          + leaf(70, 110, 13, -20, "#d48a64") + leaf(330, 120, 11, 25, "#e0a05a")
          + leaf(48, 210, 9, 40, "#e0a05a") + leaf(350, 250, 12, -10, "#d48a64")
          + leaf(110, 366, 8, 10, "#d48a64"))
    behind = TAIL
    neck = band() + band_dots()
    beret = (f'<g transform="rotate(-10 200 120)">'
             f'<path d="M136 134 Q134 98 200 98 Q266 98 264 132 Q200 148 136 134 Z" fill="{INK2}" stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round"/>'
             f'<path d="M142 132 Q200 144 258 130" fill="none" stroke="{INK}" stroke-width="3"/></g>')
    mug = (f'<path d="M222 292 q16 0 16 12 q0 12 -16 12" fill="none" stroke="{INK}" stroke-width="5"/>'
           f'<rect x="176" y="280" width="48" height="42" rx="9" fill="{PAPER}" stroke="{INK}" stroke-width="4.5"/>'
           f'<rect x="178" y="292" width="44" height="9" fill="{INK3}"/>'
           f'<g fill="none" stroke="#9aabc6" stroke-width="3" stroke-linecap="round"><path d="M192 274 q-5 -6 0 -12 q5 -6 0 -12"/><path d="M208 274 q-5 -6 0 -12 q5 -6 0 -12"/></g>'
           + flipper(170, 306, 13, 22, 35) + flipper(230, 306, 13, 22, -35))
    return dict(bg=bg, behind=behind, neck=neck, face=face("happy", "w"), hat=beret,
                star=head_star(cx=200, cy=70, stem_from=(194, 100)), front=scarf_knot() + mug,
                title="水鏡湖のほしまる（瑠璃凪の水鏡湖・秋）",
                memo="ベレー帽で湖畔カフェのマグを両手に、ほっこり。もみじが舞う。")


def windmill():
    blades = "".join(
        f'<rect x="349" y="146" width="10" height="40" rx="4" transform="rotate({a} 354 186)" fill="{PAPER}" stroke="{INK}" stroke-width="3"/>'
        for a in (15, 105, 195, 285))
    bg = (f'<rect width="400" height="400" fill="#edf1f7"/>'
          f'<path d="M342 290 L346 190 L362 190 L366 290 Z" fill="{PAPER}" stroke="{INK}" stroke-width="3.5" stroke-linejoin="round"/>'
          f'<rect x="349" y="262" width="10" height="14" rx="4" fill="{INK3}"/>'
          + blades + f'<circle cx="354" cy="186" r="5" fill="{INK}"/>'
          f'<path d="M48 250 L52 200 L62 200 L66 250 Z" fill="{PAPER}" stroke="{INK3}" stroke-width="2.5"/>'
          + "".join(f'<rect x="54" y="170" width="6" height="30" rx="3" transform="rotate({a} 57 200)" fill="{PAPER}" stroke="{INK3}" stroke-width="2"/>' for a in (40, 130, 220, 310))
          + f'<path d="M0 290 Q110 246 220 286 T400 268 V400 H0 Z" fill="#d6e3cf"/>'
          f'<path d="M0 330 Q120 300 240 326 T400 316 V400 H0 Z" fill="#c8d9be"/>'
          + "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#efcf5a"/>' for x, y, r in [
              (30, 300, 5), (52, 290, 4), (74, 306, 5), (300, 300, 5), (360, 290, 4), (380, 306, 5),
              (40, 340, 6), (88, 352, 5), (330, 340, 6), (370, 356, 5), (20, 372, 5), (300, 370, 5)]))
    behind = WAVE_LEFT + TAIL
    neck = band() + band_dots()
    hat = (f'<ellipse cx="200" cy="134" rx="94" ry="17" fill="#ecd9a6" stroke="{INK}" stroke-width="{SW}"/>'
           f'<path d="M158 134 Q156 100 200 98 Q244 100 242 134 Z" fill="#ecd9a6" stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round"/>'
           f'<path d="M159 124 Q200 132 241 124 L242 134 Q200 142 158 134 Z" fill="{INK}"/>')
    bouquet = (f'<g stroke="#6f9a68" stroke-width="3.5" stroke-linecap="round"><path d="M262 322 L252 262"/><path d="M264 322 L268 258"/><path d="M266 322 L282 266"/></g>'
               + "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#efcf5a" stroke="#c9a53a" stroke-width="1.5"/>' for x, y, r in [
                   (250, 258, 6), (256, 250, 5), (246, 250, 4.5), (268, 252, 6), (274, 246, 5), (264, 244, 4.5),
                   (284, 262, 6), (290, 256, 5), (280, 254, 4.5)])
               + f'<path d="M248 290 L282 290 L270 330 L258 330 Z" fill="{PAPER}" stroke="{INK}" stroke-width="4" stroke-linejoin="round"/>'
               f'<path d="M256 306 H274" stroke="{INK3}" stroke-width="4"/>'
               + flipper(284, 304, 13, 22, -35))
    return dict(bg=bg, behind=behind, neck=neck, face=face("open", "open"), hat=hat,
                star=head_star(cx=206, cy=70, stem_from=(200, 99)), front=scarf_knot() + bouquet,
                title="風車丘のほしまる（月花の風車丘・春）",
                memo="麦わら帽子で菜の花のブーケを抱えて手をふる。うしろに風車。")


def street():
    houses = ""
    for x, w, h in [(10, 70, 110), (84, 60, 140), (282, 60, 130), (346, 70, 100)]:
        top = 320 - h
        houses += (f'<rect x="{x}" y="{top}" width="{w}" height="{h}" fill="#c9d4e6"/>'
                   f'<path d="M{x - 6} {top + 2} L{x + w / 2} {top - 26} L{x + w + 6} {top + 2} Z" fill="#b3c1d8"/>'
                   f'<rect x="{x + 12}" y="{top + 20}" width="14" height="16" rx="2" fill="{WARM}"/>'
                   f'<rect x="{x + w - 26}" y="{top + 48}" width="14" height="16" rx="2" fill="{WARM}"/>')
    stones = "".join(f'<rect x="{x}" y="{y}" width="46" height="18" rx="7" fill="none" stroke="#c1cbd9" stroke-width="2.5"/>'
                     for y, off in [(334, 0), (356, 24), (378, 0)] for x in range(-20 + off, 400, 52))
    bg = (f'<rect width="400" height="400" fill="#e3e9f3"/>' + houses
          + f'<rect y="322" width="400" height="80" fill="#dde3ec"/>' + stones
          + "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{PAPER}"/>' for x, y, r in [
              (60, 60, 3), (110, 110, 2.5), (300, 70, 3), (350, 130, 2.5), (40, 150, 2), (260, 40, 2), (150, 50, 2)]))
    behind = TAIL
    neck = (band(258, 290, 30, INK2) +
            "".join(f'<path d="M{x} 262 Q{x + 2} 285 {x} 300" stroke="#253858" stroke-width="2.5" fill="none"/>'
                    for x in range(104, 300, 14)))
    hat = (f'<path d="M126 154 Q124 92 200 90 Q276 92 274 154 Z" fill="{INK2}" stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round"/>'
           + "".join(f'<path d="M{x} 104 Q{x + (x - 200) * 0.15:.0f} 128 {x + (x - 200) * 0.2:.0f} 146" stroke="#253858" stroke-width="2.5" fill="none"/>' for x in range(150, 260, 16))
           + f'<rect x="120" y="140" width="160" height="24" rx="12" fill="{INK3}" stroke="{INK}" stroke-width="{SW}"/>'
           + "".join(f'<line x1="{x}" y1="145" x2="{x}" y2="159" stroke="{INK2}" stroke-width="2.5"/>' for x in range(134, 270, 10)))
    star = head_star(cx=200, cy=86, stem_from=None, rot=0)
    ball = (f'<clipPath id="ball"><circle cx="200" cy="292" r="27"/></clipPath>'
            f'<circle cx="200" cy="292" r="27" fill="#d2e4ef"/>'
            f'<g clip-path="url(#ball)" stroke="{INK3}" stroke-width="2" fill="none">'
            f'<path d="M170 278 L230 306 M170 306 L230 278 M172 292 H228 M200 264 V320"/></g>'
            f'<ellipse cx="190" cy="282" rx="8" ry="5" transform="rotate(-30 190 282)" fill="#ffffff" opacity="0.9"/>'
            f'<circle cx="200" cy="292" r="27" fill="none" stroke="{INK}" stroke-width="4.5"/>'
            + flipper(168, 304, 13, 22, 35) + flipper(232, 304, 13, 22, -35))
    return dict(bg=bg, behind=behind, neck=neck, face=face("open", "w"), hat=hat, star=star, front=ball,
                title="石畳通りのほしまる（灯雲の石畳通り・冬）",
                memo="星のぼんぼりのニット帽とマフラー。ガラス工房の浮き玉を大事に抱える。")


def hall():
    bg = (f'<rect width="400" height="400" fill="#e6edf6"/>'
          f'<rect x="22" y="214" width="96" height="100" fill="#c2cee1"/>'
          f'<path d="M12 218 L70 168 L128 218 Z" fill="{INK3}"/>'
          f'<path d="M12 218 L70 168 L128 218" fill="none" stroke="{PAPER}" stroke-width="5" stroke-linejoin="round"/>'
          f'<rect x="38" y="236" width="16" height="22" rx="7" fill="{WARM}"/><rect x="62" y="236" width="16" height="22" rx="7" fill="{WARM}"/>'
          f'<rect x="86" y="236" width="16" height="22" rx="7" fill="{WARM}"/><rect x="60" y="276" width="20" height="38" rx="3" fill="{INK3}"/>'
          f'<path d="M0 318 Q100 296 200 312 T400 304 V400 H0 Z" fill="{PAPER}"/>'
          + "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{PAPER}"/>' for x, y, r in [
              (40, 60, 4), (90, 110, 3), (150, 50, 3), (250, 60, 3.5), (370, 110, 3), (140, 150, 2.5), (380, 200, 3), (30, 160, 3)])
          + note(300, 92, INK3) + note(140, 92, "#8fa3c6") + note(262, 56, "#8fa3c6"))
    raise_right = (f'<line x1="338" y1="176" x2="366" y2="132" stroke="{INK}" stroke-width="4" stroke-linecap="round"/>'
                   f'<circle cx="366" cy="132" r="4" fill="{PAPER}" stroke="{INK}" stroke-width="2.5"/>'
                   + flipper(322, 202, 14, 30, 40))
    behind = WAVE_LEFT + raise_right
    neck = band() + band_dots()
    muffs = (f'<path d="M110 186 Q110 96 200 92 Q290 96 290 186" fill="none" stroke="{INK}" stroke-width="9" stroke-linecap="round"/>'
             f'<circle cx="108" cy="188" r="20" fill="{PAPER}" stroke="{INK}" stroke-width="{SW}"/><circle cx="108" cy="188" r="10" fill="{SPOT}"/>'
             f'<circle cx="292" cy="188" r="20" fill="{PAPER}" stroke="{INK}" stroke-width="{SW}"/><circle cx="292" cy="188" r="10" fill="{SPOT}"/>')
    return dict(bg=bg, behind=behind, neck=neck, face=face("happy", "open"), hat=muffs,
                star=head_star(cx=208, cy=66, stem_from=(200, 94)), front=scarf_knot(),
                title="音楽堂のほしまる（雪雫の音楽堂・冬）",
                memo="イヤーマフで指揮棒をふる。雪の中の音楽堂に音符が舞う。")


SPOTS = {"lighthouse": lighthouse, "cape": cape, "market": market, "lake": lake,
         "windmill": windmill, "street": street, "hall": hall}


def render(key: str, d: dict) -> str:
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" role="img" aria-labelledby="t">
  <title id="t">{d["title"]}</title>
  <desc>{d["memo"]}</desc>
  <defs>
    <clipPath id="bg"><circle cx="200" cy="200" r="186"/></clipPath>
    <clipPath id="body"><path d="{BODY_D}"/></clipPath>
    <symbol id="spark" viewBox="-10 -10 20 20"><path d="M0 -10 Q1.6 -1.6 10 0 Q1.6 1.6 0 10 Q-1.6 1.6 -10 0 Q-1.6 -1.6 0 -10 Z"/></symbol>
  </defs>
  <g clip-path="url(#bg)">{d["bg"]}</g>
  <ellipse cx="200" cy="338" rx="104" ry="10" fill="{INK}" opacity="{d.get("shadow_op", 0.12)}"/>
  {d["behind"]}
  {body_fill()}{d["neck"]}{d.get("head_clip", "")}{body_close()}
  {d["face"]}
  {d["hat"]}
  {d["star"]}
  {d["front"]}
</svg>
'''


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for key, fn in SPOTS.items():
        (OUT / f"hoshimaru_{key}.svg").write_text(render(key, fn()), encoding="utf-8")
        print("wrote", f"hoshimaru_{key}.svg")


if __name__ == "__main__":
    main()
