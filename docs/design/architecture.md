# アーキテクチャ設計

関連文書:
- データ配信責務の詳細は `docs/design/data-delivery.md` を参照する
- 具体的な更新順序は `docs/design/data-flow.md` を参照する

## 全体方針

- フロントは PWA
- 端末ごとのローカル保存は IndexedDB
- 日次更新と通知は Vercel Functions / Cron
- GitHub Actions は CI と品質担保
- デプロイは Vercel の Git 連携を使う

## データ保存の責務

- IndexedDB は、PWA / Web を開いている端末ごとのローカル保存先として使う
- Vercel Cron はユーザー端末の IndexedDB へ直接保存しない
- Vercel Cron で取得した市場データは、サーバー側の保存先へ保存する
- PWA / Web は起動時に最新データ配信 API から市場データを取得し、その端末の IndexedDB にキャッシュする
- 同じ URL のアプリでも、Mac の Chrome、Mac の Safari、iPhone の PWA などの IndexedDB は別の保存領域として扱う
- 保有情報は複数端末で同じ内容を扱うため、サーバー側のユーザーデータ保存を正とする
- 保有情報の IndexedDB 保存は、画面表示を速くするための端末キャッシュとして扱う
- Vercel Functions は API 実行基盤として使い、永続データは Vercel Functions 内ではなく DB / Storage に保存する
- 保有情報をサーバー保存するには、ユーザー識別または個人利用向けの認証導線を別途用意する

## データ更新から画面表示まで

1. Vercel Cron が市場ごとに時間をずらして起動する
2. Cron が Stooq bulk data と為替データを取得する
3. 取得結果を株式 / ETF / REIT の対象 universe に正規化する
4. 正規化済みの重い価格履歴ファイルを Cloudflare R2 に保存する
5. 銘柄マスタ、最新価格、取得失敗状態、R2 manifest 参照を Supabase に保存する
6. PWA / Web は起動時または画面表示時に Vercel Functions の最新データ API を呼ぶ
7. API は Supabase と R2 manifest から必要な市場データを返す
8. PWA / Web は受け取ったデータを、その端末の IndexedDB にキャッシュする
9. 各画面は IndexedDB のキャッシュを優先して表示し、必要に応じて API 同期で更新する

補足:
- iPhone の PWA、iPhone の Safari、Mac の Chrome などは IndexedDB が別領域になる
- Cron は特定端末の IndexedDB を知らないため、端末へ直接保存しない
- 端末間で共有したい保有情報は Supabase 側を正とし、IndexedDB は表示高速化とオフライン用キャッシュにする
- Cron で更新に失敗した銘柄は失敗状態を保存し、ホームや銘柄詳細などで再取り込み導線を出す
- 個別 CSV は通常の全件取り込みではなく、失敗銘柄だけを手動で再取得する fallback として扱う

## MVP インフラ構成

- MVP は Vercel Hobby、Supabase Free、Cloudflare R2 Free を第一候補にする
- Vercel は PWA 配信、Functions、Cron の実行基盤として使う
- Supabase は Auth、Postgres の候補として使う
- Cloudflare R2 は、価格履歴など重いファイルの object storage として使う
- Neon Postgres は、DB を軽量な Postgres に寄せたい場合の代替候補にする
- AWS EC2 などの自前サーバー構築は MVP では前提にしない
- 価格データ量や利用者数が無料枠を超えそうになったら、DB の有料プランまたは保存範囲の見直しを行う
- Stooq の圧縮 bulk サイズではなく、展開後 `.txt` と DB index を含む保存サイズで容量判断する
- 無料枠では全履歴保存を前提にせず、最新値、計算済み指標、直近日足を優先する
- Vercel Functions と DB は、接続先 DB に近い region を選ぶことを検討する

## repository 構成

- `apps/web`: PWA 本体
- `packages/shared`: 共通型 / 定数 / schema
- `packages/domain`: 計算ロジック
- `vercel/functions`: API / cron / push
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
- 手動更新トリガ
- 必要な集計結果の返却

