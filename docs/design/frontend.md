# フロント設計

## 画面構成

- HomePage
- SearchPage
- ScreeningPage
- PortfolioPage
- StockDetailPage
- HoldingFormPage
- RebalancePage
- SimulationPage

## feature 単位

- stock-search
- stock-detail
- screening
- portfolio
- holdings
- rebalance
- simulation
- notifications
- data-sync

## 状態管理方針

- サーバー / 同期データは TanStack Query
- ローカル永続データは IndexedDB
- 画面内の一時状態は React state を基本とする
- グローバル状態管理ライブラリは必要最小限にとどめる

## IndexedDB 方針

Store 例:
- symbols
- dailyPrices
- exchangeRates
- holdings
- cash
- screeningResults
- watchlist

## チャート方針

- lightweight-charts を利用
- ローソク足
- 25MA / 75MA
- 出来高
- 直近高値ライン
- 買値 / 損切りライン

## 円グラフ方針

- Recharts を利用
- 銘柄別構成比
- 現金込み構成比
- Before / After 切替

## UI 方針

- スマホ縦画面を主対象にする
- デスクトップ幅でも崩れずに使えるようにする
- 1画面1目的を崩さない
- 最重要操作は下部固定ボタンを優先する
- 下タブは 4 つまでに抑える
- 保有登録 / 編集は下タブに増やさず、銘柄詳細とポートフォリオから遷移する
- 市場選択は検索や保有登録で使うが、主要下タブは増やさない
- ポートフォリオは JPY を基準通貨にし、外貨建て保有は評価額の換算状態を表示する

## 画面確認基準

- モバイル幅: 390px 前後
- デスクトップ幅: 1280px 以上

少なくとも上記 2 条件で、主要画面のレイアウト崩れがないことを確認する。

## レスポンシブ完了条件

以下を満たす場合に、画面崩れなしとみなす。

- 主要情報が欠けない
- 主要ボタンが画面外にはみ出さない
- 主要操作が隠れない
- 不要な横スクロールが発生しない
- カードや一覧の余白が極端に崩れない
- チャート、円グラフ、フォームが視認可能な大きさを保つ
