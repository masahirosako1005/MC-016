"""アンケートに答えてくれた旅人へのお礼の品（ほしまる素材）を作る。

使い方: python scripts/mascot/gen_hoshimaru_gifts.py
出力: frontend/public/img/gifts/
  wallpapers/wp_<key>.svg   … スマホ待ち受け 1170×2532（上 1/3 は時計のために空けてある）
  stickers/st_<key>.svg     … スタンプ 370×320（背景透過、LINE スタンプの規格サイズ）
  nurie/nurie_<key>.svg     … 印刷用ぬりえ 1240×1754（A4 縦 150dpi）
  card/nakama.svg           … 星凪諸島なかま証 1011×638（カード比）
  gifts.json                … 一覧
  ../frames/frame_gift_thanks.svg … 回答者だけの AR フォトフレーム 900×1200
"""
from __future__ import annotations

import json
import math
import random
from pathlib import Path

import gen_hoshimaru as gh
import gen_hoshimaru_ui as ui
from gen_hoshimaru import (BLUSH, BODY_D, INK, INK2, INK3, PAPER, SW, TAIL, WARM, WAVE_LEFT, flipper, head_star,
                           scarf_knot, sparkle, star_points)
from gen_hoshimaru_ui import DEFS, GOTHIC, MINCHO, character, face, place, spot_char

ROOT = Path(__file__).resolve().parents[2] / "frontend" / "public" / "img"
OUT = ROOT / "gifts"


def svg(w, h, title, body, bg=None) -> str:
    b = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" '
            f'aria-label="{title}"><title>{title}</title><defs>{DEFS}</defs>{b}{body}</svg>\n')


def grad(gid, top, bottom, y2=1.0) -> str:
    return (f'<linearGradient id="{gid}" x1="0" y1="0" x2="0" y2="{y2}"><stop offset="0" stop-color="{top}"/>'
            f'<stop offset="1" stop-color="{bottom}"/></linearGradient>')


def wband(y, fill, w, h, amp=18, wl=120) -> str:
    d = f"M0 {y} Q{wl / 4} {y - amp} {wl / 2} {y}"
    x = wl / 2
    while x < w:
        x += wl / 2
        d += f" T{x} {y}"
    return f'<path d="{d} V{h} H0 Z" fill="{fill}"/>'


def cloud(x, y, s=1.0, op=0.95) -> str:
    return (f'<g transform="translate({x} {y}) scale({s})" fill="#ffffff" opacity="{op}">'
            f'<ellipse cx="0" cy="0" rx="120" ry="44"/><circle cx="-40" cy="-30" r="46"/><circle cx="34" cy="-44" r="58"/></g>')


def windmill(x, base, s=1.0, line=INK) -> str:
    hub = base - 270 * s
    blades = "".join(f'<rect x="{x - 15 * s}" y="{hub - 160 * s}" width="{30 * s}" height="{160 * s}" rx="{10 * s}" '
                     f'transform="rotate({a} {x} {hub})" fill="{PAPER}" stroke="{line}" stroke-width="{6 * s}"/>'
                     for a in (20, 110, 200, 290))
    return (f'<path d="M{x - 34 * s} {base} L{x - 20 * s} {hub + 6 * s} L{x + 20 * s} {hub + 6 * s} L{x + 34 * s} {base} Z" '
            f'fill="{PAPER}" stroke="{line}" stroke-width="{7 * s}" stroke-linejoin="round"/>'
            f'<rect x="{x - 14 * s}" y="{base - 70 * s}" width="{28 * s}" height="{56 * s}" rx="{12 * s}" fill="{INK3}"/>'
            + blades + f'<circle cx="{x}" cy="{hub}" r="{13 * s}" fill="{line}"/>')


def flowers(rnd, n, x0, x1, y0, y1) -> str:
    return "".join(f'<circle cx="{rnd.randint(x0, x1)}" cy="{rnd.randint(y0, y1)}" r="{rnd.choice([7, 8, 10, 11])}" '
                   f'fill="#efcf5a" stroke="#c9a53a" stroke-width="2"/>' for _ in range(n))


def label(w, y, text="HOSHINAGI ISLANDS", fill=INK3, size=34) -> str:
    return (f'<text x="{w / 2}" y="{y}" text-anchor="middle" font-family="{GOTHIC}" font-size="{size}" fill="{fill}" '
            f'letter-spacing="12">{text}</text>')


