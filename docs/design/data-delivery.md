# データ配信基盤メモ

Slice 14 では、cron から画面表示までのデータ配信責務を明文化する。
ここでは「どこに何を保存するか」「更新後にどうやって端末へ届くか」「失敗時の fallback をどう扱うか」をまとめる。

## 目的

- Cloudflare R2、Supabase、IndexedDB の責務を混同しない
- cron が端末キャッシュへ直接書けない前提をはっきりさせる
- 価格履歴、最新価格、保有情報、失敗状態の正本保存先を固定する
- 個別 CSV fallback を通常経路ではなく手動再取得の補助経路として定義する
- 主要画面のモック回収順序を Slice に結び付ける

## 正本保存先の整理

| データ | 主な用途 | 正本保存先 | 端末側キャッシュ | 補足 |
| --- | --- | --- | --- | --- |
| 正規化済み価格履歴 | 銘柄詳細チャート、履歴参照 | Cloudflare R2 | IndexedDB | 重い履歴ファイルなので DB に全件保存しない |
| latest manifest | 最新 run の参照先特定 | Cloudflare R2 | なし | API は manifest を起点に履歴ファイルを引く |
| 銘柄マスタ | 検索、一覧、市場 / 通貨 / 商品種別表示 | Supabase | IndexedDB | `sourceSymbol`、商品種別、import 状態を持つ |
| 最新価格 | ホーム、検索、一覧、ポートフォリオ軽量表示 | Supabase | IndexedDB | 毎回 R2 の重い履歴を読まないための表示キャッシュ |
| 計算済み指標 / ランキング | スクリーニング、候補一覧、ホーム要約 | Supabase | IndexedDB | cron で市場全体に対して再計算する値 |
| 取り込み失敗状態 | 警告表示、再取り込み対象判定 | Supabase | IndexedDB | `failed`、`noData`、`unsupported` などを保持する |
| 保有情報 / 現金 / ウォッチリスト | 端末間共有したい個人データ | Supabase | IndexedDB | サーバー側を正とし、IndexedDB は表示高速化用 |
| UI 計算結果 | ポートフォリオ評価、リバランス、購入シミュレーション | 永続保存しない | メモリ / IndexedDB 元データから再計算 | ユーザー保有に依存するため、画面表示時に再計算する |

## cron から画面表示までの流れ

1. Vercel Cron が市場別 Function を起動する
2. Function が Stooq bulk data と為替を取得する
3. 取得結果を株式 / ETF / REIT の universe に正規化する
4. 正規化済み価格履歴を Cloudflare R2 の `runs/{runId}/...` に保存する
5. 銘柄マスタ、最新価格、計算済み指標、ランキング、失敗状態、R2 manifest 参照を Supabase に保存する
6. 成功時のみ latest manifest を新しい run に差し替える
7. PWA / Web が起動時または画面表示時に最新データ配信 API を呼ぶ
8. API が Supabase の軽量データと latest manifest をもとに必要なレスポンスを返す
9. クライアントが受け取ったデータを、その端末の IndexedDB にキャッシュする
10. 各画面は IndexedDB のキャッシュを先に表示し、必要に応じて最新データへ差し替える

## なぜ最新価格を Supabase に置くか

- ホーム、検索、ポートフォリオ、候補一覧の表示では「各銘柄の直近 1 点」があれば足りることが多い
- そのたびに R2 の大きい履歴ファイルを API 側で読みに行くと、I/O とレスポンスが重くなる
- そのため、重い履歴は R2、軽い一覧表示用の latest 値は Supabase へ分ける
- 銘柄詳細の履歴チャートのように series が必要な画面だけ、latest manifest から R2 を参照する

## 何を cron で保存し、何を画面で計算するか

### cron で保存するもの

- 銘柄マスタ
- 最新価格
- 為替 latest 値
- 市場全体向けの計算済み指標
- スクリーニング順位や候補ランキング
- 取り込み失敗状態
- R2 manifest 参照

### 画面で再計算するもの

- 保有評価額
- 含み損益
- 現金込み構成比
- リバランス改善度
- 購入シミュレーションの Before / After

理由:
- これらはユーザーの保有情報や入力値に依存する
- cron で全ユーザー分を事前計算するより、画面表示時に最新保有と latest 値から計算するほうが MVP に合う

## 個別 CSV fallback の位置づけ

- 個別 CSV fallback は通常の日次取り込み経路ではない
- cron で bulk 取得不可、bulk 内欠損、銘柄単位失敗が起きたときの補助経路として使う
- cron 失敗時に自動で大量の個別 CSV をばらまいて取りに行く運用はしない
- まず Supabase に失敗状態を保存し、ホームや銘柄詳細で再取り込みボタンを表示する
- ユーザーが再取り込みを実行したときだけ、対象 `sourceSymbol` に対して個別 CSV endpoint を呼ぶ
- 取得成功時は通常価格と同じ正規化形式へ寄せ、失敗状態を更新する
- `noData` はエラーではなく「価格データなし」状態として扱う

## IndexedDB の扱い

- IndexedDB は端末ごとのローカルキャッシュであって、サーバー側の正本ではない
- 同じアプリ URL でも、Mac Chrome、iPhone Safari、iPhone のホーム画面追加 PWA は別保存領域になる
- Vercel Cron や Function はユーザー端末の IndexedDB へ直接書き込まない
- サーバー更新後のデータは、API を通して「端末が開かれたとき」にその端末の IndexedDB へ届く

## モック回収順序

| 画面 | モック回収 Slice | 前提 |
| --- | --- | --- |
| 検索 | Slice 18 | 銘柄マスタ配信 API と IndexedDB キャッシュ |
| 銘柄詳細 | Slice 19 | R2 履歴参照、latest manifest、IndexedDB キャッシュ |
| ホーム | Slice 20 | 最新価格、失敗状態、保有サマリー API |
| スクリーニング | Slice 21 | bulk 由来の universe、計算済み指標、ランキング |

補足:
- ポートフォリオ、リバランス、購入シミュレーションは Slice 12 / 13 時点で IndexedDB ベースの実計算に入っている
- ただし保有同期とサーバー保存の本線は Slice 16 以降で扱う

## Slice 14 の結論

- 重い履歴は Cloudflare R2
- 検索 / 一覧 / 失敗状態 / 個人データは Supabase
- 表示高速化とオフライン寄りのキャッシュは IndexedDB
- cron の更新はサーバー側保存先を更新し、端末へは API 経由で配信する
- 個別 CSV fallback は失敗銘柄の手動再取り込み用に限定する
