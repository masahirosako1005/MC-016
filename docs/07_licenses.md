# 07 ライセンスと画像の出典

アプリ本体のコード・文章・地図 SVG はこのリポジトリの成果物（星凪諸島・店・人・旅人の声はすべて架空）。

## 実行時の依存（Python、`uv.lock` で固定）
| パッケージ | 版 | ライセンス |
|---|---|---|
| fastapi | 0.115.6 | MIT |
| starlette | 0.41.3 | BSD-3-Clause |
| uvicorn | 0.34.0 | BSD-3-Clause |
| pydantic / pydantic-core | 2.10.4 / 2.27.2 | MIT |
| python-multipart | 0.0.20 | Apache-2.0 |
| h11 | 0.16.0 | MIT |
| typing-extensions | 4.16.0 | PSF |
| （開発）pytest 8.3.4 / httpx 0.28.1 / httpcore / idna / iniconfig / packaging / pluggy | | MIT / BSD / Apache-2.0 |

## 画面（Node、`package-lock.json` で固定。ビルド成果物は `frontend/dist`）
| パッケージ | 版 | ライセンス |
|---|---|---|
| react / react-dom | 18.3.1 | MIT |
| （開発）vite 5.4.11、@vitejs/plugin-react 4.3.4、typescript 5.6.3、vitest 2.1.8、@types/react, @types/react-dom | | MIT |

## ツール
Python 3.12（PSF）、uv（MIT/Apache-2.0）、Node.js（MIT）。グローバルに入れたのは Python と uv だけ。
フォント: システムフォントのみ（Yu Mincho / Yu Gothic UI、外部フォントなし）。

## 画像（`frontend/public/img/`、2026-11-09 取得。ネット利用はこの取得時だけ）

### 人の絵 8 枚 — Loose Drawing（https://loosedrawing.com/、商用利用可・クレジット不要。素材そのものの再配布は不可）
| ファイル | 元イラスト |
|---|---|
| people/akari.png | https://loosedrawing.com/illust/1513/ 女性料理人 |
| people/rui.png | https://loosedrawing.com/illust/1076/ 立って案内する女性飲食店員 |
| people/tsukino.png | https://loosedrawing.com/illust/1515/ 泡立て器を持つ女性料理人 |
| people/minato.png | https://loosedrawing.com/illust/811/ 男性漁師 |
| people/tsuzuri.png | https://loosedrawing.com/illust/1917/ 紹介する男性作業員 |
| people/suzu.png | https://loosedrawing.com/illust/1978/ スマホとシニア女性 |
| people/nagi.png | https://loosedrawing.com/illust/1912/ 案内する作業員女性 |
| people/ho.png | https://loosedrawing.com/illust/1907/ 中年男性作業員（帽子） |

### 場所の写真 7 枚 — Unsplash（Unsplash License: 無償・商用可・クレジット任意）
| ファイル | 写真 |
|---|---|
| places/lighthouse.jpg | https://unsplash.com/photos/IzOrQXaOQXs |
| places/cape.jpg | https://unsplash.com/photos/DQZ-WFYYPwU |
| places/market.jpg | https://unsplash.com/photos/-F3wMFrZ7z0 |
| places/lake.jpg | https://unsplash.com/photos/A3Zah3ZZ6iU |
| places/windmill.jpg | https://unsplash.com/photos/Jfo6DeFqTnc |
| places/street.jpg | https://unsplash.com/photos/8MabgJlm434 |
| places/hall.jpg | https://unsplash.com/photos/EwwVAaxZ4DM |

### アイコン 11 点 — ICOOON MONO（https://icooon-mono.com/、商用利用可・クレジット不要。色を藍 #1b2a44 に変更）
calendar（12549）, pin（00020）, map（10163）, letter（00024）, ticket（11458）, camera（00068）, receipt（12044）, settings（00001）, download（00178）, share（00054）, print（11011）

### ゆるキャラ「ほしまる」 — 自作
| ファイル | 内容 |
|---|---|
| mascot/hoshimaru.svg | 星凪諸島のゆるキャラ（ごまふアザラシの子、頭に山吹の星、藍染のスカーフ、おもいで便の手紙）。このリポジトリで自作した SVG |
| mascot/hoshimaru.png | 上の SVG を Edge headless で 800×800 に書き出したもの |
| mascot/hoshimaru_<svg_key>.svg / .png | スポット別のほしまる 7 枚（svg_key は spots マスタと同じ: lighthouse・cape・market・lake・windmill・street・hall）。`scripts/mascot/gen_hoshimaru.py` で生成した自作 SVG と 800×800 PNG |

### 地図の背景（衛星写真風）— Unsplash
| ファイル | 写真 |
|---|---|
| map/island.jpg | https://unsplash.com/photos/Cgt8qnrgz4s （島々の空撮。第 3 回 FB で地図の背景に使ったが、第 4 回で自作の地形図 map/hoshinagi_map.png に置き換え。現在は未使用、参考のため残す） |
| mascot/ui/hoshimaru_<pose>.svg / .png | UI 用のポーズ差分 10 種（背景透過、PNG 720×720）。wave・cheer・point・letter・think・sleep・sorry・thanks・camera・coupon。一覧は mascot/ui/poses.json。`scripts/mascot/gen_hoshimaru_ui.py` で生成した自作素材 |
| frames/frame_<key>.svg / .png | AR フォト用フレーム 5 種（900×1200、写真の部分は透明）。ai・hoshizora・hagaki・cheki・hyokkori。一覧は frames/frames.json。同じスクリプトで生成した自作素材 |
| frames/frame_spot_<svg_key>.svg / .png | 場所ごとの特別フレーム 7 種（900×1200、写真の部分は透明。その場所の服装のほしまると場所名の札入り）。frames.json の `spot` に svg_key。同じスクリプトで生成した自作素材 |
| map/hoshinagi_map.png | Azgaar's Fantasy Map Generator（https://azgaar.github.io/Fantasy-Map-Generator/ 、MIT License。生成した地図は自由に利用可）で作成した星凪諸島の地図（2560×1920）。高度マップはアプリの場所座標（map_x/map_y、400×300 を 4 倍）に合わせて自前で書き込み、水彩スタイル＋バイオーム・地形・川。文字・ピン・航路は入れない（アプリ側のレイヤーで重ねる） |
| gifts/（wallpapers・stickers・nurie・card）/ frames/frame_gift_thanks | アンケート回答者へのお礼の品 18 点（待ち受け 6・スタンプ 8・ぬりえ 2・なかま証 1・ありがとうフレーム 1）。一覧は gifts/gifts.json。`scripts/mascot/gen_hoshimaru_gifts.py` で生成した自作素材 |