# ---------- 待ち受け（1170×2532） ----------
WW, WH = 1170, 2532
CHAR_WP = (185, 1480, 2.0)   # 体の下端 ≈ y2144、星の上端 ≈ y1600


def wp_spring():
    rnd = random.Random(11)
    return (f'<defs>{grad("sky", "#dbe7f5", "#f4f7fb", 0.75)}</defs><rect width="{WW}" height="{WH}" fill="url(#sky)"/>'
            + cloud(260, 1180, 1.1) + cloud(900, 1360, 0.8)
            + windmill(220, 1830, 0.55, INK3)
            + f'<path d="M0 1900 Q300 1780 650 1880 T{WW} 1830 V{WH} H0 Z" fill="#d6e3cf"/>'
            + windmill(960, 1900, 1.1) + flowers(rnd, 45, 0, WW, 1920, 2130)
            + f'<path d="M0 2140 Q350 2060 700 2130 T{WW} 2100 V{WH} H0 Z" fill="#c8d9be"/>'
            + flowers(rnd, 80, 0, WW, 2170, 2520)
            + place(spot_char("windmill"), *CHAR_WP) + label(WW, 2330, fill="#5b7a58"))


def wp_summer():
    clip = '<clipPath id="lt"><path d="M150 1730 L172 1150 L228 1150 L250 1730 Z"/></clipPath>'
    house = (clip + f'<linearGradient id="beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{WARM}" stop-opacity="0.8"/>'
             f'<stop offset="1" stop-color="{WARM}" stop-opacity="0"/></linearGradient>'
             f'<path d="M232 1120 L820 990 L820 1260 Z" fill="url(#beam)"/>'
             f'<path d="M150 1730 L172 1150 L228 1150 L250 1730 Z" fill="{PAPER}"/>'
             f'<g clip-path="url(#lt)" fill="{INK3}"><rect x="140" y="1270" width="120" height="70"/><rect x="140" y="1470" width="120" height="70"/></g>'
             f'<path d="M150 1730 L172 1150 L228 1150 L250 1730 Z" fill="none" stroke="{INK}" stroke-width="8" stroke-linejoin="round"/>'
             f'<rect x="164" y="1090" width="72" height="62" rx="6" fill="{WARM}" stroke="{INK}" stroke-width="8"/>'
             f'<path d="M150 1094 L200 1040 L250 1094 Z" fill="{INK}" stroke="{INK}" stroke-width="6" stroke-linejoin="round"/>'
             f'<path d="M20 1760 Q120 1690 200 1700 Q300 1690 380 1760 Z" fill="{INK3}"/>')
    shells = "".join(f'<polygon points="{star_points(x, y, r, 0.5)}" fill="#f2d7b8" stroke="{INK3}" stroke-width="4" stroke-linejoin="round"/>'
                     for x, y, r in [(150, 2240, 26), (1040, 2300, 20), (260, 2420, 16)])
    return (f'<defs>{grad("sky", "#c7dcf2", "#eef4fb", 0.7)}</defs><rect width="{WW}" height="{WH}" fill="url(#sky)"/>'
            f'<circle cx="960" cy="1060" r="86" fill="{WARM}"/>' + cloud(700, 1500, 0.9) + cloud(1020, 1600, 0.6)
            + ui.gull(640, 1260, 2.4) + ui.gull(800, 1360, 1.6) + ui.gull(560, 1420, 1.1)
            + f'<rect y="1720" width="{WW}" height="400" fill="#b9cde6"/>'
            + wband(1790, "#a9c1e0", WW, WH, 16, 140) + wband(1880, "#98b4d8", WW, WH, 16, 140) + house
            + f'<path d="M0 2040 Q500 1960 {WW} 2050 V{WH} H0 Z" fill="#f1ead8"/>' + shells
            + place(spot_char("lighthouse"), 340, 1530, 2.0) + label(WW, 2330, fill="#8c7a58"))


