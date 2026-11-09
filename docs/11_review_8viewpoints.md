# 11 事務局 8 観点セルフチェック（2026-11-09）

対象: 作業ツリーの状態（コミット 7c4d184 + 別セッションが編集中の未コミット差分）。
確認手段: `uv run pytest`（34 件通過）、`npm run build`（型検査込みで通過）、デモ起動（`start.ps1 -Demo`、ポート 8001）でのブラウザ操作（初回ガイド → マップ → 計画 → クーポン → 設定。コンソールエラーなし）、生 HTTP でのパス検査、コード読解（frontend/src 全ページ、backend/app 全モジュール）。
評価は ◎（強み）／○（概ね良い）／△（要対応あり）／✕（致命）。

| # | 観点 | 評価 | ひとこと |
|---|------|------|----------|
| S1 | 要求仕様・目的の達成度 | ◎ | 旅前→旅中→旅後が通しで動き、「人に会いに戻る」設計が全画面に一貫 |
| S2 | ユーザビリティ | ○ | 1 画面 1 主ボタン・48px・図解ガイドは強い。行き止まり 1 件と文言の残骸あり |
| S3 | 革新性 | ○ | 場所→人→季節の種、おもいで便、ほしまる AR は独自。OCR と現在地は演出で開示が不足 |
| S4 | 多様性 | △ | 文字サイズ・はっきり配色・やさしい日本語を備えるが、キーボード操作とフォーカス管理が未対応 |
| T1 | 正確性 | ○ | テスト 37 件・通し動作 OK。店の編集で定休日が消える／営業時間 99:99 で 500／次の一手が実時刻を見る の 3 件は同日修正済み |
| T2 | セキュリティ | ○ | ヘッダ・検証・先頭バイト判定は良い。SPA 配信のパストラバーサルは同日修正済み（生 HTTP で再検証） |

### 同日の修正（2026-11-09、pytest 34 → 37 件）
- `backend/app/main.py` SPA フォールバック: `dist` を resolve した配下のファイルだけ返す。`/..%2F..%2F…`・`/%2e%2e/…`・`/..%5C…` はすべて index.html に落ちることを生 HTTP で再確認。テスト `test_spa_never_serves_outside_dist`。
- `backend/app/api/operator.py` 店の編集: `model_dump(exclude_unset=True)` で送られた項目だけ更新（定休日が消えない。null を明示したときだけ無休）。営業時間は `time.fromisoformat` で実在チェック（99:99 は 422）。
- `backend/app/seed/master.py` 起動時の shops 上書きから営業時間・定休日・紹介・行き方を外した（点検中に追加で見つけた件: 起動やデモ初期化のたびに運営の編集が master に戻っていた）。
- `backend/app/services/advice.py` `audience` が `now` を受け取り、呼び出し側（API・便り送信・次の一手）は clock の時刻を渡す。デモ時計 12-01 で「花」1 人になることをテスト。
- 未着手: フロント側（印刷パス・見込みポイント・長押し文言・アクセシビリティ）、画像の孤児対策と 7 日削除の日次化、便りの表示と宛先の整合。
| T3 | データ完全性 | ○ | UNIQUE・1 トランザクション・直列化は良い。画像の孤児と削除タイミングに穴 |
| T4 | 保守性 | ○ | 層分けと型は良い。フロントに死にコード・型の重複・巨大コンポーネント |

---

## サービス性

### S1 要求仕様・目的の達成度 ◎
- テーマ「旅の後に開く理由」に対し、約束（種→つぼみ→花）・おもいで便（18:00 開封、最終日+30 日に再配達）・次の旅でしか使えないクーポン（当選翌日から）の 3 本が実装され、present の 5 場面で通しが確認できる。
- CLAUDE.md の禁止事項（格付け・星・ランキングなし、外部 API/CDN/フォントなし、本体とデモ層の分離、時刻は clock 1 箇所）はコードで守られている（`backend/app/api/__init__.py` のデモ組み込み条件、`security.py` の CSP self のみ）。
- 旅前・旅中・旅後に加えて運営側（DMO／お店の窓、次の一手、便り）まで揃い、再訪指標 7 つ（`/api/metrics`）で効果測定の口がある。
- 残: 「AI-OCR」は演出（デモ時だけ 1,200 円が入る）。README と present では開示済みだが、利用者向け文言は断定調（下記 S3）。

