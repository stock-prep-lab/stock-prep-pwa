# データフロー設計

補足:

- 保存責務の整理は `docs/design/data-delivery.md` を参照する

## 日次更新フロー

1. 管理者が Stooq から市場別 bulk ZIP をダウンロードする
2. 管理画面から日本 / 米国 / 香港 / world(為替) の対象 ZIP をアップロードする
3. 管理画面は raw ZIP を Cloudflare R2 に保存し、Supabase に `import_jobs` を `queued` で作成する
4. Mac `launchd` worker が `queued` job を取得し、R2 から raw ZIP を読む
5. worker が ZIP を展開し、対象カテゴリ配下を再帰的に走査して daily ASCII `.txt` を収集する
6. MVP では株式 / ETF / 為替を保存対象にし、`hkex reits` は取り込み対象から外す
7. 先物 / オプション / 債券 / 指数 / 暗号資産 / 派生的な商品カテゴリを除外する
8. `world/currencies` から JPY 換算に必要な為替ペアを抽出する
9. `stooqCategory` と、フォルダ名で安全に判定できる範囲の正規化済み `securityType`、市場、通貨、`sourceSymbol` を付与する
10. worker が対象 scope の旧 `full historical` と旧 `latest summary` を先に削除する
11. worker が新しい `full historical` と `latest summary` を R2 の `current/...` に保存する
12. worker が `dataset_state` と `import_jobs` を Supabase に保存する
13. worker が raw ZIP を削除する
14. 空の価格ファイルは価格データなし状態として保存する
15. 必要な通知判定や後続処理は次段 Slice で扱う

## 手動取り込みから画面表示までの流れ

1. 管理画面が市場別のアップロード API を起動する
2. Vercel Functions がアップロード対象 scope を受け取り、raw ZIP の保存先を払い出す
3. クライアントが raw ZIP を Cloudflare R2 に保存する
4. Vercel Functions が Supabase に `import_jobs` を作成する
5. Mac `launchd` worker が `queued` job を拾い、R2 から raw ZIP を取得する
6. worker が対象カテゴリ配下を再帰的に探索し、株式 / ETF / 為替の `.txt` を抽出する
7. worker が対象 scope の旧データを先に削除し、新しい `full historical` と `latest summary` を R2 に保存する
8. worker が `dataset_state` と `import_jobs` を Supabase に保存する
9. PWA / Web が起動時または画面表示時に最新データ配信 API を読む
10. PWA / Web がサーバーの dataset version とローカル version を比較する
11. サーバー版が新しい場合だけ取得結果をその端末の IndexedDB にキャッシュする
12. ホーム、検索、スクリーニング、ポートフォリオ画面に表示する
13. 詳細チャートで履歴が必要な場合は、API が manifest をもとに R2 の該当履歴ファイルを参照する

## クライアント起動時フロー

1. PWA 起動
2. IndexedDB から前回データを読む
3. 画面表示
4. `GET /api/dataset-version?localVersion=...` を呼ぶ
5. サーバー側に新しい市場データがあれば `GET /api/market-data` を呼ぶ
6. 取得した軽量データを、その端末の IndexedDB に保存する
7. `GET /api/holdings` を呼び、保有キャッシュも更新する
8. 差分更新
9. 再計算
10. 画面反映

## 保存先の考え方

- 取り込み処理はサーバー側で実行され、ユーザー端末の IndexedDB には直接書き込まない
- PWA / Web は、開かれた実行環境ごとの IndexedDB に保存する
- Mac のブラウザ、スマホのブラウザ、ホーム画面に追加した PWA は、それぞれ別の IndexedDB を持つ前提で設計する
- `full historical` と `latest summary` は R2、状態管理と個人データは Supabase に保存する
- 市場データはサーバー側の保存先から配信し、各端末の IndexedDB はローカルキャッシュとして使う
- 保有情報はサーバー側の保存先を正とし、各端末の IndexedDB はローカルキャッシュとして使う
- PC とスマホは互いに直接同期せず、同じ dataset version を見て別々に再同期する
- 保有情報のサーバー保存には、ユーザー識別または個人利用向けの認証導線を必要とする
- IndexedDB へ全銘柄 full historical は保存しない

## R2 更新管理フロー

1. 管理画面が `incoming/{scope}/{jobId}.zip` へ raw ZIP を保存する
2. Mac worker が `queued` job を `processing` に更新する
3. worker は `current/{scope}/...` の旧 `full historical` と旧 `latest summary` を先に削除する
4. worker は新しい `full historical` と `latest summary` を `current/{scope}/...` に保存する
5. worker は `current/manifest.json` を更新する
6. worker は raw ZIP を削除する
7. 失敗時は `import_jobs` を `failed` にし、その scope の一時的な欠損を許容する
8. 無料枠優先のため、R2 では 2 世代保持を行わない

## 検索フロー

1. 市場を選択
2. 銘柄コードまたは銘柄名を入力
3. ローカルの軽量データを検索する
4. 結果一覧表示
5. 詳細遷移

## スクリーニングフロー

1. 条件指定
2. 条件適用
3. 指標計算
4. ランキング計算
5. 候補一覧表示

## シミュレーションフロー

1. 候補銘柄選択
2. 購入価格入力
3. 株数入力
4. 購入金額算出
5. 構成比再計算
6. 円グラフ更新
7. 改善コメント生成

## 保有登録フロー

1. 銘柄詳細またはポートフォリオから保有登録へ遷移
2. 対象銘柄と市場を確認
3. 保有株数を入力
4. 取得単価を入力
5. 通貨と現金メモを確認
6. `PUT /api/holdings` で保有情報更新 API に保存する
7. 保存成功後、その端末の IndexedDB キャッシュを更新する
8. ポートフォリオへ戻る
9. 構成比と含み損益を再計算する

## 保有同期フロー

1. PWA / Web 起動、またはポートフォリオ画面表示
2. IndexedDB の保有キャッシュを先に表示
3. 保有情報取得 API からサーバー側の最新保有を取得
4. サーバー側の内容で IndexedDB キャッシュを更新
5. 評価額、構成比、含み損益を再計算
6. サーバー取得に失敗した場合は、キャッシュ表示と同期失敗状態を表示

## ポートフォリオ評価フロー

1. 保有銘柄を読み込む
2. 各銘柄の latest 値を取得する
3. 外貨建て保有の通貨を判定する
4. 必要な為替ペアの latest 値を取得する
5. JPY 換算評価額を算出する
6. 現金込み構成比を算出する
7. 為替レート不足があれば評価不能状態を表示する
