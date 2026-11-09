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
