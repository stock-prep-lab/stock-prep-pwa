# アーキテクチャ設計

関連文書:

- データ配信責務の詳細は `docs/design/data-delivery.md` を参照する
- 具体的な更新順序は `docs/design/data-flow.md` を参照する
- Vercel 入口のセットアップは `docs/setup/vercel-import-setup.md` を参照する

## 全体方針

- フロントは PWA
- 端末ごとのローカル保存は IndexedDB
- 軽い API と管理画面の受付は Vercel Functions を使う
- 重い bulk 解凍 / 正規化は当面 Mac `launchd` worker で実行し、将来はクラウド runner へ置き換え可能な形にする
- GitHub Actions は CI と品質担保
- デプロイは Vercel の Git 連携を使う

## データ保存の責務

- IndexedDB は、PWA / Web を開いている端末ごとのローカル保存先として使う
- 手動取り込み処理はユーザー端末の IndexedDB へ直接保存しない
- 管理画面からアップロードした市場データは、サーバー側の保存先へ保存する
- PWA / Web は起動時に最新データ配信 API から軽量データを取得し、その端末の IndexedDB にキャッシュする
- 同じ URL のアプリでも、Mac の Chrome、Mac の Safari、iPhone の PWA などの IndexedDB は別の保存領域として扱う
- 保有情報は複数端末で同じ内容を扱うため、サーバー側のユーザーデータ保存を正とする
- 保有情報の IndexedDB 保存は、画面表示を速くするための端末キャッシュとして扱う
- Vercel Functions は API 実行基盤として使い、永続データは Vercel Functions 内ではなく DB / Storage に保存する
- 保有情報をサーバー保存するには、ユーザー識別または個人利用向けの認証導線を別途用意する
- IndexedDB へ全銘柄 full historical は保存しない

## データ更新から画面表示まで

1. 管理者が Stooq から市場別 bulk ZIP を手動取得する
2. 管理画面から ZIP をアップロードする
3. Vercel Functions が raw ZIP の保存先払い出しと `import_jobs` 作成を行う
4. Mac `launchd` worker が raw ZIP を R2 から取得し、`stocks` / `etfs` / `currencies` を正規化する
5. 正規化済みの `full historical` と `latest summary` を Cloudflare R2 に保存する
6. `dataset_state`、`import_jobs`、保有情報などの軽量データを Supabase に保存する
7. PWA / Web は起動時または画面表示時に Vercel Functions の最新データ API を呼ぶ
8. API は Supabase と R2 manifest から必要な軽量データと dataset version を返す
9. PWA / Web は受け取ったデータを、その端末の IndexedDB にキャッシュする
10. 各画面は IndexedDB のキャッシュを優先して表示し、履歴が必要なときだけ API 経由で R2 を参照する

補足:

- iPhone の PWA、iPhone の Safari、Mac の Chrome などは IndexedDB が別領域になる
- サーバー側の取り込み処理は特定端末の IndexedDB を知らないため、端末へ直接保存しない
- 端末間で共有したい保有情報は Supabase 側を正とし、IndexedDB は表示高速化とオフライン用キャッシュにする
- 同期は PC とスマホが互いに直接やり取りするのではなく、同じ dataset version を見て各端末がサーバーから再取得する

## MVP インフラ構成

- MVP は Vercel Hobby、Supabase Free、Cloudflare R2 Free を第一候補にする
- Vercel は PWA 配信と Functions の実行基盤として使う
- Supabase は Auth、Postgres の候補として使う
- Cloudflare R2 は、価格履歴など重いファイルの object storage として使う
- Neon Postgres は、DB を軽量な Postgres に寄せたい場合の代替候補にする
- AWS EC2 などの自前サーバー構築は MVP では前提にしない
- 価格データ量や利用者数が無料枠を超えそうになったら、DB の有料プランまたは保存範囲の見直しを行う
- Stooq の圧縮 bulk サイズではなく、展開後 `.txt` と正規化後ファイルを含む保存サイズで容量判断する
- Supabase には全履歴保存を前提にせず、`dataset_state`、`import_jobs`、個人データを優先する
- R2 は 1 世代管理を前提とし、更新中でも 2 世代保持にならない設計を優先する

## repository 構成

- `apps/web`: PWA 本体
- `packages/shared`: 共通型 / 定数 / schema
- `packages/domain`: 計算ロジック
- `api`: Vercel Functions の entrypoint
- `docs`: 要件 / 設計 / 計画

## フロント

- React
- TypeScript
- Vite
- Tailwind CSS
- TanStack Query
- IndexedDB
- lightweight-charts
- Recharts

## バックエンド相当

### Vercel Functions

- Push 購読登録
- Push 購読解除
- 最新データ配信
- 保有情報取得
- 保有情報更新
- 手動 bulk 取り込みの受付
- 必要な集計結果の返却

### サーバー側保存先

