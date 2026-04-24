# データ配信基盤メモ

Slice 14 では、手動 bulk 取り込みから画面表示までのデータ配信責務を明文化する。
ここでは「どこに何を保存するか」「更新後にどうやって端末へ届くか」「PC とスマホがどう同じ版へ追従するか」をまとめる。

## 目的

- Cloudflare R2、Supabase、IndexedDB の責務を混同しない
- 手動取り込み処理が端末キャッシュへ直接書けない前提をはっきりさせる
- 価格履歴、最新価格、保有情報、import job 状態の正本保存先を固定する
- ZIP を扱うのは管理画面だけで、各端末は version を見て再同期する方針を定義する
- 主要画面のモック回収順序を Slice に結び付ける

## 正本保存先の整理

| データ | 主な用途 | 正本保存先 | 端末側キャッシュ | 補足 |
| --- | --- | --- | --- | --- |
| 正規化済み価格履歴 | 銘柄詳細チャート、履歴参照 | Cloudflare R2 | IndexedDB | 重い履歴ファイルなので DB に全件保存しない |
| latest manifest | 最新 run の参照先特定 | Cloudflare R2 | なし | API は manifest を起点に履歴ファイルを引く |
| 銘柄マスタ | 検索、一覧、市場 / 通貨 / 商品種別表示 | Supabase | IndexedDB | `sourceSymbol`、商品種別、import 状態を持つ |
| 最新価格 | ホーム、検索、一覧、ポートフォリオ軽量表示 | Supabase | IndexedDB | 毎回 R2 の重い履歴を読まないための表示キャッシュ |
| 計算済み指標 / ランキング | スクリーニング、候補一覧、ホーム要約 | Supabase | IndexedDB | 市場データ取り込み時に再計算する値 |
| import job 状態 / dataset version | 管理画面、同期判定、最終更新表示 | Supabase | IndexedDB | 各端末は version を見て必要時だけ再同期する |
| 保有情報 / 現金 / ウォッチリスト | 端末間共有したい個人データ | Supabase | IndexedDB | サーバー側を正とし、IndexedDB は表示高速化用 |
| UI 計算結果 | ポートフォリオ評価、リバランス、購入シミュレーション | 永続保存しない | メモリ / IndexedDB 元データから再計算 | ユーザー保有に依存するため、画面表示時に再計算する |

## 手動取り込みから画面表示までの流れ

1. 管理者が Stooq から市場別 bulk ZIP を手動取得する
2. 管理画面から ZIP をアップロードする
3. Function が受け取った ZIP を株式 / ETF / REIT の universe に正規化する
4. 正規化済み価格履歴を Cloudflare R2 の `runs/{runId}/...` に保存する
5. 銘柄マスタ、最新価格、計算済み指標、ランキング、import job 状態、R2 manifest 参照を Supabase に保存する
6. 成功時のみ latest manifest と dataset version を新しい run に差し替える
7. PWA / Web が起動時または画面表示時に最新データ配信 API を呼ぶ
8. API が Supabase の軽量データ、latest manifest、dataset version をもとに必要なレスポンスを返す
9. クライアントが受け取ったデータを、その端末の IndexedDB にキャッシュする
10. 各画面は IndexedDB のキャッシュを先に表示し、必要に応じて最新データへ差し替える

## bulk 入力前提

- MVP の入力 ZIP は `jp` / `us` / `uk` / `hk` / `world` の 5 系統を第一候補にする
- `jp` / `us` / `uk` / `hk` は株式系市場データ、`world` は為替入力元として扱う
- `world` では `currencies` 配下を為替対象とし、JPY 換算に使う通貨ペアを抽出する
- ZIP 展開後は対象カテゴリ配下を再帰的に走査し、下位フォルダを含めて `.txt` を収集する
- 直下に `.txt` があるカテゴリと、`1/`, `2/` などの分割フォルダ配下に `.txt` があるカテゴリの両方を許容する
- 商品種別の一次判定はフォルダ名で行い、元の分類名は `stooqCategory` として保持する
- 画面やドメイン計算で使う商品種別は `securityType` として正規化し、MVP では `stock` / `etf` / `currency` を基本に扱う
- `stooqCategory` と `securityType` を分けることで、Stooq 側の分類差分を残したままアプリ内の扱いを統一する
- 実 ZIP の fixture を確認するまでは、各市場の対象カテゴリは暫定扱いとし、追加の実物確認で確定する
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

