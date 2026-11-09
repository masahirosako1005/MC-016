# ひとめぐり便

星凪諸島（架空）の観光スタンプラリーに足す、観光者向けスマホ Web アプリ。
旅先で会ったお店の人との **約束（季節の種）** と **思い出（おもいで便）** を持ち帰り、季節の便りと次の旅でしか使えないクーポンで **その人に会いに戻りたくなる** 体験をつくる。旅前（しらべる・つぎの旅）→ 旅中（きょう・AR フォト・レシート）→ 旅後（おもいで便・種と花・クーポン）を 1 本で。

## 動かす
前提: Windows、Node.js 18+、Python 3.12、uv（`winget install Python.Python.3.12 astral-sh.uv`）。ネットはインストール時だけ使います。

```powershell
.\scripts\start.ps1          # 本体だけ（実際の日付）
.\scripts\start.ps1 -Demo    # デモ層つき（模擬の時計、/#/present）
```
→ http://127.0.0.1:8000 （本体） / `/#/admin`（運営の窓） / `/#/present`（発表用、-Demo のときだけ）

スクリプトは `npm ci → npm run build → uv sync → uvicorn` を順に行い、1 プロセスで画面と API を同じポートから配ります。`-SkipBuild` で画面のビルドを飛ばせます。

テスト: `uv run pytest`（37 件）。

## 構成
- backend: Python 3.12 + FastAPI + uvicorn、SQLite（標準 sqlite3、`data/app.db`）。層は api（pydantic）→ services → repositories。
- frontend: React 18 + TypeScript + Vite。ルーター・UI ライブラリなし、絵は自前 SVG、外部 CDN・フォントなし。
- データ: `C:\AI-Sprint\sample-data` の 5 CSV を運営の窓から取り込み（冪等、失敗行は理由付き）。足りない履歴はシード 42 のダミー（`is_dummy`）。

## 画面
下タブ 5 つ: **計画**（旅前: 行きたい場所をえらぶ → そこにいる人が分かる → 日を決める）／**マップ**（旅中: 行った先の人に「会えた」→ AR フォト → レシート）／**思い出**（おもいで便・ひとめぐり帖）／**クーポン**（クーポン・ポイントと抽選・レシート）。各タブの上に「いまやること」、初回は 3 枚のガイド。詳しくは `docs/02_screens.md`。

デザインは藍染と和紙の手紙（藍 `#1b2a44`・紙 `#fbfcfd`・差し色 山吹 `#e3a21a`、見出し明朝・本文ゴシック）。人の絵は Loose Drawing、場所の写真は Unsplash、アイコンは ICOOON MONO（出典は `docs/07_licenses.md`）。

## ドキュメント
`docs/00_requirements.md` 要件と判断ログ ／ `01_system.md` 構成 ／ `02_screens.md` 画面 ／ `03_data.md` データ ／ `04_features.md` 機能 ／ `05_tests.md` テスト ／ `06_security.md` セキュリティ ／ `07_licenses.md` ライセンス ／ `08_demo_scripts.md` デモ台本 ／ `10_progress.md` 進捗（1 行ずつ）

## 正直に書いておくこと
- 「AR フォト」はカメラ映像に人の絵と飾りを重ねて合成するもので、マーカー認識や空間追跡はしていません。
- 「SNS で見かけた声」はデモ用の内部データです。本番では SNS 公式 API 等に差し替える前提です。
- 認証はありません（ローカルホスト前提）。本番では運営の窓に認証が必要です。
