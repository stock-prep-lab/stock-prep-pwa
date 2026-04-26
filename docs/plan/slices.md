# Slice 計画

## ルール

- 1 PR = 1 Slice を原則とする
- 各 Slice はレビュー可能な大きさにする
- 各 Slice で対象 / 非対象 / 完了条件を明記する
- 一度に複数の大きな画面を完成させない
- UI を含む Slice は、モバイル幅とデスクトップ幅の両方で大きな崩れがないことを完了条件に含める
- 崩れがないとは、主要情報が欠けず、主要操作が隠れず、不要な横スクロール前提にならない状態を指す
- E2E 対象 Slice では、主要導線の E2E テストを追加または更新する
- E2E は画面骨組みが固まる前には無理に追加せず、実データや主要導線が成立した段階で導入する
- レスポンシブ対応だけでは PWA 対応とみなさない
- PWA としての Manifest / Service Worker / installable 対応は、主要画面の本物データ化後の Slice 22 で扱う
- 外部日足データは Stooq daily ASCII bulk を使い、管理者が手動取得した ZIP を取り込む前提で扱う
- 日本株に加えて、米国株、英国株、香港株の日足も同じ取り込み設計に含める
- 株式と ETF を MVP の投資対象に含め、REIT は将来拡張まで保留する
- 米国株、英国株、香港株を JPY 建てポートフォリオで評価するため、為替日次も取り込み対象に含める
- 保有登録 / 編集画面は必要とし、静的 UI は Slice 6、IndexedDB キャッシュは Slice 9 以降、サーバー同期は Slice 16 以降で扱う
- MVP インフラは Vercel Hobby + Supabase Free + Cloudflare R2 Free を第一候補とし、DB 容量や利用量に応じて Neon Postgres や有料プランを検討する
- ホーム / 検索 / 銘柄詳細 / スクリーニングに残る静的モックは、手動 bulk 取り込み、R2 / Supabase 配信、最新データ API の境界ができた後に順番に回収する
- 手動 bulk 取り込みの本運用は、管理画面アップロード、`import_jobs`、Mac `launchd` worker を早い段階で整理し、後続 Slice の本物データ化より前に運用導線を固める

---

## Slice 0: 開発基盤

### 目的
モノレポ、pnpm、Vite、Tailwind、基本設定を整える。

### 対象
- repository 初期構成
- apps/web 作成
- packages/shared 作成
- packages/domain 作成
- lint / format / typecheck 基盤
- GitHub Actions の最小 CI

### 非対象
- 画面実装
- データ取得
- 通知