### サーバー側保存先
- 市場データ、銘柄マスタ、為替レート、保有情報はサーバー側の永続保存先を使う
- 重い価格履歴ファイルは Cloudflare R2 に保存する
- 銘柄マスタ、最新価格、取得失敗状態、R2 manifest 参照、保有情報、ウォッチリストは Supabase Postgres に保存する
- 最新価格は、一覧、ホーム、ポートフォリオ、検索結果などの軽量表示で R2 の大きな履歴ファイルを毎回読まないための表示キャッシュとして使う
- 計算済み指標やランキングは、cron の定期更新時に再計算して Supabase に保存する。ただしユーザー保有起因のポートフォリオ評価やリバランスは画面表示時に最新保有と価格から計算する
- 取得失敗状態は、cron で bulk 取得や銘柄単位の更新に失敗したときに保存し、画面の警告表示と手動再取り込み対象の判定に使う
- DB 候補は Supabase Postgres を第一候補、Neon Postgres を代替候補として比較して決める
- 大きな bulk data の原本や中間ファイルは、必要に応じて R2 に一時保存する

### 外部データ
- Stooq CSV を第一候補にする
- Stooq API key は Vercel 環境変数で管理する
- Stooq CSV download endpoint には `apikey` parameter を付与する
- 取得対象は日本株を主軸に、米国株、英国株、香港株も同じ日足取り込み基盤で扱う
- 投資対象商品は株式 / ETF / REIT を MVP の universe に含める
- 先物 / オプション / 債券 / 指数 / 暗号資産 / 派生的な商品カテゴリは MVP では保存対象外にする
- 全市場 universe は Stooq の daily ASCII bulk data を候補にし、直接取得できない場合は銘柄マスタに対する個別 CSV 取得へフォールバックする
- bulk data は `.txt` 形式の解析を行い、個別 CSV 取得は手動更新、失敗銘柄の再取得に使う
- cron で bulk 取得や銘柄単位の取り込みに失敗した場合は、まず失敗状態を Supabase に保存し、画面からの再取り込み導線で個別 CSV を使う
- 外貨建て保有の JPY 換算用に `USDJPY` / `GBPJPY` / `HKDJPY` の為替日次も扱う
- 市場ごとの Stooq symbol は銘柄マスタで管理する
- Stooq 側のカテゴリとアプリ内の商品種別は分けて保持し、REIT が独立カテゴリにない市場では銘柄マスタで分類する
- Stooq 側で取得できない銘柄は、未対応状態として保存する
- 空の価格ファイルはエラーではなく、価格データなし状態として保存する

### Vercel Cron
- 日本 / 米国 / 英国 / 香港 / 為替に分けた外部データ取得
- 市場ごとに cron 時刻をずらして、1 回の実行で全市場をまとめて処理しない
- データ整形
- 候補計算
- 通知判定
- Push 通知送信

### R2 / Supabase の使い分け

| 保存先 | 置くもの | 置かないもの |
| --- | --- | --- |
| Cloudflare R2 | 正規化済み価格履歴ファイル、必要最小限の圧縮済み直近日足、更新 run の manifest | 保有情報、検索用の全行 DB、非圧縮 txt の長期保存、毎日の full snapshot |
| Supabase Postgres | 認証、保有情報、銘柄マスタ、画面表示用の最新価格、計算済み指標、スクリーニング結果、取り込み失敗状態、ウォッチリスト、R2 manifest 参照 | 全銘柄の全履歴日足、大きな bulk 原本 |
| IndexedDB | 端末ごとの表示キャッシュ、前回取得した保有情報、市場データの軽量キャッシュ | サーバー全体の正本データ |

### R2 データ管理

- 定期更新は全更新を基本にする
- 更新中は `runs/{runId}/...` に書き込み、直接 `latest` を上書きしない
- 更新完了後に件数、対象市場、対象商品、ファイルサイズ、空データを検証する
- 検証に成功したら `latest/*.json` manifest を新しい `runId` に差し替える
- 画面や API は R2 のファイルを直接探索せず、Supabase または R2 の latest manifest から参照する
- 無料枠を優先し、保持する世代は latest と更新中 run を基本にする
- 必要な場合のみ previous 1 世代を短期間残す

## 画面モック回収方針

- ホーム / 検索 / 銘柄詳細 / スクリーニングに残る静的モックは、Stooq bulk 取り込み、R2 / Supabase 保存、最新データ API の境界ができた後に回収する
- 検索は銘柄マスタが正規化されてから、本物の銘柄コード / 銘柄名 / 市場 / 通貨 / 商品種別で動かす
- 銘柄詳細は R2 / IndexedDB の日足履歴が読めるようになってから、lightweight-charts でローソク足、移動平均、出来高を表示する
- ホームは Supabase の最新価格、取得失敗状態、保有サマリーが揃ってから、本物の更新状況と主要導線を表示する
- スクリーニングは bulk 由来の対象 universe が揃ってから、静的候補を廃止し、株式 / ETF / REIT を含む本物ランキングに切り替える
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
