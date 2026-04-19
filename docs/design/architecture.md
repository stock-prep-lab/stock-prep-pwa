# アーキテクチャ設計

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
- DB 候補は Postgres 系のサービスや Supabase / Neon などを比較して決める
- 大きな bulk data の原本や中間ファイルは、必要に応じて object storage を検討する

### 外部データ
- Stooq CSV を第一候補にする
- Stooq API key は Vercel 環境変数で管理する
- Stooq CSV download endpoint には `apikey` parameter を付与する
- 取得対象は日本株を主軸に、米国株、英国株、香港株も同じ日足取り込み基盤で扱う
- 投資対象商品は株式 / ETF / REIT を MVP の universe に含める
- 先物 / オプション / 債券 / 指数 / 暗号資産 / 派生的な商品カテゴリは MVP では保存対象外にする
- 全市場 universe は Stooq の daily ASCII bulk data を候補にし、直接取得できない場合は銘柄マスタに対する個別 CSV 取得へフォールバックする
- bulk data は `.txt` 形式の解析を行い、個別 CSV 取得は手動更新、失敗銘柄の再取得、bulk 取得不可時の fallback に使う
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