## 商品種別の正規化方針

- `securityType` は Stooq の生分類をそのまま信じるのではなく、アプリ内で使うための正規化済み種別として保持する
- 一次判定はフォルダ名で行う
  - 例: `tse stocks` -> `stock`
  - 例: `tse etfs` -> `etf`
  - 例: `world/currencies` -> `currency`
- 米国 / 英国 / 香港のように市場ごとの分類差分がありうるため、最終的な `securityType` 対応は fixture 確認後に確定する
- `lse stocks intl` と `hkex reits` は存在確認済みだが、MVP では自動判定対象にも取り込み対象にも含めない
- フォルダ名だけで `stock` / `etf` / `currency` を安全に判定できない市場やカテゴリは、`stooqCategory` を保持したうえで別途マスタ補完または対象外判定を行う

## 実 ZIP fixture で追加確認したい観点

- 日本:
  - `tse stocks` 以外に MVP 対象へ含めるべき `stocks` / `etfs` 系カテゴリがないか
  - 直下配置と `1/`, `2/` などの分割フォルダ配置が混在していないか
- 米国:
  - `nasdaq` / `nyse` / `nysemkt` 以外に MVP 対象へ含めるべき `stocks` / `etfs` 系カテゴリがないか
  - 小数出来高や小数価格をそのまま扱えるか
- 英国:
  - `lse stocks intl` を除外したままで MVP が成立するか
  - `.uk` 銘柄で通貨や市場表示に追加補完が必要か
- 香港:
  - `hkex reits` を除外したままで MVP が成立するか
  - 先頭 0 付きコードをファイル名とアプリ内コードでどう対応付けるか
- world:
  - JPY 換算に必要な通貨ペアが `currencies` 配下のどこまでで揃うか
  - 逆数計算が必要な通貨ペアと、そのまま使える通貨ペアをどう切り分けるか
- 共通:
  - 空ファイル、ヘッダーのみファイル、欠損行をどう扱うか
  - ファイルパスから市場 / `stooqCategory` / `securityType` を一意に決められるか
  - 銘柄コードと銘柄名を結び付ける追加マスタが必要か
## なぜ最新価格を Supabase に置くか

- ホーム、検索、ポートフォリオ、候補一覧の表示では「各銘柄の直近 1 点」があれば足りることが多い
- そのたびに R2 の大きい履歴ファイルを API 側で読みに行くと、I/O とレスポンスが重くなる
- そのため、重い履歴は R2、軽い一覧表示用の latest 値は Supabase へ分ける
- 銘柄詳細の履歴チャートのように series が必要な画面だけ、latest manifest から R2 を参照する

## 何を取り込み時に保存し、何を画面で計算するか

### 取り込み時に保存するもの

- 銘柄マスタ
- 最新価格
- 為替 latest 値
- 市場全体向けの計算済み指標
- スクリーニング順位や候補ランキング
- import job 状態
- R2 manifest 参照

### 画面で再計算するもの

- 保有評価額
- 含み損益
- 現金込み構成比
- リバランス改善度
- 購入シミュレーションの Before / After

理由:
- これらはユーザーの保有情報や入力値に依存する
- サーバー側で全ユーザー分を事前計算するより、画面表示時に最新保有と latest 値から計算するほうが MVP に合う

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

## モック回収順序

| 画面 | モック回収 Slice | 前提 |
| --- | --- | --- |
| 検索 | Slice 18 | 銘柄マスタ配信 API と IndexedDB キャッシュ |
| 銘柄詳細 | Slice 19 | R2 履歴参照、latest manifest、IndexedDB キャッシュ |
| ホーム | Slice 20 | 最新価格、dataset version、保有サマリー API |
| スクリーニング | Slice 21 | bulk 由来の universe、計算済み指標、ランキング |

補足:
- ポートフォリオ、リバランス、購入シミュレーションは Slice 12 / 13 時点で IndexedDB ベースの実計算に入っている
- ただし保有同期とサーバー保存の本線は Slice 16 以降で扱う

## Slice 14 の結論

- 重い履歴は Cloudflare R2
- 検索 / 一覧 / import job 状態 / 個人データは Supabase
- 表示高速化とオフライン寄りのキャッシュは IndexedDB
- 手動 bulk 取り込みはサーバー側保存先を更新し、端末へは API 経由で配信する
- 端末同期は dataset version を見て必要時だけ自動で行う
