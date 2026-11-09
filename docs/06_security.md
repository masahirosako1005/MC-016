# 06 セキュリティ

- 入力検証: すべての API は pydantic（型・範囲・正規表現）で検証。CSV は行ごとに検証し、失敗行は理由付きで返す。
- SQL: すべてプレースホルダ。動的に組むのは IN 句の `?` の個数だけ。
- エラー: `{detail, code, request_id}` に統一。例外の詳細はログだけ（`X-Request-Id` で突き合わせ）。
- セキュリティヘッダ: CSP（`default-src 'self'`、img は self + data: + blob:、frame-ancestors self）、`X-Content-Type-Options: nosniff`、`X-Frame-Options: SAMEORIGIN`、`Referrer-Policy: same-origin`、`Permissions-Policy: camera=(self)`、API は `Cache-Control: no-store`。
- 静的配信: SPA フォールバックは `dist` を resolve した配下のファイルだけ返す（`%2F`・`%2e`・`%5C` でエンコードした `..` も resolve で潰す。2026-11-09 のセルフチェックで見つけて修正、テストあり）。
- 画像: 拡張子や Content-Type ではなく**先頭バイト**で判定（PNG/JPEG/WebP）。5MB 上限。保存名はサーバーが決める（UUID）。外部に送らない。
- レシート画像は **7 日で自動削除**（起動時）。ハッシュ・金額などの数値だけ残す。
- 重複登録: 画像の SHA-256 に UNIQUE。同日同人の「会えた」、同日同スポットの「行けた」も DB の UNIQUE。
- トランザクション: ポイント減算・在庫減・クーポン付与は `BEGIN IMMEDIATE` で 1 つ。書き込みはプロセス内ロックで直列化。
- 運営の窓の入力: 営業時間は形式だけでなく `time.fromisoformat` で実在する時刻か検証（99:99 を通すと利用者側の予報計算で 500 になるため）。
- 認証なし（ローカルホスト前提）。本体は利用者 8800001 固定。運営の窓も認証なし → 本番では認証と権限分離が必要（既知の制約）。
- 外部通信なし: CDN・外部フォント・外部 API を使わない。ネットはインストール時だけ。
- デモ層は `DEMO_MODE=1` のときだけルーターを組み込む。0 のときは `/api/demo/*` は存在しない（JSON 404）。
- 依存は版固定（`uv.lock`、`package-lock.json` + `npm ci`）。
- 個人情報: 取り込む CSV のメールはマスク済みで、そもそも保存しない。指標は 3 人未満の区分を非表示。