### 完了条件
- ローカル起動できる
- lint / typecheck が通る
- CI が動く

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`

---

## Slice 1: 画面骨組みとルーティング

### 対象
- 下タブ
- 7 画面の空ページ
- ルーティング

### 非対象
- 実データ
- 本格 UI
- 計算ロジック

### 完了条件
- 画面間遷移できる
- モバイル幅とデスクトップ幅で主要ナビゲーションが破綻しない

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- モバイル幅で下タブが利用できる
- デスクトップ幅で主要導線が見える

---

## Slice 2: ホーム静的UI

### 対象
- ホーム画面の静的レイアウト
- ダミーデータ表示

### 非対象
- 実データ接続
- 通知接続

### 完了条件
- ワイヤーに沿ってホームが見える
- モバイル幅で主要カードが自然に縦積みで表示される
- デスクトップ幅で余白や横並びが破綻しない
- 主要操作が画面外に隠れない

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- モバイル幅 / デスクトップ幅でホーム確認

---

## Slice 3: 検索静的UI

### 対象
- 検索画面の静的レイアウト
- ダミー検索結果表示

### 非対象
- 本物の検索
- IndexedDB 接続

### 完了条件
- ワイヤーに沿って検索画面が見える
- モバイル幅で検索バーと結果一覧が自然に表示される
- デスクトップ幅で一覧や余白が破綻しない
- 不要な横スクロールが発生しない

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- モバイル幅 / デスクトップ幅で検索画面確認

---

## Slice 4: スクリーニング静的UI

### 対象
- 条件サマリー
- 候補一覧
- 並び替え UI

### 非対象
- 本物の条件計算
- 本物のランキング

### 完了条件
- ワイヤーに沿ってスクリーニング画面が見える
- モバイル幅で条件表示と候補一覧が読みやすい
- デスクトップ幅で一覧密度が破綻しない
- 下部アクションが隠れない

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- モバイル幅 / デスクトップ幅でスクリーニング画面確認

---

## Slice 5: ポートフォリオ静的UI

### 対象
- サマリー
- 円グラフダミー
- 保有一覧

### 非対象
- 本物の保有計算
- 本物の円グラフデータ

### 完了条件
- ワイヤーに沿ってポートフォリオ画面が見える
- モバイル幅で円グラフと一覧が共存できる
- デスクトップ幅でサマリーと一覧のバランスが崩れない
- 主要情報が欠けない

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- モバイル幅 / デスクトップ幅でポートフォリオ画面確認

---

## Slice 6: 銘柄詳細 / 保有登録静的UI

### 対象
- 基本情報
- チャート領域
- トレンド分析カード
- アクション導線
- 保有登録 / 編集フォーム
- 市場 / 通貨表示

### 非対象
- 本物のチャートデータ
- 指標計算
- 保有の永続化
- 保有評価額計算

### 完了条件
- ワイヤーに沿って銘柄詳細画面が見える
- ワイヤーに沿って保有登録 / 編集画面が見える
- モバイル幅でチャートと指標が視認可能
- モバイル幅で保有株数と取得単価を入力できる
- デスクトップ幅でチャート領域が十分確保される
- 主要ボタンが隠れない

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- モバイル幅 / デスクトップ幅で銘柄詳細画面確認
- モバイル幅 / デスクトップ幅で保有登録画面確認

---

## Slice 7: リバランス提案静的UI

### 対象
- 現状サマリー
- 提案ランキング
- アクション導線

### 非対象
- 本物の改善計算

### 完了条件
- ワイヤーに沿ってリバランス提案画面が見える
- モバイル幅で提案カードが読みやすい
- デスクトップ幅で一覧と余白が破綻しない
- 主要導線が明確である

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- モバイル幅 / デスクトップ幅でリバランス画面確認

---

## Slice 8: 購入シミュレーション静的UI

### 対象
- 入力フォーム
- Before / After
- 円グラフ領域
- 改善コメント領域

### 非対象
- 本物の計算

### 完了条件
- ワイヤーに沿って購入シミュレーション画面が見える
- モバイル幅で入力フォームと円グラフが操作可能
- デスクトップ幅で比較表示が見やすい
- 主要操作が下部固定で利用できる

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- モバイル幅 / デスクトップ幅でシミュレーション画面確認

---

## Slice 9: IndexedDB 基盤

### 対象
- IndexedDB ラッパー
- 基本 store 定義
- ダミーデータ保存 / 読込
- 銘柄マスタ store
- 日次価格 store
- 為替レート store
- 保有 store
- 現金 store
- 保有情報の端末キャッシュ store

### 非対象
- 外部データ取得
- 本物の保有計算
- 保有情報のサーバー同期

### 完了条件
- ローカル保存 / 読込できる

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- store 単位のユニットテストを追加

---

## Slice 10: 外部データ取り込み

### 対象
- 日次価格データ取り込み
- 市場別 symbol suffix
- 日本株 / 米国株 / 英国株 / 香港株の取得対象定義
- 株式 / ETF / 為替の商品種別を扱える前提
- 為替ペア取得対象定義
  - `USDJPY`
  - `GBPJPY`
  - `HKDJPY`
- ローカル保存更新
- 起動時同期導線

### 非対象
- 手動 bulk ZIP アップロード
- Stooq bulk data の定期取り込み
- Stooq bulk `.txt` parser
- 通知送信
- Stooq で未提供の銘柄を補完する別データソース
- リアルタイム価格
- 分足データ

### 完了条件
- 価格データがローカルに反映される
- 市場 / 通貨 / sourceSymbol を保持できる
- 為替ペア / close を保持できる
- Stooq で取得できない銘柄を未対応として扱える
- Stooq で取得できない為替ペアを未対応として扱える

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- 取り込みロジックのユニットテストを追加
- 市場別 symbol 生成のユニットテストを追加
- 為替ペア取得対象のユニットテストを追加
- 必要なら最低限の同期導線確認

---

## Slice 11: スクリーニング / モメンタム計算

### 対象
- 指標計算
- モメンタム計算
- 候補ランキング反映

### 非対象
- リバランス計算

### 完了条件
- スクリーニング結果が本物のデータで出る

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- モメンタム計算ロジックのユニットテストを追加
- スクリーニング画面から銘柄詳細へ遷移確認

---

## Slice 12: ポートフォリオ計算 / リバランス計算

### 対象
- 保有評価額計算
- 構成比計算
- 現金込み構成比計算
- 外貨建て保有の JPY 換算
- 改善候補計算
- 保有登録内容の反映

### 非対象
- Push 通知
- 高度な外貨換算
- 為替差損益の詳細分解

### 完了条件
- ポートフォリオとリバランス提案が本物データで動く
- 保有登録 / 編集した内容がポートフォリオに反映される
- 米国株 / 英国株 / 香港株の評価額を JPY 換算できる
- 為替レート不足時に評価不能状態を扱える

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- ポートフォリオ計算と改善計算のユニットテストを追加
- 保有登録後の構成比計算テストを追加
- 外貨建て保有の JPY 換算テストを追加
- ポートフォリオからリバランス画面への導線確認

---

## Slice 13: 購入シミュレーション本実装

### 対象
- 購入価格 / 株数入力
- Before / After 計算
- 円グラフ反映

### 非対象
- 保有への永続反映の高度機能

### 完了条件
- 購入後の構成変化を確認できる
- モバイル幅とデスクトップ幅の両方でフォームとグラフが破綻しない

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- シミュレーション計算のユニットテストを追加
- 主要導線の E2E を追加または更新
  - 例: 銘柄詳細 → 購入シミュレーション

### E2E 方針
- この Slice は E2E 対象 Slice とする
- 少なくとも以下の導線の E2E を追加または更新する
  - 銘柄詳細 → 購入シミュレーション

---

## Slice 14: データ配信基盤設計 / R2 + Supabase 方針

### 対象
- 手動 bulk 取り込みから画面表示までのデータフロー整理
- Cloudflare R2 と Supabase の責務分離
- 市場データ、銘柄マスタ、保有情報、import job 状態の正本保存先整理
- IndexedDB を端末キャッシュとして扱う方針整理
- 画面モック回収順序の明文化
- dataset version による端末再同期方針整理

### 非対象
- 実際の手動取り込み実装
- Stooq bulk `.txt` parser 実装
- R2 / Supabase への実保存
- 画面モックの実装回収
- PWA installable 対応

### 完了条件
- R2 に置くもの、Supabase に置くもの、IndexedDB に置くものが明確になっている
- 手動取り込み後に PWA / Web が開いた端末へデータが流れる順序が説明できる
- ZIP を扱うのが管理画面だけで、各端末は version を見て再同期することが明記されている
- 主要画面のモック回収 Slice が定義されている

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- docs-only の場合は文書レビュー観点を PR に記載

---

## Slice 15: Stooq bulk 取り込み / 正規化

### 対象
- Stooq daily ASCII bulk data の ZIP 入力前提整理
- bulk `.txt` parser
- 日本 / 米国 / 英国 / 香港 / 為替の取り込み単位整理
- 株式 / ETF / 為替のみを保存対象にするフィルタ
- 先物 / オプション / 債券 / 指数 / 暗号資産 / 派生的な商品カテゴリの除外
- 空の価格ファイルを価格データなし状態として扱う処理
- 正規化済み価格履歴ファイルの生成
- 銘柄マスタに対する取得成功 / 失敗 / 未対応状態の生成

### 非対象
- ZIP アップロード UI
- R2 への本保存
- Supabase への本保存
- 画面モックの実装回収
- Stooq で未提供の銘柄を補完する別データソース

### 完了条件
- bulk `.txt` を正規化済みデータへ変換できる
- 株式 / ETF / 為替 以外を MVP 保存対象から除外できる
- 銘柄単位の成功 / 失敗 / 空データ / 未対応を表現できる

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- bulk parser のユニットテストを追加
- 商品種別フィルタのユニットテストを追加
- 空ファイル / 欠損ファイルのユニットテストを追加

---

## Slice 16: Vercel Functions / 最新データ配信 API

### 対象
- 最新データ配信 API
- dataset version 取得 API
- Supabase / Neon などサーバー側 DB への接続方針
- Cloudflare R2 への価格履歴ファイル参照方針
- サーバー側に保存された市場データを PWA / Web へ返す API
- PWA / Web 起動時に、その端末の IndexedDB へキャッシュするための差分取得
- dataset version とローカル version を比較して同期要否を返す API 境界
- 起動時 / 前面復帰時に dataset version を見て同期を開始するクライアント導線
- 保有情報取得 API
- 保有情報更新 API
- 保有情報をサーバー側保存先へ保存し、端末の IndexedDB キャッシュへ反映する同期導線

### 非対象
- 手動 bulk ZIP アップロード
- Push 通知
- 本格的な複数ユーザー SaaS 化
- AWS EC2 などの自前サーバー構築
- 画面モックの実装回収

### 完了条件
- Functions が利用できる
- 市場データを R2 / Supabase から取得して画面へ返す API 境界ができる
- dataset version を返し、端末側が再同期要否を判定できる
- 保有情報を別端末でも取得できる前提の API 境界ができる
- 起動時に API から IndexedDB へキャッシュする流れが実装できる
- 起動時または前面復帰時に version を見て必要時だけ同期する流れが説明できる
- MVP 用 DB / R2 候補と必要な環境変数が整理されている

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- Function 単位のテストまたはハンドラテストを追加

---

## Slice 16.5: Stooq bulk 入力仕様の確定

### 対象
- Stooq bulk の MVP 入力を `jp` / `us` / `uk` / `hk` / `world` の 5 ZIP 前提で整理
- `world` ZIP を為替入力元とし、`currencies` 配下を対象候補にする方針整理
- 市場別 ZIP 配下の対象カテゴリを再帰的に走査して `.txt` を収集する前提整理
- `stocks` / `etfs` / `currencies` を保存対象カテゴリにする前提整理
- フォルダ名から `stooqCategory` を保持し、アプリ内の `securityType` へ正規化する方針整理
- `lse stocks intl` と `hkex reits` を MVP の取り込み対象外にする方針整理
- 実 ZIP fixture で確認したい観点の整理

### 非対象
- 実際の ZIP アップロード UI
- parser の本実装
- R2 / Supabase への保存
- 画面モックの回収

### 完了条件
- MVP で扱う入力 ZIP が 5 系統で明記されている
- 対象カテゴリ配下を再帰走査して `.txt` を拾う前提が明記されている
- `stooqCategory` と `securityType` を分けて保持する理由が明記されている
- `lse stocks intl` と `hkex reits` を MVP の取り込み対象外にすることが明記されている
- 日本 / 米国 / 英国 / 香港 / world の fixture で追加確認する観点が明記されている

### テスト / 確認観点
- docs-only の場合は文書レビュー観点を PR に記載

---

## Slice 17: 手動 bulk 取り込み / R2・Supabase 更新

### 対象
- 管理画面の ZIP アップロード導線
- 市場選択、日本 / 米国 / 英国 / 香港 / world(為替) ごとの ZIP 入力 UI
- アップロード後に import job 状態を確認する管理 UI
- 手動 bulk ZIP アップロード処理
- 日本 / 米国 / 英国 / 香港 / world(為替) の市場別 import job
- ZIP 受け取りからサーバー保存までの実行境界
- 対象カテゴリ配下の再帰走査による `.txt` 収集
- `stooqCategory` から `securityType` への正規化
- MVP 対象外カテゴリを除外する商品種別処理
- 正規化済み価格履歴ファイルの Cloudflare R2 保存
- latest summary と manifest による更新管理
- `dataset_state`、`import_jobs`、保有系データの Supabase 保存
- raw ZIP 一時保存と削除方針の整理

### 非対象
- Push 送信
- 先物 / オプション / 債券 / 指数 / 暗号資産 / 派生的な商品カテゴリの保存
- 非圧縮 txt の長期保存
- 毎日の full snapshot 永続保存
- 画面モックの実装回収
- Mac `launchd` worker の本実装

### 完了条件
- 管理画面から市場別 ZIP を取り込める
- アップロード対象市場、実行中、成功、失敗が管理画面で分かる
- 対象カテゴリ直下と下位フォルダのどちらに `.txt` があっても収集できる
- R2 の latest summary / manifest 更新方針が定義されている
- Supabase の `dataset_state` / `import_jobs` が更新される
- ZIP を再アップロードすれば市場単位で再取り込みできる

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- import 対象ロジックを関数分離してユニットテスト可能にする

---

## Slice 17.5: 管理画面 / 取り込み運用の本番前提整理

### 対象
- 管理画面を本運用の入口として使う前提整理
- raw ZIP を Cloudflare R2 へ保存する前提整理
- `import_jobs` を Supabase の取り込み依頼票として使う前提整理
- Mac `launchd` worker が `queued` job を拾って処理する運用整理
- R2 を 1 世代管理に固定する前提整理
- IndexedDB を軽量キャッシュだけに絞る前提整理

### 非対象
- direct-to-R2 upload の本実装
- Mac worker の本実装
- Slice 17 実装のコード差し替え

### 完了条件
- 管理画面、R2、Supabase、Mac worker の責務分担が文書で固定されている
- `dataset_state` と `import_jobs` の用途が明記されている
- R2 を 2 世代保持しない運用方針が明記されている
- IndexedDB に full historical を保存しないことが明記されている

### テスト / 確認観点
- docs-only の場合は文書レビュー観点を PR に記載

---

## Slice 17.6: Mac `launchd` worker による取り込み実行

### 対象
- Mac ローカル実行用の import worker エントリポイント追加
- Supabase の `import_jobs` から `queued` job を取得する処理
- `queued` -> `processing` -> `completed` / `failed` の状態更新
- Cloudflare R2 から raw ZIP を取得する処理
- ZIP 展開、`.txt` 収集、正規化ロジックの worker 呼び出し
- 対象 scope の旧 `full historical` / `latest summary` を先に削除してから再保存する処理
- `dataset_state` 更新
- raw ZIP 削除
- `launchd` 用 plist とローカルセットアップ手順の追加

### 非対象
- Windows / Linux 用の常駐ジョブ実装
- Cloud Run / GitHub Actions などクラウド runner への移植
- direct-to-R2 upload のクライアント実装
- 通知送信

### 完了条件
- Mac 上で import worker を手動実行できる
- `launchd` で定期実行できる
- `queued` job を 1 件以上拾って処理できる
- 処理成功時に R2 の対象 scope データと `dataset_state` が更新される
- 処理失敗時に `import_jobs` が `failed` になり、失敗理由を残せる
- R2 が 2 世代保持にならず、対象 scope の旧データを先に削除してから更新する

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- worker の job 取得 / 状態更新ロジックにユニットテストを追加
- ローカルで 1 回の手動実行確認
- `launchd` 経由の起動確認手順を PR に記載

---

## Slice 17.7: direct-to-R2 upload のクライアント実装

### 対象
- 管理画面から raw ZIP を Cloudflare R2 へ直接アップロードするクライアント導線
- Vercel API で presigned upload URL または同等の一時アップロード権限を払い出す処理
- R2 直接アップロード後に `import_jobs` を `queued` で作成する処理
- アップロード進捗、成功、失敗を管理画面で表示する UI 更新
- 大きい ZIP を Vercel Function 本体へ直接 POST しない運用への切り替え

### 非対象
- Mac `launchd` worker の実装変更
- Windows / Linux 用 worker 実装
- Cloud Run / GitHub Actions などクラウド runner への移植
- 通知送信

### 完了条件
- 管理画面から市場別 ZIP を選んで R2 へ直接アップロードできる
- Vercel は upload URL 発行と `import_jobs` 作成の入口として動く
- 大きい ZIP を Vercel Function の request body に載せずに取り込み開始できる
- アップロード成功後に `queued` job が作成され、17.6 の worker から処理できる
- 実 ZIP 5 本（`jp` / `us` / `uk` / `hk` / `world`）で取り込み導線が通る
- R2 の object key と cleanup が想定どおりに動き、raw ZIP と current データの扱いを確認できる
- worker 失敗時に `import_jobs` が `failed` になり、失敗理由を確認できる
- `launchd` の定期実行で queue polling と job 実行が安定して回る
- 管理画面の進捗表示で upload / queue / 処理結果が分かりやすく確認できる
- モバイル幅とデスクトップ幅の両方でアップロード操作が成立する

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- upload URL 発行ロジックのユニットテストを追加
- 管理画面から実 ZIP 5 本をアップロードして `queued` job 作成から worker 完了まで確認
- R2 の object key / cleanup を実環境で確認
- 失敗系 1 件を流して `failed` 記録と error message を確認
- `launchd` 登録後の定期実行ログ確認
- モバイル幅 / デスクトップ幅で進捗 UI の確認

---

## Slice 18: 銘柄マスタ / 検索の本物データ化

### 対象
- 検索画面のダミー検索結果回収
- R2 の `latest summary` と IndexedDB にキャッシュされた軽量銘柄データ検索
- 銘柄コード / 銘柄名 / 市場 / 通貨 / 商品種別の表示
- 株式 / ETF の検索対象化
- 取得失敗 / 未対応銘柄の表示状態
- 検索結果から銘柄詳細への導線

### 非対象
- 銘柄詳細チャート本実装
- スクリーニングランキング完全化
- Push 通知

### 完了条件
- 検索画面が本物の軽量銘柄データで動く
- モック検索結果が残っていない
- 取得失敗 / 未対応状態の銘柄をエラーにせず表示できる
- モバイル幅とデスクトップ幅で検索結果が破綻しない

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- 銘柄検索ロジックのユニットテストを追加
- 検索 → 銘柄詳細の導線確認

---

## Slice 19: 銘柄詳細の本物データ化 / lightweight-charts

### 対象
- 銘柄詳細画面のモック価格 / モック指標回収
- R2 の current 日足履歴と IndexedDB の軽量データを使った表示
- full historical を IndexedDB に全量保存せず、必要な銘柄だけ都度取得する導線
- lightweight-charts によるローソク足 / 出来高表示
- 25MA / 75MA
- 直近高値ライン
- 買値 / 損切りライン
- 最新価格、通貨、為替、import 状態の表示
- 保有登録 / 編集画面への実データ導線

### 非対象
- 購入シミュレーションの高度化
- Push 通知
- 分足 / リアルタイム価格

### 完了条件
- 銘柄詳細が本物の日足データで表示される
- モックチャートとモック指標が残っていない
- full historical を全量同期しなくても銘柄詳細が成立する
- 価格データが空の銘柄でも画面が破綻しない
- モバイル幅とデスクトップ幅でチャートが視認可能

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- チャート用データ変換のユニットテストを追加
- 検索 / スクリーニング / ポートフォリオから銘柄詳細への導線確認

---

## Slice 20: ホームの本物データ化

### 対象
- ホーム画面のモックカード回収
- データ最終更新日
- import job 状態
- `latest summary` に基づく最新価格・軽量サマリー表示
- 保有サマリー
- 今日見る候補
- 最新 dataset version と同期状態の案内
- 主要導線の本物データ接続

### 非対象
- Push 通知
- PWA installable 対応
- 高度なダッシュボード分析

### 完了条件
- ホームが保存済み市場データ / 保有データ / import 状態を反映する
- モック値が残っていない
- データ未取得、取り込み待ち、保有未登録の状態が扱える
- モバイル幅とデスクトップ幅で主要カードと導線が破綻しない

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- ホーム表示用集約ロジックのユニットテストを追加
- ホーム → 検索 / スクリーニング / 銘柄詳細 / ポートフォリオの導線確認

---

## Slice 21: スクリーニング完全本物化

### 対象
- スクリーニング画面に残る暫定表示の回収
- bulk 由来の全対象銘柄ランキング
- `latest summary` または同等の軽量配信データを使ったランキング生成 / 表示
- 株式 / ETF を含む対象 universe
- 価格欠損 / 為替欠損 / 未対応銘柄の除外または表示状態
- 市場 / 通貨 / 商品種別フィルタ
- ランキング更新日時の表示

### 非対象
- Push 通知
- 高度なスクリーニング条件編集
- リアルタイム価格

### 完了条件
- スクリーニングが bulk 更新済みの本物 universe で動く
- 静的候補や暫定候補が残っていない
- 欠損銘柄をエラーにせず扱える
- モバイル幅とデスクトップ幅でランキングが破綻しない

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- universe フィルタのユニットテストを追加
- ランキング表示の確認
- スクリーニング → 銘柄詳細の導線確認

---

## Slice 22: PWA 最小基盤

### 対象
- Web App Manifest
- アプリアイコン
- `theme_color` / `background_color`
- `display: standalone`
- Service Worker 登録
- 最小限の app shell / assets cache
- オフライン時の最低限の fallback

### 非対象
- Push 通知
- IndexedDB 同期
- 外部データ取得
- バックグラウンド同期
- 日次データのオフライン完全対応

### 完了条件
- アプリとしてインストール可能な構成になっている
- 初回読み込み後、基本 shell がキャッシュされる
- オフライン時に最低限の fallback が表示される
- モバイル幅とデスクトップ幅で起動表示が破綻しない

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- Manifest が取得できる
- Service Worker が登録される
- オフライン時の fallback 確認
- モバイル幅 / デスクトップ幅で起動確認

---

## Slice 23: Push 購読

### 対象
- 通知許可導線
- 購読取得
- 購読登録 API 接続

### 非対象
- 通知送信本体

### 完了条件
- Push 購読を保存できる

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- API 接続部の確認
- 通知許可導線の手動確認

---

## Slice 24: 通知送信

### 対象
- 日次更新通知
- 候補通知
- ウォッチ通知

### 非対象
- 高度な通知設定

### 完了条件
- 最小通知が送れる

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- 通知メッセージ生成ロジックのテストを追加

---

## Slice 25: 仕上げと QA

### 対象
- UI 微調整
- E2E の追加
- エラー状態改善
- ドキュメント更新

### 完了条件
- MVP として一通り使える
- 主要画面がモバイル幅とデスクトップ幅の両方で崩れない
- 既知の崩れや制約が文書化されている

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`
- 主要導線の E2E が揃っている

