# 03 データ（短縮版）

## 取り込む CSV（C:\AI-Sprint\sample-data、UTF-8 BOM、列名はファイルごとに違う）
| ファイル | 取り込み先 | キー（冪等） | 主な検証 |
|---|---|---|---|
| 13_ユーザー一覧 | users | ユーザーID | ID 整数、登録日時の形式 |
| 12_スタンプ獲得履歴 | spot_visits | (ユーザID, スポット名, 獲得日時) | 日時形式、スポット名がマスタにあること |
| 18_特典獲得履歴 | legacy_rewards | (user_id, reward_name, timestamp) | 日時形式 |
| 08_アンケート回答_参加後 | survey_post | user_id | 満足度 5 値のいずれか |
| 09_アンケート回答_登録時 | survey_reg | user_id | 年齢帯の形式 |
失敗行は `{row, reason}` で返し、取り込み済み行は INSERT OR IGNORE で増えない。

## 固定マスタ（seed）
- spots 7（CSV のスポット名と一致）: 風詠みの灯台(白波離島) / 星綾の潮見台(薄青岬) / 虹灯りの夜市(虹帆町) / 瑠璃凪の水鏡湖(雫森谷) / 月花の風車丘(月灯集落) / 灯雲の石畳通り(星綴港) / 雪雫の音楽堂(鈴風高原)
- shops 8（飲食 4・宿泊 1・体験 1・物販 2＝無人）、people 6（有人店に 1 人）、promises 24（人×四季）、prizes（カテゴリ 4 + はずれ）、voices（旅人の声、箇所ごと 3〜5）
- 主人公 users.id = 8800001

## 業務表
meetings / spot_checkins / seeds / receipts / point_ledger / draws / coupons / diaries / wishes / letter_opens / photos / plans / plan_items / admin_history / import_runs / settings

## ダミー
シード 42。取り込んだ利用者から約 150 人に meetings・receipts・letter_opens・plans を生成し `is_dummy=1`。人・店・商品・主人公には付けない。指標は値ごとに n と dummy_n を返す。