### S2 ユーザビリティ ○
良い点
- 全タブ先頭の「いまやること」+ 主ボタン 1 つ（`components/parts.tsx`）、計画のステップ帯、空状態の文言、タップ目標は `.btn`/`.iconbtn`/`.segment` すべて 48px 以上（`styles.css`）。
- 初回ガイド 3 枚と画面ごとの「？」図解チュートリアルが同じ部品で統一。
- カメラ不可 → 写真選択 → 風景合成の 3 段フォールバック（`pages/Camera.tsx`）。
- 地図ピンのポップアップで遷移せずに営業時間・住所・電話（tel: リンク）が見られる。

要対応
- [高] `pages/Photo.tsx:51` 印刷ボタンが `navigate("/print/")` で写真 ID を渡していない → 印刷画面が `NaN` で失敗する行き止まり。`/print/${p.id}` が正。
- [中] 「長押し」文言の残骸。長押しは第 2 回 FB で全廃したが、`pages/Wallet.tsx:64` の いまやること、`i18n.ts:23`、`docs/04_features.md`・CLAUDE.md の記述が残っている。
- [中] クーポン使用の UI が 2 系統（場所画面はインライン 2 段確認、店ページはブラウザ `confirm()`）。店ページの戻り先は常にクーポンタブで文脈を失う。
- [低] 管理画面の読み込み表示が `<p>読み込み中…</p>` 直書きで `Loading` 部品を通らない。
- [低] 計画画面の `backTo={... ? undefined : undefined}`（`pages/Plan.tsx:173`）は意図不明で、deck/map/date 段階から一覧へ戻る手段が乏しい。

### S3 革新性 ○
独自性があるもの
- 「場所を選ぶと人が付いてくる」導線（人にボタンを付けない）と、関係段階（はじめまして／また会えたね／おなじみ）を順位ではなく「会えた別日数」で表す設計。
- 季節の約束が種→つぼみ→花になる仕掛けと Bloom 演出、帖の季節スタンプ。逃しても枯れない設計は「再訪を急かさない」姿勢として一貫。
- おもいで便を保存せず毎回組み立てる（日記 140 字と「行きたい」だけ保存）ことを UI で明示。18:00 開封・30 日後再配達という時間設計。
- IP に頼らない自作マスコット「ほしまる」の場所別衣装、場所限定★フレーム、ハガキ判印刷。
- 運営側の「次の一手」提案が便りの宛先・下書きまで自動で埋める。

標準パターン／演出のみ
- スワイプカード、コルクボード、スロット抽選、ポラロイドは既存 UI の再利用。
- [中] AI-OCR は演出のみ。`pages/Place.tsx:265` の利用者向け説明と図解チュートリアルは非デモ環境でも「撮るだけで店名と金額を読み取ります」と断定しており、実際は常に「読み取れませんでした」になる。デモ以外では文言を「金額を入力」に切り替えるか、（デモ）注記を付けるのが誠実。
- [低] マップの現在地は計画から計算した模擬位置（`pages/Map.tsx:33-38`）。利用者向け UI に模擬である注記がない（present には記載あり）。

### S4 多様性 △
良い点
- 文字サイズ 3 段階（14/16/19px）、「はっきり」配色（山吹を `#b57b00` に落とす）、やさしい日本語の切り替え（`settings.ts`、`i18n.ts`）。`html lang="ja"`。
- アイコンボタンに aria-label、タブに aria-current、トーストに role="status"、装飾画像は alt=""。
- スワイプには「← 行かない／行く →」のボタン代替、ピンは色+番号+✓ で冗長化し凡例あり。
- 性別・年齢を含む表現なし（「お店の人」で統一）。

