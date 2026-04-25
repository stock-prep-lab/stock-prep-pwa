# データ配信基盤メモ

Slice 14 では、手動 bulk 取り込みから画面表示までのデータ配信責務を明文化する。
ここでは「どこに何を保存するか」「更新後にどうやって端末へ届くか」「PC とスマホがどう同じ版へ追従するか」をまとめる。

## 目的

- Cloudflare R2、Supabase、IndexedDB の責務を混同しない
- 手動取り込み処理が端末キャッシュへ直接書けない前提をはっきりさせる
- ZIP を扱うのは管理画面だけで、各端末は version を見て再同期する方針を定義する
- 無料枠を優先し、R2 は 1 世代管理、Supabase は軽量データだけに絞る方針を固定する
- 管理画面、`import_jobs`、Mac `launchd` worker の役割分担を明記する

## 保存責務の確定版

| データ | 主な用途 | 正本保存先 | 端末側キャッシュ | 補足 |
| --- | --- | --- | --- | --- |
| raw ZIP | 手動取り込みの入力原本 | Cloudflare R2 | なし | 一時保存のみ。取り込み成功後に削除する |
| `full historical` | 銘柄詳細チャート、履歴参照 | Cloudflare R2 | なし | `stocks` / `etfs` / `currencies` のみ。全量を IndexedDB に保存しない |
| `latest summary` | ホーム、検索、一覧、ポートフォリオ軽量表示 | Cloudflare R2 | IndexedDB | latest 値だけを軽量配信する |
| `manifest` | 最新 dataset / scope の参照先特定 | Cloudflare R2 | なし | API と Mac worker は manifest を起点に対象ファイルを解決する |
| `dataset_state` | 同期判定、最終更新表示、現在の正本状態確認 | Supabase | なし | `ready` / `importing` / `failed` と scope ごとの状態を持つ |
| `import_jobs` | 管理画面、Mac worker への取り込み依頼票 | Supabase | なし | `queued` / `processing` / `completed` / `failed` を保持する |
| `holdings` / `cash` / `watchlist` | 端末間共有したい個人データ | Supabase | IndexedDB | サーバー側を正とし、IndexedDB は表示高速化用に使う |
| UI 計算結果 | ポートフォリオ評価、リバランス、購入シミュレーション | 永続保存しない | メモリ / IndexedDB 元データから再計算 | ユーザー保有に依存するため、画面表示時に再計算する |

## 容量の目安

| 保存先 | 保存するもの | 目安 |
| --- | --- | --- |
| Cloudflare R2 | raw ZIP 一時保存、`full historical`、`latest summary`、`manifest` | 約 4〜8GB |
| Supabase | `dataset_state`、`import_jobs`、`holdings`、`cash`、`watchlist` | 数MB〜数十MB、多く見ても 100MB 前後 |
| IndexedDB | `holdings`、`cash`、`watchlist`、`syncState`、必要最小限の `latest summary` | 数MB〜数十MB |

補足:

- R2 は raw ZIP の一時保存を含めても 1 世代管理の 10GB 未満を狙う
- Supabase には全銘柄 latest snapshot や full historical を保存しない
- IndexedDB には閲覧済み銘柄 history cache も保存しない

## 手動取り込みから画面表示までの流れ

1. 管理者が Stooq から市場別 bulk ZIP を手動取得する
2. 管理画面から ZIP をアップロードし、raw ZIP を Cloudflare R2 へ保存する
3. Supabase に `import_jobs` を `queued` で作成する
4. Mac `launchd` worker が `import_jobs` を拾い、対象 ZIP を R2 から取得する
5. worker が ZIP を展開し、`stocks` / `etfs` / `currencies` を正規化する
6. worker が対象 scope の旧データを先に削除し、新しい `full historical` と `latest summary` を R2 に保存する
7. worker が `dataset_state` と `import_jobs` を Supabase へ更新する
8. worker が raw ZIP を削除する
9. PWA / Web が起動時または前面復帰時に最新データ配信 API を呼ぶ
10. API が Supabase の `dataset_state` と R2 の `manifest` をもとに必要なレスポンスを返す
11. クライアントが受け取った軽量データを、その端末の IndexedDB にキャッシュする
12. 各画面は IndexedDB のキャッシュを先に表示し、履歴が必要なときだけ R2 由来の API を参照する

## bulk 入力前提

- MVP の入力 ZIP は `jp` / `us` / `uk` / `hk` / `world` の 5 系統を第一候補にする
- `jp` / `us` / `uk` / `hk` は株式系市場データ、`world` は為替入力元として扱う
- `world` では `currencies` 配下を為替対象とし、JPY 換算に使う通貨ペアを抽出する
- ZIP 展開後は対象カテゴリ配下を再帰的に走査し、下位フォルダを含めて `.txt` を収集する
- 直下に `.txt` があるカテゴリと、`1/`, `2/` などの分割フォルダ配下に `.txt` があるカテゴリの両方を許容する
- 商品種別の一次判定はフォルダ名で行い、元の分類名は `stooqCategory` として保持する
- 画面やドメイン計算で使う商品種別は `securityType` として正規化し、MVP では `stock` / `etf` / `currency` を基本に扱う
- `stooqCategory` と `securityType` を分けることで、Stooq 側の分類差分を残したままアプリ内の扱いを統一する
- MVP の取り込み対象カテゴリは `stocks` / `etfs` / `currencies` を基本とし、`lse stocks intl` と `hkex reits` は取り込み対象から外す

## 確認済み実物構成

現時点で確認済みの ZIP 展開後構成は以下。

### 為替

