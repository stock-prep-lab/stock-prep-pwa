# データ要件

## 外部データ

### 価格データ
- 日付
- 銘柄コード
- 始値
- 高値
- 安値
- 終値
- 出来高

### 制約
- 日次データ中心
- 取得範囲は外部データソース依存
- 全銘柄完全保証は前提にしない
- 価格系列中心の分析を優先する

## アプリ内データ

### 銘柄マスタ
- code
- name

### 日次価格
- code
- date
- open
- high
- low
- close
- volume

### 保有銘柄
- code
- quantity
- averagePrice

### 現金
- amount

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