要対応
- [高] キーボード操作不能。`tabIndex`/`onKeyDown`/`.focus()` が全ソースで 0 件。SVG ピン `<g role="button">`（`components/gmap.tsx:60`）、写真の `div role="button"`（`components/parts.tsx:39`）、コルクボードの `div.polaroid onClick`（`pages/Memories.tsx`）はフォーカスできない。`<button>` 化が最短。
- [高] モーダル（初回ガイド・チュートリアル・Bloom）に初期フォーカス・Escape・フォーカストラップがない。初回ガイドは全画面を覆うため、スクリーンリーダー利用者が閉じられない恐れ。
- [中] `prefers-reduced-motion` 非対応。スキャン線の無限ループ、スロット、Bloom、pulse、ピンの `<animate>` に停止手段がない（CSS 1 ブロックで対応可）。
- [中] 山吹 `#e3a21a` の文字（白地で約 2.2:1）: チュートリアル SVG の 11px テキスト（`components/tutorial.tsx:157,274`）、Deck の「行く」スタンプ、`.guide .no`。本文側は `#7a5300` に置換済み。
- [中] やさしい日本語のカバー率が低い。`useT()` を使うのは 13 ファイル中 8、呼び出し 37 箇所。「いまやること」本文・チュートリアル・トースト・Camera/Photo/Shop/Admin は直書きで、設定を ON にしてもほとんど変わらない。
- [低] iOS の DeviceOrientation は `requestPermission` が必要だが未実装（視差が静かに無効になるだけ）。

---

## テクニカル性

### T1 正確性 △
- `uv run pytest` 34 件通過（季節境界・年またぎ・旅クラスタ・同日同人 1 回・種の付与/果たす・レシート判定/重複/率スナップショット・抽選/在庫 0/確率合計 1・クーポン期間/カテゴリ・便 18:00/30 日後・指標 3 人未満 null・DEMO_MODE=0 で /api/demo 404 を別プロセスで確認）。
- `npm run build`（tsc strict + noUnusedLocals）通過。ブラウザ操作でコンソールエラーなし。
- [高] `services/operator.py:155-160` 店の編集でどの項目を PUT しても **定休日が NULL に消える**。`body.model_dump()` は未指定でも `closed_weekday: None` を含むため `"closed_weekday" in patch` が常に真になる。`patch.get("closed_weekday") is not None` にするか `model_dump(exclude_unset=True)` に変える。`tests/test_operator.py` はこの経路を検査していない。
- [高] `api/operator.py:38-39` 営業時間の検証が `^\d{2}:\d{2}$` だけで `99:99` を通し、`services/forecast.py:17` の `time(99, 99)` が ValueError → **`/api/today` と `/api/places` が 500**（マップ・計画の両タブが開けなくなる）。運営の窓は無認証なので利用者画面を止められる経路になる。`field_validator` で `time.fromisoformat` を通す。
- [高] `services/advice.py:145` 「次の一手」の宛先集計が `datetime.now()` を使い clock サービスを迂回。デモ時計 12-01 では帖が「花」なのに audience は「つぼみ」になり、場面 ⑤ の「花の人に便り」提案が成立しない。`now` を引数で受けて `clock.now(conn)` を渡す。
- [中] `services/operator.py:250-258` 利用者側の便り一覧は宛先の絞り込み（関係・種の状態）を見ないため、`sent_to: 0` の便りも会ったことのある人全員に表示される（クーポンだけ付かない）。宛先を `messages` に記録して絞る。
- [低] `api/today.py:33-41` 「会えた」の既出判定が `write_tx` の外。二重タップ競合は UNIQUE で守られるが IntegrityError が 500 になる（`INSERT OR IGNORE` で解消）。
- [低] 便りのクーポンは当日から使える（`services/operator.py:333`）。CLAUDE.md の抽選クーポン「翌日から」とは別ルールで、docs/00 の判断ログに記載済み。
- [低] `services/metrics.py:112` 「予定日から 7 日以内の来訪も来訪扱い」は仕様にない暗黙の許容幅。docs/04 に書く。
- [高] `pages/Place.tsx:225` レシートの見込みポイントが `amt * 10 / 100` と 10% 固定。付与側（サーバー）は店の還元率を使うため、率を変えた店では表示と付与がずれる。`shop.rate_percent` を使う（クーポンタブ側 `pages/Wallet.tsx:186` は正しい）。
- [低] `index.html` の theme-color が旧配色 `#2f5d62`（藍 `#1b2a44` に揃える）。
- [低] README の「下タブ 4 つ」「テスト 33 件」が古い（5 タブ・34 件）。
- バックエンドの業務ルール照合は下の「サービス層の詳細」を参照。