- raw ZIP、`full historical`、`latest summary`、manifest は Cloudflare R2 に保存する
- `dataset_state`、`import_jobs`、保有情報、ウォッチリストは Supabase Postgres に保存する
- 一覧、ホーム、ポートフォリオ、検索結果などの軽量表示には R2 の `latest summary` を使い、R2 の重い履歴ファイルを毎回読まない
- ユーザー保有起因のポートフォリオ評価やリバランスは画面表示時に最新保有と latest 値から計算する
- import job 状態は、管理画面で取り込み成否や最新 dataset version を確認し、Mac worker が次に処理する job を拾うために使う
- 大きな bulk data の原本は R2 に一時保存し、成功後に削除する
- 想定する環境変数は `STOCK_PREP_SUPABASE_URL`、`STOCK_PREP_SUPABASE_SERVICE_ROLE_KEY`、`STOCK_PREP_R2_ACCOUNT_ID`、`STOCK_PREP_R2_ACCESS_KEY_ID`、`STOCK_PREP_R2_SECRET_ACCESS_KEY`、`STOCK_PREP_R2_BUCKET`

### 外部データ

- Stooq daily ASCII bulk data を第一候補にする
- 取得対象は日本株を主軸に、米国株、英国株、香港株も同じ日足取り込み基盤で扱う
- 投資対象商品は MVP では 株式 / ETF / 為替 を扱い、`lse stocks intl` と `hkex reits` は取り込み対象から外す
- 先物 / オプション / 債券 / 指数 / 暗号資産 / 派生的な商品カテゴリは MVP では保存対象外にする
- 管理者が Stooq から市場別 ZIP を手動取得し、管理画面からアップロードする
- MVP の入力 ZIP は `jp` / `us` / `uk` / `hk` / `world` の 5 系統を第一候補にする
- `world` ZIP は為替入力元として扱い、`currencies` 配下から JPY 換算に必要な通貨ペアを抽出する
- bulk data は `.txt` 形式の解析を行う
- ZIP 展開後は対象カテゴリ配下を再帰的に走査し、下位フォルダを含めて `.txt` を収集する
- 商品種別の一次判定には Stooq のフォルダ名を使い、元分類は `stooqCategory` として保持する
- アプリ内の表示と計算には正規化済み `securityType` を使い、MVP では `stock` / `etf` / `currency` を基本候補として扱う
- `securityType` はフォルダ名で安全に判定できる範囲から付与し、曖昧な市場やカテゴリは fixture 確認後に最終決定する
- `lse stocks intl` と `hkex reits` は存在確認済みだが、MVP では取り込み対象から外す
- 外貨建て保有の JPY 換算用に `USDJPY` / `GBPJPY` / `HKDJPY` の為替日次も扱う
- Stooq 側で取得できない銘柄は、未対応状態として保存する
- 空の価格ファイルはエラーではなく、価格データなし状態として保存する

### 更新ジョブ

- 管理画面からの ZIP 受付
- `import_jobs` 作成
- Mac `launchd` worker によるデータ整形
- 候補計算
- 通知判定
- Push 通知送信

### R2 / Supabase / IndexedDB の使い分け

| 保存先 | 置くもの | 置かないもの |
| --- | --- | --- |
| Cloudflare R2 | raw ZIP の一時保存、`full historical`、`latest summary`、manifest | 保有情報、`import_jobs`、非圧縮 txt の長期保存、2 世代分の full historical |
| Supabase Postgres | 認証、保有情報、`dataset_state`、`import_jobs`、ウォッチリスト | 全銘柄の全履歴日足、全銘柄 latest snapshot、大きな bulk 原本 |
| IndexedDB | 端末ごとの表示キャッシュ、前回取得した保有情報、軽量な latest summary | サーバー全体の正本データ、全銘柄 full historical、history cache |

### R2 データ管理

- 更新は scope 単位を基本にする
- raw ZIP は `incoming/...` に一時保存する
- 更新時は対象 scope の旧 `full historical` と旧 `latest summary` を先に削除する
- 新しいデータ保存後に `current/manifest.json` を更新する
- 画面や API は R2 のファイルを直接探索せず、manifest から参照する
- 無料枠を優先し、保持する世代は current 1 世代のみとする
- 更新失敗時は対象 scope の一時的な欠損を許容する

## 画面モック回収方針

- ホーム / 検索 / 銘柄詳細 / スクリーニングに残る静的モックは、手動 bulk 取り込み、R2 / Supabase 保存、最新データ API の境界ができた後に回収する
- 検索は `latest summary` と必要最小限の銘柄識別情報が配信できるようになってから、本物の銘柄コード / 銘柄名 / 市場 / 通貨 / 商品種別で動かす
- 銘柄詳細は R2 の日足履歴が読めるようになってから、lightweight-charts でローソク足、移動平均、出来高を表示する
- ホームは `latest summary`、dataset version、保有サマリーが揃ってから、本物の更新状況と主要導線を表示する
- スクリーニングは bulk 由来の対象 universe が揃ってから、静的候補を廃止し、本物ランキングに切り替える
- PWA installable 対応は、主要画面の本物データ化後に行う

## ドメインロジック

- 指標計算
- モメンタム計算
- トレンド判定
- 共分散 / 分散計算
- リバランス改善度
- シミュレーション計算

## デプロイ方針

- Preview / Production は Vercel
- CI は GitHub Actions
- Production 反映前に CI 成功を必須とする