def wp_autumn():
    rnd = random.Random(5)
    pines = "".join(f'<path d="M{x} 1830 L{x + w / 2} {1830 - h} L{x + w} 1830 Z" fill="{c}"/>' for x, w, h, c in [
        (-30, 150, 330, "#a3b3cd"), (90, 120, 240, "#b3c1d8"), (180, 100, 170, "#a3b3cd"),
        (900, 110, 200, "#b3c1d8"), (990, 140, 300, "#a3b3cd"), (1080, 130, 230, "#b3c1d8")])
    leaves = "".join(gh.leaf(rnd.randint(40, WW - 40), rnd.randint(980, 2460), rnd.choice([16, 20, 26, 32]),
                             rnd.randint(-40, 40), rnd.choice(["#d48a64", "#e0a05a", "#cf7656"])) for _ in range(26))
    return (f'<defs>{grad("sky", "#e6ecf6", "#f6f8fb", 0.7)}</defs><rect width="{WW}" height="{WH}" fill="url(#sky)"/>'
            f'<path d="M0 1700 Q250 1540 520 1650 T{WW} 1620 V{WH} H0 Z" fill="#d3dceb"/>' + pines
            + f'<rect y="1828" width="{WW}" height="700" fill="#d6e1ee"/>'
            f'<g stroke="{PAPER}" stroke-width="8" stroke-linecap="round"><path d="M120 1900 H300"/><path d="M820 1940 H1040"/><path d="M460 1990 H560"/></g>'
            f'<path d="M0 2150 Q600 2090 {WW} 2160 V{WH} H0 Z" fill="#c9d4e6"/>' + leaves
            + place(spot_char("lake"), *CHAR_WP) + label(WW, 2330, fill=INK3))


def wp_winter():
    rnd = random.Random(9)
    houses = ""
    for x, w, h in [(-20, 220, 520), (190, 180, 400), (360, 170, 300), (640, 170, 320), (800, 190, 430), (980, 210, 560)]:
        top = 2090 - h
        houses += (f'<rect x="{x}" y="{top}" width="{w}" height="{h}" fill="{INK2}"/>'
                   f'<path d="M{x - 14} {top + 4} L{x + w / 2} {top - 60} L{x + w + 14} {top + 4} Z" fill="{INK}"/>'
                   f'<path d="M{x - 14} {top + 4} L{x + w / 2} {top - 60} L{x + w + 14} {top + 4}" fill="none" stroke="{PAPER}" stroke-width="14" stroke-linejoin="round"/>'
                   f'<rect x="{x + 34}" y="{top + 54}" width="44" height="52" rx="8" fill="{WARM}"/>'
                   f'<rect x="{x + w - 80}" y="{top + 150}" width="44" height="52" rx="8" fill="{WARM}"/>')
    snow = "".join(f'<circle cx="{rnd.randint(0, WW)}" cy="{rnd.randint(0, 2500)}" r="{rnd.choice([4, 6, 8, 10])}" fill="{PAPER}" '
                   f'opacity="{rnd.choice([0.6, 0.8, 1])}"/>' for _ in range(150))
    return (f'<defs>{grad("sky", "#cfdaeb", "#eef2f8", 0.8)}</defs><rect width="{WW}" height="{WH}" fill="url(#sky)"/>'
            + houses + f'<path d="M0 2070 Q600 2030 {WW} 2080 V{WH} H0 Z" fill="{PAPER}"/>'
            f'<path d="M0 2070 Q600 2030 {WW} 2080" fill="none" stroke="#c8d3e6" stroke-width="6"/>' + snow
            + place(spot_char("street"), *CHAR_WP) + label(WW, 2330, fill=INK3))


def wp_night():
    rnd = random.Random(2)
    milky = "".join(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" transform="rotate(-28 {cx} {cy})" fill="#8fa3c6" opacity="{op}"/>'
                    for cx, cy, rx, ry, op in [(585, 1100, 900, 160, 0.08), (585, 1100, 700, 90, 0.08), (620, 1080, 420, 46, 0.1)])
    dots = "".join(f'<circle cx="{rnd.randint(0, WW)}" cy="{rnd.randint(0, 2000)}" r="{rnd.choice([1.5, 2, 2.5, 3.5])}" '
                   f'fill="{PAPER}" opacity="{rnd.choice([0.4, 0.6, 0.9])}"/>' for _ in range(220))
    sp = "".join(sparkle(rnd.randint(40, WW - 80), rnd.randint(900, 1800), rnd.choice([28, 36, 48]),
                         rnd.choice([PAPER, "#c8d3e6"])) for _ in range(12))
    moon = (f'<mask id="m"><rect width="{WW}" height="{WH}" fill="#fff"/><circle cx="960" cy="1000" r="92" fill="#000"/></mask>'
            f'<circle cx="910" cy="1040" r="104" fill="{WARM}" mask="url(#m)"/>')
    rocks = "".join(f'<polygon points="{star_points(x, y, r, 0.5)}" fill="#14213a" stroke="#14213a" stroke-width="10" stroke-linejoin="round"/>'
                    for x, y, r in [(140, 2260, 60), (1030, 2230, 44), (900, 2420, 30)])
    return (f'<defs>{grad("sky", "#101a2e", "#2b4069", 1)}</defs><rect width="{WW}" height="{WH}" fill="url(#sky)"/>'
            + milky + dots + sp + moon
            + wband(2050, "#2b4069", WW, WH, 18, 160) + wband(2150, "#334a76", WW, WH, 18, 160) + wband(2270, "#3b5482", WW, WH, 18, 160)
            + rocks + place(spot_char("cape"), 185, 1430, 2.0) + label(WW, 2400, fill="#c8d3e6"))