### T2 セキュリティ △
良い点
- CSP は self のみ（img は data:/blob: を許可）、nosniff、X-Frame-Options SAMEORIGIN、Referrer-Policy、Permissions-Policy で camera を self に限定、COOP、API は no-store（`security.py`）。
- すべての API を pydantic で型・範囲・正規表現検証。SQL はプレースホルダのみ（動的なのは `ALTER TABLE ... ADD COLUMN` の列名で、固定タプルから選ぶ）。
- 画像は拡張子ではなく先頭バイトで判定（PNG/JPEG/WebP、AR は PNG のみ）、5MB 上限、保存名は UUID。CSV は 20MB 上限、UTF-8 以外は 415。
- エラーは `{detail, code, request_id}` に統一、例外詳細はログだけ。OpenAPI/docs は無効。デモ層は `DEMO_MODE=1` のときだけルーターに組み込まれる。
- 外部通信なし。依存は版固定。`Password.txt.txt` は .gitignore 済み。

要対応
- [高・要修正] **SPA フォールバックのパストラバーサル**。`backend/app/main.py` の `spa()` は `dist / full_path` をそのまま `FileResponse` で返しており、`..` の正規化や dist 配下チェックがない。生 HTTP で確認した結果:
  - `GET /..%2F..%2Fpyproject.toml` → 200 でリポジトリ直下のファイルが返る
  - `GET /%2e%2e/%2e%2e/pyproject.toml`、`GET /..%5C..%5C...`（バックスラッシュ）も同様
  - `GET /..%2F..%2Fdata%2Fapp.db` → 200 で SQLite 本体（約 0.9MB）が返る
  - `GET /..%2F..%2FPassword.txt.txt` → 200 でワークスペース直下の利用者ファイルが返る
  - 素の `/../x` はブラウザ/サーバーが正規化するため index.html に落ちるが、`%2F`・`%2e`・`%5C` エンコードで抜けられる
  - 影響: 待ち受けは 127.0.0.1 のみなので同一 PC 内に限られるが、審査の「セキュリティ性」としては明確な欠陥。
  - 修正案（3 行）: `dist_root = dist.resolve()` を用意し、`candidate = (dist / full_path).resolve()`、`candidate.is_relative_to(dist_root) and candidate.is_file()` のときだけ返す。あわせて `tests/test_foundation.py` に `/..%2F..%2Fpyproject.toml` が 200 で返らない（index.html になる）テストを足す。
- [中] 運営の窓（`/api/admin/*`、店の編集・便り送信・還元率・在庫・CSV 取り込み）が認証なし。既知の制約として docs に明記済みだが、本番前提の説明をプレゼンで添える。
- [低] アップロード系は `await file.read()` で全体を読んでからサイズ判定するため、上限超のリクエストもメモリに載る（ローカル前提なら許容）。
- [低] 管理用レシート画像 `/api/admin/receipts/{id}/image` は利用者チェックなし（運営の窓の一部なので認証なしと同じ論点）。

### T3 データ完全性 ○
良い点
- SQLite WAL + `busy_timeout`、外部キー ON。`UNIQUE(user_id, person_id, met_on)`、レシート SHA-256 UNIQUE、未達の種は部分 UNIQUE インデックス、計画項目 UNIQUE。
- 書き込みは `deps.write_tx`（プロセス内 RLock + `BEGIN IMMEDIATE`、例外で ROLLBACK）に統一。抽選はポイント減算・在庫減・クーポン付与・記録を 1 トランザクションで行い、在庫 0 は `UPDATE ... WHERE stock > 0` の rowcount で二重チェック。
- 同期エンドポイントをスレッド 1 本で直列化（SQLite 接続 1 本の並行アクセス対策）。
- CSV 取り込みは行検証 + `INSERT OR IGNORE` で冪等、失敗行は理由付き、`import_runs` に履歴。運営の変更は `admin_history` に before/after。
- ダミーは `is_dummy` 列で分離し、利用者向け一覧は `is_dummy = 0` で除外。指標は n/dummy_n を併記。
- 個人情報: CSV のメールは保存しない。指標は 3 人未満を null。

