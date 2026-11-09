# 01 システム構成（短縮版）

```
ブラウザ (React + TS, hash ルーティング自前)
   │  /api/*  JSON
   ▼
FastAPI (uvicorn, 127.0.0.1:8000, 1 プロセス)
   ├ api/          pydantic で入力検証、エラーは {detail, code, request_id}
   ├ services/     業務ルール（clock, season, forecast, seeds, points, lottery, letters, trips, metrics, importer, dummy, cleanup）
   ├ repositories/ SQL（プレースホルダのみ）
   └ StaticFiles   frontend/dist を / から配信、SPA フォールバック
SQLite data/app.db (標準 sqlite3)
data/uploads/ レシート画像（7 日で削除） / data/photos/ AR フォト
```

- 時刻は `services/clock.py` の 1 箇所から。`DEMO_MODE=1` のときだけ DB の `settings.demo_clock` を返す。
- `DEMO_MODE=0` では `/api/demo/*` は JSON 404、`/#/present` は本体へ戻す。
- セキュリティヘッダ: CSP（self のみ、img は self + blob + data）、X-Content-Type-Options、Referrer-Policy、X-Frame-Options は同一オリジン（present の iframe のため SAMEORIGIN）。
- 存在しない `/api/*` は JSON 404。例外の詳細はログだけ。
- 依存は版固定（uv.lock / package-lock.json + npm ci）、グローバルには Python と uv だけ。
- 起動: `scripts/start.ps1 [-Demo]` → npm ci → npm run build → uv sync → uv run uvicorn。
- 運営の窓 `/#/admin` は DEMO_MODE に関係なく動く。認証なし（ローカル前提）。