### E2E 方針
- この Slice は E2E 対象 Slice とする
- 主要導線の E2E を整備する
  - ホーム → 銘柄詳細
  - 検索 → 銘柄詳細
  - スクリーニング → 銘柄詳細
  - ポートフォリオ → リバランス提案 → 購入シミュレーション

---

## Slice 26: ローカル開発環境の Docker 分離

### 対象
- Docker Compose によるローカル開発環境の追加
- Supabase の代替となるローカル DB の用意
- Cloudflare R2 の代替となるローカル object storage の用意
- Vercel Functions の代替となるローカル API 実行環境の整理
- ローカル環境用の env 切り替え
- ローカル import / API / 画面確認フローの文書化

### 非対象
- MVP 本線の新機能追加
- 本番クラウド構成の変更
- 新しい画面追加
- Push 通知や PWA 機能の拡張

---

## Slice 27: runtime 境界整理と構成リファクタ

### 対象
- 機能変更なしの構成リファクタ
- server / client / worker の runtime 境界整理
- `api/*` から参照する server-side コードの配置整理
- package 境界の見直しと必要な共通ロジックの package 移設
- bundler / module 解決方針の見直し
- Node ESM runtime 前提での import / build / deploy 構成整理
- setup / architecture 文書の更新

### 非対象
- UI / UX の変更
- 新しい機能追加
- データモデル変更
- API 契約変更
- import / screening / notification など既存機能の挙動変更

### 完了条件
- ユーザーから見える挙動が変わっていない
- `api/*` / worker / app の runtime 境界が今より明確になっている
- deep relative import や runtime 依存の曖昧な import が整理されている
- package 境界と bundler 方針が文書で説明できる
- Vercel / Mac worker / ローカル開発の各実行経路で import 解決が安定している

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- 主要 API の疎通確認
- 主要画面の smoke 確認
- 既存の import / worker / 通知導線で挙動差分がないことを確認

### 完了条件
- Docker を使ってローカルだけで DB / object storage / API を起動できる
- ローカル import 処理と最新データ API が、クラウド環境を触らずに確認できる
- ローカル env とクラウド env の切り替え方法が明記されている
- 本番データを汚さずに主要導線を確認できる

### テスト / 確認観点
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- Docker 起動手順の確認
- ローカル import から画面表示までの手動確認
- クラウド環境を使わずに主要 API が応答することを確認