要対応
- [中] レシート画像・店の写真は **INSERT の前にディスクへ書く**（`services/points.py`、`services/operator.py set_shop_photo`）。INSERT が失敗（例: 制約違反）して ROLLBACK してもファイルが残る孤児になる。書き込みを INSERT 後に移すか、失敗時に unlink する。
- [中] レシート画像の 7 日削除は **起動時だけ**（`main.py` の lifespan）。docs/04 は「起動時」、`services/cleanup.py` の docstring は「起動時と日次」で、日次の呼び出しは存在しない。長時間起動のままだと 7 日を超えて残る。
- [中・修正済み] `seed/master.py` の起動時 UPDATE が shops の営業時間・定休日・紹介・行き方を毎回 master の値に戻していた（運営の編集が再起動・デモ初期化で消える）。編集できる列を UPDATE から外した。
- [中] デモの `reset`（`api/demo.py:128`）はレシート行を消すが画像ファイルを消さない。行が消えるため 7 日削除にも二度と拾われず永久孤児になる。
- [低] `letter_opens` に UNIQUE がなく開くたび行が増える（指標側は集合化しているので値には影響なし）。
- [低] `services/importer.py:116` 取り込み履歴の時刻が `datetime.now()` で clock を迂回。
- [低] デモの `reset` は在庫を初期値に戻すコメントがあるが、実際は `seed_master` の冪等 INSERT のみで在庫（`prizes.stock`）は戻らない（運営の変更保持という判断と矛盾しないか確認）。
- [低] `data/app.db` は .gitignore 済みだがバックアップ手段がない（ローカル前提のため docs に「`data/` を丸ごと保存」と書けば十分）。

### T4 保守性 ○
良い点
- 層分け api(pydantic) → services → repositories が守られ、業務ルールは services に docstring 付きで集約。設定値は `config.py` の dataclass 1 箇所。
- 全モジュール冒頭に日本語 docstring、型ヒントあり。pytest 34 件がルールごとに分かれていて読みやすい。
- フロントは `strict` + `noUnusedLocals`、`any` 0 件、非 null 断言 2 箇所のみ。API 層は `api.ts` 1 ファイルに統一。
- docs 00〜10 が要件・判断ログ・画面・データ・テスト・セキュリティ・ライセンス・台本・進捗に分かれ、判断ログに「迷った点と選んだ方」が残る。

要対応
- [高] フロントの死にコード: `LongPressButton`（`components/ui.tsx:55-82`）、`components/map.tsx` の `IslandMap`、`components/art.tsx` の `SceneArt`/`PersonArt`、`parts.tsx` の `StatusBadge`、`types.ts` の `PersonItem/SpotItem/UnmannedShop/TodayView` は参照 0。`TodayView` は `pages/Map.tsx` に別定義があり二重。
- [高] レスポンス型が各ページに散在・重複: `Coupon` が Place/Shop/Wallet で 3 回、`ShopView` が Place/Shop で 2 回（内容も異なる）。共有型 `PlaceCard` が `pages/Plan.tsx` にあり Map/Place が Plan を import する逆依存。`types.ts` は 22 行で実質未使用。
- [中] 巨大コンポーネント: `pages/Place.tsx` 519 行に 7 部品、`Plan.tsx` 429、`Admin.tsx` 421、`AdminShop.tsx` の `ShopPanel` 単体 215 行。
- [中] 重複ロジック: レシート送信が Place と Wallet で二重（前者に率バグ）、写真グリッド・旅人の声カード・定休日文字列生成が複数箇所。
- [中] inline style が 400 箇所超、色リテラル（`#4a90e2`, `#c9527a`, `#7a5300` など）が TSX 直書きで「はっきり」テーマに追従しない。charts/gmap/tutorial がそれぞれ色定数を再定義。
- [低] `// eslint-disable-next-line` が 8 箇所あるが ESLint 設定がない。vitest は設定のみでテストファイル 0（`seasonOf`、`fmtMetric`、`currentPosition` など純関数は単体テストしやすい）。
- [低] localStorage キーが 6 種に散在し定数化されていない。`pages/Admin.tsx:165` の動的 import、`pages/Camera.tsx:213` のファイル途中 import。
- [中] バックエンドの repositories は `master.py` のみで、services 全体と `api/explore.py:108-123`・`api/today.py:37` が生 SQL を書いている（層の名目と実態のずれ。docs/01 の説明と合わせる）。
- [中] 関係段階の判定が `relationship.stage_of` のほかに `operator.py:119`・`advice.py:153` で再実装。`"月火水木金土日"[..]` や `name.split("（")[0]` が十数箇所に散在。
- [低] 循環依存回避の関数内 import が 8 箇所（plan ↔ letters ↔ places）。`_unused` スタブで未使用 import を黙らせている箇所が 3 つ。
- [低] テスト未カバー: 定休日の保持、営業時間の妥当性、デモ時計下の audience、果たす→次の種→翌年まで枯れない、API 経由の「おなじみ」(4 日)、18:00 ちょうど、クーポン最終日/翌日、7 日削除、店写真の不正 MIME、便りの表示と宛先の整合、冬→春の年またぎ種。