def wp_ai():
    r = 90
    rings = ""
    row = 0
    for y in range(1460, WH + r, r // 2):
        off = 0 if row % 2 == 0 else r
        for x in range(-2 * r + off, WW + 2 * r, 2 * r):
            rings += (f'<circle cx="{x}" cy="{y}" r="{r}" fill="{INK}"/>'
                      + "".join(f'<circle cx="{x}" cy="{y}" r="{rr}" fill="none" stroke="{INK3}" stroke-width="6"/>'
                                for rr in (r - 12, r - 30, r - 48, r - 66)))
        row += 1
    mask = (f'<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.5" stop-color="#000"/>'
            f'<stop offset="0.75" stop-color="#fff"/></linearGradient>'
            f'<mask id="fm"><rect width="{WW}" height="{WH}" fill="url(#fade)"/></mask>')
    return (f'<defs>{mask}</defs><rect width="{WW}" height="{WH}" fill="{INK}"/><g mask="url(#fm)">{rings}</g>'
            f'<text x="{WW / 2}" y="1290" text-anchor="middle" font-family="{MINCHO}" font-size="72" font-weight="600" fill="{PAPER}" letter-spacing="28">星凪諸島</text>'
            + place(character(WAVE_LEFT + TAIL, face("open", "w"), scarf_knot() + ui.RIGHT_FRONT), *CHAR_WP)
            + label(WW, 2330, fill="#c8d3e6"))


WALLPAPERS = {
    "spring": (wp_spring, "春・月花の風車丘（菜の花と風車）"),
    "summer": (wp_summer, "夏・風詠みの灯台（海と灯台）"),
    "autumn": (wp_autumn, "秋・瑠璃凪の水鏡湖（もみじと湖）"),
    "winter": (wp_winter, "冬・灯雲の石畳通り（雪と家々の灯り）"),
    "night": (wp_night, "星凪の夜（天の川と三日月）"),
    "ai": (wp_ai, "藍染（青海波と星凪諸島）"),
}


# ---------- スタンプ（370×320、背景透過） ----------
STICKERS = {
    "hello": ("wave", "こんにちは"),
    "thanks": ("thanks", "ありがとう"),
    "yatta": ("cheer", "やったー！"),
    "sorry": ("sorry", "ごめんね"),
    "oyasumi": ("sleep", "おやすみ"),
    "uun": ("think", "うーん…"),
    "matane": ("letter", "またきてね"),
    "photo": ("camera", "いい写真！"),
}


def sticker(pose: str, text: str) -> str:
    char = ui.POSES[pose][0]()
    size = 50 if len(text) <= 5 else 44
    return (place(char, 21, -4, 0.84)
            + f'<text x="185" y="300" text-anchor="middle" font-family="{GOTHIC}" font-weight="700" font-size="{size}" '
              f'fill="{INK}" stroke="{PAPER}" stroke-width="14" stroke-linejoin="round" paint-order="stroke" letter-spacing="2">{text}</text>')


# ---------- ぬりえ（1240×1754） ----------
NW, NH = 1240, 1754
LINE = 'fill="#ffffff" stroke="#1b2a44" stroke-linejoin="round"'


def line_char(scarf=True, mouth="open") -> str:
    s = (f'<ellipse cx="86" cy="206" rx="14" ry="32" transform="rotate(-42 86 206)" {LINE} stroke-width="{SW}"/>'
         f'<path d="M292 300 C312 296 332 284 340 292 C346 300 330 316 312 322 C300 326 292 318 292 300 Z" {LINE} stroke-width="{SW}"/>'
         f'<path d="{BODY_D}" {LINE} stroke-width="{SW}"/>')
    if scarf:
        s += (f'<g clip-path="url(#body)"><path d="M80 266 Q200 296 320 266 L320 282 Q200 314 80 282 Z" {LINE} stroke-width="3.5"/>'
              + "".join(f'<circle cx="{x}" cy="{(274 + 2 * ((x - 80) / 240) * (1 - (x - 80) / 240) * 31):.1f}" r="3.5" fill="none" stroke="{INK}" stroke-width="2"/>'
                        for x in range(110, 310, 28)) + '</g>'
              f'<path d="{BODY_D}" fill="none" stroke="{INK}" stroke-width="{SW}"/>' + scarf_knot(fill="#ffffff"))
    s += f'<ellipse cx="292" cy="300" rx="13" ry="22" transform="rotate(-30 292 300)" {LINE} stroke-width="{SW}"/>'
    s += ('<g transform="translate(0 12)">'
          f'<ellipse cx="138" cy="226" rx="17" ry="10" fill="none" stroke="{INK3}" stroke-width="2.5" stroke-dasharray="5 4"/>'
          f'<ellipse cx="262" cy="226" rx="17" ry="10" fill="none" stroke="{INK3}" stroke-width="2.5" stroke-dasharray="5 4"/>'
          + "".join(f'<ellipse cx="{x}" cy="200" rx="12" ry="15" fill="{INK}"/><circle cx="{x + 3}" cy="193" r="4.5" fill="#fff"/>'
                    f'<circle cx="{x - 4}" cy="207" r="2" fill="#fff"/>' for x in (160, 240))
          + f'<ellipse cx="200" cy="218" rx="7.5" ry="5.5" fill="{INK}"/>')
    if mouth == "open":
        s += f'<path d="M188 227 Q200 247 212 227 Q200 231 188 227 Z" {LINE} stroke-width="3.5"/>'
    else:
        s += f'<path d="M186 226 Q193 236 200 226 Q207 236 214 226" fill="none" stroke="{INK}" stroke-width="4" stroke-linecap="round"/>'
    s += '</g>'
    s += (f'<path d="M200 124 Q196 108 206 98" fill="none" stroke="{INK}" stroke-width="{SW}" stroke-linecap="round"/>'
          f'<polygon transform="rotate(12 208 86)" points="{star_points(208, 86)}" {LINE} stroke-width="4.5"/>')
    return s


def outline_star(x, y, r, rot=0, w=4) -> str:
    return f'<polygon transform="rotate({rot} {x} {y})" points="{star_points(x, y, r, 0.46)}" {LINE} stroke-width="{w}"/>'


def nurie_title(text, y=210, size=104) -> str:
    return (f'<text x="{NW / 2}" y="{y}" text-anchor="middle" font-family="{MINCHO}" font-weight="700" font-size="{size}" '
            f'fill="#ffffff" stroke="{INK}" stroke-width="4" stroke-linejoin="round" letter-spacing="10">{text}</text>')


def nurie_footer() -> str:
    return (f'<text x="90" y="1640" font-family="{GOTHIC}" font-size="34" fill="{INK}">なまえ</text>'
            f'<path d="M200 1648 H700" stroke="{INK3}" stroke-width="3"/>'
            f'<text x="{NW - 90}" y="1640" text-anchor="end" font-family="{GOTHIC}" font-size="28" fill="{INK3}" letter-spacing="6">星凪諸島 ・ ひとめぐり</text>')


def nurie_basic():
    lh = (f'<path d="M130 1440 L150 1020 L200 1020 L220 1440 Z" {LINE} stroke-width="5"/>'
          f'<path d="M140 1160 H210 M137 1220 H213 M133 1300 H217 M130 1360 H220" stroke="{INK}" stroke-width="4"/>'
          f'<rect x="146" y="968" width="58" height="52" rx="5" {LINE} stroke-width="5"/>'
          f'<path d="M136 970 L175 926 L214 970 Z" {LINE} stroke-width="5"/>')
    waves = "".join(f'<path d="M0 {y} q40 -26 80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0" '
                    f'fill="none" stroke="{INK}" stroke-width="4"/>' for y in (1470, 1530))
    env = (f'<g transform="rotate(10 1030 470)"><rect x="950" y="420" width="160" height="104" rx="10" {LINE} stroke-width="5"/>'
           f'<path d="M956 428 L1030 480 L1104 428" fill="none" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/></g>')
    stars = outline_star(170, 420, 44, -10) + outline_star(1080, 760, 34, 15) + outline_star(260, 640, 24, 5) + outline_star(1000, 1060, 26)
    return (nurie_title("ほしまる ぬりえ") + stars + env + lh + waves
            + place(line_char(), 140, 500, 2.4) + nurie_footer())


def nurie_dress():
    guide = (f'<path d="M370 690 Q620 420 870 690" fill="none" stroke="{INK3}" stroke-width="4" stroke-dasharray="14 12"/>'
             f'<text x="{NW / 2}" y="470" text-anchor="middle" font-family="{GOTHIC}" font-size="40" fill="{INK3}">ここに ぼうしを かいてね</text>'
             f'<text x="{NW / 2}" y="1420" text-anchor="middle" font-family="{GOTHIC}" font-size="40" fill="{INK3}">すきな ふく・もちものも かいてみよう</text>')
    stars = outline_star(150, 360, 36, -10) + outline_star(1090, 380, 30, 15) + outline_star(1100, 1160, 24)
    return (nurie_title("ほしまるを きせかえよう", 230, 80) + guide + stars
            + place(line_char(scarf=False, mouth="w"), 140, 560, 2.4) + nurie_footer())


NURIE = {
    "basic": (nurie_basic, "ほしまるぬりえ（灯台・手紙・星）"),
    "dress": (nurie_dress, "きせかえぬりえ（ぼうしや服を描き足す）"),
}


# ---------- なかま証（1011×638） ----------
CW, CH = 1011, 638


def nakama_card():
    r = 50
    rings = ""
    row = 0
    for y in range(-r, CH + r, r // 2):
        off = 0 if row % 2 == 0 else r
        for x in range(-2 * r + off, 380 + 2 * r, 2 * r):
            rings += (f'<circle cx="{x}" cy="{y}" r="{r}" fill="{INK}"/>'
                      + "".join(f'<circle cx="{x}" cy="{y}" r="{rr}" fill="none" stroke="{INK2}" stroke-width="4"/>' for rr in (r - 8, r - 20, r - 32)))
        row += 1
    cheer = character(flipper(84, 168, 14, 34, -22) + flipper(316, 168, 14, 34, 22) + TAIL, face("happy", "open"), scarf_knot())
    return (f'<clipPath id="card"><rect width="{CW}" height="{CH}" rx="36"/></clipPath>'
            f'<g clip-path="url(#card)"><rect width="{CW}" height="{CH}" fill="{PAPER}"/>'
            f'<g clip-path="url(#left)">{rings}</g>'
            f'<clipPath id="left"><rect width="360" height="{CH}"/></clipPath>'
            f'<rect x="360" width="10" height="{CH}" fill="{INK3}"/>'
            + place(cheer, 2, 150, 0.92)
            + f'<text x="414" y="110" font-family="{MINCHO}" font-size="32" font-weight="600" fill="{INK3}" letter-spacing="10">星凪諸島</text>'
            f'<text x="406" y="214" font-family="{MINCHO}" font-size="96" font-weight="700" fill="{INK}" letter-spacing="12">なかま証</text>'
            f'<path d="M414 246 H950" stroke="{INK}" stroke-width="3"/>'
            f'<text x="414" y="296" font-family="{GOTHIC}" font-size="25" fill="{INK}">アンケートにご協力いただき、ありがとうございます。</text>'
            f'<text x="414" y="334" font-family="{GOTHIC}" font-size="25" fill="{INK}">またのお越しを、島のみんなで待っています。</text>'
            f'<text x="414" y="430" font-family="{GOTHIC}" font-size="24" fill="{INK3}">おなまえ</text>'
            f'<path d="M524 438 H950" stroke="#b3c1d8" stroke-width="3"/>'
            f'<text x="414" y="506" font-family="{GOTHIC}" font-size="24" fill="{INK3}">はじめて来た日</text>'
            f'<path d="M590 514 H950" stroke="#b3c1d8" stroke-width="3"/>'
            f'<text x="950" y="590" text-anchor="end" font-family="{GOTHIC}" font-size="18" fill="{INK3}" letter-spacing="6">HOSHINAGI ISLANDS ・ ひとめぐり</text>'
            f'</g><rect x="2" y="2" width="{CW - 4}" height="{CH - 4}" rx="34" fill="none" stroke="#dfe6f1" stroke-width="4"/>')


# ---------- 回答者だけの AR フレーム（900×1200） ----------
def frame_thanks():
    FW, FH = 900, 1200
    l, t, r, b = 44, 44, FW - 44, 960
    hearts = "".join(ui.heart(x, y, s, c) for x, y, s, c in [
        (22, 300, 1.0, BLUSH), (878, 200, 1.2, BLUSH), (22, 640, 0.8, "#c8d3e6"), (878, 560, 0.9, "#c8d3e6"),
        (300, 20, 0.8, BLUSH), (600, 18, 0.9, "#c8d3e6"), (878, 860, 0.8, BLUSH)])
    ribbon = (f'<polygon points="0,150 150,0 250,0 0,250" fill="{INK}"/>'
              f'<text x="0" y="0" transform="translate(112 112) rotate(-45)" text-anchor="middle" dy="12" font-family="{GOTHIC}" '
              f'font-weight="700" font-size="32" fill="{PAPER}" letter-spacing="6">THANK YOU</text>')
    thanks = ui.POSES["thanks"][0]()
    return (f'<path fill-rule="evenodd" d="{ui.window_path(l, t, r, b, 18)}" fill="{PAPER}"/>'
            f'<rect x="{l - 12}" y="{t - 12}" width="{r - l + 24}" height="{b - t + 24}" rx="26" fill="none" stroke="{BLUSH}" stroke-width="5" stroke-dasharray="2 14" stroke-linecap="round"/>'
            + hearts + ribbon
            + f'<text x="76" y="1068" font-family="{MINCHO}" font-size="76" font-weight="700" fill="{INK}" letter-spacing="10">ありがとう</text>'
            f'<text x="80" y="1124" font-family="{GOTHIC}" font-size="24" fill="{INK3}" letter-spacing="5">アンケートのお礼 ・ 星凪諸島</text>'
            + place(thanks, 590, 872, 0.82))


def main() -> None:
    items = []
    for sub in ("wallpapers", "stickers", "nurie", "card"):
        (OUT / sub).mkdir(parents=True, exist_ok=True)
    for k, (fn, t) in WALLPAPERS.items():
        (OUT / "wallpapers" / f"wp_{k}.svg").write_text(svg(WW, WH, f"待ち受け: {t}", fn()), encoding="utf-8")
        items.append({"type": "wallpaper", "key": k, "label": t, "width": WW, "height": WH,
                      "svg": f"/img/gifts/wallpapers/wp_{k}.svg", "png": f"/img/gifts/wallpapers/wp_{k}.png"})
    for k, (pose, text) in STICKERS.items():
        (OUT / "stickers" / f"st_{k}.svg").write_text(svg(370, 320, f"スタンプ: {text}", sticker(pose, text)), encoding="utf-8")
        items.append({"type": "sticker", "key": k, "label": text, "width": 370, "height": 320,
                      "svg": f"/img/gifts/stickers/st_{k}.svg", "png": f"/img/gifts/stickers/st_{k}.png"})
    for k, (fn, t) in NURIE.items():
        (OUT / "nurie" / f"nurie_{k}.svg").write_text(svg(NW, NH, f"ぬりえ: {t}", fn(), bg="#ffffff"), encoding="utf-8")
        items.append({"type": "nurie", "key": k, "label": t, "width": NW, "height": NH,
                      "svg": f"/img/gifts/nurie/nurie_{k}.svg", "png": f"/img/gifts/nurie/nurie_{k}.png"})
    (OUT / "card" / "nakama.svg").write_text(svg(CW, CH, "星凪諸島なかま証", nakama_card()), encoding="utf-8")
    items.append({"type": "card", "key": "nakama", "label": "星凪諸島なかま証", "width": CW, "height": CH,
                  "svg": "/img/gifts/card/nakama.svg", "png": "/img/gifts/card/nakama.png"})
    (ROOT / "frames" / "frame_gift_thanks.svg").write_text(
        ui.frame_svg("フレーム: ありがとう（アンケート回答者だけ）", frame_thanks()), encoding="utf-8")
    items.append({"type": "ar_frame", "key": "gift_thanks", "label": "ありがとうフレーム（回答者だけ）", "width": 900, "height": 1200,
                  "svg": "/img/frames/frame_gift_thanks.svg", "png": "/img/frames/frame_gift_thanks.png"})
    (OUT / "gifts.json").write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"gifts={len(items)}")


if __name__ == "__main__":
    main()
