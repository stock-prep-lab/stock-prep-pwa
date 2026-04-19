# データ要件

## 外部データ

### データソース
- 第一候補は Stooq CSV
- プログラムから Stooq CSV download endpoint を取得するには Stooq の API key が必要
- API key は Stooq の `get_apikey` 導線で取得する
- CSV download endpoint は `https://stooq.com/q/d/l/?s={sourceSymbol}&i=d&apikey={apikey}` 形式を使う
- 全市場の universe 取り込みでは、Stooq の daily ASCII bulk data も候補にする
- Stooq bulk download は認証コード導線を挟む可能性があるため、cron から無人で直接取得できるかは実装前に検証する
- bulk download を cron から直接取得できない場合は、対象銘柄マスタに対して個別 CSV を分割取得する
- API key は環境変数で扱い、リポジトリには保存しない
- 取得可否は Stooq 側の銘柄 / 市場対応に依存する
- 未対応銘柄は取り込み失敗として扱い、アプリ側で状態を保持する

### 対象市場
- 日本株
- 米国株
- 英国株
- 香港株

### 対象商品
- 株式
- ETF
- REIT

### MVP で対象外にする商品
- 先物
- オプション
- 債券
- 指数
- 暗号資産
- DRS / CBBC / DWS などの派生的な商品カテゴリ

### Stooq bulk 取り込み方針
- 市場別の daily ASCII bulk を日本 / 米国 / 英国 / 香港に分けて取り込む
- Vercel Cron は市場ごとに時間をずらして起動する
- bulk 内の Stooq カテゴリから、株式 / ETF / REIT のみを保存対象にする
- ETF は Stooq 上の `tse etfs` / `nasdaq etfs` / `nyse etfs` / `lse etfs` / `hkex etfs` などを対象にする
- REIT は Stooq 上で独立カテゴリがある場合は対象にし、独立カテゴリがない市場では銘柄マスタ側の商品種別で分類する
- 空の価格ファイルは取り込み失敗ではなく、価格データなし状態として保存する
- 壊れたファイル、想定外の列形式、ネットワーク失敗は取り込み失敗として扱う

### Stooq symbol 方針
- アプリ内の銘柄コードと Stooq 取得用 symbol を分けて保持する
- 市場ごとの suffix を銘柄マスタで管理する
- 例: 米国株 `AAPL.US`
- 例: 英国株 `AV.UK`
- 例: 香港株 `0700.HK`
- 為替は Stooq の通貨ペア symbol を保持する
  - 例: `USDJPY`
  - 例: `GBPJPY`
  - 例: `HKDJPY`

### 価格データ
- 日付
- 銘柄コード
- 市場
- 商品種別
- Stooq symbol
- 通貨
- 始値
- 高値
- 安値
- 終値
- 出来高

### 為替日次
- date
- pair
- baseCurrency
- quoteCurrency
- open
- high
- low
- close
- source
- sourceSymbol

### ポートフォリオ評価
- 基準通貨は JPY
- 外貨建て保有は評価日時点の為替レートで JPY 換算する
- 為替レートが取得できない場合は評価不能状態として扱う
- 高度な為替損益分解は MVP では扱わない

### 制約
- 日次データ中心
- 取得範囲は外部データソース依存
- 全銘柄完全保証は前提にしない
- 価格系列中心の分析を優先する
- 外貨建て保有の評価額と構成比は為替レートに依存する

## アプリ内データ

### 銘柄マスタ
- code
- name
- market
- currency
- instrumentType
- source
- sourceSymbol
- enabled
- importStatus
- lastImportError

### 日次価格
- code
- market
- date
- open
- high
- low
- close
- volume
- source

### 為替レート
- pair
- date
- close
- source
- sourceSymbol

### 保有銘柄
- code
- market
- currency
- quantity
- averagePrice
- memo
- updatedAt

### 現金
- amount
- currency
- updatedAt

### スクリーニング結果
- code
- ranking
- reason
- computedAt

### ウォッチリスト
- code
- enabledNotification
- createdAt

### Push 通知購読
- endpoint
- p256dh
- auth
- enabledTypes
- createdAt