---

## 直すなら この順（効果 ÷ 工数）
バックエンド（各 1〜5 行 + テスト）
1. **`main.py` の SPA フォールバックに dist 配下チェック**（+ `/..%2F..%2Fpyproject.toml` が index.html になるテスト）。T2 の唯一の実害。
2. **`services/operator.py update_shop` の定休日消失**（`is not None` 判定 + テスト）。
3. **`api/operator.py ShopIn` の営業時間を `time.fromisoformat` で検証**（無認証経路からの全画面 500 を防ぐ）。
4. **`services/advice.py audience` に `now` を渡す**（デモ場面 ⑤ の整合）。
5. 画像の孤児対策: INSERT 成功後に書く／ROLLBACK 時に unlink、demo reset で画像も削除、7 日削除を lifespan の日次タスクに。

フロント
6. `pages/Photo.tsx:51` の印刷パスに写真 ID を付ける（1 行）。
7. `pages/Place.tsx:225` の見込みポイントを `shop.rate_percent` で計算（1 行）。
8. 「長押し」文言の除去（Wallet / i18n / docs/04 / CLAUDE.md）と死にコード削除。
9. アクセシビリティ最小セット: ピン・ポラロイド・写真を `<button>` 化、モーダルに初期フォーカス + Escape、`@media (prefers-reduced-motion: reduce)` で無限アニメ停止、山吹文字を `#7a5300` へ。
10. 非デモ環境の OCR 文言を「金額を入力」に切り替え、現在地が模擬である注記。
11. 共有型を `types.ts` に集約、レシート送信を 1 部品に、`useT()` を いまやること・チュートリアル・トーストへ拡大。

## 業務ルール照合（CLAUDE.md との突き合わせ、すべて一致を確認）
- 季節境界 `services/season.py`（3/1・5/31・6/1・11/30・12/1・2/28 をテスト済み）、MM-DD 範囲の年またぎ。
- 会えた: `UNIQUE(user_id, person_id, met_on)`、関係 = `COUNT(DISTINCT met_on)` で 1 / 2–3 / 4+。
- 種: 初回会えた日の次の季節（`seeds.py:67`）、未達 1 つは部分 UNIQUE、果たす条件 = 季節一致 + その日会えた、果たすと次の季節の種、逃しても状態は「つぼみ」のまま。
- レシート: `received_on = now.date()` を固定し日付を入力させないので「今日のみ」は構造的に担保。率はスナップショット。
- 抽選: 10pt、在庫 0 の重みは はずれ に合算、確率合計 1、1 トランザクション。
- クーポン: 当選+1 日〜+365 日（両端含む）、同カテゴリの店のみ。うるう年をまたぐ年は「+1 年」と 1 日ずれる（軽微）。
- おもいで便: `now.hour >= 18`（18:00 ちょうどを含む）、旅の最終日+30 日以降に再表示。旅 = 活動日の間隔 `<= 2` 日。
- 指標: `MIN_N = 3`、全値に n / dummy_n / suppressed。
- デモ層: `DEMO_MODE=0` で `/api/demo/*` が 404 になることを別プロセスのテストで確認。