- 例: `/data/daily/world/currencies/major/jpyusd.txt`
- 為替 `.txt` はヘッダー付き CSV 形式で、少なくとも次の列順を持つ
  - `<TICKER>,<PER>,<DATE>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>,<OPENINT>`
- 例:
  - `JPYUSD,D,19710104,000000,0.002795,0.002795,0.002795,0.002795,0,0`
- MVP では `world/currencies` 配下から JPY 換算に必要な通貨ペアを抽出する

### 日本 ETF

- 例: `/data/daily/jp/tse etfs/162a.jp.txt`
- `tse etfs` はカテゴリ直下に `.txt` があるケースを許容する
- ヘッダーは為替と同じ CSV 形式

### 日本普通株

- 例: `/data/daily/jp/tse stocks/1/130a.jp.txt`
- `tse stocks` は `1/`, `2/` などの下位フォルダ配下に `.txt` があるケースを許容する
- そのため importer は対象カテゴリ直下だけでなく、下位フォルダを含めて再帰的に `.txt` を収集する

### 米国

- 対象候補:
  - `/data/daily/us/nasdaq etfs`
  - `/data/daily/us/nasdaq stocks`
  - `/data/daily/us/nyse etfs`
  - `/data/daily/us/nyse stocks`
  - `/data/daily/us/nysemkt etfs`
  - `/data/daily/us/nysemkt stocks`
- 各カテゴリ配下は、直下に `.txt` があるケースと、`1/`, `2/` などの下位フォルダ配下に `.txt` があるケースの両方を許容する
- ヘッダーは日本 / 為替と同じ CSV 形式

### 英国

- 対象候補:
  - `/data/daily/uk/lse etfs`
  - `/data/daily/uk/lse stocks`
- `/data/daily/uk/lse stocks intl` は意味づけ未確定のため、MVP では取り込み対象から外す
- 各カテゴリ配下は、直下に `.txt` があるケースと、`1/`, `2/` などの下位フォルダ配下に `.txt` があるケースの両方を許容する
- ヘッダーは日本 / 為替と同じ CSV 形式

### 香港

- 対象候補:
  - `/data/daily/hk/hkex etfs`
  - `/data/daily/hk/hkex stocks`
- `/data/daily/hk/hkex reits` は存在確認済みだが、MVP では取り込み対象から外す
- 各カテゴリ配下は、直下に `.txt` があるケースと、`1/`, `2/` などの下位フォルダ配下に `.txt` があるケースの両方を許容する
- ヘッダーは日本 / 為替と同じ CSV 形式

## `dataset_state` と `import_jobs` の役割

### `dataset_state`

- 現在どの dataset が正なのかを示す
- 現在の状態が `ready` / `importing` / `failed` のどれかを示す
- クライアントの local version と比較して、再同期が必要かを判断する基準になる

### `import_jobs`

- 管理画面から作られる取り込み依頼票
- Mac `launchd` worker が `queued` job を拾うためのキュー
- 進捗、失敗理由、完了状態を管理画面へ返す

## なぜ `latest summary` を R2 に置くか

- ホーム、検索、ポートフォリオ、候補一覧の表示では「各銘柄の直近 1 点」があれば足りることが多い
- そのたびに R2 の大きい履歴ファイルから latest を都度走査すると、I/O とレスポンスが重くなる
- そのため、重い履歴は R2 の `full historical`、軽い一覧表示用の latest 値は同じく R2 の `latest summary` へ分ける
- Supabase を状態管理と個人データに絞ることで、無料枠 500MB を使い切りにくくする

## 端末再同期の位置づけ

- ZIP を扱うのは管理画面だけで、PC やスマホの通常画面は ZIP を扱わない
- 各端末は起動時または前面復帰時に dataset version を確認する
- サーバー側の version が新しい場合だけ、その端末の IndexedDB を更新する
- PC とスマホは互いに直接同期せず、同じサーバー版へ別々に追従する

## IndexedDB の扱い

- IndexedDB は端末ごとのローカルキャッシュであって、サーバー側の正本ではない
- 同じアプリ URL でも、Mac Chrome、iPhone Safari、iPhone のホーム画面追加 PWA は別保存領域になる
- Function はユーザー端末の IndexedDB へ直接書き込まない
- サーバー更新後のデータは、API を通して「端末が開かれたとき」にその端末の IndexedDB へ届く
- IndexedDB は `holdings` / `cash` / `watchlist` / `syncState` / 必要最小限の `latest summary` のみを持つ
- 閲覧済み銘柄の history cache と全銘柄 full historical は IndexedDB へ保存しない

## モック回収順序

| 画面 | モック回収 Slice | 前提 |
| --- | --- | --- |
| 検索 | Slice 18 | R2 の `latest summary` と IndexedDB 軽量キャッシュ |
| 銘柄詳細 | Slice 19 | R2 履歴参照、manifest、オンデマンド取得 |
| ホーム | Slice 20 | `latest summary`、dataset version、保有サマリー API |
| スクリーニング | Slice 21 | bulk 由来の universe とランキング |

補足:

- ポートフォリオ、リバランス、購入シミュレーションは Slice 12 / 13 時点で IndexedDB ベースの実計算に入っている
- ただし保有同期とサーバー保存の本線は Slice 16 以降で扱う

## Slice 14 の結論

- 重い履歴と latest summary は Cloudflare R2
- 状態管理と個人データは Supabase
- 表示高速化とオフライン寄りのキャッシュは軽量な IndexedDB のみ
- 手動 bulk 取り込みは raw ZIP を R2 に置き、Mac worker が正規化して保存先を更新する
- 端末同期は dataset version を見て必要時だけ自動で行う
